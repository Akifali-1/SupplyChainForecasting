const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("./config/passport");   // ✅ Google strategy
const dataRoutes = require("./routes/dataRotes");
const mlRoutes = require("./routes/mlRoutes");
const authRoutes = require("./routes/authRoutes");
require("dotenv").config();

// Suppress MongoDB deprecation warnings
process.env.NODE_OPTIONS = '--no-warnings';

const axios = require("axios");
const { MongoClient } = require("mongodb");
const mongoose = require("mongoose"); // ✅ for User model

const app = express();

// ✅ Allow cookies/credentials for OAuth sessions
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [FRONTEND_URL, ...extraOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Session middleware (needed for passport)
const isProduction = process.env.NODE_ENV === 'production';
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: isProduction, // set true if using https
      sameSite: isProduction ? 'none' : 'lax'
    },
  })
);

// ✅ Passport init
app.use(passport.initialize());
app.use(passport.session());

// ✅ Mongoose connection for User model
const mongooseUri = process.env.MONGO_URI;
if (mongooseUri) {
  mongoose.connect(mongooseUri)
    .then(() => {
      console.log("✅ Connected to MongoDB via Mongoose");
    })
    .catch((err) => {
      console.error("❌ Mongoose connection failed:", err.message);
    });
} else {
  console.warn("⚠️ MONGO_URI not set; MongoDB connection disabled");
}

// ✅ Routes
app.use("/api/data", dataRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/auth", authRoutes); // Google login/logout/me

// Mongo (Atlas) minimal client - using same connection string as ML service
const mongoUri = process.env.MONGO_URI;
const mongoDbName = process.env.MONGO_DB || "supplychain";
let mongoClient;
let companiesCollection;
let companiesDbName = null;

async function initMongo() {
  if (!mongoUri || !mongoUri.trim()) {
    console.warn("⚠️ MONGO_URI not set; company registration disabled");
    return;
  }

  try {
    console.log("Attempting to connect to MongoDB Atlas...");
    mongoClient = new MongoClient(mongoUri, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 30000
    });

    await mongoClient.connect();
    const db = mongoClient.db(mongoDbName);
    companiesCollection = db.collection("companies");
    companiesDbName = db.databaseName || mongoDbName;
    console.log(`✅ Connected to MongoDB Atlas. Using DB: ${companiesDbName}, collection: companies`);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.warn("⚠️  Company registration will be disabled. Check your network connection and MongoDB Atlas settings.");
    mongoClient = null;
    companiesCollection = null;
  }
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
    if (!companiesCollection) {
      console.warn("MongoDB not available, using local fallback for company registration");
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ error: "name is required" });

      // Local fallback - generate a simple ID
      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return res.json({
        _id: localId,
        name: name,
        status: "local_fallback",
        message: "MongoDB unavailable, using local storage"
      });
    }

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
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
    const mlResponse = await axios.get(`${ML_SERVICE_URL}/health`);
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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);