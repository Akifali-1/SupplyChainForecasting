const request = require("supertest");
const app = require("../server");
const mongoose = require("mongoose");

describe("Health API", () => {
  // Disconnect mongoose after all tests so Jest can exit cleanly
  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it("should return healthy status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("status", "healthy");
  });
});
