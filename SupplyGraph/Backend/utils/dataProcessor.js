const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

function processRawCSV(rawFilePath, companyId) {
  return new Promise((resolve, reject) => {
    const nodesMap = new Map();
    const edges = [];
    const salesData = [];

    fs.createReadStream(rawFilePath)
      .pipe(csv())
      .on("data", (row) => {
        console.log("Processing row:", row);
        
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
          salesData.push({
            node_id: nodeId,
            type: nodesMap.get(nodeId).node_type,
            ...timeSeriesData
          });
        }
      })
      .on("end", () => {
        console.log("CSV processing complete");
        console.log("Nodes found:", nodesMap.size);
        console.log("Edges found:", edges.length);
        console.log("Sales records found:", salesData.length);
        
        const outputDir = path.join(__dirname, "../uploads", companyId);
        fs.mkdirSync(outputDir, { recursive: true });

        const nodes = Array.from(nodesMap.values());

        // Write the three required files
        fs.writeFileSync(path.join(outputDir, "nodes.csv"), toCSV(nodes));
        fs.writeFileSync(path.join(outputDir, "edges.csv"), toCSV(edges));
        fs.writeFileSync(path.join(outputDir, "demand.csv"), toCSV(salesData)); // Keep filename as demand.csv for compatibility

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
