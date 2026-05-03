const { idempotencyMiddleware, clearIdempotencyCache, clearCleanupInterval } = require('../utils/idempotency');

// Helper to create a complete Express-like res mock
function makeMockRes(statusCode = 200) {
  const res = {
    statusCode,
    json: jest.fn(function(data) { return this; }),
    end:  jest.fn(function() { return this; }),
    set:  jest.fn(function() { return this; }),
    status: jest.fn(function(code) { this.statusCode = code; return this; }),
    getHeaders: jest.fn(() => ({})),
    on: jest.fn(),
  };
  return res;
}

describe('Idempotency Middleware', () => {
  afterAll(() => {
    clearCleanupInterval();
  });

  beforeEach(() => {
    clearIdempotencyCache();
  });

  it('should pass through GET requests without caching', async () => {
    const middleware = idempotencyMiddleware();
    const req = { method: 'GET', path: '/api/test' };
    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should cache and return the same response for identical POST requests', async () => {
    const middleware = idempotencyMiddleware();
    const req = {
      method: 'POST',
      path: '/api/test',
      body: { data: 'test' },
      headers: {}
    };

    // --- First request ---
    const res1 = makeMockRes();
    let captured1 = null;
    const originalJson1 = res1.json;
    res1.json = jest.fn(function(data) { captured1 = data; return originalJson1.call(this, data); });
    const next1 = jest.fn(() => {
      // Simulate route handler calling res.json
      res1.json({ success: true, original: true });
    });

    await middleware(req, res1, next1);
    expect(next1).toHaveBeenCalled();
    expect(captured1).toEqual({ success: true, original: true });

    // --- Second identical request — should be served from cache ---
    const res2 = makeMockRes();
    let captured2 = null;
    res2.json = jest.fn(function(data) { captured2 = data; return this; });
    const next2 = jest.fn();

    await middleware(req, res2, next2);

    expect(next2).not.toHaveBeenCalled();
    expect(captured2).toEqual({ success: true, original: true });
  });

  it('should require idempotency header if requireHeader option is true', async () => {
    const middleware = idempotencyMiddleware({ requireHeader: true });
    const req = {
      method: 'POST',
      path: '/api/test',
      headers: {} // No idempotency header
    };

    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Idempotency-Key header required'
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
