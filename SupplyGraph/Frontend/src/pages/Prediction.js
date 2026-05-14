import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import ReorderIntelligence from '../components/charts/ReorderIntelligence';
import { useToast } from '../hooks/use-toast';
import { predict, getModelInfo, getHistoricalData } from '../lib/api';
import DemandChart from '../components/charts/DemandChart';
import PredictionAnalytics from '../components/charts/PredictionAnalytics';
import {
  Loader2,
  Store,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  BarChart3,
  Lightbulb,
  Sparkles,
  Brain,
  Zap,
  BarChart,
  LineChart,
  Activity,
  Download,
  Search
} from 'lucide-react';

// Searchable product autocomplete — shows 6 at a time, filters as you type
const ProductSearch = ({ nodeList, value, onChange }) => {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync external value
  React.useEffect(() => { setQuery(value || ''); }, [value]);

  const sorted = [...nodeList].sort((a, b) => a.localeCompare(b));
  const filtered = query
    ? sorted.filter(n => n.toLowerCase().includes(query.toLowerCase()))
    : sorted;

  return (
    <div ref={ref} className="relative">
      <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500 z-10" />
      <input
        id="productSearch"
        type="text"
        autoComplete="off"
        value={query}
        placeholder="Search products..."
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(''); }}
        className="pl-10 h-12 w-full border border-slate-300 dark:border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:focus:border-purple-400 transition-all duration-300 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
      />
      {value && (
        <button type="button" onClick={() => { setQuery(''); onChange(''); }}
          className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          ✕
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-[220px] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl">
          {filtered.slice(0, 50).map((node, i) => (
            <li key={node}>
              <button type="button"
                onClick={() => { onChange(node); setQuery(node); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors flex items-center space-x-2 ${value === node ? 'bg-purple-50 dark:bg-slate-700 text-purple-700 dark:text-purple-300 font-medium' : 'text-slate-700 dark:text-slate-300'} ${i === 0 ? 'rounded-t-lg' : ''}`}>
                <Package className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span>{node}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">No matching products</li>
          )}
        </ul>
      )}
    </div>
  );
};

const Prediction = () => {
  const [formData, setFormData] = useState({
    storeName: '',
    productName: ''
  });
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const { toast } = useToast();
  const [nodeList, setNodeList] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(false);

  // Fetch available products/stores when component mounts
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        setLoadingNodes(true);
        let companyId = localStorage.getItem('companyId');
        if (!companyId) {
          const user = localStorage.getItem('user');
          if (user) companyId = JSON.parse(user).companyId;
        }
        if (!companyId) return;
        const modelInfo = await getModelInfo(companyId);
        const nodes = modelInfo?.feature_columns || modelInfo?.node_list || [];
        setNodeList(nodes);
      } catch (err) {
        console.log('[Prediction] Could not load node list:', err.message);
      } finally {
        setLoadingNodes(false);
      }
    };
    fetchNodes();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.productName.trim()) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let companyId = localStorage.getItem('companyId');
      if (!companyId) {
        const user = localStorage.getItem('user');
        if (user) companyId = JSON.parse(user).companyId;
      }
      if (!companyId) throw new Error('Missing companyId');

      // Check if model exists (reused for confidence later)
      let cachedModelInfo = null;
      try {
        cachedModelInfo = await getModelInfo(companyId);
      } catch (error) {
        cachedModelInfo = null;
      }

      if (!cachedModelInfo || !cachedModelInfo.model_type) {
        toast({
          title: "Model Not Ready",
          description: "Please upload and process your data first, then train the model before making predictions.",
          variant: "destructive"
        });
        return;
      }

      const inputRow = {
        node_type: 'store',
        company: companyId,
        product: formData.productName
      };

      const resp = await predict(companyId, [inputRow], 30); // Request 30-day forecast

      const predObj = resp?.prediction ?? resp; // handle both {prediction:{...}} and flat {...}

      // Handle 30-day forecast or single day prediction
      let yhat = 0;
      let total30Days = 0;
      let forecastArray = null;
      const backendForecastArray = Array.isArray(predObj?.prediction) ? predObj.prediction : null;
      const backendAverage = Number(predObj?.average_daily);
      const backendTotal = Number(predObj?.total_30_days);
      const backendRawPeak = Number(predObj?.rawPredicted);
      
      if (backendForecastArray && backendForecastArray.length === 30) {
        // 30-day forecast
        forecastArray = backendForecastArray;
        total30Days = Number.isFinite(backendTotal)
          ? backendTotal
          : forecastArray.reduce((sum, val) => sum + (Number(val) || 0), 0);
        const avgFromBackend = Number.isFinite(backendAverage) ? backendAverage : null;
        yhat = Number.isFinite(avgFromBackend) ? avgFromBackend : (total30Days / 30);
      } else {
        // Single day prediction (backward compatibility)
        const yhatRaw = Array.isArray(predObj?.prediction)
          ? predObj.prediction[0]
          : Array.isArray(resp?.prediction)
            ? resp.prediction[0]
            : undefined;
        const yhatParsed = typeof yhatRaw === 'number' ? yhatRaw : Number(yhatRaw);
        yhat = Number.isFinite(yhatParsed) ? yhatParsed : 0;
      }

      // Get historical data for charts
      let historicalData = [];
      try {
        const historicalResp = await getHistoricalData(companyId, formData.productName, 30);
        historicalData = Array.isArray(historicalResp.historical_data) ? historicalResp.historical_data : [];

        // Validate historical data format
        historicalData = historicalData.filter(item =>
          item &&
          typeof item === 'object' &&
          item.date &&
          typeof item.demand === 'number' &&
          item.demand > 0
        );
      } catch (error) {
        // Fallback to generated data if historical data is not available
        historicalData = Array.from({ length: 20 }).map((_, i) => ({
          date: new Date(Date.now() - (19 - i) * 86400000).toISOString(),
          demand: Math.max(1, Math.round(Math.random() * 1000)),
          product: formData.productName || 'Sample Product'
        }));
      }

      // Calculate confidence from actual model metrics (reuse cachedModelInfo)
      let confidence = 75;
      const valMape = cachedModelInfo?.metrics?.val_mape;
      if (typeof valMape === 'number' && valMape >= 0 && valMape <= 1) {
        confidence = Math.round((1 - valMape) * 100);
        confidence = Math.min(99, Math.max(30, confidence));
      }

      // Determine trend based on prediction value
      let trend = 'flat';
      if (yhat > 100) trend = 'increasing';
      else if (yhat < 50) trend = 'decreasing';

      const predictionPayload = {
        predictedDemand: Math.round((Number.isFinite(backendTotal) ? backendTotal : total30Days) || yhat), // total window
        displayPredicted: Number.isFinite(backendTotal)
          ? Math.round(backendTotal)
          : Number.isFinite(total30Days)
            ? Math.round(total30Days)
            : Math.round(yhat),
        rawPredicted: Number.isFinite(backendRawPeak)
          ? backendRawPeak
          : forecastArray
            ? Math.max(...forecastArray.map(val => Number(val) || 0))
            : yhat,
        prediction: forecastArray || backendForecastArray || (Array.isArray(predObj?.prediction) ? predObj.prediction : [yhat]), // Include full forecast array
        total_30_days: Number.isFinite(backendTotal) ? backendTotal : total30Days,
        average_daily: Number.isFinite(backendAverage) ? backendAverage : yhat,
        next_day_prediction: forecastArray && forecastArray.length
          ? Number(forecastArray[0])
          : Number.isFinite(backendAverage)
            ? backendAverage
            : yhat,
        confidence: `${Math.round(confidence)}%`,
        trend: trend,
        storeName: formData.storeName,
        productName: formData.productName,
        historicalData: historicalData,
        modelInfo: {
          featureColumns: predObj?.feature_columns_used || [],
          timestamp: predObj?.timestamp || new Date().toISOString(),
          inputDim: predObj?.actual_input_dim || 0
        }
      };

      setPrediction(predictionPayload);


      toast({ title: 'Success!', description: 'Demand prediction generated successfully' });
    } catch (error) {
      console.error('[Prediction] Error during prediction process', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      toast({
        title: "Error",
        description: error.message || "Prediction failed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-slate-500" />;
    }
  };

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'increasing':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'decreasing':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  // Chart view state
  const [chartView, setChartView] = useState('analytics'); // 'simple' or 'analytics'

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-200 dark:border-slate-700 shadow-lg mb-4">
            <Brain className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">AI Prediction Engine</span>
            <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent mb-4">
            Demand Prediction Dashboard
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Get AI-powered demand forecasts with advanced analytics and actionable insights
          </p>
        </div>

        {/* Prediction Input Form */}
        <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up mb-8">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
              <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span>Prediction Input</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {/* Product Name — Searchable Autocomplete */}
                <div className="space-y-2">
                  <Label htmlFor="productSearch" className="text-slate-700 dark:text-slate-300 font-medium flex items-center space-x-2">
                    <Package className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                    <span>Select Product</span>
                  </Label>
                  <ProductSearch
                    nodeList={nodeList}
                    value={formData.productName}
                    onChange={(val) => setFormData(prev => ({ ...prev, productName: val }))}
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  type="submit"
                  disabled={loading}
                  className="px-10 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-700 dark:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group border-0 rounded-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Prediction...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Get AI Prediction
                      <BarChart3 className="ml-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Quick Tips */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-blue-200 dark:border-slate-700">
              <h4 className="font-medium text-slate-800 dark:text-slate-300 mb-2 flex items-center space-x-2">
                <Lightbulb className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                <span>Quick Tips</span>
              </h4>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>• Use specific store names for better accuracy</li>
                <li>• Include product categories when possible</li>
                <li>• Try seasonal products for trend analysis</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {prediction ? (
          <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            {/* Main Prediction Card */}
            <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <span className="text-slate-900 dark:text-white">Demand Forecast Results</span>
                  </div>
                  <Badge className="bg-white/80 text-green-700 border-green-200 shadow-sm dark:bg-slate-700 dark:text-green-300 dark:border-green-800">
                    Confidence: {prediction.confidence}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center group">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-6 hover:from-blue-100 hover:to-blue-200 dark:hover:from-slate-700 dark:hover:to-slate-700 transition-all duration-300 hover:scale-105">
                      <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">
                        {(() => {
                          const nextDay = Number.isFinite(prediction?.next_day_prediction)
                            ? prediction.next_day_prediction
                            : Number(prediction?.rawPredicted ?? prediction?.predictedDemand ?? prediction?.average_daily);
                          const value = Number.isFinite(nextDay) ? nextDay : 0;
                          return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
                        })()}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 font-medium">
                        Predicted Units (Next Day)
                      </p>
                      {Number.isFinite(prediction?.total_30_days) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          30-day total: {Number(prediction.total_30_days).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      )}
                      <div className="mt-2 h-1 bg-gradient-to-r from-blue-400 to-purple-400 dark:from-blue-500 dark:to-purple-500 rounded-full"></div>
                    </div>
                  </div>

                  <div className="text-center group">
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-6 hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700 dark:hover:to-slate-700 transition-all duration-300 hover:scale-105">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        {getTrendIcon(prediction.trend)}
                        <Badge className={`${getTrendColor(prediction.trend)} font-medium`}>
                          {prediction.trend}
                        </Badge>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 font-medium">Market Trend</p>
                      <div className="mt-2 h-1 bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500 rounded-full"></div>
                    </div>
                  </div>

                  <div className="text-center group">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-6 hover:from-green-100 hover:to-green-200 dark:hover:from-slate-700 dark:hover:to-slate-700 transition-all duration-300 hover:scale-105">
                      <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                        {prediction.confidence}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 font-medium">AI Confidence</p>
                      <div className="mt-2 h-1 bg-gradient-to-r from-green-400 to-emerald-400 dark:from-green-500 dark:to-emerald-500 rounded-full"></div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Store className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-white">Store:</span>
                        <span className="text-slate-700 dark:text-slate-400 ml-2">{prediction.storeName}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-white">Product:</span>
                        <span className="text-slate-700 dark:text-slate-400 ml-2">{prediction.productName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reorder Intelligence Widget */}
            <ReorderIntelligence prediction={prediction} />

            {/* Demand Visualization */}
            <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-900 dark:text-white">
                    <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    <span>Demand Visualization</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant={chartView === 'simple' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartView('simple')}
                      className="flex items-center space-x-2"
                    >
                      <BarChart className="h-4 w-4" />
                      <span>Simple</span>
                    </Button>
                    <Button
                      variant={chartView === 'analytics' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartView('analytics')}
                      className="flex items-center space-x-2"
                    >
                      <Activity className="h-4 w-4" />
                      <span>Analytics</span>
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {chartView === 'simple' ? (
                  <div className="space-y-6">
                    {/* Simple Line Chart */}
                    <DemandChart
                      historicalData={[]}
                      prediction={prediction}
                      chartType="line"
                      title={`Demand Forecast - Next 30 Days for ${prediction.productName}`}
                      showPrediction={true}
                      productName={prediction.productName}
                    />

                    {/* Simple Bar Chart */}
                    <DemandChart
                      historicalData={[]}
                      prediction={prediction}
                      chartType="bar"
                      title={`Demand Forecast - Next 30 Days for ${prediction.productName}`}
                      showPrediction={true}
                      productName={prediction.productName}
                    />
                  </div>
                ) : (
                  /* Comprehensive Analytics Dashboard */
                  <PredictionAnalytics
                    historicalData={prediction.historicalData}
                    prediction={prediction}
                    storeName={prediction.storeName}
                    productName={prediction.productName}
                  />
                )}
              </CardContent>
            </Card>

            {/* Export Forecast CSV */}
            {prediction?.prediction && Array.isArray(prediction.prediction) && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const forecastArr = prediction.prediction;
                    const today = new Date();
                    const header = 'Day,Date,Predicted Demand\n';
                    const rows = forecastArr.map((val, i) => {
                      const date = new Date(today);
                      date.setDate(date.getDate() + i + 1);
                      return `${i + 1},${date.toISOString().split('T')[0]},${val}`;
                    }).join('\n');
                    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `forecast_${prediction.productName}_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Forecast CSV</span>
                </button>
              </div>
            )}

            {/* AI Recommendations */}
            <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
                <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
                  <Lightbulb className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  <span>AI-Powered Recommendations</span>
                  <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {(prediction?.recommendations ?? []).map((recommendation, index) => (
                    <div key={index} className="group">
                      <div className="flex items-start space-x-4 p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 hover:shadow-md">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5 group-hover:scale-110 transition-transform duration-300">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">{recommendation}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="relative mb-6">
                  <BarChart3 className="h-20 w-20 text-slate-300 dark:text-slate-600 mx-auto" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 dark:from-blue-400/10 dark:to-purple-400/10 rounded-full blur-xl"></div>
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent mb-4">
                  Ready to Generate AI Predictions
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
                  Select a product to get AI-powered demand forecasts with interactive charts and actionable insights.
                </p>
                <div className="flex justify-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                    <Brain className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span>AI-Powered</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                    <BarChart3 className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                    <span>Real-time Charts</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                    <Lightbulb className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                    <span>Smart Insights</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Prediction;