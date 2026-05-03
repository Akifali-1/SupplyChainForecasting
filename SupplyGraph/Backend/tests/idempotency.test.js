const { idempotencyMiddleware, clearIdempotencyCache, clearCleanupInterval } = require('../utils/idempotency');
const mongoose = require('mongoose');
const { getMongoClient } = require('../server');

describe('Idempotency Middleware', () => {
  afterAll(async () => {
    clearCleanupInterval();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const client = getMongoClient();
    if (client) await client.close();
  });

  beforeEach(() => {
    clearIdempotencyCache();
  });

  it('should pass through GET requests without caching', async () => {
    const middleware = idempotencyMiddleware();
    const req = { method: 'GET', path: '/api/test' };
    const res = {};
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
    
    // First Request
    let responseData1;
    const res1 = {
      json: jest.fn(function(data) { responseData1 = data; return this; }),
      set: jest.fn(),
      getHeaders: jest.fn(() => ({})),
      statusCode: 200,
      on: jest.fn()
    };
    const next1 = jest.fn(() => {
      // Simulate route handler execution
      res1.json({ success: true, original: true });
    });

    await middleware(req, res1, next1);
    expect(next1).toHaveBeenCalled();
    expect(responseData1).toEqual({ success: true, original: true });

    // Second Request (Identical req object, so it will generate the same idempotency key)
    let responseData2;
    const res2 = {
      json: jest.fn(function(data) { responseData2 = data; return this; }),
      status: jest.fn(function() { return this; }),
      set: jest.fn(),
      getHeaders: jest.fn(() => ({})),
      on: jest.fn()
    };
    const next2 = jest.fn();

    await middleware(req, res2, next2);
    
    // Next should NOT be called. It should return from cache directly
    expect(next2).not.toHaveBeenCalled();
    expect(res2.json).toHaveBeenCalledWith({ success: true, original: true });
  });

  it('should require idempotency header if requireHeader option is true', async () => {
    const middleware = idempotencyMiddleware({ requireHeader: true });
    const req = { 
      method: 'POST', 
      path: '/api/test',
      headers: {} // No idempotency header
    };
    
    const res = {
      status: jest.fn(function() { return this; }),
      json: jest.fn(function() { return this; })
    };
    const next = jest.fn();

    await middleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Idempotency-Key header required'
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
