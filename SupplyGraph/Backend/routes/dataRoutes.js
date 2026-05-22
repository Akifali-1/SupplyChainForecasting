const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { pipeline } = require("stream/promises");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { processRawCSV } = require("../utils/dataProcessor");
const { idempotencyMiddleware } = require("../utils/idempotency");
const { requireAuth, requireRole } = require("../utils/auth");

const router = express.Router();

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET;

// GET route to generate presigned S3 URL for raw CSV uploads
router.get("/upload-url/:companyId", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    // Path traversal and sanitization check on companyId
    if (!companyId || !/^[a-zA-Z0-9_-]+$/.test(companyId)) {
      return res.status(400).json({
        error: "Invalid Company ID",
        details: "Company ID must be alphanumeric and cannot contain directory paths or special characters."
      });
    }

    // Inter-tenant data leakage protection
    if (!req.user.companyId || req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        error: "Forbidden",
        details: "You do not have authorization to upload datasets for this organization."
      });
    }

    if (!BUCKET_NAME) {
      return res.status(500).json({ error: "S3 uploads bucket is not configured" });
    }

    const s3Key = `raw/${companyId}/${Date.now()}-${filename}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: "text/csv"
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({ uploadUrl, s3Key });
  } catch (err) {
    console.error("❌ Error generating presigned URL:", err);
    res.status(500).json({ error: "Failed to generate upload URL", details: err.message });
  }
});

// File processing / conversion with auth, role checking, tenancy protection, and idempotency
router.post("/convert/:companyId", requireAuth, requireRole(["admin"]), idempotencyMiddleware({ ttl: 60 * 60 * 1000 }), async (req, res) => {
  let localRawPath = null;
  const { companyId } = req.params;
  try {
    const { s3Key, filename, size } = req.body;

    // 1. Path traversal and sanitization check on companyId
    if (!companyId || !/^[a-zA-Z0-9_-]+$/.test(companyId)) {
      return res.status(400).json({
        error: "Invalid Company ID",
        details: "Company ID must be alphanumeric and cannot contain directory paths or special characters."
      });
    }

    // 2. Inter-tenant data leakage protection
    if (!req.user.companyId || req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        error: "Forbidden",
        details: "You do not have authorization to upload or manage datasets for this organization."
      });
    }

    if (!s3Key) {
      return res.status(400).json({
        error: "Missing S3 key",
        details: "Please provide the s3Key of the uploaded file."
      });
    }

    if (!filename || !filename.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({
        error: "Invalid file type",
        details: "Please provide a valid filename with a CSV extension."
      });
    }

    if (!BUCKET_NAME) {
      return res.status(500).json({ error: "S3 uploads bucket is not configured" });
    }

    // Validate file size (max 10MB) if provided
    const maxSize = 10 * 1024 * 1024;
    if (size && size > maxSize) {
      return res.status(400).json({
        error: "File too large",
        details: `File size exceeds maximum allowed size (10MB)`
      });
    }

    console.log("Downloading raw file from S3 key:", s3Key);
    const getObjectResponse = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    }));

    const tempDir = os.tmpdir();
    localRawPath = path.join(tempDir, `raw-${companyId}-${Date.now()}.csv`);
    const writeStream = fs.createWriteStream(localRawPath);

    await pipeline(getObjectResponse.Body, writeStream);

    console.log("Processing raw CSV file locally:", localRawPath);
    const result = await processRawCSV(localRawPath, companyId);

    if (!result || !result.nodes || !result.edges || !result.demand) {
      throw new Error("File processing failed - unable to generate required output files");
    }

    const backendDir = path.dirname(__dirname); // Backend directory
    const localNodesPath = path.join(backendDir, result.nodes);
    const localEdgesPath = path.join(backendDir, result.edges);
    const localSalesPath = path.join(backendDir, result.sales);

    console.log("Uploading processed files to S3...");
    const uploadToS3 = async (localPath, s3TargetKey) => {
      const fileStream = fs.createReadStream(localPath);
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3TargetKey,
        Body: fileStream,
        ContentType: "text/csv"
      }));
    };

    await uploadToS3(localNodesPath, `processed/${companyId}/nodes.csv`);
    await uploadToS3(localEdgesPath, `processed/${companyId}/Edges (Plant).csv`);
    await uploadToS3(localSalesPath, `processed/${companyId}/Sales Order.csv`);

    // Clean up local processed files
    try {
      fs.rmSync(path.join(backendDir, "uploads", companyId), { recursive: true, force: true });
    } catch (e) {
      console.warn("⚠️ Warning: Failed to clean up local processed files directory:", e.message);
    }

    res.json({
      message: "✅ Files processed successfully and saved to S3",
      files: result,
      company_id: companyId,
      summary: {
        originalFile: filename,
        fileSize: size ? `${(size / 1024).toFixed(2)} KB` : "unknown",
        processedFiles: {
          nodes: `processed/${companyId}/nodes.csv`,
          edges: `processed/${companyId}/Edges (Plant).csv`,
          demand: `processed/${companyId}/Sales Order.csv`
        }
      }
    });

  } catch (err) {
    console.error("❌ Error processing raw file:", err);

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
  } finally {
    // Clean up local raw file if it exists
    if (localRawPath && fs.existsSync(localRawPath)) {
      try {
        fs.unlinkSync(localRawPath);
      } catch (e) {
        console.warn("⚠️ Warning: Failed to clean up temporary raw file:", e.message);
      }
    }
  }
});

module.exports = router;
