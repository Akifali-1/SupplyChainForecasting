import React, { useState } from "react";
import { predict } from "../services/api";

export default function ForecastQuery({ companyId }) {
  const [nodeId, setNodeId] = useState("");
  const [productId, setProductId] = useState("");
  const [horizon, setHorizon] = useState(30);
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    if (!nodeId || !productId) return alert("Enter node & product");
    try {
      const data = await predict(companyId, { nodeId, productId, horizon });
      // Backend returns { prediction: { company_id, prediction: [...], ... } }
      setResult(data?.prediction || data);
    } catch (e) {
      console.error(e);
      alert("Prediction failed (ensure backend /api/ml/predict/:companyId exists)");
    }
  };

  return (
    <div className="forecast-query">
      <h3>Forecast Demand</h3>
      <input
        type="text"
        placeholder="Node ID (e.g. Store_1)"
        value={nodeId}
        onChange={(e) => setNodeId(e.target.value)}
      />
      <input
        type="text"
        placeholder="Product ID (e.g. P101)"
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
      />
      <input
        type="number"
        min="1"
        value={horizon}
        onChange={(e) => setHorizon(Number(e.target.value))}
      />
      <button onClick={handleSubmit}>Get Forecast</button>

      {result && (
        <div className="result">
          <h4>Forecast Result</h4>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
