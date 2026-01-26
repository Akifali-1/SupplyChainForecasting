const crypto = require('crypto');

/**
 * Generate ETag from response data
 * @param {any} data - Response data to hash
 * @returns {string} ETag value (e.g., "W/\"abc123\"")
 */
function generateETag(data) {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  // Use weak ETag (W/) for dynamic content that might change slightly
  return `W/"${hash.substring(0, 16)}"`;
}

/**
 * ETag middleware for Express
 * Checks If-None-Match header and returns 304 if ETag matches
 * Adds ETag header to response
 */
function etagMiddleware(req, res, next) {
  // Skip ETag for non-JSON responses (binary, images, etc.)
  // Check content-type before processing
  const contentType = res.getHeader('content-type') || '';
  if (contentType && !contentType.includes('application/json') && !contentType.includes('text/')) {
    return next();
  }
  
  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override json method to add ETag
  res.json = function(data) {
    // Generate ETag from response data
    const etag = generateETag(data);
    
    // Check If-None-Match header BEFORE setting status
    const clientETag = req.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      // Resource hasn't changed, return 304 Not Modified (with ETag header)
      // Use writeHead with headers object to ensure headers are sent
      res.writeHead(304, {
        'ETag': etag,
        'Cache-Control': 'private, no-cache'
      });
      return res.end();
    }
    
    // Set ETag header for normal responses
    res.set('ETag', etag);
    res.set('Cache-Control', 'private, no-cache');
    
    // Call original json method
    return originalJson(data);
  };
  
  next();
}

module.exports = {
  generateETag,
  etagMiddleware
};
