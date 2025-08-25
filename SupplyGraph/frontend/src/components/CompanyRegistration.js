import React, { useState } from "react";
import { registerCompany } from "../services/api";
import "./CompanyRegistration.css";

export default function CompanyRegistration({ onRegister }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const company = await registerCompany(name);
      alert(`Company registered: ${company.name}`);
      setName("");
      if (onRegister) onRegister(company);
    } catch (err) {
      console.error("Registration failed:", err);
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div className="registration-container">
      <h2>Register Company</h2>
      <form onSubmit={handleSubmit} className="registration-form">
        <input
          type="text"
          placeholder="Enter company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">Register</button>
      </form>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
