const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

/**
 * Enhanced CSV processor:
 *  - Generates Sales Order.csv (wide: Date + products)
 *  - Generates Edges (Plant).csv (Plant,node1,node2, plus Plant–Product edges)
 *  - Generates nodes.csv (Node,Plant)
 *  - Automatically infers numeric product columns
 *  - Preserves backward compatibility if plant data missing
 */
async function processRawCSV(rawFilePath, companyId) {
  return new Promise((resolve, reject) => {
    const rawRows = [];
    let headers = null;

    fs.createReadStream(rawFilePath)
      .pipe(csv())
      .on("data", (row) => {
        if (!row || Object.values(row).every((v) => String(v || "").trim() === "")) return;
        Object.keys(row).forEach((k) => {
          if (typeof row[k] === "string") {
            const t = row[k].trim();
            row[k] = t.replace(/,/g, "");
            if (row[k] === "") row[k] = null;
          }
        });
        if (!headers) headers = Object.keys(row);
        rawRows.push(row);
      })
      .on("end", () => {
        try {
          if (!rawRows.length) return reject(new Error("No rows found in input CSV"));

          const keys = Object.keys(rawRows[0]);
          const lowerMap = {};
          keys.forEach((k) => (lowerMap[k.toLowerCase()] = k));

          // Detect base columns
          const dateKey =
            lowerMap["date"] ||
            lowerMap["timestamp"] ||
            keys.find((k) => /date|timestamp/i.test(k));
          const plantKey = keys.find((k) => /^(plant|factory|supplier)$/i.test(k));
          const node1Key = keys.find((k) => /^(node1|source|from)$/i.test(k));
          const node2Key = keys.find((k) => /^(node2|target|to)$/i.test(k));

          if (!dateKey) {
            return reject(new Error("No Date/Timestamp column detected in the input CSV"));
          }

          // Identify numeric product columns
          const exclude = new Set([dateKey, plantKey, node1Key, node2Key].filter(Boolean));
          const productCandidates = keys.filter((k) => !exclude.has(k));
          const productCols = productCandidates.filter((col) => {
            let numericCount = 0,
              totalCount = 0;
            for (let i = 0; i < rawRows.length; i++) {
              const v = rawRows[i][col];
              if (v === null || v === undefined || String(v).trim() === "") continue;
              totalCount++;
              if (!Number.isNaN(parseFloat(v))) numericCount++;
              if (totalCount >= 10) break;
            }
            return totalCount > 0 && numericCount / Math.max(1, totalCount) >= 0.5;
          });

          if (productCols.length === 0) {
            return reject(new Error("No numeric product columns detected."));
          }

          // === Build Node List (with Plant association if available)
          const nodesMap = new Map(); // Node -> Plant (if any)
          rawRows.forEach((r) => {
            const plantVal = plantKey ? String(r[plantKey] || "").trim() : "";
            productCols.forEach((p) => {
              if (!nodesMap.has(p)) nodesMap.set(p, plantVal);
            });
          });

          const nodesOut = Array.from(nodesMap.entries()).map(([Node, Plant]) => ({
            Node,
            Plant,
          }));

          // === Aggregate Sales by Date
          const salesByDate = new Map();
          rawRows.forEach((r) => {
            let dateVal = r[dateKey];
            if (!dateVal) return;
            dateVal = String(dateVal).split(" ")[0].trim();
            if (!salesByDate.has(dateVal)) salesByDate.set(dateVal, {});
            const aggRow = salesByDate.get(dateVal);
            productCols.forEach((c) => {
              const v = parseFloat(r[c]);
              if (!Number.isNaN(v)) {
                aggRow[c] = (aggRow[c] || 0) + v;
              }
            });
          });

          const sortedDates = Array.from(salesByDate.keys()).sort(
            (a, b) => new Date(a) - new Date(b)
          );
          const salesWideRows = sortedDates.map((d) => {
            const base = { Date: d };
            const mapRow = salesByDate.get(d) || {};
            productCols.forEach((c) => (base[c] = mapRow[c] || 0));
            return base;
          });

          // === Build Edges (Plant-to-Plant + Plant-to-Product)
          const edges = [];
          const edgesSet = new Set();

          // Original plant connections
          rawRows.forEach((r) => {
            const plantVal = plantKey ? String(r[plantKey] || "").trim() : "";
            const n1 = node1Key ? String(r[node1Key] || "").trim() : "";
            const n2 = node2Key ? String(r[node2Key] || "").trim() : "";
            if (plantVal || n1 || n2)
              edgesSet.add(`${plantVal}|||${n1}|||${n2}`);
          });

          Array.from(edgesSet).forEach((s) => {
            const [Plant, node1, node2] = s.split("|||");
            edges.push({ Plant, node1, node2 });
          });

          // Add Product–Plant bidirectional edges
          nodesOut.forEach(({ Node, Plant }) => {
            if (Plant && Node) {
              edges.push({ Plant, node1: Plant, node2: Node });
              edges.push({ Plant, node1: Node, node2: Plant });
            }
          });


          // === Write output files
          const outDir = path.join(__dirname, "../uploads", companyId);
          fs.mkdirSync(outDir, { recursive: true });

          const salesPath = path.join(outDir, "Sales Order.csv");
          const edgesPath = path.join(outDir, "Edges (Plant).csv");
          const nodesPath = path.join(outDir, "nodes.csv");

          writeWideCSV(salesPath, salesWideRows, ["Date", ...productCols]);
          writeWideCSV(edgesPath, edges, ["Plant", "node1", "node2"]);
          writeWideCSV(nodesPath, nodesOut, ["Node", "Plant"]);

          const salesRelativePath = `uploads/${companyId}/Sales Order.csv`;
          resolve({
            sales: salesRelativePath,
            edges: `uploads/${companyId}/Edges (Plant).csv`,
            nodes: `uploads/${companyId}/nodes.csv`,
            // Backward compatibility alias: downstream logic still expects `demand`
            demand: salesRelativePath,
          });
        } catch (err) {
          reject(err);
        }
      })
      .on("error", (error) => reject(error));
  });
}

/** Helper: write array-of-objects CSV */
function writeWideCSV(filePath, rows, cols) {
  const lines = [];
  lines.push(cols.join(","));
  rows.forEach((r) => {
    const line = cols
      .map((k) => {
        let v = r[k];
        if (v === null || v === undefined) v = "";
        if (String(v).includes(",") || String(v).includes("\n")) {
          return `"${String(v).replace(/"/g, '""')}"`;
        }
        return String(v);
      })
      .join(",");
    lines.push(line);
  });
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

module.exports = { processRawCSV };
