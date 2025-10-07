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

    if (!nodes || !edges || !demand) {
      return res.status(400).json({ error: "nodes, edges, and demand paths are required" });
    }

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/fine-tune`, {
      company_id: companyId,
      nodes: nodes,
      edges: edges,
      demand: demand,
      force_retrain: !!force_retrain
    });

    if (mlResponse.data.success) {
      res.json({
        message: "Fine-tuning completed successfully",
        company_id: companyId,
        ml_response: mlResponse.data,
      });
    } else {
      res.status(500).json({ error: "Fine-tuning failed" });
    }
  } catch (error) {
    console.error("Error starting fine-tuning:", error);
    res.status(500).json({ error: "Failed to start fine-tuning" });
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

module.exports = router;