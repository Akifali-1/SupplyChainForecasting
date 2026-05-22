const express = require("express");
const router = express.Router();
const axios = require("axios");
const mongoose = require("mongoose");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { etagMiddleware } = require("../utils/etag");
const { idempotencyMiddleware } = require("../utils/idempotency");
const { requireAuth, requireRole } = require("../utils/auth");

// ML service runs in a separate docker container, use Docker network alias
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://ml-service:5001";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

// Helper to log rich ML errors
function logMlError(label, error) {
  console.error(label, {
    message: error?.message,
    code: error?.code,
    responseStatus: error?.response?.status,
    responseData: error?.response?.data,
    requestUrl: error?.config?.url,
    stack: error?.stack,
  });
}

// Parameter validation middleware for companyId to enforce tenancy and prevent path traversal
router.param("companyId", (req, res, next, companyId) => {
  // Path traversal check
  if (!companyId || !/^[a-zA-Z0-9_-]+$/.test(companyId)) {
    return res.status(400).json({
      error: "Invalid Company ID",
      details: "Company ID must be alphanumeric and cannot contain directory paths or special characters."
    });
  }

  // Require authentication for all companyId routes
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", details: "Authentication required" });
  }

  // Multi-tenancy check
  if (!req.user.companyId || req.user.companyId.toString() !== companyId) {
    return res.status(403).json({
      error: "Forbidden",
      details: "You do not have authorization to access data for this organization."
    });
  }

  next();
});

// Health check
router.get("/health", async (req, res) => {
  try {
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

// Create sample dataset
router.post("/create-sample/:companyId", requireRole(["admin"]), idempotencyMiddleware({ ttl: 60 * 60 * 1000 }), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { size = "small" } = req.body;

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/create-sample`, {
      company_id: companyId,
      size: size,
    });

    if (mlResponse.data.success) {
      res.json({
        company_id: companyId,
        file_paths: {
          nodes: mlResponse.data.nodes,
          edges: mlResponse.data.edges,
          demand: mlResponse.data.demand,
        },
        message: "Sample dataset created successfully",
        size: size,
      });
    } else {
      res.status(500).json({ error: "Failed to create sample dataset" });
    }
  } catch (error) {
    console.error("Error creating sample dataset:", error);
    res.status(500).json({ error: "Failed to create sample dataset" });
  }
});

// Fine-tune model - CRITICAL: Requires idempotency to prevent duplicate training jobs
router.post("/fine-tune/:companyId", requireRole(["admin"]), idempotencyMiddleware({ ttl: 24 * 60 * 60 * 1000 }), async (req, res) => {
  try {
    // Disable Node.js server timeout for this request since training can take 12+ minutes
    req.setTimeout(0);
    
    const { companyId } = req.params;
    const { nodes, edges, demand, force_retrain } = req.body;

    // Validate inputs
    if (!companyId || companyId.trim() === '') {
      return res.status(400).json({
        error: "Company ID is required",
        details: "Please provide a valid company identifier"
      });
    }

    if (!nodes || !edges || !demand) {
      return res.status(400).json({
        error: "Missing required file paths",
        details: "nodes, edges, and demand file paths are required",
        received: { nodes: !!nodes, edges: !!edges, demand: !!demand }
      });
    }

    // Validate file paths format
    const pathValidation = [
      { name: 'nodes', path: nodes },
      { name: 'edges', path: edges },
      { name: 'demand', path: demand }
    ];

    for (const { name, path } of pathValidation) {
      if (typeof path !== 'string' || path.trim() === '') {
        return res.status(400).json({
          error: `Invalid ${name} path`,
          details: `${name} path must be a non-empty string`,
          received: path
        });
      }
    }

    console.log(`Starting fine-tuning for company ${companyId}`);
    console.log(`File paths: nodes=${nodes}, edges=${edges}, demand=${demand}`);

    if (SQS_QUEUE_URL) {
      console.log("SQS queue configured. Enqueuing training job...");
      
      // Update database status immediately to queued
      if (mongoose.connection && mongoose.connection.db) {
        try {
          await mongoose.connection.db.collection("training_status").updateOne(
            { company_id: companyId },
            {
              $set: {
                status: "queued",
                progress: 0,
                message: "Job submitted to queue. Waiting for background worker...",
                error: null,
                timestamp: new Date().toISOString()
              }
            },
            { upsert: true }
          );
          console.log(`Updated training status to queued in DB for company ${companyId}`);
        } catch (dbErr) {
          console.error("Warning: Failed to update training status in DB:", dbErr.message);
        }
      }

      const sqsPayload = {
        company_id: companyId,
        nodes: nodes.startsWith("processed/") ? nodes : `processed/${companyId}/nodes.csv`,
        edges: edges.startsWith("processed/") ? edges : `processed/${companyId}/Edges (Plant).csv`,
        demand: demand.startsWith("processed/") ? demand : `processed/${companyId}/Sales Order.csv`,
        force_retrain: !!force_retrain
      };

      const command = new SendMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MessageBody: JSON.stringify(sqsPayload)
      });

      await sqsClient.send(command);

      res.json({
        message: "Fine-tuning queued successfully via SQS",
        company_id: companyId,
        status: "training_started",
        ml_response: { success: true, message: "Enqueued job in SQS" }
      });
    } else {
      console.log("SQS queue URL not configured. Falling back to synchronous HTTP call...");
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/fine-tune`, {
        company_id: companyId,
        nodes: nodes,
        edges: edges,
        demand: demand,
        force_retrain: !!force_retrain
      });

      if (mlResponse.status === 200) {
        res.json({
          message: "Fine-tuning started successfully",
          company_id: companyId,
          ml_response: mlResponse.data,
          status: "training_started"
        });
      } else {
        res.status(500).json({
          error: "Fine-tuning failed to start",
          details: mlResponse.data.error || "Unknown ML service error",
          ml_response: mlResponse.data
        });
      }
    }
  } catch (error) {
    logMlError("Error starting fine-tuning", error);

    let errorDetails = "Unknown error occurred";
    if (error.code === 'ECONNREFUSED') {
      errorDetails = "ML service is not available. Please ensure the ML service is running.";
    } else if (error.response) {
      errorDetails = error.response.data?.error || error.response.statusText;
    } else if (error.message) {
      errorDetails = error.message;
    }

    res.status(500).json({
      error: "Failed to start fine-tuning",
      details: errorDetails,
      suggestions: [
        "Check if the ML service is running on port 5001",
        "Verify that the file paths are correct and accessible",
        "Ensure the CSV files contain valid data",
        "Try again in a few moments"
      ]
    });
  }
});

// Get training status - ETag enabled for caching when status is stable
router.get("/training-status/:companyId", etagMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/training-status/${companyId}`
    );

    res.json({
      company_id: companyId,
      ml_status: mlResponse.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logMlError("Error getting training status", error);
    res.status(500).json({ error: "Failed to get training status" });
  }
});

// Cancel training
router.post("/cancel-training/:companyId", requireRole(["admin"]), async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/cancel-training/${companyId}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    logMlError("Error cancelling training", error);
    res.status(500).json({ error: "Failed to cancel training" });
  }
});

// Make prediction - Idempotent (same input = same output)
router.post("/predict/:companyId", idempotencyMiddleware({ ttl: 60 * 60 * 1000 }), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { input_data, forecast_days } = req.body;

    if (!input_data) {
      return res.status(400).json({ error: "input_data is required" });
    }

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
      company_id: companyId,
      input_data: input_data,
      forecast_days: forecast_days || 1,  // Default to 1 day, support 30 days
    });

    res.json(mlResponse.data);
  } catch (error) {
    logMlError("Error generating prediction", error);
    res.status(500).json({ error: "Failed to generate prediction" });
  }
});

// Get model info - ETag enabled (model metadata rarely changes)
router.get("/model-info/:companyId", etagMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/model-info/${companyId}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    logMlError("Error getting model info", error);
    res.status(500).json({ error: "Failed to get model info" });
  }
});

// Validate company data - ETag enabled
router.get("/validate-data/:companyId", etagMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/validate-data/${companyId}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    logMlError("Error validating data", error);
    res.status(500).json({ error: "Failed to validate data" });
  }
});

// Get historical data for charts - ETag enabled (historical data is immutable)
router.get("/historical-data/:companyId", etagMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { product, intervalDays } = req.query;

    const qp = new URLSearchParams();
    if (product) qp.set("product", product);
    if (intervalDays) qp.set("intervalDays", intervalDays);
    const qpStr = qp.toString();

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/historical-data/${companyId}${qpStr ? '?' + qpStr : ''}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    logMlError("Error getting historical data", error);
    res.status(500).json({ error: "Failed to get historical data" });
  }
});

// Get inventory analytics - Top trending items - ETag enabled
router.get("/inventory/trending/:companyId", etagMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { timeRange = '30d' } = req.query;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/inventory/trending/${companyId}?time_range=${timeRange}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    logMlError("Error getting trending inventory", error);
    res.status(500).json({ error: "Failed to get trending inventory data" });
  }
});

// Get inventory analytics summary - ETag enabled
router.get("/inventory/analytics/:companyId", etagMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/inventory/analytics/${companyId}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    logMlError("Error getting inventory analytics", error);
    res.status(500).json({ error: "Failed to get inventory analytics" });
  }
});

module.exports = router;
