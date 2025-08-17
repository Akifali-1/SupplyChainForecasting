import React, { useEffect, useState } from "react";
import { getCompanyById } from "../services/api";

export default function StatusDisplay({ companyId }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return; // don’t fetch until companyId exists

    const fetchCompany = async () => {
      try {
        const data = await getCompanyById(companyId);
        setCompany(data);
      } catch (err) {
        console.error("Error fetching company status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [companyId]);

  if (loading) return <p>Loading company status...</p>;

  if (!company) return <p>No company data found.</p>;

  return (
    <div>
      <h2>Company Status</h2>
      <p>
        <strong>{company.name}</strong> → {company.status}
      </p>
    </div>
  );
}
