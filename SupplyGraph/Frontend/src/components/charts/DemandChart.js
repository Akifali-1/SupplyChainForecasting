const DemandChart = ({
  historicalData = [],
  prediction = null,
  chartType = 'line',
  title = 'Demand Forecast - Next 30 Days',
  showPrediction = true,
  productName = '' // Add product name prop
}) => {
  // Check if we have 30-day forecast - if yes, show only predictions (next 30 days)
  // Check multiple possible paths for the forecast array
  let forecastArray = null;
  
  if (prediction) {
    // Try different possible paths for the 30-day forecast array
    if (prediction.prediction && Array.isArray(prediction.prediction) && prediction.prediction.length === 30) {
      forecastArray = prediction.prediction;
    } else if (prediction.forecast && Array.isArray(prediction.forecast) && prediction.forecast.length === 30) {
      forecastArray = prediction.forecast;
    } else if (Array.isArray(prediction) && prediction.length === 30) {
      forecastArray = prediction;
    }
  }
  
  // Debug log
  if (prediction && !forecastArray) {
    console.log('DemandChart: No 30-day forecast found. Prediction structure:', {
      hasPrediction: !!prediction.prediction,
      predictionType: typeof prediction.prediction,
      predictionLength: Array.isArray(prediction.prediction) ? prediction.prediction.length : 'not array',
      keys: Object.keys(prediction || {})
    });
  }

  let finalData = [];

  // ALWAYS show only next 30 days when we have a 30-day forecast - ignore historical data completely
  if (forecastArray && forecastArray.length === 30) {
    // Show only next 30 days of predictions (no historical data)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + 1); // Start from tomorrow
    
    finalData = forecastArray.map((predValue, index) => {
      const predDate = new Date(startDate);
      predDate.setDate(startDate.getDate() + index);
      
      return {
        date: predDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        demand: typeof predValue === 'number' ? predValue : 0,
        fullDate: predDate.toISOString(),
        isPrediction: true,
        product: productName || 'Predicted Product'
      };
    });
  } else if (showPrediction && prediction) {
    // Single day prediction (backward compatibility)
    const predictedValue = prediction.predictedDemand || prediction.displayPredicted || prediction.rawPredicted || 
      (Array.isArray(prediction.prediction) ? prediction.prediction[0] : 0);
    if (typeof predictedValue === 'number' && predictedValue > 0) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 1);

      finalData = [{
        date: nextDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        demand: predictedValue,
        fullDate: nextDate.toISOString(),
        isPrediction: true,
        product: productName || 'Predicted Product'
      }];
    }
  } else {
    // Fallback: show recent historical data (last 30 days) if no predictions
    const filteredData = (Array.isArray(historicalData) ? historicalData : [])
      .filter(item => item && typeof item === 'object')
      .filter(item => {
        if (productName && item.product) {
          return item.product.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(item.product.toLowerCase());
        }
        return true;
      });

    finalData = filteredData
      .map(item => ({
        date: item.date ? new Date(item.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }) : 'Unknown',
        demand: typeof item.demand === 'number' && !isNaN(item.demand) ? item.demand : 0,
        fullDate: item.date || new Date().toISOString(),
        product: item.product || 'Unknown Product',
        isPrediction: false
      }))
      .filter(item => item.demand > 0)
      .slice(-30); // Show only last 30 days
  }

  const labels = finalData.map(item => item.date);
  const demandValues = finalData.map(item => item.demand);

  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        display: forecastArray ? true : true, // Show legend
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          },
          color: '#64748b', // Light mode text color
          generateLabels: (chart) => {
            // Customize legend labels based on whether we're showing predictions
            if (forecastArray) {
              return [{
                text: 'Predicted Demand (Next 30 Days)',
                fillStyle: '#8b5cf6',
                strokeStyle: '#8b5cf6',
                lineWidth: 2,
                pointStyle: 'circle'
              }];
            }
            return Chart.defaults.plugins.legend.labels.generateLabels(chart);
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
          title: function (context) {
            const dataIndex = context[0].dataIndex;
            const item = finalData[dataIndex];
            return item?.isPrediction ? 'AI Prediction' : `Date: ${item?.fullDate || 'Unknown'}`;
          },
          label: function (context) {
            const value = context.parsed.y;
            const isPrediction = finalData[context.dataIndex]?.isPrediction;
            const product = finalData[context.dataIndex]?.product || 'Product';
            return `${isPrediction ? 'Predicted' : 'Historical'} Demand for ${product}: ${value.toLocaleString()} units`;
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
          color: '#64748b' // Light mode text color
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
          color: '#64748b', // Light mode text color
          callback: function (value) {
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
    datasets: forecastArray ? [
      // Show only 30-day forecast
      {
        label: 'Predicted Demand (Next 30 Days)',
        data: demandValues,
        borderColor: 'rgb(139, 92, 246)', // Purple for predictions
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(139, 92, 246)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: 'rgb(139, 92, 246)',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 3
      }
    ] : [
      // Historical data (if no 30-day forecast)
      {
        label: productName ? `Historical Demand for ${productName}` : 'Historical Demand',
        data: demandValues.map((value, index) =>
          finalData[index]?.isPrediction ? null : value
        ),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: finalData.length > 0 ? 6 : 0,
        pointHoverRadius: finalData.length > 0 ? 8 : 0,
        pointHoverBackgroundColor: 'rgb(59, 130, 246)',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 3
      },
      ...(showPrediction && prediction && finalData.some(item => item.isPrediction) ? [{
        label: 'AI Prediction',
        data: demandValues.map((value, index) =>
          finalData[index]?.isPrediction ? value : null
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
        pointRadius: finalData.some(item => item.isPrediction) ? 8 : 0,
        pointHoverRadius: finalData.some(item => item.isPrediction) ? 10 : 0,
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
        label: forecastArray ? 'Predicted Demand (Next 30 Days)' : (productName ? `Demand for ${productName}` : 'Demand'),
        data: demandValues,
        backgroundColor: forecastArray 
          ? 'rgba(139, 92, 246, 0.8)' // Purple for 30-day forecast
          : demandValues.map((value, index) =>
              finalData[index]?.isPrediction
                ? 'rgba(16, 185, 129, 0.8)'
                : 'rgba(59, 130, 246, 0.8)'
            ),
        borderColor: forecastArray
          ? 'rgb(139, 92, 246)'
          : demandValues.map((value, index) =>
              finalData[index]?.isPrediction
                ? 'rgb(16, 185, 129)'
                : 'rgb(59, 130, 246)'
            ),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: forecastArray
          ? 'rgba(139, 92, 246, 1)'
          : demandValues.map((value, index) =>
              finalData[index]?.isPrediction
                ? 'rgba(16, 185, 129, 1)'
                : 'rgba(59, 130, 246, 1)'
            ),
        hoverBorderColor: forecastArray
          ? 'rgb(139, 92, 246)'
          : demandValues.map((value, index) =>
              finalData[index]?.isPrediction
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
        return <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'line':
        return <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      default:
        return <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
        <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
          {getChartIcon()}
          <span>{title}</span>
          {showPrediction && prediction && finalData.some(item => item.isPrediction) && (
            <div className="ml-auto flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-700 dark:text-green-400 font-medium">AI Prediction</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-80 w-full">
          {finalData.length > 0 ? (
            chartType === 'line' ? (
              <Line data={lineData} options={chartOptions} />
            ) : (
              <Bar data={barData} options={chartOptions} />
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <BarChart3 className="h-12 w-12 mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-lg font-medium">No data available</p>
              <p className="text-sm">Upload data and train a model to see demand predictions</p>
            </div>
          )}
        </div>

        {/* Chart Statistics */}
        {finalData.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-blue-200 dark:border-slate-700">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {finalData.filter(item => !item.isPrediction).length}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Days of Data</div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="text-lg font-bold text-slate-600 dark:text-slate-400">
                {finalData.filter(item => !item.isPrediction).length > 0 ?
                  Math.round(finalData.filter(item => !item.isPrediction).reduce((sum, item) => sum + item.demand, 0) / finalData.filter(item => !item.isPrediction).length) : 0}
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">Avg Daily Demand</div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-green-200 dark:border-slate-700">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {finalData.filter(item => !item.isPrediction).length > 0 ?
                  Math.max(...finalData.filter(item => !item.isPrediction).map(item => item.demand)) : 0}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">Peak Daily Demand</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DemandChart;
