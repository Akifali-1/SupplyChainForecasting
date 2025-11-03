const express = require("express");
const router = express.Router();
const axios = require("axios");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

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
router.post("/create-sample/:companyId", async (req, res) => {
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

// Fine-tune model
router.post("/fine-tune/:companyId", async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Error starting fine-tuning:", error);

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

// Get training status
router.get("/training-status/:companyId", async (req, res) => {
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
    console.error("Error getting training status:", error);
    res.status(500).json({ error: "Failed to get training status" });
  }
});

// Make prediction
router.post("/predict/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const { input_data } = req.body;

    if (!input_data) {
      return res.status(400).json({ error: "input_data is required" });
    }

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
      company_id: companyId,
      input_data: input_data,
    });

    res.json(mlResponse.data);
  } catch (error) {
    console.error("Error generating prediction:", error);
    res.status(500).json({ error: "Failed to generate prediction" });
  }
});

// Get model info
router.get("/model-info/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/model-info/${companyId}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    console.error("Error getting model info:", error);
    res.status(500).json({ error: "Failed to get model info" });
  }
});

// Validate company data
router.get("/validate-data/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/validate-data/${companyId}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    console.error("Error validating data:", error);
    res.status(500).json({ error: "Failed to validate data" });
  }
});

// Get historical data for charts
router.get("/historical-data/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/historical-data/${companyId}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    console.error("Error getting historical data:", error);
    res.status(500).json({ error: "Failed to get historical data" });
  }
});

// Get inventory analytics - Top trending items
router.get("/inventory/trending/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const { timeRange = '30d' } = req.query;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/inventory/trending/${companyId}?timeRange=${timeRange}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    console.error("Error getting trending inventory:", error);
    res.status(500).json({ error: "Failed to get trending inventory data" });
  }
});

// Get inventory analytics summary
router.get("/inventory/analytics/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    const mlResponse = await axios.get(
      `${ML_SERVICE_URL}/inventory/analytics/${companyId}`
    );

    res.json(mlResponse.data);
  } catch (error) {
    console.error("Error getting inventory analytics:", error);
    res.status(500).json({ error: "Failed to get inventory analytics" });
  }
});

module.exports = router;