import React, { useState } from "react";
import { uploadRawFile, createSample, fineTune } from "../services/api";

export default function FileUpload({ companyId }) {
  const [rawFile, setRawFile] = useState(null);
  const [nodesPath, setNodesPath] = useState("");
  const [edgesPath, setEdgesPath] = useState("");
  const [demandPath, setDemandPath] = useState("");

  const handleRawUpload = async () => {
    if (!rawFile) return alert("Select a raw CSV");
    try {
      const res = await uploadRawFile(companyId, rawFile);
      setNodesPath(res.files.nodes);
      setEdgesPath(res.files.edges);
      setDemandPath(res.files.demand);
      alert("Raw file processed. Paths populated.");
    } catch (e) {
      console.error(e);
      alert("Raw upload failed");
    }
  };

  const handleCreateSample = async () => {
    try {
      const res = await createSample(companyId, "small");
      setNodesPath(res.file_paths.nodes);
      setEdgesPath(res.file_paths.edges);
      setDemandPath(res.file_paths.demand);
      alert("Sample created. Paths populated.");
    } catch (e) {
      console.error(e);
      alert("Sample creation failed");
    }
  };

  const handleFineTune = async () => {
    if (!nodesPath || !edgesPath || !demandPath) return alert("Set nodes/edges/demand paths first");
    try {
      await fineTune(companyId, { nodes: nodesPath, edges: edgesPath, demand: demandPath });
      alert("Fine-tuning started/completed. Check training status.");
    } catch (e) {
      console.error(e);
      alert("Fine-tuning failed");
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
        <h4>Option 2: Use Sample or Manual Paths</h4>
        <button onClick={handleCreateSample}>Create Sample (small)</button>
        <label>nodes path</label>
        <input type="text" value={nodesPath} onChange={(e) => setNodesPath(e.target.value)} placeholder="uploads/<companyId>/nodes.csv" />
        <label>edges path</label>
        <input type="text" value={edgesPath} onChange={(e) => setEdgesPath(e.target.value)} placeholder="uploads/<companyId>/edges.csv" />
        <label>demand path</label>
        <input type="text" value={demandPath} onChange={(e) => setDemandPath(e.target.value)} placeholder="uploads/<companyId>/demand.csv" />
        <button onClick={handleFineTune}>Start Fine-Tune</button>
      </div>
    </div>
  );
}
