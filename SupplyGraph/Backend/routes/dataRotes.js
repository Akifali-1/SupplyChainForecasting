const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { processRawCSV } = require("../utils/dataProcessor");

const router = express.Router();

// Simplified multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/raw/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    console.log('Multer fileFilter - file:', file);
    cb(null, true);
  }
});

router.post("/convert/:companyId", upload.single("file"), async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Debug logging
    console.log("Request received for company:", companyId);
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    
    if (!req.file) {
      return res.status(400).json({ 
        error: "No file uploaded. Please ensure the field name is 'file'",
        receivedFields: Object.keys(req.body),
        receivedFile: req.file
      });
    }

    const rawPath = req.file.path;
    console.log("Processing file:", rawPath);

    // Process raw CSV and generate structured CSVs
    const result = await processRawCSV(rawPath, companyId);

    res.json({
      message: "✅ Files processed successfully",
      files: result,
      company_id: companyId
    });
  } catch (err) {
    console.error("❌ Error processing raw file:", err.message);
    res.status(500).json({ error: "Failed to process and store raw file" });
  }
});

module.exports = router;
