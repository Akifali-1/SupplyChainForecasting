jest.mock("mongoose", () => {
  const actualMongoose = jest.requireActual("mongoose");
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue({}),
    disconnect: jest.fn().mockResolvedValue({}),
    connection: {
      ...actualMongoose.connection,
      readyState: 0,
    },
  };
});

jest.mock("mongodb", () => {
  const mockDb = {
    collection: jest.fn().mockReturnValue({
      findOneAndUpdate: jest.fn().mockResolvedValue({ value: null }),
      findOne: jest.fn().mockResolvedValue({}),
    }),
  };
  const mockClient = {
    connect: jest.fn().mockResolvedValue({}),
    db: jest.fn().mockReturnValue(mockDb),
    close: jest.fn().mockResolvedValue({}),
  };
  return {
    MongoClient: jest.fn().mockImplementation(() => mockClient),
  };
});

jest.mock("connect-mongo", () => {
  const EventEmitter = require("events");
  class MockStore extends EventEmitter {}
  return {
    MongoStore: {
      create: jest.fn().mockImplementation(() => new MockStore()),
    },
  };
});

const request = require("supertest");
const { app, getMongoClient } = require("../server");
const mongoose = require("mongoose");

describe("Health API", () => {
  afterAll(async () => {
    // Close Mongoose connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    // Close native MongoClient connection
    const client = getMongoClient();
    if (client) {
      await client.close();
    }
  });

  it("should return healthy status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toEqual(200);
    // The health endpoint returns { backend, ml_service, timestamp }
    expect(res.body).toHaveProperty("backend", "healthy");
    expect(res.body).toHaveProperty("timestamp");
  });
});
