import React, { useState } from "react";
import { uploadRawFile, uploadProcessedFiles } from "../services/api";

export default function FileUpload({ companyId }) {
  const [rawFile, setRawFile] = useState(null);
  const [nodesFile, setNodesFile] = useState(null);
  const [edgesFile, setEdgesFile] = useState(null);
  const [demandFile, setDemandFile] = useState(null);

  const handleRawUpload = async () => {
    if (!rawFile) return alert("Select a raw CSV");
    try {
      await uploadRawFile(companyId, rawFile);
      alert("Raw file uploaded & processed into nodes/edges/demand");
    } catch (e) {
      console.error(e);
      alert("Raw upload failed");
    }
  };

  const handleProcessedUpload = async () => {
    if (!nodesFile || !edgesFile || !demandFile)
      return alert("Upload nodes.csv, edges.csv, demand.csv");
    try {
      await uploadProcessedFiles(companyId, {
        nodes: nodesFile,
        edges: edgesFile,
        demand: demandFile,
      });
      alert("Processed files uploaded");
    } catch (e) {
      console.error(e);
      alert("Processed upload failed");
    }
  };

  return (
    <div className="file-upload">
      <h3>Upload Dataset</h3>

      <div className="panel">
        <h4>Option 1: Upload Raw CSV (Auto-Process)</h4>
        <input type="file" accept=".csv" onChange={(e) => setRawFile(e.target.files[0])} />
        <button onClick={handleRawUpload}>Upload & Process</button>
      </div>

      <div className="panel">
        <h4>Option 2: Upload Pre-processed Files</h4>
        <label>nodes.csv</label>
        <input type="file" accept=".csv" onChange={(e) => setNodesFile(e.target.files[0])} />
        <label>edges.csv</label>
        <input type="file" accept=".csv" onChange={(e) => setEdgesFile(e.target.files[0])} />
        <label>demand.csv</label>
        <input type="file" accept=".csv" onChange={(e) => setDemandFile(e.target.files[0])} />
        <button onClick={handleProcessedUpload}>Upload All</button>
      </div>
    </div>
  );
}
