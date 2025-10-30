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
    
    // Validate company ID
    if (!companyId || companyId.trim() === '') {
      return res.status(400).json({ 
        error: "Company ID is required",
        details: "Please provide a valid company identifier"
      });
    }
    
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ 
        error: "No file uploaded",
        details: "Please select a CSV file to upload. Ensure the field name is 'file'",
        receivedFields: Object.keys(req.body),
        expectedField: "file"
      });
    }

    // Validate file type
    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({
        error: "Invalid file type",
        details: "Please upload a CSV file (.csv extension required)",
        uploadedFile: req.file.originalname
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: "File too large",
        details: `File size (${(req.file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB)`,
        maxSizeAllowed: "10MB"
      });
    }

    const rawPath = req.file.path;
    console.log("Processing file:", rawPath);

    // Process raw CSV and generate structured CSVs
    const result = await processRawCSV(rawPath, companyId);

    // Validate processing results
    if (!result || !result.nodes || !result.edges || !result.demand) {
      throw new Error("File processing failed - unable to generate required output files");
    }

    res.json({
      message: "✅ Files processed successfully",
      files: result,
      company_id: companyId,
      summary: {
        originalFile: req.file.originalname,
        fileSize: `${(req.file.size / 1024).toFixed(2)} KB`,
        processedFiles: {
          nodes: result.nodes,
          edges: result.edges,
          demand: result.demand
        }
      }
    });
  } catch (err) {
    console.error("❌ Error processing raw file:", err);
    
    // Provide detailed error information
    let errorDetails = "Unknown error occurred during file processing";
    if (err.message.includes("ENOENT")) {
      errorDetails = "File not found or inaccessible";
    } else if (err.message.includes("CSV")) {
      errorDetails = "Invalid CSV format or structure";
    } else if (err.message.includes("validation")) {
      errorDetails = err.message;
    }
    
    res.status(500).json({ 
      error: "Failed to process file",
      details: errorDetails,
      originalError: err.message,
      suggestions: [
        "Ensure your CSV file has the required columns (source_id, target_id, demand)",
        "Check that the file is not corrupted",
        "Verify the file size is under 10MB",
        "Make sure the CSV uses standard formatting"
      ]
    });
  }
});

module.exports = router;
