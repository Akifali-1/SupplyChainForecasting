/**
 * Reorder Intelligence Routes
 * POST /api/reorder/snapshot/:companyId  — upload inventory CSV snapshot
 * GET  /api/reorder/intelligence/:companyId — compute ROP / coverage / anomalies
 * POST /api/reorder/trigger/:companyId/:productId — mark a product as ordered
 */
const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parse/sync");
const fs = require("fs");
const axios = require("axios");
const mongoose = require("mongoose");

const { requireAuth, requireRole } = require("../utils/auth");
const InventorySnapshot = require("../models/InventorySnapshot");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://ml-service:5001";

// ─── multer: memory storage for CSV ──────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.includes("csv") || file.originalname.endsWith(".csv");
    cb(null, ok);
  },
});

// ─── tenant guard ─────────────────────────────────────────────────────────────
function tenantGuard(req, res, next) {
  const { companyId } = req.params;
  if (!req.isAuthenticated || !req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });
  if (!req.user.companyId || req.user.companyId.toString() !== companyId)
    return res.status(403).json({ error: "Forbidden" });
  next();
}

// ─── POST /api/reorder/snapshot/:companyId ────────────────────────────────────
// Admin uploads inventory_snapshot.csv → stored in MongoDB (upserted)
router.post(
  "/snapshot/:companyId",
  requireAuth,
  requireRole(["admin"]),
  tenantGuard,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No CSV file provided" });

      const raw = req.file.buffer.toString("utf-8");
      let records;
      try {
        records = csv.parse(raw, { columns: true, skip_empty_lines: true, trim: true });
      } catch (parseErr) {
        return res.status(400).json({ error: "Invalid CSV", details: parseErr.message });
      }

      // Validate required columns
      const required = ["product_id", "current_stock"];
      const cols = Object.keys(records[0] || {});
      const missing = required.filter((c) => !cols.includes(c));
      if (missing.length)
        return res.status(400).json({ error: `Missing columns: ${missing.join(", ")}` });

      const items = records.map((r) => ({
        product_id:     String(r.product_id).trim().toUpperCase(),
        current_stock:  parseFloat(r.current_stock) || 0,
        lead_time_days: parseFloat(r.lead_time_days) || 5,
        safety_stock:   parseFloat(r.safety_stock) || 0,
        unit_cost:      parseFloat(r.unit_cost) || 0,
      }));

      await InventorySnapshot.findOneAndUpdate(
        { companyId: new mongoose.Types.ObjectId(req.params.companyId) },
        { companyId: new mongoose.Types.ObjectId(req.params.companyId), items, uploadedAt: new Date() },
        { upsert: true, new: true }
      );

      return res.json({ success: true, itemCount: items.length, uploadedAt: new Date() });
    } catch (err) {
      console.error("[reorderRoutes] snapshot upload error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── GET /api/reorder/snapshot/:companyId ─────────────────────────────────────
// Returns current inventory snapshot (for display on reorder page)
router.get(
  "/snapshot/:companyId",
  requireAuth,
  tenantGuard,
  async (req, res) => {
    try {
      const snap = await InventorySnapshot.findOne({
        companyId: new mongoose.Types.ObjectId(req.params.companyId),
      });
      if (!snap) return res.status(404).json({ error: "No inventory snapshot found" });
      return res.json({ uploadedAt: snap.uploadedAt, items: snap.items });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── GET /api/reorder/intelligence/:companyId ────────────────────────────────
// Core engine: joins snapshot with prediction cache → ROP, coverage, anomaly
router.get(
  "/intelligence/:companyId",
  requireAuth,
  tenantGuard,
  async (req, res) => {
    try {
      const companyId = req.params.companyId;

      // 1. Load inventory snapshot from MongoDB (via Mongoose)
      const snap = await InventorySnapshot.findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
      });
      if (!snap)
        return res.status(404).json({
          error: "No inventory snapshot uploaded yet.",
          hint: "Upload an inventory_snapshot.csv first.",
        });

      // 2. Ask Flask for cached predictions (prediction_caches collection)
      let predictionCache = null;
      try {
        const flaskResp = await axios.get(
          `${ML_SERVICE_URL}/prediction-cache/${companyId}`
        );
        predictionCache = flaskResp.data?.predictions || null;
      } catch (_) {
        // Prediction cache optional — compute without forecasts if unavailable
      }

      // 3. Compute reorder intelligence for each item
      const DEFAULT_LEAD_TIME = 5;
      const results = snap.items.map((item) => {
        const pid = item.product_id.toUpperCase();

        // Get forecast data — try exact match, then case-insensitive with underscore/space normalization
        let forecastData = predictionCache ? predictionCache[pid] : null;
        if (!forecastData && predictionCache) {
          const key = Object.keys(predictionCache).find(
            (k) => k.toUpperCase().replace(/_/g, ' ') === pid.replace(/_/g, ' ')
          );
          if (key) forecastData = predictionCache[key];
        }

        const avgDailyForecast = forecastData?.average_daily || 0;
        const forecastArray = forecastData?.prediction || [];
        const total30Days = forecastData?.total_30_days || 0;

        const currentStock  = item.current_stock;
        const leadTime      = item.lead_time_days || DEFAULT_LEAD_TIME;
        const safetyStock   = item.safety_stock || 0;

        // ── ROP formula ──────────────────────────────────────────────────────
        // ROP = (avg_daily_forecast × lead_time) + safety_stock
        const rop = avgDailyForecast > 0
          ? Math.round(avgDailyForecast * leadTime + safetyStock)
          : null;

        // ── Coverage days ────────────────────────────────────────────────────
        const coverageDays = avgDailyForecast > 0
          ? Math.round(currentStock / avgDailyForecast)
          : null;

        // ── Stock status ─────────────────────────────────────────────────────
        let stockStatus = "ok";
        if (rop !== null && currentStock <= rop) stockStatus = "reorder_needed";
        if (coverageDays !== null && coverageDays <= leadTime) stockStatus = "critical";
        if (avgDailyForecast === 0 || !forecastData) stockStatus = "no_forecast";

        // ── Overstock check ──────────────────────────────────────────────────
        const overstockThreshold = total30Days * 3;
        if (
          stockStatus === "ok" &&
          total30Days > 0 &&
          currentStock > overstockThreshold
        ) {
          stockStatus = "overstock";
        }

        // ── Anomaly detection ─────────────────────────────────────────────────
        // Sudden forecast spike vs rolling avg
        let anomaly = null;
        if (forecastArray.length >= 7) {
          const first7 = forecastArray.slice(0, 7);
          const last7  = forecastArray.slice(-7);
          const f7avg  = first7.reduce((s, v) => s + v, 0) / 7;
          const l7avg  = last7.reduce((s, v) => s + v, 0) / 7;
          if (f7avg > 0 && l7avg / f7avg > 1.5) {
            anomaly = { type: "demand_spike", ratio: +(l7avg / f7avg).toFixed(2) };
          } else if (f7avg > 0 && l7avg / f7avg < 0.5 && currentStock > safetyStock * 2) {
            anomaly = { type: "demand_drop", ratio: +(l7avg / f7avg).toFixed(2) };
          }
        }

        // ── Order-by date ────────────────────────────────────────────────────
        let orderByDate = null;
        if (coverageDays !== null && coverageDays > leadTime) {
          const d = new Date();
          d.setDate(d.getDate() + coverageDays - leadTime);
          orderByDate = d.toISOString().split("T")[0];
        }

        // ── Order quantity ───────────────────────────────────────────────────
        const orderQty = avgDailyForecast > 0
          ? Math.round(avgDailyForecast * (leadTime + 14) + safetyStock - currentStock)
          : null;
        const suggestedOrderQty = orderQty !== null ? Math.max(0, orderQty) : null;

        return {
          product_id:           pid,
          current_stock:        currentStock,
          lead_time_days:       leadTime,
          safety_stock:         safetyStock,
          unit_cost:            item.unit_cost,
          avg_daily_forecast:   Math.round(avgDailyForecast * 100) / 100,
          total_30_day_forecast: Math.round(total30Days),
          rop,
          coverage_days:        coverageDays,
          stock_status:         stockStatus,
          order_by_date:        orderByDate,
          suggested_order_qty:  suggestedOrderQty,
          anomaly,
          has_forecast:         !!forecastData,
        };
      });

      // Sort: critical → reorder_needed → ok → overstock → no_forecast
      const sortOrder = { critical: 0, reorder_needed: 1, ok: 2, overstock: 3, no_forecast: 4 };
      results.sort((a, b) => (sortOrder[a.stock_status] ?? 5) - (sortOrder[b.stock_status] ?? 5));

      const predCacheUpdatedAt = predictionCache
        ? (await axios.get(`${ML_SERVICE_URL}/prediction-cache/${companyId}`).catch(() => ({
            data: {},
          }))
          ).data?.updated_at || null
        : null;

      return res.json({
        companyId,
        snapshotDate: snap.uploadedAt,
        predictionCacheAge: predCacheUpdatedAt,
        hasForecast: !!predictionCache,
        totalItems: results.length,
        summary: {
          critical:       results.filter((r) => r.stock_status === "critical").length,
          reorder_needed: results.filter((r) => r.stock_status === "reorder_needed").length,
          ok:             results.filter((r) => r.stock_status === "ok").length,
          overstock:      results.filter((r) => r.stock_status === "overstock").length,
          no_forecast:    results.filter((r) => r.stock_status === "no_forecast").length,
        },
        items: results,
      });
    } catch (err) {
      console.error("[reorderRoutes] intelligence error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── POST /api/reorder/trigger/:companyId/:productId ─────────────────────────
// "Order Now" — stamps a reorder timestamp in the snapshot doc
router.post(
  "/trigger/:companyId/:productId",
  requireAuth,
  requireRole(["admin"]),
  tenantGuard,
  async (req, res) => {
    try {
      const { companyId, productId } = req.params;
      const snap = await InventorySnapshot.findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
      });
      if (!snap) return res.status(404).json({ error: "No inventory snapshot found" });

      const item = snap.items.find(
        (i) => i.product_id.toUpperCase() === productId.toUpperCase()
      );
      if (!item) return res.status(404).json({ error: `Product ${productId} not in snapshot` });

      // Store triggered timestamp on item (extend schema dynamically)
      const idx = snap.items.indexOf(item);
      snap.items[idx] = Object.assign(item.toObject(), {
        last_ordered_at: new Date().toISOString(),
      });
      snap.markModified("items");
      await snap.save();

      return res.json({
        success: true,
        product_id: productId.toUpperCase(),
        ordered_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[reorderRoutes] trigger error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
