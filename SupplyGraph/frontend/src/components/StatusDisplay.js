import React, { useEffect, useState, useRef } from "react";
import { getTrainingStatus } from "../services/api";

export default function StatusDisplay({ companyId }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("loading");
  const pollRef = useRef(null);

  useEffect(() => {
    if (!companyId) return; // don’t fetch until companyId exists

    const fetchCompany = async () => {
      try {
        const data = await getTrainingStatus(companyId);
        const status = data?.ml_status?.status || data?.status || "unknown";
        setCompany({ name: companyId, status });
        setStatusText(status);
      } catch (err) {
        console.error("Error fetching company status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();

    // Start short polling until completed
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await getTrainingStatus(companyId);
        const status = data?.ml_status?.status || data?.status || "unknown";
        setCompany({ name: companyId, status });
        setStatusText(status);
        if (status === "completed") {
          clearInterval(pollRef.current);
        }
      } catch (_) {}
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [companyId]);

  if (loading) return <p>Loading company status...</p>;

  if (!company) return <p>No company data found.</p>;

  return (
    <div>
      <h2>Company Status</h2>
      <p>
        <strong>{company.name}</strong> → {company.status}
        <button style={{ marginLeft: 12 }} onClick={() => {
          setLoading(true);
          getTrainingStatus(companyId).then((data) => {
            const status = data?.ml_status?.status || data?.status || "unknown";
            setCompany({ name: companyId, status });
            setStatusText(status);
          }).finally(() => setLoading(false));
        }}>Refresh</button>
      </p>
    </div>
  );
}
