import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { getModelInfo, getTrendingInventory, getInventoryAnalytics, getTrainingStatus } from '../lib/api';
import {
  BarChart3, TrendingUp, TrendingDown, Activity, Package, Brain,
  ArrowRight, Upload, Eye, RefreshCw, AlertTriangle, CheckCircle,
  Clock, Zap, Sparkles
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modelInfo, setModelInfo] = useState(null);
  const [trending, setTrending] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        let companyId = localStorage.getItem('companyId');
        if (!companyId) {
          const u = localStorage.getItem('user');
          if (u) companyId = JSON.parse(u).companyId;
        }
        if (!companyId) { setLoading(false); return; }

        const results = await Promise.allSettled([
          getModelInfo(companyId),
          getTrendingInventory(companyId, '30d'),
          getInventoryAnalytics(companyId),
          getTrainingStatus(companyId),
        ]);
        if (results[0].status === 'fulfilled') setModelInfo(results[0].value);
        if (results[1].status === 'fulfilled') setTrending(results[1].value?.trending_items || []);
        if (results[2].status === 'fulfilled') setAnalytics(results[2].value?.summary || null);
        if (results[3].status === 'fulfilled') setTrainingStatus(results[3].value);
      } catch (e) { console.error('Dashboard load error:', e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const accuracy = modelInfo?.metrics?.val_mape != null
    ? Math.round((1 - modelInfo.metrics.val_mape) * 100) : null;
  const atRisk = trending.filter(t => t.trend_direction === 'down').length;
  const needsReorder = trending.filter(t => {
    const cur = Number(t.current_demand || 0), pred = Number(t.predicted_demand || 0);
    return cur > 0 && pred / cur < 0.85;
  }).length;
  const totalProducts = analytics?.total_products || trending.length || 0;
  const modelTrained = modelInfo?.created_at;
  const modelStatus = trainingStatus?.status === 'training' ? 'training'
    : modelInfo ? 'active' : 'not_trained';

  const formatDate = (d) => {
    if (!d) return 'Never';
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-full border border-indigo-200 dark:border-slate-700 shadow-lg mb-3">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Dashboard</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-800 to-indigo-600 dark:from-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
                Welcome back{user?.companyName ? `, ${user.companyName}` : ''}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Your supply chain intelligence at a glance</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={`${modelStatus === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : modelStatus === 'training' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                <div className={`w-2 h-2 rounded-full mr-1.5 ${modelStatus === 'active' ? 'bg-green-500' : modelStatus === 'training' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                {modelStatus === 'active' ? 'Model Active' : modelStatus === 'training' ? 'Training...' : 'No Model'}
              </Badge>
              {modelTrained && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />Trained {formatDate(modelTrained)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {[
            { label: 'Total Products', value: totalProducts, Icon: Package, color: 'from-blue-500 to-blue-600', textColor: 'text-slate-900 dark:text-white' },
            { label: 'Forecast Accuracy', value: accuracy != null ? `${accuracy}%` : '—', Icon: BarChart3, color: 'from-indigo-500 to-purple-600', textColor: accuracy && accuracy > 80 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' },
            { label: 'Products At Risk', value: atRisk, Icon: AlertTriangle, color: 'from-red-500 to-red-600', textColor: atRisk > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400' },
            { label: 'Needs Reorder', value: needsReorder, Icon: RefreshCw, color: 'from-amber-500 to-orange-600', textColor: needsReorder > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400' },
          ].map(({ label, value, Icon, color, textColor }) => (
            <Card key={label} className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-xl transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
                    <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
                  </div>
                  <div className={`w-11 h-11 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Trending Products */}
          <Card className="lg:col-span-2 shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span>Top Trending Products</span>
                <Badge className="bg-white/80 text-blue-700 border-blue-200 dark:bg-slate-700 dark:text-blue-300 ml-auto">30d</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {trending.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <Package className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p>No trending data yet. Upload data and train a model to see insights.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {trending.slice(0, 8).map((item, i) => {
                    const growth = item.growth_rate || 0;
                    const isUp = item.trend_direction === 'up';
                    const isDown = item.trend_direction === 'down';
                    return (
                      <button key={item.product} onClick={() => navigate('/prediction', { state: { product: item.product } })}
                        className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-xs font-mono text-slate-400 w-5">{i + 1}</span>
                          <span className="font-medium text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.product}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`text-sm font-semibold ${isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-slate-500'}`}>
                            {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                          </span>
                          {isUp ? <TrendingUp className="h-4 w-4 text-green-500" /> : isDown ? <TrendingDown className="h-4 w-4 text-red-500" /> : <Activity className="h-4 w-4 text-slate-400" />}
                          <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
                <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <span>Quick Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {[
                { label: 'Run Prediction', desc: 'Forecast demand for any product', icon: Eye, route: '/prediction', gradient: 'from-blue-600 to-indigo-600' },
                { label: 'View Inventory', desc: 'Stock health & optimization', icon: Package, route: '/inventory', gradient: 'from-green-600 to-emerald-600' },
                { label: 'Upload New Data', desc: 'Add new supply chain datasets', icon: Upload, route: '/upload', gradient: 'from-orange-600 to-amber-600' },
                { label: 'Retrain Model', desc: 'Re-train with latest data', icon: Brain, route: '/upload', gradient: 'from-purple-600 to-pink-600' },
              ].map(({ label, desc, icon: Icon, route, gradient }) => (
                <button key={label} onClick={() => navigate(route)}
                  className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group text-left">
                  <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Model Health */}
        <Card className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
              <Brain className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <span>Model Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {modelInfo ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Model Type</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{modelInfo.model_type || 'GAT-LSTM Hybrid'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Nodes</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{modelInfo.feature_columns?.length || modelInfo.node_list?.length || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Validation MAPE</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{modelInfo.metrics?.val_mape != null ? `${(modelInfo.metrics.val_mape * 100).toFixed(1)}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Training Epochs</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{modelInfo.metrics?.training_epochs || '—'}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                <Brain className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p>No model trained yet. Upload data and start training to see model health.</p>
                <Button onClick={() => navigate('/upload')} className="mt-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
