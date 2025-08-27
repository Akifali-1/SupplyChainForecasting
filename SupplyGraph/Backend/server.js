const express = require("express");
const cors = require("cors");
const dataRoutes = require("./routes/dataRotes");
const mlRoutes = require("./routes/mlRoutes");
require("dotenv").config();
const axios = require("axios");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use("/api/data", dataRoutes);
app.use("/api/ml", mlRoutes);

// Mongo (Atlas) minimal client
const mongoUri = process.env.MONGO_URI;
const mongoDbName = process.env.MONGO_DB || "supplychain";
let mongoClient;
let companiesCollection;
let companiesDbName = null;

async function initMongo() {
  if (!mongoUri) {
    console.warn("MONGO_URI not set; company registration disabled");
    return;
  }
  mongoClient = new MongoClient(mongoUri, { tls: true, tlsAllowInvalidCertificates: true });
  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);
  companiesCollection = db.collection("companies");
  companiesDbName = db.databaseName || mongoDbName;
  console.log(`Connected to MongoDB Atlas. Using DB: ${companiesDbName}, collection: companies`);
}

initMongo().catch((e) => console.error("Mongo init failed", e));

// Debug: show which DB is currently used
app.get("/api/debug/db", (req, res) => {
  res.json({ db: companiesDbName || mongoDbName, collection: "companies" });
});

// Company registration (name -> Atlas doc)
app.post("/api/company/register", async (req, res) => {
  try {
    if (!companiesCollection) return res.status(500).json({ error: "Database not initialized" });
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });

    // Upsert by name to avoid duplicates during testing
    const now = new Date();
    const result = await companiesCollection.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, status: "new", createdAt: now }, $set: { updatedAt: now } },
      { upsert: true, returnDocument: "after" }
    );

    const doc = result.value || (await companiesCollection.findOne({ name }));
    return res.json({ _id: doc._id, name: doc.name, status: doc.status });
  } catch (err) {
    console.error("Register company failed", err);
    return res.status(500).json({ error: "Failed to register company" });
  }
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const mlResponse = await axios.get("http://localhost:5001/health");
    res.json({
      backend: "healthy",
      ml_service: mlResponse.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.json({
      backend: "healthy",
      ml_service: { error: "ML service unavailable" },
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(5000, () => console.log("Backend running on port 5000"));
