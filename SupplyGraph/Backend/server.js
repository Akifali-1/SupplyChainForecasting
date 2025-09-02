const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("./config/passport");   // ✅ Google strategy
const dataRoutes = require("./routes/dataRotes");
const mlRoutes = require("./routes/mlRoutes");
const authRoutes = require("./routes/authRoutes");
require("dotenv").config();
const axios = require("axios");
const { MongoClient } = require("mongodb");
const mongoose = require("mongoose"); // ✅ for User model

const app = express();

// ✅ Allow cookies/credentials for OAuth sessions
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Session middleware (needed for passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set true if using https
  })
);

// ✅ Passport init
app.use(passport.initialize());
app.use(passport.session());

// ✅ Routes
app.use("/api/data", dataRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/auth", authRoutes); // Google login/logout/me

/* ------------------ Mongo (Atlas) minimal client ------------------ */
const mongoUri = process.env.MONGO_URI;
const mongoDbName = process.env.MONGO_DB || "supplychain";
let mongoClient;
let companiesCollection;
let companiesDbName = null;

async function initMongo() {
  if (!mongoUri) {
    console.warn("⚠️ MONGO_URI not set; company registration disabled");
    return;
  }

  // MongoClient (for companies collection)
  mongoClient = new MongoClient(mongoUri, {
    tls: true,
    tlsAllowInvalidCertificates: true,
  });
  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);
  companiesCollection = db.collection("companies");
  companiesDbName = db.databaseName || mongoDbName;
  console.log(
    `✅ MongoClient connected. DB: ${companiesDbName}, collection: companies`
  );

  // ✅ Also connect Mongoose (for User model)
  mongoose
    .connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: mongoDbName,
    })
    .then(() => console.log("✅ Mongoose connected for User model"))
    .catch((err) => console.error("❌ Mongoose connection error:", err));
}

initMongo().catch((e) => console.error("Mongo init failed", e));

/* ------------------ Debug + Company APIs ------------------ */

// Debug: show which DB is currently used
app.get("/api/debug/db", (req, res) => {
  res.json({ db: companiesDbName || mongoDbName, collection: "companies" });
});

// Company registration (name -> Atlas doc)
app.post("/api/company/register", async (req, res) => {
  try {
    if (!companiesCollection)
      return res.status(500).json({ error: "Database not initialized" });
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });

    const now = new Date();
    const result = await companiesCollection.findOneAndUpdate(
      { name },
      {
        $setOnInsert: { name, status: "new", createdAt: now },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" }
    );

    const doc = result.value || (await companiesCollection.findOne({ name }));
    return res.json({ _id: doc._id, name: doc.name, status: doc.status });
  } catch (err) {
    console.error("❌ Register company failed", err);
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

/* ------------------ Server Start ------------------ */
app.listen(5000, () =>
  console.log("🚀 Backend running on http://localhost:5000")
);
