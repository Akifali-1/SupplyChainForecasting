import React from 'react';
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
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, BarChart3, Activity } from 'lucide-react';

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
  Filler
);

const DemandChart = ({ 
  historicalData = [], 
  prediction = null, 
  chartType = 'line',
  title = 'Demand Analysis',
  showPrediction = true 
}) => {
  // Process historical data
  const processedData = historicalData.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    demand: typeof item.demand === 'number' ? item.demand : 0,
    fullDate: item.date
  }));

  // Add prediction point if available
  const chartData = [...processedData];
  if (showPrediction && prediction) {
    const predictedValue = prediction.predictedDemand || prediction.displayPredicted || prediction.rawPredicted || 0;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);
    
    chartData.push({
      date: 'Prediction',
      demand: predictedValue,
      fullDate: nextDate.toISOString(),
      isPrediction: true
    });
  }

  const labels = chartData.map(item => item.date);
  const demandValues = chartData.map(item => item.demand);

  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: function(context) {
            const dataIndex = context[0].dataIndex;
            const item = chartData[dataIndex];
            return item?.isPrediction ? 'AI Prediction' : `Date: ${item?.fullDate}`;
          },
          label: function(context) {
            const value = context.parsed.y;
            const isPrediction = chartData[context.dataIndex]?.isPrediction;
            return `${isPrediction ? 'Predicted' : 'Historical'} Demand: ${value.toLocaleString()} units`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11,
            weight: '500'
          },
          color: '#64748b'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false
        },
        ticks: {
          font: {
            size: 11,
            weight: '500'
          },
          color: '#64748b',
          callback: function(value) {
            return value.toLocaleString();
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  // Line chart data
  const lineData = {
    labels,
    datasets: [
      {
        label: 'Historical Demand',
        data: demandValues.map((value, index) => 
          chartData[index]?.isPrediction ? null : value
        ),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: 'rgb(59, 130, 246)',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 3
      },
      ...(showPrediction && prediction ? [{
        label: 'AI Prediction',
        data: demandValues.map((value, index) => 
          chartData[index]?.isPrediction ? value : null
        ),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 3,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointBackgroundColor: 'rgb(16, 185, 129)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 8,
        pointHoverRadius: 10,
        pointHoverBackgroundColor: 'rgb(16, 185, 129)',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 3
      }] : [])
    ]
  };

  // Bar chart data
  const barData = {
    labels,
    datasets: [
      {
        label: 'Demand',
        data: demandValues,
        backgroundColor: demandValues.map((value, index) => 
          chartData[index]?.isPrediction 
            ? 'rgba(16, 185, 129, 0.8)' 
            : 'rgba(59, 130, 246, 0.8)'
        ),
        borderColor: demandValues.map((value, index) => 
          chartData[index]?.isPrediction 
            ? 'rgb(16, 185, 129)' 
            : 'rgb(59, 130, 246)'
        ),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: demandValues.map((value, index) => 
          chartData[index]?.isPrediction 
            ? 'rgba(16, 185, 129, 1)' 
            : 'rgba(59, 130, 246, 1)'
        ),
        hoverBorderColor: demandValues.map((value, index) => 
          chartData[index]?.isPrediction 
            ? 'rgb(16, 185, 129)' 
            : 'rgb(59, 130, 246)'
        ),
        hoverBorderWidth: 3
      }
    ]
  };

  const getChartIcon = () => {
    switch (chartType) {
      case 'bar':
        return <BarChart3 className="h-5 w-5 text-blue-600" />;
      case 'line':
        return <TrendingUp className="h-5 w-5 text-blue-600" />;
      default:
        return <Activity className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
        <CardTitle className="flex items-center space-x-2 text-slate-900">
          {getChartIcon()}
          <span>{title}</span>
          {showPrediction && prediction && (
            <div className="ml-auto flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-700 font-medium">AI Prediction</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-80 w-full">
          {chartType === 'line' ? (
            <Line data={lineData} options={chartOptions} />
          ) : (
            <Bar data={barData} options={chartOptions} />
          )}
        </div>
        
        {/* Chart Statistics */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
            <div className="text-lg font-bold text-blue-600">
              {processedData.length}
            </div>
            <div className="text-sm text-blue-700 font-medium">Data Points</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
            <div className="text-lg font-bold text-slate-600">
              {processedData.length > 0 ? Math.round(processedData.reduce((sum, item) => sum + item.demand, 0) / processedData.length) : 0}
            </div>
            <div className="text-sm text-slate-700 font-medium">Avg Demand</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              {processedData.length > 0 ? Math.max(...processedData.map(item => item.demand)) : 0}
            </div>
            <div className="text-sm text-green-700 font-medium">Peak Demand</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DemandChart;
