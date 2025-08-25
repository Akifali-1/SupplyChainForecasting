const express = require("express");
const cors = require("cors");
const dataRoutes = require("./routes/dataRotes");
const mlRoutes = require("./routes/mlRoutes");
require("dotenv").config();
const axios = require("axios");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use("/api/data", dataRoutes);
app.use("/api/ml", mlRoutes);

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
