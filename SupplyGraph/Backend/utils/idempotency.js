const crypto = require('crypto');

/**
 * In-memory store for idempotency keys
 * In production, this should be Redis or a database
 * Format: { key: { response, statusCode, expiresAt } }
 */
const idempotencyStore = new Map();
// Track in-flight requests to prevent race conditions
const inFlightRequests = new Map();

// Cleanup expired keys every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyStore.entries()) {
    if (value.expiresAt < now) {
      idempotencyStore.delete(key);
    }
  }
  // Also cleanup stale in-flight requests (older than 5 minutes)
  for (const [key, timestamp] of inFlightRequests.entries()) {
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      inFlightRequests.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate idempotency key from request
 * For file uploads, includes file hash in the key
 * @param {Object} req - Express request object
 * @returns {Promise<string>} Idempotency key
 */
async function generateIdempotencyKey(req) {
  const { method, path, body, params, query, file } = req;
  
  const keyData = {
    method,
    path,
    body: body || {},
    params: params || {},
    query: query || {}
  };
  
  // Include file hash if file is present (for file uploads)
  if (file && file.path) {
    try {
      const fs = require('fs');
      if (fs.existsSync(file.path)) {
        const fileBuffer = fs.readFileSync(file.path);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        keyData.file = {
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          hash: fileHash
        };
      } else {
        // File path doesn't exist yet, use file metadata only
        keyData.file = {
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        };
      }
    } catch (error) {
      // If file reading fails, use metadata only
      keyData.file = {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        error: 'hash_failed'
      };
    }
  }
  
  const keyString = JSON.stringify(keyData);
  return crypto.createHash('sha256').update(keyString).digest('hex');
}

/**
 * Get idempotency key from request
 * Checks header first, then generates from request
 * @param {Object} req - Express request object
 * @returns {Promise<string>} Idempotency key
 */
async function getIdempotencyKey(req) {
  // Check for Idempotency-Key header (standard header name)
  const headerKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  
  // Fallback: generate from request
  return await generateIdempotencyKey(req);
}

/**
 * Idempotency middleware for Express
 * Ensures POST/PUT requests are idempotent
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Time to live in milliseconds (default: 24 hours)
 * @param {boolean} options.requireHeader - Require Idempotency-Key header (default: false)
 */
function idempotencyMiddleware(options = {}) {
  const {
    ttl = 24 * 60 * 60 * 1000, // 24 hours default
    requireHeader = false
  } = options;
  
  return async (req, res, next) => {
    try {
      // Only apply to POST, PUT, PATCH methods
      if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return next();
      }
      
      // Get idempotency key (async for file hash calculation)
      const idempotencyKey = await getIdempotencyKey(req);
      
      // If header required but not provided, return error
      if (requireHeader && !req.headers['idempotency-key'] && !req.headers['x-idempotency-key']) {
        return res.status(400).json({
          error: 'Idempotency-Key header required',
          details: 'Please provide an Idempotency-Key header for this request'
        });
      }
      
      // Check if we've seen this key before
      const cached = idempotencyStore.get(idempotencyKey);
      if (cached) {
        // Check if expired
        if (cached.expiresAt < Date.now()) {
          idempotencyStore.delete(idempotencyKey);
        } else {
          // Return cached response
          res.status(cached.statusCode);
          Object.keys(cached.headers || {}).forEach(key => {
            res.set(key, cached.headers[key]);
          });
          return res.json(cached.response);
        }
      }
      
      // Race condition prevention: Check if request is already in-flight
      if (inFlightRequests.has(idempotencyKey)) {
        // Wait for in-flight request to complete (polling approach)
        // In production, use Redis with proper locking mechanism
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait (50 * 100ms)
        while (inFlightRequests.has(idempotencyKey) && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
          // Check cache again in case request completed
          const newCached = idempotencyStore.get(idempotencyKey);
          if (newCached && newCached.expiresAt >= Date.now()) {
            res.status(newCached.statusCode);
            Object.keys(newCached.headers || {}).forEach(key => {
              res.set(key, newCached.headers[key]);
            });
            return res.json(newCached.response);
          }
        }
      }
      
      // Mark request as in-flight
      inFlightRequests.set(idempotencyKey, Date.now());
    
    // Store original json and end methods
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    let responseData = null;
    let statusCode = 200;
    const responseHeaders = {};
    
    // Override json to capture response
    res.json = function(data) {
      responseData = data;
      statusCode = res.statusCode || 200;
      
      // Capture headers
      Object.keys(res.getHeaders()).forEach(key => {
        responseHeaders[key] = res.getHeaders()[key];
      });
      
      // Store in idempotency cache
      idempotencyStore.set(idempotencyKey, {
        response: data,
        statusCode,
        headers: responseHeaders,
        expiresAt: Date.now() + ttl
      });
      
      // Remove from in-flight requests
      inFlightRequests.delete(idempotencyKey);
      
      return originalJson(data);
    };
    
    // Override end to handle non-JSON responses
    res.end = function(chunk, encoding) {
      if (responseData === null && chunk) {
        responseData = chunk.toString();
        statusCode = res.statusCode || 200;
        
        // Store in idempotency cache
        idempotencyStore.set(idempotencyKey, {
          response: responseData,
          statusCode,
          headers: responseHeaders,
          expiresAt: Date.now() + ttl
        });
        
        // Remove from in-flight requests
        inFlightRequests.delete(idempotencyKey);
      }
      
      return originalEnd(chunk, encoding);
    };
    
      // Add idempotency key to response headers for debugging
      res.set('X-Idempotency-Key', idempotencyKey);
      
      // Ensure in-flight request is cleaned up on error
      res.on('finish', () => {
        inFlightRequests.delete(idempotencyKey);
      });
      
      next();
    } catch (error) {
      // If idempotency key generation fails, log and continue without idempotency
      console.error('❌ Idempotency middleware error:', error);
      if (idempotencyKey) {
        inFlightRequests.delete(idempotencyKey);
      }
      next();
    }
  };
}

/**
 * Clear idempotency cache (useful for testing)
 */
function clearIdempotencyCache() {
  idempotencyStore.clear();
}

/**
 * Get cache statistics (useful for monitoring)
 * Note: Does not expose actual keys for security
 */
function getCacheStats() {
  // Explicitly return only these fields - never include keys
  const stats = {
    size: idempotencyStore.size,
    active_keys: idempotencyStore.size,
    in_flight: inFlightRequests.size
  };
  // Double-check: ensure no keys property exists
  if (stats.hasOwnProperty('keys')) {
    delete stats.keys;
  }
  return stats;
}

/**
 * Clear cleanup interval (useful for testing or graceful shutdown)
 */
function clearCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
}

module.exports = {
  idempotencyMiddleware,
  getIdempotencyKey,
  generateIdempotencyKey,
  clearIdempotencyCache,
  getCacheStats,
  clearCleanupInterval
};
