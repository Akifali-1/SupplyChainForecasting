const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

function processRawCSV(rawFilePath, companyId) {
  return new Promise((resolve, reject) => {
    const nodesMap = new Map();
    const edges = [];
    const salesData = [];
    const demandLongRows = [];
    const rawRows = [];
    let baseWideMode = false;
    let productColumns = [];

    fs.createReadStream(rawFilePath)
      .pipe(csv())
      .on("data", (row) => {
        // Pre-clean: skip blank rows and normalize numeric strings like "2,950" -> "2950"
        if (!row || Object.values(row).every(v => String(v || '').trim() === '')) {
          return;
        }
        for (const key of Object.keys(row)) {
          const val = row[key];
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed === '') continue;
            // Remove thousand separators and normalize decimals
            const normalized = trimmed.replace(/,/g, '');
            if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
              row[key] = normalized;
            }
          }
        }
        // Debug log disabled to reduce noise
        rawRows.push(row);
        // Detect base-wide format: has Date column and many product columns
        if (!baseWideMode) {
          const keys = Object.keys(row);
          const dateKey = keys.find(k => String(k).toLowerCase() === 'date' || String(k).toLowerCase() === 'timestamp');
          if (dateKey) {
            // Consider product columns as all non-date fields with numeric-like values
            const candidates = keys.filter(k => k !== dateKey);
            const numericCandidates = candidates.filter(k => {
              const val = row[k];
              const num = parseFloat(val);
              return !isNaN(num);
            });
            if (numericCandidates.length >= 3) {
              baseWideMode = true;
              productColumns = numericCandidates;
            }
          }
        }

        if (baseWideMode) {
          // While in base-wide mode, incrementally build nodes/edges/long demand
          const keys = Object.keys(row);
          const dateKey = keys.find(k => String(k).toLowerCase() === 'date' || String(k).toLowerCase() === 'timestamp');
          const plantKey = keys.find(k => ['plant','Plant','factory','supplier'].includes(k));
          const node1Key = keys.find(k => ['node1','source','source_id','from'].includes(k));
          const node2Key = keys.find(k => ['node2','target','target_id','to'].includes(k));
          const dateVal = dateKey ? String(row[dateKey]).split(' ')[0] : undefined;
          // Determine product keys as numeric columns excluding routing columns
          const productKeys = keys.filter(k => ![dateKey, plantKey, node1Key, node2Key].includes(k))
            .filter(k => {
              const num = parseFloat(String(row[k]).replace(/,/g, ''));
              return !isNaN(num);
            });

          // Ensure route endpoint nodes
          const plantVal = plantKey ? row[plantKey] : undefined;
          const node1Val = node1Key ? row[node1Key] : undefined;
          const node2Val = node2Key ? row[node2Key] : undefined;
          if (plantVal && !nodesMap.has(String(plantVal))) nodesMap.set(String(plantVal), { node_id: String(plantVal), node_type: 'plant', company: companyId });
          if (node1Val && !nodesMap.has(String(node1Val))) nodesMap.set(String(node1Val), { node_id: String(node1Val), node_type: 'distributor', company: companyId });
          if (node2Val && !nodesMap.has(String(node2Val))) nodesMap.set(String(node2Val), { node_id: String(node2Val), node_type: 'store', company: companyId });
          if (plantVal && node1Val) edges.push({ source_id: String(plantVal), target_id: String(node1Val) });
          if (node1Val && node2Val) edges.push({ source_id: String(node1Val), target_id: String(node2Val) });

          // Add product nodes and long-format demand
          productKeys.forEach(pk => {
            if (!nodesMap.has(pk)) nodesMap.set(pk, { node_id: pk, node_type: 'store', company: companyId, product: pk });
            const v = parseFloat(String(row[pk]).replace(/,/g, ''));
            if (dateVal && !isNaN(v)) {
              demandLongRows.push({ node_id: pk, type: 'store', date: dateVal, demand: v });
            }
          });
          return;
        }
        
        // Flexible column mapping for different formats
        const nodeId = row.Node || row.node || row.node_id || row.product || row.product_id;
        const plant = row.Plant || row.plant || row.factory || row.supplier;
        const node1 = row.node1 || row.source || row.source_id || row.from;
        const node2 = row.node2 || row.target || row.target_id || row.to;
        
        // Extract time series sales data (t1, t2, t3, etc.)
        const timeSeriesData = {};
        let hasTimeSeriesData = false;
        
        // Look for time series columns (t1, t2, t3, ... or period1, period2, etc.)
        Object.keys(row).forEach(key => {
          if (key.match(/^t\d+$/i) || key.match(/^period\d+$/i) || key.match(/^sales\d+$/i) || key.match(/^month\d+$/i)) {
            const value = parseFloat(row[key]);
            if (!isNaN(value)) {
              timeSeriesData[key.toLowerCase()] = value;
              hasTimeSeriesData = true;
            }
          }
        });

        // Skip rows without essential data
        if (!nodeId) {
          console.log("Skipping row - missing node identifier:", row);
          return;
        }

        // Add main node
        if (!nodesMap.has(nodeId)) {
          // Determine node type from naming patterns or explicit type column
          let nodeType = row.type || row.node_type || "store"; // Default to store for products
          if (nodeType === "unknown" || nodeType === "store") {
            if (nodeId.toLowerCase().includes("store") || nodeId.toLowerCase().includes("retail")) {
              nodeType = "store";
            } else if (nodeId.toLowerCase().includes("fac") || nodeId.toLowerCase().includes("plant")) {
              nodeType = "factory";
            } else if (nodeId.toLowerCase().includes("sup") || nodeId.toLowerCase().includes("supplier")) {
              nodeType = "supplier";
            } else if (nodeId.toLowerCase().includes("dist") || nodeId.toLowerCase().includes("warehouse")) {
              nodeType = "distributor";
            } else {
              // For product names, default to store (end consumer)
              nodeType = "store";
            }
          }
          
          nodesMap.set(nodeId, {
            node_id: nodeId,
            node_type: nodeType,
            company: companyId,
            product: nodeId // Use node_id as product for now
          });
        }

        // Add plant/supplier node if exists
        if (plant && !nodesMap.has(plant)) {
          nodesMap.set(plant, {
            node_id: plant,
            node_type: "supplier",
            company: companyId,
            product: nodeId
          });
        }

        // Add node1 if exists
        if (node1 && !nodesMap.has(node1)) {
          let node1Type = "supplier";
          if (node1.toLowerCase().includes("fac")) node1Type = "factory";
          if (node1.toLowerCase().includes("dist")) node1Type = "distributor";
          
          nodesMap.set(node1, {
            node_id: node1,
            node_type: node1Type,
            company: companyId,
            product: nodeId
          });
        }

        // Add node2 if exists
        if (node2 && !nodesMap.has(node2)) {
          let node2Type = "store";
          if (node2.toLowerCase().includes("fac")) node2Type = "factory";
          if (node2.toLowerCase().includes("dist")) node2Type = "distributor";
          
          nodesMap.set(node2, {
            node_id: node2,
            node_type: node2Type,
            company: companyId,
            product: nodeId
          });
        }

        // Create edges based on available relationships
        if (plant && node1) {
          edges.push({
            source_id: plant,
            target_id: node1,
            edge_type: "supply"
          });
        }
        if (node1 && node2) {
          edges.push({
            source_id: node1,
            target_id: node2,
            edge_type: "ship"
          });
        }
        if (plant && nodeId && plant !== nodeId) {
          edges.push({
            source_id: plant,
            target_id: nodeId,
            edge_type: "produce"
          });
        }

        // Add sales data if time series exists
        if (hasTimeSeriesData) {
          // Wide row (kept for compatibility)
          salesData.push({
            node_id: nodeId,
            type: nodesMap.get(nodeId).node_type,
            ...timeSeriesData
          });
          // Also append long-format rows with synthetic monthly dates
          const keys = Object.keys(timeSeriesData).sort((a,b) => {
            const ai = parseInt(a.replace(/\D/g, '')) || 0;
            const bi = parseInt(b.replace(/\D/g, '')) || 0;
            return ai - bi;
          });
          keys.forEach((k, idx) => {
            const month = String((idx % 12) + 1).padStart(2, '0');
            const year = 2024 + Math.floor(idx / 12);
            demandLongRows.push({
              node_id: nodeId,
              type: nodesMap.get(nodeId).node_type,
              date: `${year}-${month}-01`,
              demand: timeSeriesData[k]
            });
          });
        }
      })
      .on("end", () => {
        console.log("CSV processing complete");
        console.log("Nodes found:", nodesMap.size);
        console.log("Edges found:", edges.length);
        console.log("Sales records found (long-format):", demandLongRows.length, "(wide-format):", salesData.length);

        // If base-wide format detected, build nodes and long-format demand from rawRows
        if (baseWideMode) {
          try {
            // Nodes are product column names
            productColumns.forEach(col => {
              if (!nodesMap.has(col)) {
                nodesMap.set(col, {
                  node_id: col,
                  node_type: 'store',
                  company: companyId,
                  product: col
                });
              }
            });
            // Demand long rows with actual dates from the file
            const dateKey = Object.keys(rawRows[0]).find(k => String(k).toLowerCase() === 'date' || String(k).toLowerCase() === 'timestamp');
            rawRows.forEach(r => {
              const dateVal = r[dateKey];
              productColumns.forEach(col => {
                const v = parseFloat(r[col]);
                if (!isNaN(v)) {
                  demandLongRows.push({
                    node_id: col,
                    type: 'store',
                    date: String(dateVal).split(' ')[0],
                    demand: v
                  });
                }
              });
              // Also extract edges if edge columns present on the same row
              const node1Key = ['node1','source','source_id','from'].find(k => k in r);
              const node2Key = ['node2','target','target_id','to'].find(k => k in r);
              const plantKey = ['plant','Plant','factory','supplier'].find(k => k in r);
              const node1Val = node1Key ? r[node1Key] : undefined;
              const node2Val = node2Key ? r[node2Key] : undefined;
              const plantVal = plantKey ? r[plantKey] : undefined;
              // Ensure graph contains all endpoints as nodes
              if (plantVal && !nodesMap.has(String(plantVal))) {
                nodesMap.set(String(plantVal), {
                  node_id: String(plantVal),
                  node_type: 'plant',
                  company: companyId
                });
              }
              if (node1Val && !nodesMap.has(String(node1Val))) {
                nodesMap.set(String(node1Val), {
                  node_id: String(node1Val),
                  node_type: 'distributor',
                  company: companyId
                });
              }
              if (node2Val && !nodesMap.has(String(node2Val))) {
                nodesMap.set(String(node2Val), {
                  node_id: String(node2Val),
                  node_type: 'store',
                  company: companyId
                });
              }
              if (plantVal && node1Val) {
                edges.push({ source_id: String(plantVal), target_id: String(node1Val) });
              }
              if (node1Val && node2Val) {
                edges.push({ source_id: String(node1Val), target_id: String(node2Val) });
              }
              if (plantVal && !node1Val && productColumns.length > 0) {
                // connect plant directly to first product node as a minimal link
                edges.push({ source_id: String(plantVal), target_id: String(productColumns[0]) });
              }
            });
          } catch (e) {
            console.error('Error transforming base-wide format:', e);
            return reject(e);
          }
        }
        
        const outputDir = path.join(__dirname, "../uploads", companyId);
        fs.mkdirSync(outputDir, { recursive: true });

        const nodes = Array.from(nodesMap.values());

        // Write the three required files
        fs.writeFileSync(path.join(outputDir, "nodes.csv"), toCSV(nodes));
        fs.writeFileSync(path.join(outputDir, "edges.csv"), toCSV(edges));
        // Prefer long-format demand for alignment with base model; fall back to wide if no long rows
        const demandOutput = demandLongRows.length > 0 ? demandLongRows : salesData;
        fs.writeFileSync(path.join(outputDir, "demand.csv"), toCSV(demandOutput));

        resolve({
          nodes: `uploads/${companyId}/nodes.csv`,
          edges: `uploads/${companyId}/edges.csv`,
          demand: `uploads/${companyId}/demand.csv`,
        });
      })
      .on("error", (error) => {
        console.error("CSV processing error:", error);
        reject(error);
      });
  });
}

function toCSV(data) {
  if (data.length === 0) return "";
  const keys = Object.keys(data[0]);
  const rows = data.map((row) => keys.map((k) => row[k]).join(","));
  return keys.join(",") + "\n" + rows.join("\n");
}

module.exports = { processRawCSV };
