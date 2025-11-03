import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { getTrainingStatus } from '../lib/api';
import {
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Brain,
  Zap
} from 'lucide-react';

const StatusDisplay = ({ companyId }) => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("loading");
  const pollRef = useRef(null);

  useEffect(() => {
    if (!companyId) return;

    const fetchCompany = async () => {
      try {
        const data = await getTrainingStatus(companyId);
        const status = data?.ml_status?.status || data?.status || "unknown";
        setCompany({ name: companyId, status });
        setStatusText(status);
      } catch (err) {
        console.error("Error fetching company status:", err);
        setCompany({ name: companyId, status: "error" });
        setStatusText("error");
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();

    // Start polling until completed
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await getTrainingStatus(companyId);
        const status = data?.ml_status?.status || data?.status || "unknown";
        setCompany({ name: companyId, status });
        setStatusText(status);
        if (status === "completed") {
          clearInterval(pollRef.current);
        }
      } catch (_) { }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [companyId]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'training':
        return <Brain className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Zap className="h-5 w-5 text-slate-500 dark:text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'training':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await getTrainingStatus(companyId);
      const status = data?.ml_status?.status || data?.status || "unknown";
      setCompany({ name: companyId, status });
      setStatusText(status);
    } catch (err) {
      console.error("Error refreshing status:", err);
      setCompany({ name: companyId, status: "error" });
      setStatusText("error");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !company) {
    return (
      <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-slate-600 dark:text-slate-400">Loading company status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center text-slate-600 dark:text-slate-400">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-400 dark:text-slate-500" />
            <p>No company data found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="text-slate-900 dark:text-white">Training Status</span>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="outline"
            size="sm"
            className="border-slate-300 hover:border-blue-400 dark:border-slate-600 dark:hover:border-blue-400 dark:text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon(company.status)}
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Company ID: {company.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Model Training Status</p>
              </div>
            </div>
            <Badge className={`${getStatusColor(company.status)} font-medium`}>
              {company.status}
            </Badge>
          </div>

          <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Real-time Status</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {company.status === 'completed' && 'Model training completed successfully. Ready for predictions.'}
              {company.status === 'training' && 'AI model is being fine-tuned with your data. This may take a few minutes.'}
              {company.status === 'pending' && 'Training is queued and will start shortly.'}
              {company.status === 'error' && 'An error occurred during training. Please check your data and try again.'}
              {company.status === 'unknown' && 'Status unknown. Please refresh to get the latest information.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusDisplay;