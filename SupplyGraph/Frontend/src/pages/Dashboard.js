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

  // Bespoke inline vector micro-trendlines for high-end look
  const renderMiniChart = (label) => {
    switch (label) {
      case 'Total Products':
        return (
          <svg className="w-full h-8 mt-3 text-[#00B4D8]" viewBox="0 0 100 30" fill="none">
            <path d="M 5 25 Q 25 22, 45 16 T 85 8 L 95 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 25 Q 25 22, 45 16 T 85 8 L 95 6 L 95 30 L 5 30 Z" fill="url(#blue-grad)" opacity="0.08" />
            <defs>
              <linearGradient id="blue-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00B4D8" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'Forecast Accuracy':
        return (
          <svg className="w-full h-8 mt-3 text-green-500" viewBox="0 0 100 30" fill="none">
            <path d="M 5 22 Q 25 14, 45 12 T 85 5 L 95 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 22 Q 25 14, 45 12 T 85 5 L 95 4 L 95 30 L 5 30 Z" fill="url(#green-grad)" opacity="0.08" />
            <defs>
              <linearGradient id="green-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'Products At Risk':
        return (
          <svg className="w-full h-8 mt-3 text-red-500" viewBox="0 0 100 30" fill="none">
            <path d="M 5 28 Q 20 28, 35 15 T 70 8 L 85 22 L 95 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 28 Q 20 28, 35 15 T 70 8 L 85 22 L 95 6 L 95 30 L 5 30 Z" fill="url(#red-grad)" opacity="0.08" />
            <defs>
              <linearGradient id="red-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'Needs Reorder':
        return (
          <svg className="w-full h-8 mt-3 text-amber-500" viewBox="0 0 100 30" fill="none">
            <path d="M 5 6 L 30 6 L 30 20 L 60 20 L 60 14 L 85 14 L 85 28 L 95 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 6 L 30 6 L 30 20 L 60 20 L 60 14 L 85 14 L 85 28 L 95 28 L 95 30 L 5 30 Z" fill="url(#amber-grad)" opacity="0.08" />
            <defs>
              <linearGradient id="amber-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" />
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
      <div className="min-h-screen py-24 px-4 bg-[#000000] relative flex items-center justify-center">
        <div className="absolute top-[20%] left-[-10%] w-[300px] h-[300px] rounded-full bg-[#00B4D8]/10 blur-[100px] pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00B4D8] mx-auto mb-4" />
          <p className="text-slate-400 font-mono text-sm tracking-wider uppercase">Loading Intelligence System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8 bg-[#000000] relative overflow-hidden text-white">
      {/* Background Glow Orbs for elite depth */}
      <div className="absolute top-[10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-[#00B4D8]/8 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[450px] h-[450px] rounded-full bg-[#7B2FBE]/6 blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Block */}
        <div className="mb-10 animate-fade-in-up">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl px-4 py-1.5 rounded-full shadow-2xl mb-4">
                <Sparkles className="h-3.5 w-3.5 text-[#00B4D8]" />
                <span className="text-xs font-mono tracking-widest text-[#00B4D8] uppercase">Command Center v1.2</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </h1>
              <p className="text-slate-400 mt-2 text-sm md:text-base">Neural networks active. Stock level anomaly predictions synchronized.</p>
            </div>
            
            <div className="flex items-center space-x-3 bg-white/[0.02] border border-white/[0.08] p-2.5 rounded-2xl backdrop-blur-lg">
              <Badge className={`${
                modelStatus === 'active' 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : modelStatus === 'training' 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
              } rounded-lg font-mono text-xs uppercase px-2.5 py-1`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-2 inline-block ${
                  modelStatus === 'active' ? 'bg-green-400 animate-pulse' : modelStatus === 'training' ? 'bg-amber-400 animate-ping' : 'bg-red-400'
                }`} />
                {modelStatus === 'active' ? 'GNN Engine: Active' : modelStatus === 'training' ? 'GNN: Training' : 'GNN: Offline'}
              </Badge>
              {modelTrained && (
                <span className="text-[10px] font-mono text-slate-500 flex items-center pr-2">
                  <Clock className="h-3 w-3 mr-1 text-slate-500" />Trained {formatDate(modelTrained)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Products', value: totalProducts, Icon: Package, color: 'from-cyan-500/20 to-blue-500/10', borderHover: 'hover:border-blue-500/30' },
            { label: 'Forecast Accuracy', value: accuracy != null ? `${accuracy}%` : '—', Icon: BarChart3, color: 'from-green-500/20 to-emerald-500/10', borderHover: 'hover:border-green-500/30' },
            { label: 'Products At Risk', value: atRisk, Icon: AlertTriangle, color: 'from-red-500/20 to-rose-500/10', borderHover: 'hover:border-red-500/30' },
            { label: 'Needs Reorder', value: needsReorder, Icon: RefreshCw, color: 'from-amber-500/20 to-orange-500/10', borderHover: 'hover:border-amber-500/30' },
          ].map(({ label, value, Icon, color, borderHover }) => (
            <Card key={label} className={`border border-white/[0.06] bg-white/[0.015] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-0.5 ${borderHover} overflow-hidden shadow-2xl`}>
              <CardContent className="p-5 flex flex-col justify-between h-full relative">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 tracking-tight">{value}</p>
                  </div>
                  <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl border border-white/5 flex items-center justify-center`}>
                    <Icon className="h-4.5 w-4.5 text-white/90" />
                  </div>
                </div>
                {/* Mini chart visual integration */}
                {renderMiniChart(label)}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Block */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Trending Products Panel */}
          <Card className="lg:col-span-2 border border-white/[0.06] bg-white/[0.015] backdrop-blur-2xl overflow-hidden shadow-2xl">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.01] px-6 py-4">
              <CardTitle className="flex items-center space-x-2 text-white">
                <TrendingUp className="h-4 w-4 text-[#00B4D8]" />
                <span className="font-semibold text-sm uppercase tracking-wider font-mono">Anomaly Signals & Trending</span>
                <Badge className="bg-white/[0.03] text-[#00B4D8] border border-white/5 font-mono ml-auto">30D Window</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {trending.length === 0 ? (
                <div className="py-20 text-center text-slate-500">
                  <Package className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                  <p className="font-mono text-xs uppercase tracking-wider">No active datasets synced. Launch onboarding in upload panel.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04] overflow-hidden">
                  {trending.slice(0, 7).map((item, i) => {
                    const growth = item.growth_rate || 0;
                    const isUp = item.trend_direction === 'up';
                    const isDown = item.trend_direction === 'down';
                    return (
                      <button 
                        key={item.product} 
                        onClick={() => navigate('/prediction', { state: { product: item.product } })}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-all text-left group border-l-2 border-transparent hover:border-l-[#00B4D8]"
                      >
                        <div className="flex items-center space-x-4 min-w-0">
                          <span className="text-[10px] font-mono text-slate-600 w-5">{String(i + 1).padStart(2, '0')}</span>
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-white group-hover:text-[#00B4D8] transition-colors truncate block">{item.product}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Current: {Number(item.current_demand || 0).toFixed(0)} units</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className={`text-xs font-mono font-bold ${isUp ? 'text-green-400' : isDown ? 'text-rose-400' : 'text-slate-400'}`}>
                              {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                            </span>
                            <span className="text-[9px] text-slate-500 block font-mono">growth rate</span>
                          </div>
                          <div className={`p-1.5 rounded-lg bg-white/[0.02] border border-white/5`}>
                            {isUp ? <TrendingUp className="h-3.5 w-3.5 text-green-400" /> : isDown ? <TrendingDown className="h-3.5 w-3.5 text-rose-400" /> : <Activity className="h-3.5 w-3.5 text-slate-400" />}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-[#00B4D8] group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Panel */}
          <Card className="border border-white/[0.06] bg-white/[0.015] backdrop-blur-2xl overflow-hidden shadow-2xl">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.01] px-6 py-4">
              <CardTitle className="flex items-center space-x-2 text-white">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="font-semibold text-sm uppercase tracking-wider font-mono">Action Modules</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {[
                { label: 'Run Prediction Engine', desc: 'Analyse future GNN demand models', icon: Eye, route: '/prediction', gradient: 'from-[#00B4D8]/20 to-blue-500/5 hover:border-[#00B4D8]/20', iconColor: 'text-[#00B4D8]', adminOnly: false },
                { label: 'Inventory Control Center', desc: 'Optimize current safety stock levels', icon: Package, route: '/inventory', gradient: 'from-green-500/20 to-emerald-500/5 hover:border-green-500/20', iconColor: 'text-green-400', adminOnly: false },
                { label: 'Ingest New Dataset', desc: 'Upload CSV or connect ERP database', icon: Upload, route: '/upload', gradient: 'from-orange-500/20 to-amber-500/5 hover:border-orange-500/20', iconColor: 'text-orange-400', adminOnly: true },
                { label: 'Execute GNN Retraining', desc: 'Optimize weights on updated nodes', icon: Brain, route: '/upload', gradient: 'from-purple-500/20 to-pink-500/5 hover:border-purple-500/20', iconColor: 'text-purple-400', adminOnly: true },
              ].filter(action => !action.adminOnly || user?.role === 'admin').map(({ label, desc, icon: Icon, route, gradient, iconColor }) => (
                <button 
                  key={label} 
                  onClick={() => navigate(route)}
                  className={`w-full flex items-center space-x-3.5 p-3 rounded-2xl bg-white/[0.01] border border-white/[0.04] transition-all hover:bg-white/[0.03] group text-left ${gradient}`}
                >
                  <div className={`w-9 h-9 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${iconColor}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-xs tracking-wide group-hover:text-white transition-colors">{label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{desc}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Model Health / GNN Radar sweep */}
        <Card className="border border-white/[0.06] bg-white/[0.015] backdrop-blur-2xl overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.01] px-6 py-4">
            <CardTitle className="flex items-center space-x-2 text-white">
              <Brain className="h-4 w-4 text-[#7B2FBE]" />
              <span className="font-semibold text-sm uppercase tracking-wider font-mono">Neural Model Diagnostics</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {modelInfo ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Topology Model Type</p>
                    <p className="font-semibold text-white mt-1 text-sm md:text-base">{modelInfo.model_type || 'GAT-LSTM Hybrid'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Active Graph Nodes</p>
                    <p className="font-semibold text-white mt-1 text-sm md:text-base">{modelInfo.feature_columns?.length || modelInfo.node_list?.length || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Validation Accuracy</p>
                    <p className="font-semibold text-[#00B4D8] mt-1 text-sm md:text-base">{accuracy != null ? `${accuracy}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Optimizer Epochs</p>
                    <p className="font-semibold text-white mt-1 text-sm md:text-base">{modelInfo.metrics?.training_epochs || '—'}</p>
                  </div>
                </div>

                {/* Animated GNN Neural Radar visualization */}
                <div className="flex items-center justify-center lg:justify-end">
                  <div className="relative w-28 h-28 flex items-center justify-center bg-white/[0.01] border border-white/[0.06] rounded-full">
                    {/* Pulsing Sweep Rings */}
                    <div className="absolute inset-1.5 border border-[#00B4D8]/10 rounded-full animate-ping" style={{ animationDuration: '3.5s' }} />
                    <div className="absolute inset-5 border border-[#7B2FBE]/10 rounded-full animate-ping" style={{ animationDuration: '4.5s' }} />
                    
                    {/* SVG Scanning Grid */}
                    <svg className="w-full h-full absolute inset-0 text-[#00B4D8]/10" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="3,3" />
                      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.4" />
                      <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="0.4" />
                      <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2,2" />
                      <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2,2" />
                      {/* Spinning sweep line */}
                      <line x1="50" y1="50" x2="85" y2="15" stroke="#00B4D8" strokeWidth="1.2" strokeLinecap="round" className="origin-[50px_50px] animate-spin" style={{ animationDuration: '5.5s' }} />
                    </svg>

                    {/* Orbiting mock nodes for visual premium feel */}
                    <div className="absolute top-[20%] left-[25%] w-1.5 h-1.5 bg-[#7B2FBE] rounded-full animate-pulse" />
                    <div className="absolute bottom-[25%] right-[20%] w-1.5 h-1.5 bg-[#00B4D8] rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />

                    {/* Glowing Core Node */}
                    <div className="w-3.5 h-3.5 bg-gradient-to-tr from-[#00B4D8] to-[#7B2FBE] rounded-full shadow-lg shadow-cyan-500/50 relative z-10 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500">
                <Brain className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                <p className="font-mono text-xs uppercase tracking-wider">No active neural networks compiled. Complete dataset upload.</p>
                <Button onClick={() => navigate('/upload')} className="mt-4 bg-gradient-to-r from-[#00B4D8] to-[#7B2FBE] hover:from-[#00B4D8]/95 hover:to-[#7B2FBE]/95 text-white font-mono text-xs uppercase tracking-wider rounded-full px-5 py-2">
                  Initialize Nodes <ArrowRight className="ml-2 h-3.5 w-3.5" />
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
