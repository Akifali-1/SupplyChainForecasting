import React, { useEffect, useMemo, useState } from 'react';
import { getTrendingInventory, getInventoryAnalytics } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Package, TrendingUp, TrendingDown, Shield, RefreshCw, Filter,
  ArrowUpCircle, ArrowDownCircle, MinusCircle, Download, Search,
  BarChart3, Activity, AlertTriangle, ChevronUp, ChevronDown, Sparkles, Clock, ArrowRight
} from 'lucide-react';

const HORIZON = '30d';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('product');
  const [sortDir, setSortDir] = useState('asc');
  const [actionFilter, setActionFilter] = useState('all');
  const { toast } = useToast();

  const loadData = async () => {
    try {
      let companyId = localStorage.getItem('companyId');
      if (!companyId) {
        const user = localStorage.getItem('user');
        if (user) companyId = JSON.parse(user).companyId;
      }
      if (!companyId) throw new Error('Missing companyId');
      const [trendingData, analyticsData] = await Promise.all([
        getTrendingInventory(companyId, HORIZON),
        getInventoryAnalytics(companyId),
      ]);
      setItems(trendingData?.trending_items || []);
      setAnalytics(analyticsData?.summary || null);
    } catch (err) {
      toast({ title: 'Failed to load data', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const decisions = useMemo(() => {
    return (items || []).map((it) => {
      const current = Number(it.current_demand || it.current_sales || 0);
      const predicted = Number(it.predicted_demand || it.predicted_sales || 0);
      const ratio = current > 0 ? predicted / current : (predicted > 0 ? 2 : 1);
      let action = 'Maintain', advice = '';
      if (ratio > 1.15) {
        action = 'Stock Up';
        const pct = ((predicted - current) / current * 100).toFixed(1);
        advice = `Expected ${pct}% increase. Increase inventory by ${Math.ceil((predicted - current) * 1.2)} units.`;
      } else if (ratio < 0.85) {
        action = 'Reduce';
        const pct = ((current - predicted) / current * 100).toFixed(1);
        advice = `Expected ${pct}% decrease. Reduce by ${Math.ceil((current - predicted) * 0.8)} units.`;
      } else {
        advice = 'Demand stable. Maintain current levels.';
      }
      return {
        product: String(it.product), current, predicted, ratio,
        delta: predicted - current, trend: it.trend_direction,
        risk: it.risk_level, action, advice,
        volatility: it.volatility || 0, growth: it.growth_rate || 0,
      };
    });
  }, [items]);

  const filtered = useMemo(() => {
    let result = decisions;
    if (searchTerm) result = result.filter(d => d.product.toLowerCase().includes(searchTerm.toLowerCase()));
    if (actionFilter !== 'all') result = result.filter(d => d.action === actionFilter);
    result.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [decisions, searchTerm, actionFilter, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5 inline ml-1 text-[#00B4D8]" /> : <ChevronDown className="h-3.5 w-3.5 inline ml-1 text-[#00B4D8]" />;
  };

  const exportCsv = () => {
    const header = ['product','current','predicted','delta','ratio','trend','risk','action'];
    const rows = filtered.map(d => [d.product, d.current, d.predicted, d.delta.toFixed(2), d.ratio.toFixed(2), d.trend, d.risk, d.action]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `inventory_${HORIZON}.csv`; a.click();
  };

  const ActionBadge = ({ action }) => {
    const cfg = {
      'Stock Up': { cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20', Icon: ArrowUpCircle },
      'Reduce': { cls: 'bg-red-500/10 text-rose-650 dark:text-red-400 border border-red-500/20', Icon: ArrowDownCircle },
      'Maintain': { cls: 'bg-slate-100 dark:bg-white/[0.02] text-slate-650 dark:text-slate-400 border border-slate-250 dark:border-white/10', Icon: MinusCircle },
    };
    const { cls, Icon } = cfg[action] || cfg['Maintain'];
    return (
      <Badge className={`${cls} rounded-lg font-mono text-xs uppercase px-2.5 py-1 flex items-center w-fit gap-1 border`}>
        <Icon className="h-3.5 w-3.5" />
        {action}
      </Badge>
    );
  };

  const TrendIcon = ({ trend }) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-rose-400" />;
    return <Activity className="h-4 w-4 text-slate-400" />;
  };

  const renderMiniChart = (label) => {
    switch (label) {
      case 'Total Products':
        return (
          <svg className="w-full h-8 mt-3 text-[#00B4D8]" viewBox="0 0 100 30" fill="none">
            <path d="M 5 20 Q 25 15, 45 22 T 85 8 L 95 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 20 Q 25 15, 45 22 T 85 8 L 95 10 L 95 30 L 5 30 Z" fill="url(#blue-grad-inv)" opacity="0.08" />
            <defs>
              <linearGradient id="blue-grad-inv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00B4D8" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'Stock Up':
        return (
          <svg className="w-full h-8 mt-3 text-green-500" viewBox="0 0 100 30" fill="none">
            <path d="M 5 25 Q 30 20, 50 10 T 95 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 25 Q 30 20, 50 10 T 95 4 L 95 30 L 5 30 Z" fill="url(#green-grad-inv)" opacity="0.08" />
            <defs>
              <linearGradient id="green-grad-inv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'Reduce':
        return (
          <svg className="w-full h-8 mt-3 text-red-500" viewBox="0 0 100 30" fill="none">
            <path d="M 5 4 Q 30 10, 50 20 T 95 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 4 Q 30 10, 50 20 T 95 26 L 95 30 L 5 30 Z" fill="url(#red-grad-inv)" opacity="0.08" />
            <defs>
              <linearGradient id="red-grad-inv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'Maintain':
        return (
          <svg className="w-full h-8 mt-3 text-slate-500" viewBox="0 0 100 30" fill="none">
            <path d="M 5 15 Q 25 20, 45 10 T 85 20 L 95 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 15 Q 25 20, 45 10 T 85 20 L 95 15 L 95 30 L 5 30 Z" fill="url(#slate-grad-inv)" opacity="0.08" />
            <defs>
              <linearGradient id="slate-grad-inv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748B" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-24 px-4 bg-slate-50 dark:bg-[#000000] relative flex items-center justify-center">
        <div className="absolute top-[20%] left-[-10%] w-[300px] h-[300px] rounded-full bg-[#00B4D8]/10 blur-[100px] pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00B4D8] mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-mono text-sm tracking-wider uppercase">Syncing Inventory Databases...</p>
        </div>
      </div>
    );
  }

  const stockUpCount = decisions.filter(d => d.action === 'Stock Up').length;
  const reduceCount = decisions.filter(d => d.action === 'Reduce').length;
  const maintainCount = decisions.filter(d => d.action === 'Maintain').length;

  return (
    <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-[#000000] relative overflow-hidden text-slate-900 dark:text-white">
      {/* Background Ambient Glow Orbs for Elite Visual Depth */}
      <div className="absolute top-[10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-[#00B4D8]/8 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[450px] h-[450px] rounded-full bg-[#7B2FBE]/6 blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 animate-fade-in">
        
        {/* Header Block */}
        <div className="mb-10 flex items-center justify-between flex-wrap gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] backdrop-blur-xl px-4 py-1.5 rounded-full shadow-sm dark:shadow-2xl mb-4">
              <Sparkles className="h-3.5 w-3.5 text-[#00B4D8]" />
              <span className="text-xs font-mono tracking-widest text-[#00B4D8] uppercase">Logistics Matrix v1.2</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              Inventory Intelligence
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm md:text-base">STGT recommendations for nodes safety-stock level and flow optimization models.</p>
          </div>
          
          <div className="flex items-center space-x-3 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-2.5 rounded-2xl backdrop-blur-lg">
            <span className="text-[10px] font-mono text-slate-500 flex items-center">
              <Clock className="h-3.5 w-3.5 mr-1 text-slate-500" /> Auto-sync complete. Horizon: {HORIZON}
            </span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Products', value: analytics?.total_products || decisions.length, Icon: Package, color: 'from-cyan-500/20 to-blue-500/10', borderHover: 'hover:border-blue-500/30' },
            { label: 'Stock Up', value: stockUpCount, Icon: TrendingUp, color: 'from-green-500/20 to-emerald-500/10', borderHover: 'hover:border-green-500/30' },
            { label: 'Reduce', value: reduceCount, Icon: TrendingDown, color: 'from-red-500/20 to-rose-500/10', borderHover: 'hover:border-red-500/30' },
            { label: 'Maintain', value: maintainCount, Icon: MinusCircle, color: 'from-slate-500/20 to-slate-500/10', borderHover: 'hover:border-slate-500/30' },
          ].map(({ label, value, Icon, color, borderHover }) => (
            <Card key={label} className={`border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.015] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-0.5 ${borderHover} overflow-hidden shadow-sm dark:shadow-2xl`}>
              <CardContent className="p-5 flex flex-col justify-between h-full relative">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 tracking-tight">{value}</p>
                  </div>
                  <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-center`}>
                    <Icon className="h-4.5 w-4.5 text-slate-700 dark:text-white/90" />
                  </div>
                </div>
                {/* Custom Mini SVG Trends */}
                {renderMiniChart(label)}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab Controls */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-1.5 rounded-2xl backdrop-blur-xl">
            {[
              { value: 'overview', label: 'Overview', Icon: BarChart3 },
              { value: 'health', label: 'Stock Health', Icon: Activity },
              { value: 'optimization', label: 'Optimization', Icon: Shield },
              { value: 'actions', label: 'Actions', Icon: Package }
            ].map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-[#00B4D8]/10 data-[state=active]:text-[#00B4D8] data-[state=active]:border-[#00B4D8]/20 transition-all font-mono text-xs uppercase py-2.5 rounded-xl border border-transparent flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-6 animate-fade-in-up">
            {/* Warning Block */}
            {decisions.filter(d => d.action === 'Reduce').length > 0 && (
              <Card className="border border-red-500/20 bg-red-50 dark:bg-red-500/5 backdrop-blur-2xl shadow-sm dark:shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="bg-red-100/30 dark:bg-red-500/5 border-b border-red-500/10 px-6 py-4">
                  <CardTitle className="flex items-center space-x-2 text-red-600 dark:text-rose-400">
                    <AlertTriangle className="h-5 w-5 animate-pulse text-red-500" />
                    <span className="font-semibold text-sm uppercase tracking-wider font-mono">Excess Stock Risk Anomalies</span>
                    <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20 font-mono ml-auto">
                      {decisions.filter(d => d.action === 'Reduce').length} Nodes
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mb-4">STGT neural models forecast substantial demand declines at these nodes. Excess capacity risks holding cost spikes. Avoid replenishment.</p>
                  <div className="flex flex-wrap gap-2">
                    {decisions.filter(d => d.action === 'Reduce').map(g => (
                      <Badge key={g.product} variant="outline" className="bg-slate-50 dark:bg-white/[0.01] border-slate-200 dark:border-white/[0.08] hover:border-red-500/30 text-slate-700 dark:text-slate-300 font-mono text-xs px-3 py-1 rounded-lg transition-colors">
                        {g.product} <span className="text-red-600 dark:text-red-400 font-bold ml-1.5">{g.delta.toFixed(0)}</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Summary Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[
                {
                  action: 'Stock Up',
                  title: 'Replenish / Increase Capacity',
                  desc: 'High demand triggers. Action safety stock increase.',
                  colors: 'from-green-500/10 to-emerald-500/5 border-green-500/10 hover:border-green-500/30',
                  accentColor: 'bg-green-500'
                },
                {
                  action: 'Reduce',
                  title: 'Deplete / Hold Restraints',
                  desc: 'Downward drift trend triggers. Suppress over-ordering.',
                  colors: 'from-red-500/10 to-rose-500/5 border-red-500/10 hover:border-red-500/30',
                  accentColor: 'bg-red-500'
                },
                {
                  action: 'Maintain',
                  title: 'Balanced / Flow Intact',
                  desc: 'Node is fully balanced. Keep current flows active.',
                  colors: 'from-slate-500/10 to-slate-500/5 border-slate-200 dark:border-white/[0.06] hover:border-slate-350 dark:hover:border-white/20',
                  accentColor: 'bg-slate-500'
                }
              ].map(({ action, title, desc, colors, accentColor }) => {
                const list = decisions.filter(d => d.action === action);
                return (
                  <Card key={action} className={`border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.015] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-0.5 shadow-sm dark:shadow-2xl rounded-2xl overflow-hidden`}>
                    <div className={`h-1 w-full ${accentColor}`} />
                    <CardHeader className="p-5 border-b border-slate-100 dark:border-white/[0.03] bg-slate-50/50 dark:bg-white/[0.01]">
                      <div className="flex items-center justify-between">
                        <ActionBadge action={action} />
                        <Badge className="bg-slate-100 dark:bg-white/[0.03] text-slate-650 dark:text-slate-400 border border-slate-200 dark:border-white/5 font-mono text-[10px]">{list.length} units</Badge>
                      </div>
                      <h3 className="font-bold text-slate-800 dark:text-white text-sm mt-3">{title}</h3>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{desc}</p>
                    </CardHeader>
                    <CardContent className="p-5">
                      {list.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 dark:text-slate-600">
                          <Package className="h-8 w-8 mx-auto mb-2 text-slate-400 dark:text-slate-700" />
                          <p className="font-mono text-[10px] uppercase tracking-wider">No nodes registered</p>
                        </div>
                      ) : (
                        <ul className="space-y-3 font-mono text-xs">
                          {list.slice(0, 5).map(d => (
                            <li key={d.product} className="flex justify-between items-center bg-slate-50 dark:bg-white/[0.01] border border-slate-100 dark:border-white/[0.04] p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-colors group">
                              <span className="truncate mr-2 font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white transition-colors">{d.product}</span>
                              <span className={`font-bold ${d.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {d.delta >= 0 ? '+' : ''}{d.delta.toFixed(0)}
                              </span>
                            </li>
                          ))}
                          {list.length > 5 && (
                            <li className="text-center pt-2">
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest">+ {list.length - 5} additional products</span>
                            </li>
                          )}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ===== STOCK HEALTH TAB ===== */}
          <TabsContent value="health" className="space-y-6 animate-fade-in-up">
            <div className="flex items-center space-x-3 max-w-md bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-1.5 rounded-2xl backdrop-blur-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter by product identifier..."
                  className="pl-10 pr-4 py-2.5 w-full bg-transparent border-0 rounded-xl text-slate-800 dark:text-slate-300 focus:outline-none focus:ring-0 text-sm font-mono placeholder-slate-450 dark:placeholder-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(d => {
                const pctChange = d.current > 0 ? ((d.predicted - d.current) / d.current * 100) : 0;
                const barWidth = Math.min(100, Math.abs(pctChange));
                const isUp = d.action === 'Stock Up';
                const isDown = d.action === 'Reduce';
                const accentColor = isDown ? 'border-red-500/30 hover:border-red-500/50' : isUp ? 'border-green-500/30 hover:border-green-500/50' : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-350 dark:hover:border-white/20';
                return (
                  <div
                    key={d.product}
                    className={`group relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.015] border backdrop-blur-2xl shadow-sm dark:shadow-2xl hover:shadow-lg dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.6)] hover:-translate-y-1 transition-all duration-300 ${accentColor}`}
                  >
                    <div className={`h-1 w-full bg-gradient-to-r ${isDown ? 'from-red-500 to-orange-500' : isUp ? 'from-green-500 to-emerald-500' : 'from-slate-500 to-slate-400'}`} />
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5`}>
                            <Package className={`h-4.5 w-4.5 ${isDown ? 'text-rose-500 dark:text-rose-400' : isUp ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`} />
                          </div>
                          <h3 className="font-extrabold text-slate-800 dark:text-white truncate text-sm tracking-tight">{d.product}</h3>
                        </div>
                        <TrendIcon trend={d.trend} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4 font-mono text-xs">
                        <div className="bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.04] rounded-xl p-3 text-center">
                          <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Current</p>
                          <p className="text-base font-bold text-slate-800 dark:text-white">{d.current.toLocaleString()}</p>
                        </div>
                        <div className={`border rounded-xl p-3 text-center bg-slate-50 dark:bg-white/[0.01] ${isDown ? 'border-red-500/20 dark:border-red-500/10' : isUp ? 'border-green-500/20 dark:border-green-500/10' : 'border-slate-250 dark:border-slate-500/10'}`}>
                          <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Predicted</p>
                          <p className={`text-base font-bold ${isDown ? 'text-rose-600 dark:text-rose-400' : isUp ? 'text-green-600 dark:text-green-400' : 'text-[#00B4D8]'}`}>{d.predicted.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                          <span className="text-slate-500 uppercase">Confidence Drift</span>
                          <span className={`font-bold ${isDown ? 'text-rose-600 dark:text-rose-400' : isUp ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-white/[0.04] rounded-full overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${isDown ? 'from-red-550 to-orange-400 dark:from-red-500 dark:to-orange-400' : isUp ? 'from-green-550 to-emerald-400 dark:from-green-500 dark:to-emerald-400' : 'from-[#00B4D8] to-[#7B2FBE]'}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/[0.04] h-8">
                        <ActionBadge action={d.action} />
                        {d.risk && (
                          <span className={`text-[9px] font-mono uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-lg border ${
                            d.risk === 'high'
                              ? 'bg-red-500/10 text-red-650 dark:text-red-400 border-red-500/20'
                              : d.risk === 'medium'
                                ? 'bg-amber-500/10 text-amber-650 dark:text-amber-400 border-amber-500/20'
                                : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                          }`}>
                            {d.risk} RISK
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ===== OPTIMIZATION TAB ===== */}
          <TabsContent value="optimization" className="space-y-6 animate-fade-in-up">
            <Card className="border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.015] backdrop-blur-2xl shadow-sm dark:shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-200 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01] px-6 py-5">
                <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
                  <Shield className="h-5 w-5 text-[#00B4D8]" />
                  <span className="font-semibold text-sm uppercase tracking-wider font-mono">Neural Logistics Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {['Stock Up', 'Reduce', 'Maintain'].map(action => {
                  const list = decisions.filter(d => d.action === action);
                  if (list.length === 0) return null;
                  const cfg = {
                    'Stock Up': { cls: 'border-green-500/20 bg-green-500/5', titleCls: 'text-green-600 dark:text-green-400', bullet: 'bg-green-500' },
                    'Reduce': { cls: 'border-red-500/20 bg-red-500/5', titleCls: 'text-rose-650 dark:text-rose-400', bullet: 'bg-rose-500' },
                    'Maintain': { cls: 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.01]', titleCls: 'text-slate-500 dark:text-slate-400', bullet: 'bg-slate-450' }
                  };
                  const { cls, titleCls, bullet } = cfg[action] || cfg['Maintain'];
                  return (
                    <div key={action} className={`p-5 rounded-2xl border ${cls} backdrop-blur-md`}>
                      <h4 className={`font-mono text-xs uppercase tracking-widest font-extrabold flex items-center gap-2 ${titleCls} mb-3.5`}>
                        <span className={`w-2 h-2 rounded-full ${bullet} animate-pulse`} />
                        {action} Operational Mandates — {list.length} Items Detected
                      </h4>
                      <ul className="space-y-3 font-mono text-xs text-slate-650 dark:text-slate-300">
                        {list.map(d => (
                          <li key={d.product} className="flex items-start bg-slate-100/50 dark:bg-black/25 border border-slate-200 dark:border-white/[0.03] p-3.5 rounded-xl gap-2 hover:bg-slate-200/50 dark:hover:bg-black/45 transition-colors">
                            <span className="text-[#00B4D8] font-bold shrink-0">{d.product}:</span>
                            <span className="text-slate-600 dark:text-slate-400">{d.advice}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>          {/* ===== ACTIONS TABLE TAB ===== */}
          <TabsContent value="actions" className="space-y-6 animate-fade-in-up">
            {/* Control Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-4 rounded-2xl backdrop-blur-xl shadow-sm dark:shadow-none">
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search query..."
                    className="pl-10 pr-4 py-2.5 w-full bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-300 focus:outline-none focus:border-[#00B4D8]/45 focus:ring-1 focus:ring-[#00B4D8]/45 text-sm font-mono placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  {['all', 'Stock Up', 'Reduce', 'Maintain'].map(f => (
                    <button
                      key={f}
                      onClick={() => setActionFilter(f)}
                      className={`px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider rounded-xl transition-all border ${
                        actionFilter === f
                          ? 'bg-[#00B4D8]/10 text-[#00B4D8] border-[#00B4D8]/20'
                          : 'bg-slate-50 dark:bg-white/[0.01] border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {f === 'all' ? 'All Rows' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2.5 w-full lg:w-auto justify-end">
                <Button
                  onClick={() => { setRefreshing(true); loadData(); }}
                  disabled={refreshing}
                  className="bg-gradient-to-r from-[#00B4D8] to-[#7B2FBE] hover:from-[#00B4D8]/90 hover:to-[#7B2FBE]/90 font-mono text-xs uppercase tracking-wider rounded-xl px-4 py-2.5 border-0 shadow-lg shrink-0 text-white"
                >
                  <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Syncing...' : 'Sync Data'}
                </Button>
                <Button
                  variant="outline"
                  onClick={exportCsv}
                  className="border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white font-mono text-xs uppercase tracking-wider rounded-xl px-4 py-2.5 shrink-0"
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  CSV Export
                </Button>
              </div>
            </div>

            {/* Actions Table Overhaul (Translucent rows with status accents on hover) */}
            <Card className="border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.015] backdrop-blur-2xl shadow-sm dark:shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs font-mono">
                    <thead>
                      <tr className="text-left text-slate-500 bg-slate-50/50 dark:bg-white/[0.01] border-b border-slate-200 dark:border-white/[0.05]">
                        {[
                          { key: 'product', label: 'Product Node' },
                          { key: 'current', label: 'Current Demand' },
                          { key: 'predicted', label: 'STGT Prediction' },
                          { key: 'delta', label: 'Delta (Δ)' },
                          { key: 'ratio', label: 'Ratio' },
                          { key: 'trend', label: 'Trend' },
                          { key: 'risk', label: 'Risk' },
                          { key: 'action', label: 'Action Vector' }
                        ].map(({ key, label }) => (
                          <th
                            key={key}
                            className="py-4 px-5 font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-white select-none transition-colors"
                            onClick={() => toggleSort(key)}
                          >
                            <span className="flex items-center gap-1">
                              {label}
                              <SortIcon field={key} />
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {filtered.map(d => {
                        const isUp = d.action === 'Stock Up';
                        const isDown = d.action === 'Reduce';
                        const hoverAccent = isUp ? 'hover:border-l-green-500' : isDown ? 'hover:border-l-rose-500' : 'hover:border-l-slate-400';
                        return (
                          <tr
                            key={d.product}
                            className={`border-l-2 border-l-transparent transition-all hover:bg-slate-100/50 dark:hover:bg-white/[0.02] ${hoverAccent}`}
                          >
                            <td className="py-4 px-5 font-bold text-slate-800 dark:text-white">{d.product}</td>
                            <td className="py-4 px-5 text-slate-655 dark:text-slate-400">{Math.round(d.current).toLocaleString()}</td>
                            <td className="py-4 px-5 text-[#00B4D8] font-semibold">{Math.round(d.predicted).toLocaleString()}</td>
                            <td className={`py-4 px-5 font-bold ${d.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-655 dark:text-rose-400'}`}>
                              {d.delta >= 0 ? '+' : ''}{Math.round(d.delta).toLocaleString()}
                            </td>
                            <td className="py-4 px-5 text-slate-655 dark:text-slate-400">{d.ratio.toFixed(2)}</td>
                            <td className="py-4 px-5"><TrendIcon trend={d.trend} /></td>
                            <td className="py-4 px-5">
                              <span className={`px-2 py-0.5 rounded-lg border ${
                                d.risk === 'high'
                                  ? 'bg-red-500/10 text-red-655 dark:text-red-400 border-red-500/20'
                                  : d.risk === 'medium'
                                    ? 'bg-amber-500/10 text-amber-655 dark:text-amber-400 border-amber-500/20'
                                    : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                              } uppercase text-[9px] font-bold`}>
                                {d.risk}
                              </span>
                            </td>
                            <td className="py-4 px-5"><ActionBadge action={d.action} /></td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            <Package className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                            <p className="font-mono text-xs uppercase tracking-widest">No matching nodes located</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Inventory;
