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

// Smart fetch: automatically redirects to /login when session expires (401)
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) {
    // Session expired or cookie is stale — force re-login
    console.warn('[API] Session expired (401). Redirecting to login.');
    window.location.href = '/login?error=session_expired';
    throw new Error('Session expired. Please log in again.');
  }
  return res;
}

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
  logger.info('API', 'Initiating S3 upload & conversion', { companyId, fileName: file.name, fileSize: file.size });
  
  // 1. Request presigned URL from backend
  const uploadUrlRes = await apiFetch(`${API_BASE}/api/data/upload-url/${companyId}?filename=${encodeURIComponent(file.name)}`);
  if (!uploadUrlRes.ok) {
    const errorData = await uploadUrlRes.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `Failed to generate S3 upload URL`;
    throw new Error(errorMessage);
  }
  const { uploadUrl, s3Key } = await uploadUrlRes.json();

  // 2. Upload raw file directly to S3
  logger.info('API', 'Uploading raw file directly to S3 bucket', { s3Key });
  const s3PutRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "text/csv"
    },
    body: file
  });

  if (!s3PutRes.ok) {
    logger.error('API', 'Direct S3 upload failed', { status: s3PutRes.status });
    throw new Error(`Direct S3 upload failed (HTTP ${s3PutRes.status})`);
  }

  // 3. Notify backend to process the file in S3
  logger.info('API', 'Notifying backend to process S3 object', { s3Key });
  const res = await apiFetch(`${API_BASE}/api/data/convert/${companyId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ s3Key, filename: file.name, size: file.size })
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

export async function fineTune(companyId, nodes, edges, demand, forceRetrain = true) {
  logger.info('API', 'Starting fine-tuning process', { companyId, nodes, edges, demand, forceRetrain });
  
  // Generate a unique idempotency key for this specific training request.
  // This prevents the backend's idempotency middleware from aggressively caching
  // the 200 OK response from a previous run (which prevents retraining with identical files).
  const idempotencyKey = `train-${companyId}-${Date.now()}`;
  
  const res = await apiFetch(`${API_BASE}/api/ml/fine-tune/${companyId}`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    // force_retrain=true by default: the user explicitly clicked Train/Retrain,
    // so we must never silently skip training due to a stale existing model.
    body: JSON.stringify({ nodes, edges, demand, force_retrain: forceRetrain })
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
  // Commented out to prevent console spam during 500ms interval polling
  // logger.info('API', 'Fetching training status', { companyId });
  const res = await apiFetch(`${API_BASE}/api/ml/training-status/${companyId}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to fetch training status', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }

  const result = await res.json();
  // Commented out to prevent console spam during 500ms interval polling
  // logger.info('API', 'Training status fetched', result);
  return result;
}

export async function cancelTraining(companyId) {
  logger.info('API', 'Cancelling training', { companyId });
  const res = await apiFetch(`${API_BASE}/api/ml/cancel-training/${companyId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to cancel training', { error: errorMessage, status: res.status });
    throw new Error(errorMessage);
  }

  const result = await res.json();
  logger.info('API', 'Training cancelled', result);
  return result;
}

export async function predict(companyId, input_data, forecastDays = 30) {
  logger.info('API', 'Making prediction', { companyId, input_data_length: input_data?.length, forecastDays });
  const res = await apiFetch(`${API_BASE}/api/ml/predict/${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_data, forecast_days: forecastDays })
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
  const res = await apiFetch(`${API_BASE}/api/ml/model-info/${companyId}`);
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
  const res = await apiFetch(`${API_BASE}/api/ml/create-sample/${companyId}`, {
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
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return `${API_BASE}/api/auth/google?frontendUrl=${encodeURIComponent(origin)}`;
}

export async function getHistoricalData(companyId, product, intervalDays) {
  logger.info('API', 'Fetching historical data', { companyId, product, intervalDays });
  const qp = new URLSearchParams();
  if (product) qp.set('product', product);
  if (intervalDays) qp.set('intervalDays', String(intervalDays));
  const res = await apiFetch(`${API_BASE}/api/ml/historical-data/${companyId}?${qp.toString()}`, {
    method: "GET"
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
  const res = await apiFetch(`${API_BASE}/api/ml/inventory/trending/${companyId}?timeRange=${timeRange}`, {
    method: "GET"
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
  const res = await apiFetch(`${API_BASE}/api/ml/inventory/analytics/${companyId}`, {
    method: "GET"
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

// Invite & Member Management APIs
export async function setupCompany(companyName) {
  logger.info('API', 'Setting up company name', { companyName });
  const res = await apiFetch(`${API_BASE}/api/company/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyName })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function generateInvite() {
  logger.info('API', 'Generating invite token');
  const res = await apiFetch(`${API_BASE}/api/invite/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to generate invite', { error: errorMessage });
    throw new Error(errorMessage);
  }

  return res.json();
}

export async function verifyInvite(token) {
  logger.info('API', 'Verifying invite token', { token });
  const res = await apiFetch(`${API_BASE}/api/invite/verify/${token}`, {
    method: "GET"
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Invite token verification failed', { error: errorMessage });
    throw new Error(errorMessage);
  }

  return res.json();
}

export async function getCompanyMembers() {
  logger.info('API', 'Fetching company members');
  const res = await apiFetch(`${API_BASE}/api/company/members`, {
    method: "GET"
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to fetch company members', { error: errorMessage });
    throw new Error(errorMessage);
  }

  return res.json();
}

export async function revokeMember(userId) {
  logger.info('API', 'Revoking company member access', { userId });
  const res = await apiFetch(`${API_BASE}/api/company/members/${userId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.details || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
    logger.error('API', 'Failed to revoke member access', { error: errorMessage });
    throw new Error(errorMessage);
  }

  return res.json();
}

// ─── Reorder Intelligence ─────────────────────────────────────────────────────

/** Upload an inventory snapshot CSV for the given company */
export async function uploadInventorySnapshot(companyId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetch(`${API_BASE}/api/reorder/snapshot/${companyId}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  return res.json();
}

/** Fetch the current inventory snapshot metadata + items */
export async function getInventorySnapshot(companyId) {
  const res = await apiFetch(`${API_BASE}/api/reorder/snapshot/${companyId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Fetch failed (${res.status})`);
  }
  return res.json();
}

/** Run the Reorder Intelligence engine and get ROP / coverage / anomaly data */
export async function getReorderIntelligence(companyId) {
  const res = await apiFetch(`${API_BASE}/api/reorder/intelligence/${companyId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Intelligence fetch failed (${res.status})`);
  }
  return res.json();
}

/** Trigger an order for a product (stamps timestamp in MongoDB) */
export async function triggerReorder(companyId, productId) {
  const res = await apiFetch(
    `${API_BASE}/api/reorder/trigger/${companyId}/${productId}`,
    { method: 'POST' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Trigger failed (${res.status})`);
  }
  return res.json();
}
