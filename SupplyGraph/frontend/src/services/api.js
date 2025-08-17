import axios from "axios";

const API_BASE = "http://localhost:5000/api";

// Register a new company
export const registerCompany = async (name) => {
  try {
    const res = await axios.post(`${API_BASE}/company/register`, { name });
    return res.data;
  } catch (err) {
    console.error("Error registering company:", err.response?.data || err.message);
    throw err;
  }
};

// Upload raw CSV file → backend converts into nodes.csv, edges.csv, demand.csv
export const uploadRawFile = async (companyId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await axios.post(`${API_BASE}/data/convert/${companyId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (err) {
    console.error("Error uploading raw file:", err.response?.data || err.message);
    throw err;
  }
};

// Upload processed CSVs (nodes, edges, demand)
export const uploadProcessedFiles = async (companyId, files) => {
  const formData = new FormData();
  if (files.nodes) formData.append("nodes", files.nodes);
  if (files.edges) formData.append("edges", files.edges);
  if (files.demand) formData.append("demand", files.demand);

  try {
    const res = await axios.post(`${API_BASE}/company/upload/${companyId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (err) {
    console.error("Error uploading processed files:", err.response?.data || err.message);
    throw err;
  }
};

// Fetch all companies with status = "pending" (admin use, not user-facing)
export const getPendingCompanies = async () => {
  try {
    const res = await axios.get(`${API_BASE}/company/pending`);
    return res.data;
  } catch (err) {
    console.error("Error fetching pending companies:", err.response?.data || err.message);
    throw err;
  }
};

// Fetch details of a single company by ID (for logged-in company dashboard)
export const getCompanyById = async (companyId) => {
  try {
    const res = await axios.get(`${API_BASE}/company/${companyId}`);
    return res.data;
  } catch (err) {
    console.error("Error fetching company:", err.response?.data || err.message);
    throw err;
  }
};

// Query the model for demand forecast (after training)
export const forecastQuery = async (companyId, query) => {
  try {
    const res = await axios.post(`${API_BASE}/predict/${companyId}`, query);
    return res.data;
  } catch (err) {
    console.error("Error running forecast query:", err.response?.data || err.message);
    throw err;
  }
};
