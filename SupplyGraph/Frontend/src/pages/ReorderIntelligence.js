import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';
import {
  getReorderIntelligence,
  uploadInventorySnapshot,
  triggerReorder,
} from '../lib/api';
import {
  ShoppingCart, Upload, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Package, Clock, Zap, BarChart3,
  ChevronDown, ChevronUp, Info, Download, Loader2, XCircle, Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getCompanyId(user) {
  return localStorage.getItem('companyId') || user?.companyId || null;
}

function statusConfig(status) {
  switch (status) {
    case 'critical':
      return { label: 'Critical', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' };
    case 'reorder_needed':
      return { label: 'Reorder', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' };
    case 'overstock':
      return { label: 'Overstock', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' };
    case 'ok':
      return { label: 'OK', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' };
    default:
      return { label: 'No Forecast', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-neutral-900', border: 'border-slate-200 dark:border-neutral-800', dot: 'bg-slate-400' };
  }
}

function SummaryCard({ label, count, icon: Icon, colorClass }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border bg-white dark:bg-neutral-900/90 border-slate-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`p-2.5 rounded-xl ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      </div>
    </div>
  );
}

function AnomalyBadge({ anomaly }) {
  if (!anomaly) return null;
  const spike = anomaly.type === 'demand_spike';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      spike ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
             : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    }`}>
      {spike ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {spike ? `Demand Spike ×${anomaly.ratio}` : `Demand Drop ×${anomaly.ratio}`}
    </span>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

function ProductRow({ item, onOrder, ordering }) {
  const [expanded, setExpanded] = useState(false);
  const sc = statusConfig(item.stock_status);

  return (
    <div className={`rounded-2xl border ${sc.border} ${sc.bg} transition-all duration-200 hover:shadow-md`}>
      {/* Main row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 py-4">

        {/* Status dot + name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${sc.dot} shadow-sm ring-2 ring-white dark:ring-neutral-900`} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">
              {item.product_id.replace(/_/g, ' ')}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
              <AnomalyBadge anomaly={item.anomaly} />
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs shrink-0">
          <div className="text-center">
            <p className="text-slate-500 dark:text-slate-400">Stock</p>
            <p className="font-bold text-slate-800 dark:text-slate-200">{item.current_stock.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 dark:text-slate-400">ROP</p>
            <p className={`font-bold ${item.rop !== null && item.current_stock <= item.rop ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {item.rop !== null ? item.rop.toLocaleString() : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 dark:text-slate-400">Coverage</p>
            <p className={`font-bold ${
              item.coverage_days !== null && item.coverage_days <= item.lead_time_days ? 'text-red-600 dark:text-red-400'
              : item.coverage_days !== null && item.coverage_days <= 14 ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-800 dark:text-slate-200'
            }`}>
              {item.coverage_days !== null ? `${item.coverage_days}d` : '—'}
            </p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-slate-500 dark:text-slate-400">Avg/Day</p>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {item.has_forecast ? item.avg_daily_forecast.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {(item.stock_status === 'critical' || item.stock_status === 'reorder_needed') && (
            <button
              onClick={() => onOrder(item.product_id)}
              disabled={ordering === item.product_id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-all duration-200 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {ordering === item.product_id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ShoppingCart className="h-3.5 w-3.5" />}
              {ordering === item.product_id ? 'Ordering…' : 'Order Now'}
            </button>
          )}
          <button
            onClick={() => setExpanded(x => !x)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/60 dark:hover:bg-neutral-800 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-dashed border-current/10 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-500 dark:text-slate-400 mb-0.5">Lead Time</p>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{item.lead_time_days} days</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 mb-0.5">Safety Stock</p>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{item.safety_stock.toLocaleString()} units</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 mb-0.5">30-Day Forecast</p>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {item.has_forecast ? item.total_30_day_forecast.toLocaleString() : 'No forecast yet'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 mb-0.5">Unit Cost</p>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {item.unit_cost > 0 ? `$${item.unit_cost.toFixed(2)}` : '—'}
            </p>
          </div>
          {item.order_by_date && (
            <div>
              <p className="text-slate-500 dark:text-slate-400 mb-0.5">Order By</p>
              <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.order_by_date}
              </p>
            </div>
          )}
          {item.suggested_order_qty !== null && item.suggested_order_qty > 0 && (
            <div>
              <p className="text-slate-500 dark:text-slate-400 mb-0.5">Suggested Qty</p>
              <p className="font-semibold text-violet-600 dark:text-violet-400">
                {item.suggested_order_qty.toLocaleString()} units
              </p>
            </div>
          )}
          {item.unit_cost > 0 && item.suggested_order_qty > 0 && (
            <div>
              <p className="text-slate-500 dark:text-slate-400 mb-0.5">Est. Order Value</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                ${(item.unit_cost * item.suggested_order_qty).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReorderIntelligence() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ordering, setOrdering] = useState(null); // product_id being ordered
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState(null);

  const companyId = getCompanyId(user);

  const fetchIntelligence = useCallback(async (silent = false) => {
    if (!companyId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await getReorderIntelligence(companyId);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => { fetchIntelligence(); }, [fetchIntelligence]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const res = await uploadInventorySnapshot(companyId, file);
      toast({ title: '✅ Snapshot uploaded', description: `${res.itemCount} products loaded.` });
      await fetchIntelligence();
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleOrder = async (productId) => {
    if (!companyId) return;
    setOrdering(productId);
    try {
      await triggerReorder(companyId, productId);
      toast({
        title: '🛒 Order triggered',
        description: `Reorder for ${productId.replace(/_/g, ' ')} has been stamped.`,
      });
    } catch (err) {
      toast({ title: 'Order failed', description: err.message, variant: 'destructive' });
    } finally {
      setOrdering(null);
    }
  };

  // ── filter items ─────────────────────────────────────────────────────────
  const allItems = data?.items || [];
  const filteredItems = filterStatus === 'all'
    ? allItems
    : allItems.filter(i => i.stock_status === filterStatus);

  const FILTERS = [
    { key: 'all',           label: 'All' },
    { key: 'critical',      label: '🔴 Critical' },
    { key: 'reorder_needed', label: '🟡 Reorder' },
    { key: 'ok',            label: '🟢 OK' },
    { key: 'overstock',     label: '🔵 Overstock' },
    { key: 'no_forecast',   label: '⚫ No Forecast' },
  ];

  // ── export CSV ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!allItems.length) return;
    const header = 'Product,Status,Stock,ROP,Coverage(days),Avg/Day,Order By,Suggested Qty,Unit Cost\n';
    const rows = allItems.map(i =>
      `${i.product_id},${i.stock_status},${i.current_stock},${i.rop ?? ''},${i.coverage_days ?? ''},${i.avg_daily_forecast},${i.order_by_date ?? ''},${i.suggested_order_qty ?? ''},${i.unit_cost}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reorder_intelligence_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── staleness label ──────────────────────────────────────────────────────
  const cacheAgeLabel = (() => {
    if (!data?.predictionCacheAge) return null;
    const diffMs = Date.now() - new Date(data.predictionCacheAge).getTime();
    const diffH = Math.round(diffMs / 3600000);
    if (diffH < 1) return 'less than 1 hour ago';
    return `~${diffH} hour${diffH !== 1 ? 's' : ''} ago`;
  })();

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-100 dark:from-black dark:via-black dark:to-black">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <Zap className="h-3.5 w-3.5" />
              AI-Powered
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reorder Intelligence</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              GAT+LSTM forecasts joined with live inventory — proactive stock management.
            </p>
            {cacheAgeLabel && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Forecast data last updated {cacheAgeLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Upload snapshot */}
            <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 shadow-sm border
              ${uploading
                ? 'bg-slate-100 dark:bg-neutral-800 text-slate-400 cursor-not-allowed border-slate-200 dark:border-neutral-800'
                : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300 hover:border-violet-400 dark:hover:border-violet-650 hover:text-violet-600 dark:hover:text-violet-400 hover:shadow-md'
              }`}>
              {uploading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload Snapshot'}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
            {/* Refresh */}
            <button
              onClick={() => fetchIntelligence(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {/* Export */}
            {allItems.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-all duration-200 shadow-sm"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            )}
          </div>
        </div>

        {/* ── Summary cards ── */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard label="Critical"       count={data.summary.critical}       icon={XCircle}      colorClass="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" />
            <SummaryCard label="Reorder Needed" count={data.summary.reorder_needed} icon={AlertTriangle} colorClass="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
            <SummaryCard label="Healthy"        count={data.summary.ok}             icon={CheckCircle2}  colorClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" />
            <SummaryCard label="Overstock"      count={data.summary.overstock}      icon={Package}      colorClass="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" />
            <SummaryCard label="No Forecast"    count={data.summary.no_forecast}    icon={BarChart3}    colorClass="bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400" />
          </div>
        )}



        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-violet-200 dark:border-violet-800" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-violet-600 dark:border-violet-400 border-t-transparent animate-spin" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Computing reorder intelligence…</p>
          </div>
        )}

        {/* ── Error / Onboarding Snapshot Upload ── */}
        {!loading && error && (
          error.toLowerCase().includes('snapshot') ? (
            <div className="flex flex-col items-center py-6 px-4 animate-fade-in-up">
              <Card className="w-full max-w-xl shadow-2xl border-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-neutral-900 dark:to-neutral-900 rounded-t-2xl border-b border-slate-100 dark:border-neutral-800/50">
                  <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
                    <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <span>Initialize Reorder Intelligence</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-center">
                    To start displaying suggestions, upload a current inventory snapshot CSV file.
                  </div>

                  {/* Sleek, matching file upload zone from Upload.js */}
                  <label className="block">
                    <div className="border-dashed border-2 border-slate-300 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-blue-400 transition-all duration-300 group hover:shadow-lg bg-gradient-to-br from-blue-50/20 to-cyan-50/20 dark:from-neutral-900/90 dark:to-neutral-900/90 rounded-2xl p-8 cursor-pointer relative">
                      <div className="text-center space-y-3">
                        {uploading ? (
                          <div className="space-y-3">
                            <Loader2 className="h-12 w-12 text-blue-500 mx-auto animate-spin" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">Processing Snapshot...</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mapping warehouse stock levels...</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="relative group-hover:scale-105 transition-transform duration-300">
                              <Upload className="h-12 w-12 text-slate-450 mx-auto group-hover:text-blue-500 transition-colors" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">Choose Inventory CSV File</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">drag and drop or click to browse</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        disabled={uploading}
                        onChange={handleUpload}
                      />
                    </div>
                  </label>

                  <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 text-center">
                    Required columns: 
                    <code className="bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-violet-600 dark:text-violet-400 font-semibold">product_id</code> 
                    and 
                    <code className="bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-violet-600 dark:text-violet-400 font-semibold">current_stock</code>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center py-20 gap-4">
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 max-w-lg w-full text-center">
                <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Could not load data</p>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )
        )}

        {/* ── Items table ── */}
        {!loading && !error && data && (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    filterStatus === f.key
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-300 hover:border-violet-400'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    filterStatus === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {f.key === 'all' ? allItems.length : (data.summary[f.key] ?? 0)}
                  </span>
                </button>
              ))}
            </div>

            {/* Product rows */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No products in this category</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map(item => (
                  <ProductRow
                    key={item.product_id}
                    item={item}
                    onOrder={handleOrder}
                    ordering={ordering}
                  />
                ))}
              </div>
            )}

            {/* Snapshot metadata */}
            <p className="text-xs text-center text-slate-400 dark:text-slate-600">
              Inventory snapshot: {new Date(data.snapshotDate).toLocaleString()} · {data.totalItems} products
            </p>
          </>
        )}
      </div>
    </div>
  );
}
