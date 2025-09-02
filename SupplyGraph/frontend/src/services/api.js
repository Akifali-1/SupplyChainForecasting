import axios from "axios";

const API_BASE = "http://localhost:5000/api";

// Always send cookies (needed for session-based Google OAuth)
axios.defaults.withCredentials = true;

/* -------------------- AUTH -------------------- */

// Get currently logged-in user (returns null if not logged in)
export const getCurrentUser = async () => {
  const { data } = await axios.get(`${API_BASE}/auth/me`);
  return data;
};

// Logout user
export const logoutUser = async () => {
  const { data } = await axios.get(`${API_BASE}/auth/logout`);
  return data;
};

/* -------------------- COMPANY -------------------- */

// Register company by name (later can be tied to logged-in user)
export const registerCompany = async (name) => {
  const { data } = await axios.post(`${API_BASE}/company/register`, { name });
  return data;
};

/* -------------------- HEALTH -------------------- */
export const health = async () => {
  const { data } = await axios.get(`${API_BASE}/health`);
  return data;
};

/* -------------------- DATA -------------------- */

// Upload raw CSV → backend converts into nodes.csv, edges.csv, demand.csv
export const uploadRawFile = async (companyId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await axios.post(`${API_BASE}/data/convert/${companyId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

/* -------------------- ML -------------------- */

// Create sample dataset
export const createSample = async (companyId, size = "small") => {
  const { data } = await axios.post(`${API_BASE}/ml/create-sample/${companyId}`, { size });
  return data;
};

// Fine-tune model
export const fineTune = async (companyId, { nodes, edges, demand }) => {
  const { data } = await axios.post(`${API_BASE}/ml/fine-tune/${companyId}`, {
    nodes,
    edges,
    demand,
  });
  return data;
};

// Training status
export const getTrainingStatus = async (companyId) => {
  const { data } = await axios.get(`${API_BASE}/ml/training-status/${companyId}`);
  return data;
};

// Predict
export const predict = async (companyId, input_data) => {
  const { data } = await axios.post(`${API_BASE}/ml/predict/${companyId}`, { input_data });
  return data;
};

// Model info
export const getModelInfo = async (companyId) => {
  const { data } = await axios.get(`${API_BASE}/ml/model-info/${companyId}`);
  return data;
};
