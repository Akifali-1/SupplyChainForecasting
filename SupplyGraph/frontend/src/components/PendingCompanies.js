// src/components/PendingCompanies.js
import React, { useEffect, useState } from "react";
import { getPendingCompanies } from "../services/api";

export default function PendingCompanies() {
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const data = await getPendingCompanies();
        setCompanies(data);
      } catch (err) {
        console.error("Failed to fetch pending companies:", err);
      }
    };
    fetchCompanies();
  }, []);

  return (
    <div>
      <h2>Pending Companies</h2>
      <ul>
        {companies.length === 0 ? (
          <li>No pending companies</li>
        ) : (
          companies.map((c) => <li key={c._id}>{c.name} - {c.status}</li>)
        )}
      </ul>
    </div>
  );
}
