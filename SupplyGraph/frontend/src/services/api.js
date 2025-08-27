import axios from "axios";

const API_BASE = "http://localhost:5000/api";

// Company: register by name
export const registerCompany = async (name) => {
  const { data } = await axios.post(`${API_BASE}/company/register`, { name });
  return data;
};

// Health
export const health = async () => {
  const { data } = await axios.get(`${API_BASE}/health`);
  return data;
};

// Upload raw CSV → backend converts into nodes.csv, edges.csv, demand.csv
export const uploadRawFile = async (companyId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await axios.post(`${API_BASE}/data/convert/${companyId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

// ML: create sample dataset on disk for a company
export const createSample = async (companyId, size = "small") => {
  const { data } = await axios.post(`${API_BASE}/ml/create-sample/${companyId}`, { size });
  return data;
};

// ML: fine-tune with paths
export const fineTune = async (companyId, { nodes, edges, demand }) => {
  const { data } = await axios.post(`${API_BASE}/ml/fine-tune/${companyId}`, {
    nodes,
    edges,
    demand,
  });
  return data;
};

// ML: training status
export const getTrainingStatus = async (companyId) => {
  const { data } = await axios.get(`${API_BASE}/ml/training-status/${companyId}`);
  return data;
};

// ML: predict
export const predict = async (companyId, input_data) => {
  const { data } = await axios.post(`${API_BASE}/ml/predict/${companyId}`, { input_data });
  return data;
};

// ML: model info
export const getModelInfo = async (companyId) => {
  const { data } = await axios.get(`${API_BASE}/ml/model-info/${companyId}`);
  return data;
};
