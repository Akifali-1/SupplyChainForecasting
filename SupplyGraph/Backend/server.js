const express = require("express");
const cors = require("cors");
const session = require("express-session");
const DynamoDBStore = require("connect-dynamodb")({ session });
const passport = require("./config/passport");   // Google strategy
const dataRoutes = require("./routes/dataRoutes");
const mlRoutes = require("./routes/mlRoutes");
const authRoutes = require("./routes/authRoutes");
const inviteRoutes = require("./routes/inviteRoutes");
const companyRoutes = require("./routes/companyRoutes");
const reorderRoutes = require("./routes/reorderRoutes");
require("dotenv").config();

const axios = require("axios");
const { DynamoDBClient: RawDynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("./config/dynamodb");

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

// Set up DynamoDB session store
const dynamoStoreOptions = {
  table: (process.env.DYNAMODB_TABLE || "SupplyGraph-Prod") + "-Sessions",
  AWSConfigJSON: {
    region: process.env.AWS_REGION || "us-east-1"
  },
  reapInterval: 24 * 60 * 60 * 1000,  // Reap expired sessions daily
  ttl: 24 * 60 * 60                    // 1-day TTL on session records
};

const sessionStore = new DynamoDBStore(dynamoStoreOptions);
sessionStore.on("error", (error) => {
  console.error("❌ DynamoDB Session Store Error:", error.message || error);
});

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

// Routes
app.use("/api/data", dataRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/auth", authRoutes); // Google login/logout/me
app.use("/api/invite", inviteRoutes); // ✅ Invite token routes
app.use("/api/company", companyRoutes); // ✅ Company members routes
app.use("/api/reorder", reorderRoutes); // ✅ Reorder Intelligence routes


/* ------------------ Debug + Company APIs ------------------ */

// Debug: show which DB / table is currently used
app.get("/api/debug/db", (req, res) => {
  res.json({ table: TABLE_NAME, backend: "DynamoDB" });
});

// Company registration (name -> DynamoDB)
app.post("/api/company/register", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });

    const companyId = `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Check if company name already exists would require a Scan (expensive) so
    // we use a conditional put with a well-known name key as GSI1_PK instead.
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${companyId}`,
        SK: 'METADATA',
        GSI1_PK: `COMPANY_NAME#${name.toLowerCase()}`,
        GSI1_SK: 'METADATA',
        companyId,
        name,
        status: 'new',
        setupComplete: false,
        createdAt: now,
        updatedAt: now
      },
      ConditionExpression: 'attribute_not_exists(PK)'  // prevent duplicate writes
    })).catch(err => {
      // If condition fails the company key already exists — that's OK on idempotent calls
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    });

    return res.json({ _id: companyId, name, status: 'new' });
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

module.exports = { app };
