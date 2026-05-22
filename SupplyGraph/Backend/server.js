const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { MongoStore } = require("connect-mongo"); // ✅ Mongo session store
const passport = require("./config/passport");   // ✅ Google strategy
const dataRoutes = require("./routes/dataRoutes");
const mlRoutes = require("./routes/mlRoutes");
const authRoutes = require("./routes/authRoutes");
const inviteRoutes = require("./routes/inviteRoutes"); // ✅ Invite routes
const companyRoutes = require("./routes/companyRoutes"); // ✅ Company management routes
const reorderRoutes = require("./routes/reorderRoutes"); // ✅ Reorder Intelligence routes
require("dotenv").config();

// Suppress MongoDB deprecation warnings
process.env.NODE_OPTIONS = '--no-warnings';

const axios = require("axios");
const { MongoClient } = require("mongodb");
const mongoose = require("mongoose"); // ✅ for User model

const app = express();

// ✅ Trust Render's proxy so secure cookies work behind TLS termination
//    This is required for `cookie.secure: true` on Render.
app.set("trust proxy", 1);

// ✅ Allow cookies/credentials for OAuth sessions
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = [FRONTEND_URL, ...extraOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Normalize incoming origin by removing trailing slashes
      const normalizedOrigin = origin.replace(/\/$/, "");

      // 1. Exact match check
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // 2. Safe dynamic wildcard check for local development & Render subdomains
      if (
        normalizedOrigin.startsWith("http://localhost:") ||
        normalizedOrigin.startsWith("http://127.0.0.1:") ||
        (normalizedOrigin.endsWith(".onrender.com") &&
         (normalizedOrigin.includes("supplychain") || normalizedOrigin.includes("scm")))
      ) {
        return callback(null, true);
      }

      // Log CORS rejections for troubleshooting
      console.warn("⚠️  CORS blocked origin:", origin);
      console.log("✅ Allowed origins:", allowedOrigins);

      return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Enforce session secret in production
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'secret_key')) {
  console.error("❌ CRITICAL ERROR: SESSION_SECRET is not configured or uses default in production!");
  process.exit(1);
}

// ✅ Set up connect-mongo session store separately
const sessionStore = process.env.MONGO_URI ? MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  collectionName: "sessions",
  ttl: 24 * 60 * 60 // 1 day
}) : undefined;

// ✅ Prevent unhandled connection error crashes from connect-mongo session store
if (sessionStore) {
  sessionStore.on("error", (error) => {
    console.error("❌ MongoDB Session Store Error:", error.message || error);
  });
}

// ✅ Session middleware (needed for passport)
const sessionConfig = {
  name: "scm.sid",
  secret: process.env.SESSION_SECRET || "secret_key",
  resave: false,
  saveUninitialized: false,
  proxy: true,
  store: sessionStore,
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
    httpOnly: sessionConfig.cookie.httpOnly,
    hasStore: !!sessionConfig.store
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
app.use("/api/invite", inviteRoutes); // ✅ Invite token routes
app.use("/api/company", companyRoutes); // ✅ Company members routes
app.use("/api/reorder", reorderRoutes); // ✅ Reorder Intelligence routes

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

// Health check endpoint - No ETag (health status changes frequently)
app.get("/api/health", async (req, res) => {
  try {
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://ml-service:5001";
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

// Idempotency cache stats (for debugging/monitoring)
// Security: Does not expose actual keys
app.get("/api/debug/idempotency", (req, res) => {
  // Clear require cache to ensure we get latest version
  delete require.cache[require.resolve("./utils/idempotency")];
  const { getCacheStats } = require("./utils/idempotency");
  const stats = getCacheStats();
  // Explicitly construct response object - ONLY include these fields
  res.json({
    cache_size: typeof stats.size === 'number' ? stats.size : 0,
    active_keys: typeof stats.active_keys === 'number' ? stats.active_keys : 0,
    in_flight_requests: typeof stats.in_flight === 'number' ? stats.in_flight : 0
  });
});

// OAuth diagnostic endpoint (for debugging)
app.get("/api/auth/debug", (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Calculate callback URL the same way passport does
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
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
if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`🚀 Backend running on port ${PORT}`)
  );
}

module.exports = { app, getMongoClient: () => mongoClient };
