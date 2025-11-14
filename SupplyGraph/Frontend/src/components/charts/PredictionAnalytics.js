import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  TrendingUp,
  BarChart3,
  Activity,
  PieChart,
  Calendar,
  Target,
  Zap
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

const PredictionAnalytics = ({
  historicalData = [],
  prediction = null,
  storeName = '',
  productName = ''
}) => {
  const [activeChart, setActiveChart] = useState('line');
  const [timeRange, setTimeRange] = useState('month');

  // Process historical data based on time range
  const getFilteredData = () => {
    if (!historicalData.length) return [];

    let filteredData = [...historicalData];

    switch (timeRange) {
      case 'week':
        filteredData = historicalData.slice(-7);
        break;
      case 'month':
        filteredData = historicalData.slice(-30);
        break;
      default:
        filteredData = historicalData;
    }

    return filteredData.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      demand: typeof item.demand === 'number' ? item.demand : 0,
      fullDate: item.date
    }));
  };

  const processedData = getFilteredData();

  // Calculate statistics
  const stats = {
    totalDataPoints: processedData.length,
    averageDemand: processedData.length > 0
      ? Math.round(processedData.reduce((sum, item) => sum + item.demand, 0) / processedData.length)
      : 0,
    peakDemand: processedData.length > 0
      ? Math.max(...processedData.map(item => item.demand))
      : 0,
    minDemand: processedData.length > 0
      ? Math.min(...processedData.map(item => item.demand))
      : 0,
    predictedDemand: prediction ? (prediction.predictedDemand || prediction.displayPredicted || prediction.rawPredicted || 0) : 0,
    trend: prediction?.trend || 'stable'
  };

  // Chart data preparation
  const labels = processedData.map(item => item.date);
  const demandValues = processedData.map(item => item.demand);

  // Line Chart Data
  const lineData = {
    labels,
    datasets: [
      {
        label: 'Historical Demand',
        data: demandValues,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  };

  // Bar Chart Data
  const barData = {
    labels,
    datasets: [
      {
        label: 'Demand',
        data: demandValues,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  };

  // Trend Analysis Chart (Weekly aggregation)
  const getWeeklyTrendData = () => {
    const weeklyData = {};
    processedData.forEach(item => {
      const date = new Date(item.fullDate);
      const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { total: 0, count: 0 };
      }
      weeklyData[weekKey].total += item.demand;
      weeklyData[weekKey].count += 1;
    });

    return Object.entries(weeklyData).map(([week, data]) => ({
      week: week.split('-W')[1],
      average: Math.round(data.total / data.count)
    }));
  };

  const weeklyData = getWeeklyTrendData();
  const trendData = {
    labels: weeklyData.map(item => `Week ${item.week}`),
    datasets: [
      {
        label: 'Weekly Average Demand',
        data: weeklyData.map(item => item.average),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }
    ]
  };

  // Distribution Chart (Doughnut)
  const getDistributionData = () => {
    const ranges = {
      'Low (0-50)': 0,
      'Medium (51-100)': 0,
      'High (101-200)': 0,
      'Very High (200+)': 0
    };

    demandValues.forEach(value => {
      if (value <= 50) ranges['Low (0-50)']++;
      else if (value <= 100) ranges['Medium (51-100)']++;
      else if (value <= 200) ranges['High (101-200)']++;
      else ranges['Very High (200+)']++;
    });

    return {
      labels: Object.keys(ranges),
      datasets: [
        {
          data: Object.values(ranges),
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)'
          ],
          borderColor: [
            'rgb(239, 68, 68)',
            'rgb(245, 158, 11)',
            'rgb(59, 130, 246)',
            'rgb(16, 185, 129)'
          ],
          borderWidth: 2
        }
      ]
    };
  };

  const distributionData = getDistributionData();

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12, weight: '500' },
          color: '#64748b' // Light mode text color
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11, weight: '500' }, color: '#64748b' } // Light mode text color
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: {
          font: { size: 11, weight: '500' },
          color: '#64748b', // Light mode text color
          callback: function (value) { return value.toLocaleString(); }
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 11, weight: '500' },
          color: '#64748b' // Light mode text color
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8
      }
    }
  };

  const getChartComponent = () => {
    switch (activeChart) {
      case 'line':
        return <Line data={lineData} options={chartOptions} />;
      case 'bar':
        return <Bar data={barData} options={chartOptions} />;
      case 'trend':
        return <Line data={trendData} options={chartOptions} />;
      case 'distribution':
        return <Doughnut data={distributionData} options={doughnutOptions} />;
      default:
        return <Line data={lineData} options={chartOptions} />;
    }
  };

  const getChartTitle = () => {
    switch (activeChart) {
      case 'line':
        return 'Demand Timeline';
      case 'bar':
        return 'Demand Comparison';
      case 'trend':
        return 'Weekly Trend Analysis';
      case 'distribution':
        return 'Demand Distribution';
      default:
        return 'Demand Analysis';
    }
  };

  const getChartIcon = () => {
    switch (activeChart) {
      case 'line':
        return <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'bar':
        return <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'trend':
        return <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'distribution':
        return <PieChart className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      default:
        return <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-900 dark:text-white">Analytics Dashboard</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800">
                {storeName && productName ? `${storeName} - ${productName}` : 'Supply Chain Analytics'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 mb-6">
            {/* Chart Type Selector */}
            <div className="flex space-x-2 flex-wrap">
              <Button
                variant={activeChart === 'line' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveChart('line')}
                className="flex items-center space-x-2"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Timeline</span>
              </Button>
              <Button
                variant={activeChart === 'bar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveChart('bar')}
                className="flex items-center space-x-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Comparison</span>
              </Button>
              <Button
                variant={activeChart === 'trend' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveChart('trend')}
                className="flex items-center space-x-2"
              >
                <Activity className="h-4 w-4" />
                <span>Trends</span>
              </Button>
              <Button
                variant={activeChart === 'distribution' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveChart('distribution')}
                className="flex items-center space-x-2"
              >
                <PieChart className="h-4 w-4" />
                <span>Distribution</span>
              </Button>
            </div>

            {/* Time Range Selector */}
            <div className="flex space-x-2 flex-wrap">
              <Button
                variant={timeRange === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('week')}
                className="flex items-center space-x-2"
              >
                <Calendar className="h-4 w-4" />
                <span>Week</span>
              </Button>
              <Button
                variant={timeRange === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('month')}
                className="flex items-center space-x-2"
              >
                <Calendar className="h-4 w-4" />
                <span>Month</span>
              </Button>
            </div>
          </div>

          {/* Key Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-blue-200 dark:border-slate-700">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalDataPoints}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Data Points</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-green-200 dark:border-slate-700">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.averageDemand}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">Avg Demand</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-purple-200 dark:border-slate-700">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.peakDemand}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Peak Demand</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-orange-200 dark:border-slate-700">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.predictedDemand}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Predicted</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Chart */}
      <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
          <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
            {getChartIcon()}
            <span>{getChartTitle()}</span>
            {prediction && (
              <div className="ml-auto flex items-center space-x-2">
                <Zap className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
                  AI Enhanced
                </Badge>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-96 w-full">
            {getChartComponent()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PredictionAnalytics;