import React, { useState } from "react";
import { registerCompany } from "../services/api";
import "./CompanyRegistration.css";

export default function CompanyRegistration({ onRegister }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const company = await registerCompany(name);
      if (onRegister) onRegister(company);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
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
        <button type="submit" disabled={loading}>{loading ? "Creating..." : "Register"}</button>
      </form>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
