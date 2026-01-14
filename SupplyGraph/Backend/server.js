const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("./config/passport");   // ✅ Google strategy
const dataRoutes = require("./routes/dataRoutes");
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
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Log CORS rejections for debugging
      if (process.env.NODE_ENV !== 'production' || process.env.ML_DEBUG === '1') {
        console.log('⚠️  CORS blocked origin:', origin);
        console.log('✅ Allowed origins:', allowedOrigins);
      }

      return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Session middleware (needed for passport)
const isProduction = process.env.NODE_ENV === 'production';
// For Render, we need secure cookies with sameSite: 'none' for cross-origin requests
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction, // HTTPS required in production
    sameSite: isProduction ? 'none' : 'lax', // 'none' allows cross-origin cookies
    httpOnly: true, // Prevents XSS attacks
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
};

// Log session config in development
if (!isProduction || process.env.ML_DEBUG === '1') {
  console.log('🍪 Session Config:', {
    secure: sessionConfig.cookie.secure,
    sameSite: sessionConfig.cookie.sameSite,
    httpOnly: sessionConfig.cookie.httpOnly
  });
}

app.use(session(sessionConfig));

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

// OAuth diagnostic endpoint (for debugging)
app.get("/api/auth/debug", (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Calculate callback URL the same way passport does
  const backendUrl = process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.PORT ? `https://${process.env.RENDER_SERVICE_NAME || 'your-backend'}.onrender.com` : null) ||
    "http://localhost:5000";
  let url = backendUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = isProduction ? `https://${url}` : `http://${url}`;
  }
  const callbackURL = `${url}/api/auth/google/callback`;

  res.json({
    environment: {
      node_env: process.env.NODE_ENV || 'not set',
      is_production: isProduction,
      backend_url: process.env.BACKEND_URL || 'not set',
      frontend_url: process.env.FRONTEND_URL || 'not set',
      render_external_url: process.env.RENDER_EXTERNAL_URL || 'not set',
    },
    oauth: {
      client_id_set: !!process.env.GOOGLE_CLIENT_ID,
      client_secret_set: !!process.env.GOOGLE_CLIENT_SECRET,
      callback_url: callbackURL,
    },
    session: {
      secret_set: !!process.env.SESSION_SECRET,
      session_id: req.sessionID,
      user: req.user ? { email: req.user.email, id: req.user.id } : null,
    },
    cors: {
      allowed_origins: allowedOrigins,
    },
    cookies: {
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    }
  });
});

/* ------------------ Server Start ------------------ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
