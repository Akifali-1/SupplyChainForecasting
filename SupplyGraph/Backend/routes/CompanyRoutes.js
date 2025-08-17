const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const {
  registerCompany,
  uploadFiles,
  getPendingCompanies,
  uploadModel,
} = require("../controllers/companyControllers");
const Company = require("../models/Company");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// --- Existing routes ---
router.post("/register", registerCompany);
router.post(
  "/upload/:id",
  upload.fields([{ name: "nodes" }, { name: "edges" }, { name: "demand" }]),
  uploadFiles
);
router.get("/pending", getPendingCompanies);
router.post("/:id/model", upload.single("model"), uploadModel);

// Upload base model files
router.post(
  "/base-model",
  upload.fields([
    { name: "model", maxCount: 1 },
    { name: "encoder", maxCount: 1 },
    { name: "meta", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const modelFile = req.files["model"]?.[0];
      const encoderFile = req.files["encoder"]?.[0];
      const metaFile = req.files["meta"]?.[0];

      if (!modelFile || !encoderFile || !metaFile) {
        return res.status(400).json({ error: "One or more files missing" });
      }

      if (!fs.existsSync("models")) fs.mkdirSync("models");

      fs.renameSync(modelFile.path, "models/base_gcn.pth");
      fs.renameSync(encoderFile.path, "models/feature_encoder.pkl");
      fs.renameSync(metaFile.path, "models/meta.json");

      res.json({ message: "All base files uploaded successfully." });
    } catch (err) {
      console.error("Error uploading base files:", err.message);
      res.status(500).json({ error: "Failed to save base files." });
    }
  }
);

// Serve base model files
router.get("/base-model/:filename", (req, res) => {
  const filename = req.params.filename;
  const modelsDir = path.join(__dirname, "../models");
  const filePath = path.join(modelsDir, filename);

  console.log("Serving file:", filePath);

  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    return res.status(404).json({ error: "File not found" });
  }
  res.sendFile(filePath);
});

// Serve company uploaded CSVs (nodes, edges, demand)
router.get("/company-data/:companyId/:filename", (req, res) => {
  const { companyId, filename } = req.params;
  const filePath = path.join(__dirname, "../uploads", companyId, filename);

  console.log("Serving company data file:", filePath);

  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    return res.status(404).json({ error: "File not found" });
  }

  res.sendFile(filePath);
});

// NEW: Get details of a single company by ID
router.get("/:companyId", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (err) {
    console.error("Error fetching company:", err.message);
    res.status(500).json({ error: "Failed to fetch company" });
  }
});

module.exports = router;
