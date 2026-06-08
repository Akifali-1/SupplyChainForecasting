jest.mock("connect-dynamodb", () => {
  return () => {
    const EventEmitter = require("events");
    class MockStore extends EventEmitter {}
    return MockStore;
  };
});

jest.mock("@aws-sdk/client-dynamodb", () => {
  return {
    DynamoDBClient: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockImplementation(() => ({
        send: jest.fn().mockResolvedValue({})
      }))
    },
    PutCommand: jest.fn(),
    GetCommand: jest.fn(),
    UpdateCommand: jest.fn(),
    QueryCommand: jest.fn(),
    DeleteCommand: jest.fn()
  };
});

const request = require("supertest");
const { app } = require("../server");

describe("Health API", () => {
  it("should return healthy status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toEqual(200);
    // The health endpoint returns { backend, ml_service, timestamp }
    expect(res.body).toHaveProperty("backend", "healthy");
    expect(res.body).toHaveProperty("timestamp");
  });
});
