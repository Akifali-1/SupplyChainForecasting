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
      return { 
        label: 'Critical', 
        color: 'text-rose-450', 
        bg: 'bg-rose-500/[0.03]', 
        border: 'border-rose-500/20', 
        dot: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' 
      };
    case 'reorder_needed':
      return { 
        label: 'Reorder', 
        color: 'text-amber-400', 
        bg: 'bg-amber-500/[0.03]', 
        border: 'border-amber-500/20', 
        dot: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' 
      };
    case 'overstock':
      return { 
        label: 'Overstock', 
        color: 'text-[#00B4D8]', 
        bg: 'bg-[#00B4D8]/[0.03]', 
        border: 'border-[#00B4D8]/20', 
        dot: 'bg-[#00B4D8] shadow-[0_0_10px_rgba(0,180,216,0.5)]' 
      };
    case 'ok':
      return { 
        label: 'OK', 
        color: 'text-emerald-450', 
        bg: 'bg-emerald-500/[0.03]', 
        border: 'border-emerald-500/20', 
        dot: 'bg-emerald-450 shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
      };
    default:
      return { 
        label: 'No Forecast', 
        color: 'text-slate-400', 
        bg: 'bg-white/[0.01]', 
        border: 'border-white/[0.06]', 
        dot: 'bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.4)]' 
      };
  }
}

function SummaryCard({ label, count, icon: Icon, colorClass }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/[0.07] bg-white/[0.015] backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:bg-white/[0.025] hover:border-white/[0.1] transition-all duration-300 group">
      <div className={`p-3 rounded-xl ${colorClass} bg-white/[0.03] border border-white/[0.05] group-hover:scale-105 transition-transform duration-300`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight font-mono">{count}</p>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function AnomalyBadge({ anomaly }) {
  if (!anomaly) return null;
  const spike = anomaly.type === 'demand_spike';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
      spike ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
             : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.035] backdrop-blur-2xl transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)] relative overflow-hidden group">
      {/* Glow highlight stripe on left */}
      <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${sc.dot}`} />
      
      {/* Main row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-6 py-5">
        
        {/* Status indicator + Name */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className={`shrink-0 h-2 w-2 rounded-full ${sc.dot}`} />
          <div className="min-w-0">
            <p className="font-bold text-white tracking-wide truncate text-sm">
              {item.product_id.replace(/_/g, ' ')}
            </p>
            <div className="flex items-center gap-2.5 flex-wrap mt-1">
              <span className={`text-[10px] font-bold tracking-wider uppercase ${sc.color}`}>{sc.label}</span>
              <AnomalyBadge anomaly={item.anomaly} />
            </div>
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-8 gap-y-1.5 text-center shrink-0">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Stock</p>
            <p className="font-bold text-slate-200 mt-0.5 font-mono text-sm">{item.current_stock.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">ROP</p>
            <p className={`font-bold mt-0.5 font-mono text-sm ${item.rop !== null && item.current_stock <= item.rop ? 'text-rose-400' : 'text-slate-300'}`}>
              {item.rop !== null ? item.rop.toLocaleString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Coverage</p>
            <p className={`font-bold mt-0.5 font-mono text-sm ${
              item.coverage_days !== null && item.coverage_days <= item.lead_time_days ? 'text-rose-400'
              : item.coverage_days !== null && item.coverage_days <= 14 ? 'text-amber-400'
              : 'text-slate-350'
            }`}>
              {item.coverage_days !== null ? `${item.coverage_days}d` : '—'}
            </p>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Avg/Day</p>
            <p className="font-bold text-slate-300 mt-0.5 font-mono text-sm">
              {item.has_forecast ? item.avg_daily_forecast.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {(item.stock_status === 'critical' || item.stock_status === 'reorder_needed') && (
            <button
              onClick={() => onOrder(item.product_id)}
              disabled={ordering === item.product_id}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all duration-300 hover:scale-[1.04] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(124,58,237,0.3)] border-0 cursor-pointer"
            >
              {ordering === item.product_id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ShoppingCart className="h-3.5 w-3.5" />}
              <span>{ordering === item.product_id ? 'Ordering…' : 'Order Now'}</span>
            </button>
          )}
          <button
            onClick={() => setExpanded(x => !x)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.04] transition-all cursor-pointer"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-dashed border-white/[0.06] bg-white/[0.005] px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Lead Time</p>
            <p className="font-bold text-slate-300 font-mono">{item.lead_time_days} days</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Safety Stock</p>
            <p className="font-bold text-slate-300 font-mono">{item.safety_stock.toLocaleString()} units</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">30-Day Forecast</p>
            <p className="font-bold text-slate-350 font-mono">
              {item.has_forecast ? item.total_30_day_forecast.toLocaleString() : 'No forecast yet'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Unit Cost</p>
            <p className="font-bold text-slate-300 font-mono">
              {item.unit_cost > 0 ? `$${item.unit_cost.toFixed(2)}` : '—'}
            </p>
          </div>
          {item.order_by_date && (
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Order By</p>
              <p className="font-bold text-amber-400 flex items-center gap-1 font-mono">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                {item.order_by_date}
              </p>
            </div>
          )}
          {item.suggested_order_qty !== null && item.suggested_order_qty > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Suggested Qty</p>
              <p className="font-bold text-violet-450 text-violet-400 font-mono">
                {item.suggested_order_qty.toLocaleString()} units
              </p>
            </div>
          )}
          {item.unit_cost > 0 && item.suggested_order_qty > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Est. Order Value</p>
              <p className="font-bold text-slate-200 font-mono">
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
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-[#000000] relative overflow-hidden text-white">
      {/* Radial glow background lights */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[#7B2FBE]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-[#00B4D8]/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] text-[#00B4D8] px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3">
              <Zap className="h-3.5 w-3.5" />
              AI-Powered Cognitive Model
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent tracking-tight">
              Reorder Intelligence
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xl leading-relaxed">
              GAT+LSTM predictions merged with live inventory telemetry for preemptive catalog management.
            </p>
            {cacheAgeLabel && (
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-[#00B4D8]" />
                Forecast weights parsed {cacheAgeLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Upload snapshot */}
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer transition-all duration-300 shadow-lg border
              ${uploading
                ? 'bg-white/[0.02] border-white/[0.06] text-slate-500 cursor-not-allowed'
                : 'bg-white/[0.03] border-white/[0.08] text-white hover:bg-white/[0.06] hover:border-[#00B4D8]/50 hover:shadow-[0_0_15px_rgba(0,180,216,0.2)]'
              }`}>
              {uploading
                ? <Loader2 className="h-4 w-4 animate-spin text-[#00B4D8]" />
                : <Upload className="h-4 w-4 text-[#00B4D8]" />}
              <span>{uploading ? 'Processing…' : 'Upload Snapshot'}</span>
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase bg-white/[0.03] border border-white/[0.08] text-white hover:bg-white/[0.06] hover:border-[#7B2FBE]/50 hover:shadow-[0_0_15px_rgba(123,47,190,0.2)] transition-all duration-300 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-[#7B2FBE] ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Export */}
            {allItems.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase bg-white/[0.03] border border-white/[0.08] text-white hover:bg-white/[0.06] hover:border-slate-500 transition-all duration-300 shadow-lg cursor-pointer"
              >
                <Download className="h-4 w-4 text-slate-400" />
                <span>Export</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Summary cards ── */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard label="Critical"       count={data.summary.critical}       icon={XCircle}      colorClass="text-rose-400 bg-rose-500/10 border-rose-500/20" />
            <SummaryCard label="Reorder Needed" count={data.summary.reorder_needed} icon={AlertTriangle} colorClass="text-amber-400 bg-amber-500/10 border-amber-500/20" />
            <SummaryCard label="Healthy"        count={data.summary.ok}             icon={CheckCircle2}  colorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20" />
            <SummaryCard label="Overstock"      count={data.summary.overstock}      icon={Package}      colorClass="text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20" />
            <SummaryCard label="No Forecast"    count={data.summary.no_forecast}    icon={BarChart3}    colorClass="text-slate-400 bg-white/[0.03] border-white/[0.05]" />
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-white/[0.04] border-t-[#00B4D8] animate-spin" />
            </div>
            <p className="text-slate-400 font-mono text-xs">Computing real-time coverage projections...</p>
          </div>
        )}

        {/* ── Error / Onboarding Snapshot Upload ── */}
        {!loading && error && (
          error.toLowerCase().includes('snapshot') ? (
            <div className="flex flex-col items-center py-6 px-4 animate-fade-in-up">
              <Card className="w-full max-w-xl border border-white/[0.08] bg-white/[0.015] backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.85)] overflow-hidden">
                <CardHeader className="border-b border-white/[0.06] bg-white/[0.01] p-6">
                  <CardTitle className="flex items-center space-x-3 text-white text-lg font-semibold">
                    <Database className="h-5 w-5 text-[#00B4D8]" />
                    <span>Initialize Reorder Intelligence</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="text-sm text-slate-300 leading-relaxed text-center">
                    To start displaying suggestions, upload a current inventory snapshot CSV file.
                  </div>

                  {/* Sleek, matching file upload zone from Upload.js */}
                  <label className="block">
                    <div className="border-dashed border-2 border-white/[0.08] hover:border-[#00B4D8]/50 transition-all duration-300 group hover:shadow-[0_0_25px_rgba(0,180,216,0.15)] bg-white/[0.01] hover:bg-white/[0.02] backdrop-blur-xl rounded-2xl p-8 cursor-pointer relative overflow-hidden">
                      <div className="text-center space-y-3">
                        {uploading ? (
                          <div className="space-y-3">
                            <Loader2 className="h-12 w-12 text-[#00B4D8] mx-auto animate-spin" />
                            <div>
                              <p className="font-semibold text-white">Processing Snapshot...</p>
                              <p className="text-xs text-slate-400 mt-1">Mapping warehouse stock levels...</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="relative group-hover:scale-105 transition-transform duration-300">
                              <Upload className="h-12 w-12 text-slate-500 mx-auto group-hover:text-[#00B4D8] transition-colors" />
                            </div>
                            <div>
                              <p className="font-semibold text-white group-hover:text-[#00B4D8] transition-colors">Choose Inventory CSV File</p>
                              <p className="text-xs text-slate-455 text-slate-400 mt-1">drag and drop or click to browse</p>
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

                  <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 text-center">
                    Required columns: 
                    <code className="bg-white/[0.04] px-2 py-0.5 rounded text-violet-400 font-mono">product_id</code> 
                    and 
                    <code className="bg-white/[0.04] px-2 py-0.5 rounded text-violet-400 font-mono">current_stock</code>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center py-20 gap-4">
              <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 max-w-lg w-full text-center">
                <XCircle className="h-10 w-10 text-rose-455 text-rose-400 mx-auto mb-3" />
                <p className="font-semibold text-white mb-1">Could not load dataset</p>
                <p className="text-xs text-slate-400 font-mono">{error}</p>
              </div>
            </div>
          )
        )}

        {/* ── Items table ── */}
        {!loading && !error && data && (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-3 flex-wrap bg-white/[0.015] border border-white/[0.06] p-2 rounded-2xl">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                    filterStatus === f.key
                      ? 'bg-gradient-to-r from-[#00B4D8] to-[#7B2FBE] text-white shadow-[0_0_15px_rgba(0,180,216,0.3)] border-0'
                      : 'bg-transparent border border-transparent text-slate-400 hover:text-white hover:border-white/[0.08]'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    filterStatus === f.key ? 'bg-white/20 text-white' : 'bg-white/[0.05] text-slate-400'
                  }`}>
                    {f.key === 'all' ? allItems.length : (data.summary[f.key] ?? 0)}
                  </span>
                </button>
              ))}
            </div>

            {/* Product rows */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-20 border border-white/[0.06] rounded-2xl bg-white/[0.01]">
                <Package className="h-12 w-12 mx-auto mb-3 text-slate-600 animate-pulse" />
                <p className="font-semibold text-slate-400">No matching products located in this scope</p>
              </div>
            ) : (
              <div className="space-y-4">
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
            <p className="text-[10px] text-center text-slate-500 font-mono uppercase tracking-wider pt-4">
              Inventory Snapshot: {new Date(data.snapshotDate).toLocaleString()} · {data.totalItems} Active Nodes
            </p>
          </>
        )}
      </div>
    </div>
  );
}
