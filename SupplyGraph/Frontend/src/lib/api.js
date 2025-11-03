const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

// Add a simple logger utility with timestamp
const logger = {
  info: (context, message, data) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [INFO] [${context}] ${message}`, data || '');
    }
  },
  warn: (context, message, data) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.warn(`[${timestamp}] [WARN] [${context}] ${message}`, data || '');
    }
  },
  error: (context, message, data) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [ERROR] [${context}] ${message}`, data || '');
    }
  }
};

export async function registerCompany(name) {
  logger.info('API', 'Registering company', { name });
  const res = await fetch(`${API_BASE}/api/company/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error("Failed to register company");
  return res.json();
}

export async function convertRaw(companyId, file) {
  logger.info('API', 'Converting raw file', { companyId, fileName: file.name, fileSize: file.size });
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/data/convert/${companyId}`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'File conversion failed', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }

  const result = await res.json();
  logger.info('API', 'File conversion completed', result);
  return result;
}

export async function fineTune(companyId, nodes, edges, demand) {
  logger.info('API', 'Starting fine-tuning process', { companyId, nodes, edges, demand });
  const res = await fetch(`${API_BASE}/api/ml/fine-tune/${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges, demand })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Fine-tuning initiation failed', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }

  const result = await res.json();
  logger.info('API', 'Fine-tuning process started', result);
  return result;
}

export async function getTrainingStatus(companyId) {
  logger.info('API', 'Fetching training status', { companyId });
  const res = await fetch(`${API_BASE}/api/ml/training-status/${companyId}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to fetch training status', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }

  const result = await res.json();
  logger.info('API', 'Training status fetched', result);
  return result;
}

export async function predict(companyId, input_data) {
  logger.info('API', 'Making prediction', { companyId, input_data_length: input_data?.length });
  const res = await fetch(`${API_BASE}/api/ml/predict/${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_data })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Prediction failed', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }

  const result = await res.json();
  logger.info('API', 'Prediction completed', {
    hasPrediction: !!result?.prediction,
    hasSuccess: result?.success,
    responseKeys: Object.keys(result || {})
  });
  return result;
}

export async function getModelInfo(companyId) {
  logger.info('API', 'Fetching model info', { companyId });
  const res = await fetch(`${API_BASE}/api/ml/model-info/${companyId}`);
  if (!res.ok) {
    logger.error('API', 'Failed to fetch model info', { status: res.status });
    throw new Error("Failed to get model info");
  }
  const result = await res.json();
  logger.info('API', 'Model info fetched', {
    modelType: result?.model_type,
    createdAt: result?.created_at,
    featureCount: result?.feature_columns?.length
  });
  return result;
}

export async function getHealth() {
  logger.info('API', 'Checking API health');
  const res = await fetch(`${API_BASE}/api/health`);
  const result = await res.json();
  logger.info('API', 'API health check completed', result);
  return result;
}

export async function createSample(companyId, size = "small") {
  logger.info('API', 'Creating sample dataset', { companyId, size });
  const res = await fetch(`${API_BASE}/api/ml/create-sample/${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size })
  });
  if (!res.ok) {
    logger.error('API', 'Failed to create sample dataset', { status: res.status });
    throw new Error("Failed to create sample");
  }
  const result = await res.json();
  logger.info('API', 'Sample dataset created', result);
  return result;
}

// OAuth Authentication Functions
export async function getCurrentUser() {
  logger.info('API', 'Fetching current user');
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    method: "GET",
    credentials: "include" // Important for session-based auth
  });
  if (!res.ok) {
    logger.error('API', 'Failed to fetch current user', { status: res.status });
    throw new Error("Failed to get current user");
  }
  const result = await res.json();
  logger.info('API', 'Current user fetched', result);
  return result;
}

export async function logout() {
  logger.info('API', 'Logging out user');
  const res = await fetch(`${API_BASE}/api/auth/logout`, {
    method: "GET",
    credentials: "include"
  });
  if (!res.ok) {
    logger.error('API', 'Logout failed', { status: res.status });
    throw new Error("Failed to logout");
  }
  const result = await res.json();
  logger.info('API', 'Logout successful', result);
  return result;
}

export function getGoogleAuthUrl() {
  logger.info('API', 'Getting Google auth URL');
  return `${API_BASE}/api/auth/google`;
}

export async function getHistoricalData(companyId, product, intervalDays) {
  logger.info('API', 'Fetching historical data', { companyId, product, intervalDays });
  const qp = new URLSearchParams();
  if (product) qp.set('product', product);
  if (intervalDays) qp.set('intervalDays', String(intervalDays));
  const res = await fetch(`${API_BASE}/api/ml/historical-data/${companyId}?${qp.toString()}`, {
    method: "GET",
    credentials: "include"
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to fetch historical data', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }
  const result = await res.json();
  logger.info('API', 'Historical data fetched', { recordCount: result.historical_data?.length || 0 });
  return result;
}

// Inventory Management APIs
export async function getTrendingInventory(companyId, timeRange = '30d') {
  logger.info('API', 'Fetching trending inventory', { companyId, timeRange });
  const res = await fetch(`${API_BASE}/api/ml/inventory/trending/${companyId}?timeRange=${timeRange}`, {
    method: "GET",
    credentials: "include"
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to fetch trending inventory', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }

  const result = await res.json();
  logger.info('API', 'Trending inventory fetched', { itemCount: result.trending_items?.length || 0 });
  return result;
}

export async function getInventoryAnalytics(companyId) {
  logger.info('API', 'Fetching inventory analytics', { companyId });
  const res = await fetch(`${API_BASE}/api/ml/inventory/analytics/${companyId}`, {
    method: "GET",
    credentials: "include"
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to fetch inventory analytics', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }

  const result = await res.json();
  logger.info('API', 'Inventory analytics fetched', result);
  return result;
}