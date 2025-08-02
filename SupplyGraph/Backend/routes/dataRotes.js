const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { processRawCSV } = require("../utils/dataProcessor");
const Company = require("../models/Company");

const router = express.Router();
const upload = multer({ dest: "uploads/raw/" });

router.post("/convert/:companyId", upload.single("file"), async (req, res) => {
  try {
    const { companyId } = req.params;
    const rawPath = req.file.path;

    // Process raw CSV and generate structured CSVs
    const result = await processRawCSV(rawPath, companyId);

    // ✅ Update company record with generated file paths
    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      {
        "files.nodes": result.nodes,
        "files.edges": result.edges,
        "files.demand": result.demand,
        status: "pending"
      },
      { new: true }
    );

    res.json({
      message: "✅ Files processed and MongoDB updated",
      files: result,
      company: updatedCompany
    });
  } catch (err) {
    console.error("❌ Error processing raw file:", err.message);
    res.status(500).json({ error: "Failed to process and store raw file" });
  }
});

module.exports = router;
