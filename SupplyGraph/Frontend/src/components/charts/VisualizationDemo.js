import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import DemandChart from './DemandChart';
import PredictionAnalytics from './PredictionAnalytics';
import { BarChart3, TrendingUp, Activity, PieChart } from 'lucide-react';

const VisualizationDemo = () => {
  // Sample data for demonstration
  const sampleHistoricalData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString(),
    demand: Math.floor(Math.random() * 200) + 50
  }));

  const samplePrediction = {
    predictedDemand: 150,
    displayPredicted: 150.5,
    rawPredicted: 150.5,
    confidence: '87%',
    trend: 'increasing',
    storeName: 'Demo Store',
    productName: 'Sample Product',
    historicalData: sampleHistoricalData
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent mb-4">
            Supply Chain Visualization Demo
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Interactive charts and analytics powered by Chart.js and AI predictions
          </p>
        </div>

        {/* Chart Types Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Line Charts</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Timeline analysis with trend visualization</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <BarChart3 className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Bar Charts</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Comparative demand analysis</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <Activity className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Analytics</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Comprehensive dashboard with multiple views</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <PieChart className="h-8 w-8 text-orange-600 dark:text-orange-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Distribution</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Demand pattern analysis</p>
            </CardContent>
          </Card>
        </div>

        {/* Simple Charts Demo */}
        <div className="space-y-6 mb-8">
          <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <span>Simple Chart Components</span>
                <Badge className="ml-auto bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                  Individual Charts
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DemandChart
                  historicalData={sampleHistoricalData}
                  prediction={samplePrediction}
                  chartType="line"
                  title="Demand Timeline"
                  showPrediction={true}
                />

                <DemandChart
                  historicalData={sampleHistoricalData}
                  prediction={samplePrediction}
                  chartType="bar"
                  title="Demand Comparison"
                  showPrediction={true}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Dashboard Demo */}
        <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
              <Activity className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <span>Comprehensive Analytics Dashboard</span>
              <Badge className="ml-auto bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                Full Analytics
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <PredictionAnalytics
              historicalData={sampleHistoricalData}
              prediction={samplePrediction}
              storeName={samplePrediction.storeName}
              productName={samplePrediction.productName}
            />
          </CardContent>
        </Card>

        {/* Features List */}
        <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm mt-8">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
              <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
              <span>Visualization Features</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-white flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  <span>Chart Types</span>
                </h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• Interactive Line Charts</li>
                  <li>• Comparative Bar Charts</li>
                  <li>• Distribution Doughnut Charts</li>
                  <li>• Weekly Trend Analysis</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-white flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                  <span>Analytics</span>
                </h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• Real-time Statistics</li>
                  <li>• Time Range Filtering</li>
                  <li>• AI Prediction Integration</li>
                  <li>• Interactive Tooltips</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-white flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-green-500 dark:text-green-400" />
                  <span>Customization</span>
                </h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• Responsive Design</li>
                  <li>• Theme Integration</li>
                  <li>• Export Capabilities</li>
                  <li>• Mobile Optimized</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VisualizationDemo;