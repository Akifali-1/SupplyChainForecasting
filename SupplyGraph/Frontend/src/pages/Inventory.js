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
  BarChart3, Activity, AlertTriangle, ChevronUp, ChevronDown
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
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
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
      'Stock Up': { cls: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300', Icon: ArrowUpCircle },
      'Reduce': { cls: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300', Icon: ArrowDownCircle },
      'Maintain': { cls: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300', Icon: MinusCircle },
    };
    const { cls, Icon } = cfg[action] || cfg['Maintain'];
    return <Badge className={cls}><Icon className="h-3.5 w-3.5 mr-1" />{action}</Badge>;
  };

  const TrendIcon = ({ trend }) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-slate-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-900">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Loading inventory data...</p>
          </div>
        </div>
      </div>
    );
  }

  const stockUpCount = decisions.filter(d => d.action === 'Stock Up').length;
  const reduceCount = decisions.filter(d => d.action === 'Reduce').length;
  const maintainCount = decisions.filter(d => d.action === 'Maintain').length;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-200 dark:border-slate-700 shadow-lg mb-4">
            <Package className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Inventory Command Center</span>
            <Shield className="h-4 w-4 text-purple-500" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent mb-2">
            Inventory Intelligence
          </h1>
          <p className="text-slate-600 dark:text-slate-300">Complete visibility into stock health, trends, and optimization actions</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {[
            { label: 'Total Products', value: analytics?.total_products || decisions.length, color: 'from-blue-500 to-blue-600', Icon: Package },
            { label: 'Stock Up', value: stockUpCount, color: 'from-green-500 to-green-600', Icon: TrendingUp },
            { label: 'Reduce', value: reduceCount, color: 'from-red-500 to-red-600', Icon: TrendingDown },
            { label: 'Maintain', value: maintainCount, color: 'from-slate-500 to-slate-600', Icon: MinusCircle },
          ].map(({ label, value, color, Icon }) => (
            <Card key={label} className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                  </div>
                  <div className={`w-11 h-11 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md">
              <BarChart3 className="h-4 w-4 mr-2" />Overview
            </TabsTrigger>
            <TabsTrigger value="health" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md">
              <Activity className="h-4 w-4 mr-2" />Stock Health
            </TabsTrigger>
            <TabsTrigger value="optimization" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md">
              <Shield className="h-4 w-4 mr-2" />Optimization
            </TabsTrigger>
            <TabsTrigger value="actions" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md">
              <Package className="h-4 w-4 mr-2" />Actions
            </TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-6">
            {/* Trending Down Warning */}
            {decisions.filter(d => d.action === 'Reduce').length > 0 && (
              <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Products Trending Down — Do Not Over-Order</span>
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 ml-2">{decisions.filter(d => d.action === 'Reduce').length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {decisions.filter(d => d.action === 'Reduce').map(g => (
                      <Badge key={g.product} variant="outline" className="dark:border-slate-700">{g.product} • {g.delta.toFixed(1)}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['Stock Up', 'Reduce', 'Maintain'].map(action => {
                const list = decisions.filter(d => d.action === action);
                const colors = { 'Stock Up': 'green', 'Reduce': 'red', 'Maintain': 'slate' };
                const c = colors[action];
                return (
                  <Card key={action} className={`shadow-lg border-0 bg-${c}-50/80 dark:bg-slate-800/90 backdrop-blur-sm`}>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-sm font-semibold text-${c}-800 dark:text-${c}-300 flex items-center`}>
                        <ActionBadge action={action} />
                        <span className="ml-2">{list.length} products</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {list.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">None</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {list.slice(0, 5).map(d => (
                            <li key={d.product} className="flex justify-between text-slate-700 dark:text-slate-300">
                              <span className="truncate mr-2">{d.product}</span>
                              <span className="font-mono">{d.delta >= 0 ? '+' : ''}{d.delta.toFixed(0)}</span>
                            </li>
                          ))}
                          {list.length > 5 && <li className="text-slate-400 text-xs">+{list.length - 5} more</li>}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search products..."
                  className="pl-10 pr-4 py-2 w-full border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(d => {
                const pctChange = d.current > 0 ? ((d.predicted - d.current) / d.current * 100) : 0;
                const barWidth = Math.min(100, Math.abs(pctChange));
                const isUp = d.action === 'Stock Up';
                const isDown = d.action === 'Reduce';
                return (
                  <div key={d.product} className={`group relative rounded-xl overflow-hidden bg-white dark:bg-slate-800/95 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border ${isDown ? 'border-red-200/80 dark:border-red-900/50' : isUp ? 'border-green-200/80 dark:border-green-900/50' : 'border-slate-200/80 dark:border-slate-700/50'}`}>
                    <div className={`h-1 ${isDown ? 'bg-gradient-to-r from-red-500 to-orange-500' : isUp ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'}`} />
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDown ? 'bg-red-100 dark:bg-red-900/30' : isUp ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
                            <Package className={`h-4 w-4 ${isDown ? 'text-red-600 dark:text-red-400' : isUp ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`} />
                          </div>
                          <h3 className="font-bold text-slate-900 dark:text-white truncate text-sm">{d.product}</h3>
                        </div>
                        <TrendIcon trend={d.trend} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">Current</p>
                          <p className="text-lg font-bold text-slate-800 dark:text-white">{d.current.toLocaleString()}</p>
                        </div>
                        <div className={`rounded-lg p-3 text-center ${isDown ? 'bg-red-50 dark:bg-red-900/20' : isUp ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">Predicted</p>
                          <p className={`text-lg font-bold ${isDown ? 'text-red-600 dark:text-red-400' : isUp ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>{d.predicted.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500 dark:text-slate-400">Change</span>
                          <span className={`font-bold ${isDown ? 'text-red-600 dark:text-red-400' : isUp ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${isDown ? 'bg-gradient-to-r from-red-500 to-orange-400' : isUp ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-slate-400 to-slate-500'}`}
                            style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <ActionBadge action={d.action} />
                        {d.risk && (
                          <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${d.risk === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : d.risk === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                            {d.risk} risk
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
          <TabsContent value="optimization" className="space-y-4">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 backdrop-blur-sm">
              <CardHeader><CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white"><Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" /><span>Recommendations</span></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {['Stock Up', 'Reduce', 'Maintain'].map(action => {
                  const list = decisions.filter(d => d.action === action);
                  if (list.length === 0) return null;
                  const colors = { 'Stock Up': { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-800 dark:text-green-300', sub: 'text-green-700 dark:text-green-400' },
                    'Reduce': { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-800 dark:text-red-300', sub: 'text-red-700 dark:text-red-400' },
                    'Maintain': { bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-800 dark:text-slate-300', sub: 'text-slate-600 dark:text-slate-400' }
                  };
                  const c = colors[action];
                  return (
                    <div key={action} className={`${c.bg} p-4 rounded-lg border ${c.border}`}>
                      <h4 className={`font-semibold ${c.text} mb-2`}>{action} — {list.length} products</h4>
                      <ul className={`space-y-1.5 text-sm ${c.sub}`}>
                        {list.map(d => <li key={d.product}>• <strong>{d.product}:</strong> {d.advice}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== ACTIONS TABLE TAB ===== */}
          <TabsContent value="actions" className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..."
                    className="pl-10 pr-4 py-2 w-48 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                </div>
                <div className="flex space-x-1">
                  {['all', 'Stock Up', 'Reduce', 'Maintain'].map(f => (
                    <button key={f} onClick={() => setActionFilter(f)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${actionFilter === f ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                      {f === 'all' ? 'All' : f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => { setRefreshing(true); loadData(); }} disabled={refreshing} size="sm"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv} className="dark:border-slate-700 dark:text-white">
                  <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-600 dark:text-slate-300 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800">
                        {[
                          { key: 'product', label: 'Product' }, { key: 'current', label: 'Current' },
                          { key: 'predicted', label: 'Predicted' }, { key: 'delta', label: 'Δ' },
                          { key: 'ratio', label: 'Ratio' }, { key: 'trend', label: 'Trend' },
                          { key: 'risk', label: 'Risk' }, { key: 'action', label: 'Action' }
                        ].map(({ key, label }) => (
                          <th key={key} className="py-3 px-4 font-semibold cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 select-none" onClick={() => toggleSort(key)}>
                            {label}<SortIcon field={key} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(d => (
                        <tr key={d.product} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{d.product}</td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{Math.round(d.current)}</td>
                          <td className="py-3 px-4 text-blue-700 dark:text-blue-300">{Math.round(d.predicted)}</td>
                          <td className={`py-3 px-4 font-mono ${d.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{d.delta >= 0 ? '+' : ''}{Math.round(d.delta)}</td>
                          <td className="py-3 px-4 font-mono">{d.ratio.toFixed(2)}</td>
                          <td className="py-3 px-4"><TrendIcon trend={d.trend} /></td>
                          <td className="py-3 px-4 capitalize">{d.risk}</td>
                          <td className="py-3 px-4"><ActionBadge action={d.action} /></td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">No matching products</td></tr>
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
