const DemandChart = ({
  historicalData = [],
  prediction = null,
  chartType = 'line',
  title = 'Demand Analysis',
  showPrediction = true,
  productName = '' // Add product name prop
}) => {
  // Process historical data with better error handling
  // Filter data to only show the specific product
  const filteredData = (Array.isArray(historicalData) ? historicalData : [])
    .filter(item => item && typeof item === 'object')
    .filter(item => {
      // If productName is provided, try to match it with the product data
      if (productName) {
        // Check if item has product property
        if (item.product) {
          return item.product.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(item.product.toLowerCase());
        }
        // If no product property, include all data (fallback)
        return true;
      }
      return true; // If no product name specified, show all data
    });

  const processedData = filteredData
    .map(item => ({
      date: item.date ? new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) : 'Unknown',
      demand: typeof item.demand === 'number' && !isNaN(item.demand) ? item.demand : 0,
      fullDate: item.date || new Date().toISOString(),
      product: item.product || 'Unknown Product'
    }))
    .filter(item => item.demand > 0) // Only show positive demand values
    .slice(-30); // Show only last 30 days of data

  // Add prediction point if available and valid
  const chartData = [...processedData];
  if (showPrediction && prediction) {
    const predictedValue = prediction.predictedDemand || prediction.displayPredicted || prediction.rawPredicted || 0;
    if (typeof predictedValue === 'number' && predictedValue > 0) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 1);

      chartData.push({
        date: 'Prediction',
        demand: predictedValue,
        fullDate: nextDate.toISOString(),
        isPrediction: true,
        product: productName || 'Predicted Product'
      });
    }
  }

  // If we have no data after filtering, show all data (fallback)
  let finalData = chartData;
  if (chartData.length === 0 && processedData.length === 0 && productName) {
    // Fallback to show all data if no matching product data found
    const allData = (Array.isArray(historicalData) ? historicalData : [])
      .filter(item => item && typeof item === 'object' && item.demand > 0)
      .map(item => ({
        date: item.date ? new Date(item.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }) : 'Unknown',
        demand: typeof item.demand === 'number' && !isNaN(item.demand) ? item.demand : 0,
        fullDate: item.date || new Date().toISOString(),
        product: item.product || 'Product'
      }))
      .slice(-30);

    finalData = [...allData];

    // Add prediction if available
    if (showPrediction && prediction) {
      const predictedValue = prediction.predictedDemand || prediction.displayPredicted || prediction.rawPredicted || 0;
      if (typeof predictedValue === 'number' && predictedValue > 0) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 1);

        finalData.push({
          date: 'Prediction',
          demand: predictedValue,
          fullDate: nextDate.toISOString(),
          isPrediction: true,
          product: productName || 'Predicted Product'
        });
      }
    }
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
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          },
          color: '#64748b' // Light mode text color
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
    datasets: [
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
        pointRadius: finalData.length > 0 ? 6 : 0, // Hide points if no data
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
        label: productName ? `Demand for ${productName}` : 'Demand',
        data: demandValues,
        backgroundColor: demandValues.map((value, index) =>
          finalData[index]?.isPrediction
            ? 'rgba(16, 185, 129, 0.8)'
            : 'rgba(59, 130, 246, 0.8)'
        ),
        borderColor: demandValues.map((value, index) =>
          finalData[index]?.isPrediction
            ? 'rgb(16, 185, 129)'
            : 'rgb(59, 130, 246)'
        ),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: demandValues.map((value, index) =>
          finalData[index]?.isPrediction
            ? 'rgba(16, 185, 129, 1)'
            : 'rgba(59, 130, 246, 1)'
        ),
        hoverBorderColor: demandValues.map((value, index) =>
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
