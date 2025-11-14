import React, { useEffect, useMemo, useState } from 'react';
import { getTrendingInventory, getInventoryAnalytics } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Package, TrendingUp, TrendingDown, Shield, RefreshCw, Filter,
  ArrowUpCircle, ArrowDownCircle, MinusCircle, Download
} from 'lucide-react';

const HORIZON = '30d';

const InventoryOptimization = () => {
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

      const trending = trendingData?.trending_items || [];
      setItems(trending);
      setAnalytics(analyticsData?.summary || null);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Failed to load optimization data',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const decisions = useMemo(() => {
    // Simple rules using existing fields from ML service:
    // action = Stock Up if predicted > current * 1.15
    // action = Reduce if predicted < current * 0.85
    // else Maintain
    return (items || []).map((it) => {
      const current = Number(it.current_demand || it.current_sales || 0);
      const predicted = Number(it.predicted_demand || it.predicted_sales || 0);
      const ratio = current > 0 ? predicted / current : (predicted > 0 ? 2 : 1);
      let action = 'Maintain';
      let advice = '';
      
      if (ratio > 1.15) {
        action = 'Stock Up';
        const increasePct = ((predicted - current) / current * 100).toFixed(1);
        advice = `Expected ${increasePct}% increase in demand. Increase inventory by ${Math.ceil((predicted - current) * 1.2)} units to meet forecasted demand and avoid stockouts.`;
      } else if (ratio < 0.85) {
        action = 'Reduce';
        const decreasePct = ((current - predicted) / current * 100).toFixed(1);
        advice = `Expected ${decreasePct}% decrease in demand. Reduce inventory by ${Math.ceil((current - predicted) * 0.8)} units to avoid overstocking and free up capital. Consider promotional strategies.`;
      } else {
        action = 'Maintain';
        advice = `Demand is expected to remain stable. Maintain current inventory levels. Monitor closely for any trend changes.`;
      }
      
      const delta = predicted - current;
      return {
        product: String(it.product),
        current,
        predicted,
        ratio,
        delta,
        trend: it.trend_direction,
        risk: it.risk_level,
        action,
        advice,
      };
    });
  }, [items]);

  const exportCsv = () => {
    const header = ['product', 'current', 'predicted', 'delta', 'ratio', 'trend', 'risk', 'action'];
    const rows = decisions.map(d => [
      d.product, d.current, d.predicted, d.delta.toFixed(2), d.ratio.toFixed(2), d.trend, d.risk, d.action
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_optimization_${HORIZON}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ActionBadge = ({ action }) => {
    if (action === 'Stock Up') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
          <ArrowUpCircle className="h-4 w-4 mr-1" /> Stock Up
        </Badge>
      );
    }
    if (action === 'Reduce') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
          <ArrowDownCircle className="h-4 w-4 mr-1" /> Reduce
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
        <MinusCircle className="h-4 w-4 mr-1" /> Maintain
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">Loading inventory optimization...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stockUpCount = decisions.filter(d => d.action === 'Stock Up').length;
  const reduceCount = decisions.filter(d => d.action === 'Reduce').length;
  const maintainCount = decisions.filter(d => d.action === 'Maintain').length;
  const goingDown = decisions.filter(d => d.action === 'Reduce');

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-200 dark:border-slate-700 shadow-lg mb-4">
            <Package className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Inventory Optimization</span>
            <Shield className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent mb-2">
            30-Day Stock Recommendations
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            Actionable guidance to stock up or reduce inventory based on forecasts
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Products</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{analytics?.total_products || decisions.length}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Stock Up</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stockUpCount}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Reduce</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{reduceCount}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Maintain</p>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{maintainCount}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg flex items-center justify-center">
                  <MinusCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Going Down Notice */}
        <Card className="mb-8 shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.22s' }}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span>Products Trending Down — Do not over-order</span>
              <Badge className="ml-2 bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                {goingDown.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goingDown.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400">No products currently trending down in the 30-day horizon.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {goingDown.map(g => (
                  <Badge key={g.product} variant="outline" className="text-sm dark:border-slate-700">
                    {g.product} • {g.delta.toFixed(1)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Optimization Advice Section */}
        <Card className="mb-8 shadow-lg border-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span>Optimization Recommendations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {decisions.filter(d => d.action === 'Stock Up').length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Stock Up Recommendations ({decisions.filter(d => d.action === 'Stock Up').length} products)
                </h4>
                <ul className="space-y-2 text-sm text-green-700 dark:text-green-400">
                  {decisions.filter(d => d.action === 'Stock Up').map(d => (
                    <li key={d.product} className="flex items-start">
                      <span className="font-medium mr-2">• {d.product}:</span>
                      <span>{d.advice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {decisions.filter(d => d.action === 'Reduce').length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Reduce Stock Recommendations ({decisions.filter(d => d.action === 'Reduce').length} products)
                </h4>
                <ul className="space-y-2 text-sm text-red-700 dark:text-red-400">
                  {decisions.filter(d => d.action === 'Reduce').map(d => (
                    <li key={d.product} className="flex items-start">
                      <span className="font-medium mr-2">• {d.product}:</span>
                      <span>{d.advice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {decisions.filter(d => d.action === 'Maintain').length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold text-slate-800 dark:text-slate-300 mb-2 flex items-center">
                  <MinusCircle className="h-4 w-4 mr-2" />
                  Maintain Current Levels ({decisions.filter(d => d.action === 'Maintain').length} products)
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  These products show stable demand. Continue monitoring for any trend changes and maintain current inventory levels.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 mb-4 sm:mb-0">
            <Filter className="h-4 w-4" />
            <span className="text-sm">Horizon: {HORIZON}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => { setRefreshing(true); loadData(); }}
              disabled={refreshing}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {refreshing ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Refreshing...</> : <><RefreshCw className="mr-2 h-4 w-4" />Refresh</>}
            </Button>
            <Button variant="outline" onClick={exportCsv} className="dark:border-slate-700 dark:text-white">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Decisions Table */}
        <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span>Optimization Actions</span>
              <Badge className="bg-white/80 text-blue-700 border-blue-200 shadow-sm dark:bg-slate-700 dark:text-blue-300 dark:border-blue-800">
                {HORIZON}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {decisions.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400">No items available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600 dark:text-slate-300">
                      <th className="py-2 pr-4">Product</th>
                      <th className="py-2 pr-4">Current</th>
                      <th className="py-2 pr-4">Predicted</th>
                      <th className="py-2 pr-4">Δ (Pred - Curr)</th>
                      <th className="py-2 pr-4">Ratio</th>
                      <th className="py-2 pr-4">Trend</th>
                      <th className="py-2 pr-4">Risk</th>
                      <th className="py-2 pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((d) => (
                      <tr key={d.product} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{d.product}</td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{Math.round(d.current)}</td>
                        <td className="py-3 pr-4 text-blue-700 dark:text-blue-300">{Math.round(d.predicted)}</td>
                        <td className="py-3 pr-4">{d.delta >= 0 ? '+' : ''}{Math.round(d.delta)}</td>
                        <td className="py-3 pr-4">{d.ratio.toFixed(2)}</td>
                        <td className="py-3 pr-4 capitalize">{d.trend}</td>
                        <td className="py-3 pr-4 capitalize">{d.risk}</td>
                        <td className="py-3 pr-4"><ActionBadge action={d.action} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InventoryOptimization;


