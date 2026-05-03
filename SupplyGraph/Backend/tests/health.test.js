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
