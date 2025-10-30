const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export async function registerCompany(name) {
  const res = await fetch(`${API_BASE}/api/company/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error("Failed to register company");
  return res.json();
}

export async function convertRaw(companyId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/data/convert/${companyId}`, {
    method: "POST",
    body: formData
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMessage);
  }
  
  return res.json();
}

export async function fineTune(companyId, nodes, edges, demand) {
  const res = await fetch(`${API_BASE}/api/ml/fine-tune/${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges, demand })
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMessage);
  }
  
  return res.json();
}

export async function getTrainingStatus(companyId) {
  const res = await fetch(`${API_BASE}/api/ml/training-status/${companyId}`);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMessage);
  }
  
  return res.json();
}

export async function predict(companyId, input_data) {
  const res = await fetch(`${API_BASE}/api/ml/predict/${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_data })
  });
  if (!res.ok) throw new Error("Failed to generate prediction");
  return res.json();
}

export async function getModelInfo(companyId) {
  const res = await fetch(`${API_BASE}/api/ml/model-info/${companyId}`);
  if (!res.ok) throw new Error("Failed to get model info");
  return res.json();
}

export async function getHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}

export async function createSample(companyId, size = "small") {
  const res = await fetch(`${API_BASE}/api/ml/create-sample/${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size })
  });
  if (!res.ok) throw new Error("Failed to create sample");
  return res.json();
}

// OAuth Authentication Functions
export async function getCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    method: "GET",
    credentials: "include" // Important for session-based auth
  });
  if (!res.ok) throw new Error("Failed to get current user");
  return res.json();
}

export async function logout() {
  const res = await fetch(`${API_BASE}/api/auth/logout`, {
    method: "GET",
    credentials: "include"
  });
  if (!res.ok) throw new Error("Failed to logout");
  return res.json();
}

export function getGoogleAuthUrl() {
  return `${API_BASE}/api/auth/google`;
}

export async function getHistoricalData(companyId) {
  const res = await fetch(`${API_BASE}/api/ml/historical-data/${companyId}`, {
    method: "GET",
    credentials: "include"
  });
  if (!res.ok) throw new Error("Failed to get historical data");
  return res.json();
}

// Inventory Management APIs
export async function getTrendingInventory(companyId, timeRange = '30d') {
  const res = await fetch(`${API_BASE}/api/ml/inventory/trending/${companyId}?timeRange=${timeRange}`, {
    method: "GET",
    credentials: "include"
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMessage);
  }
  
  return res.json();
}

export async function getInventoryAnalytics(companyId) {
  const res = await fetch(`${API_BASE}/api/ml/inventory/analytics/${companyId}`, {
    method: "GET",
    credentials: "include"
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMessage);
  }
  
  return res.json();
}


