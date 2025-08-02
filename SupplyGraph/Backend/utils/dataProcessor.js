const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

function processRawCSV(rawFilePath, companyId) {
  return new Promise((resolve, reject) => {
    const nodesMap = new Map();
    const edges = [];
    const demand = [];

    fs.createReadStream(rawFilePath)
      .pipe(csv())
      .on("data", (row) => {
        const source = row.source;
        const target = row.target;
        const sourceType = row.source_type || "unknown";
        const targetType = row.target_type || "unknown";
        const product = row.product || "default";
        const demandVal = row.demand;

        // Add nodes uniquely
        if (!nodesMap.has(source)) {
          nodesMap.set(source, {
            node_id: source,
            node_type: sourceType,
            company: companyId,
            product: product,
          });
        }
        if (!nodesMap.has(target)) {
          nodesMap.set(target, {
            node_id: target,
            node_type: targetType,
            company: companyId,
            product: product,
          });
        }

        // Add edge
        edges.push({
          source_id: source,
          target_id: target,
          edge_type: "ship",
          company: companyId,
          product: product,
        });

        // Add demand if target is a store and demand value exists
        if (
          (targetType.toLowerCase() === "store" || target.toLowerCase().includes("store")) &&
          demandVal
        ) {
          demand.push({
            store_id: target,
            product: product,
            demand: demandVal,
          });
        }
      })
      .on("end", () => {
        const outputDir = path.join(__dirname, "../uploads", companyId);
        fs.mkdirSync(outputDir, { recursive: true });

        const nodes = Array.from(nodesMap.values());

        fs.writeFileSync(path.join(outputDir, "nodes.csv"), toCSV(nodes));
        fs.writeFileSync(path.join(outputDir, "edges.csv"), toCSV(edges));
        fs.writeFileSync(path.join(outputDir, "demand.csv"), toCSV(demand));

        resolve({
          nodes: `uploads/${companyId}/nodes.csv`,
          edges: `uploads/${companyId}/edges.csv`,
          demand: `uploads/${companyId}/demand.csv`,
        });
      })
      .on("error", reject);
  });
}

function toCSV(data) {
  if (data.length === 0) return "";
  const keys = Object.keys(data[0]);
  const rows = data.map((row) => keys.map((k) => row[k]).join(","));
  return keys.join(",") + "\n" + rows.join("\n");
}

module.exports = { processRawCSV };
