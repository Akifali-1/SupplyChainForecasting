import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { useToast } from '../hooks/use-toast';
import { convertRaw, fineTune, getTrainingStatus, createSample, cancelTraining } from '../lib/api';
import StatusDisplay from '../components/StatusDisplay';
import {
  Upload as UploadIcon,
  FileText,
  Loader2,
  CheckCircle,
  Database,
  ArrowRight,
  Brain,
  Zap,
  Sparkles,
  Info
} from 'lucide-react';

const Upload = () => {
  const [uploadType, setUploadType] = useState('single');
  const [files, setFiles] = useState({
    single: null,
    nodes: null,
    edges: null,
    demand: null
  });
  const [uploading, setUploading] = useState(false);
  const [fineTuning, setFineTuning] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [fineTuningComplete, setFineTuningComplete] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fineTuningProgress, setFineTuningProgress] = useState(0);
  const [trainingStatusMessage, setTrainingStatusMessage] = useState('');
  const [convertedPaths, setConvertedPaths] = useState(null);
  const [manualPaths, setManualPaths] = useState({
    nodes: '',
    edges: '',
    demand: ''
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkingState, setCheckingState] = useState(true);
  const pollRef = useRef(null);

  // On mount: check if training is already in progress and resume UI
  useEffect(() => {
    const checkActiveTraining = async () => {
      try {
        let companyId = localStorage.getItem('companyId');
        if (!companyId) {
          const user = localStorage.getItem('user');
          if (user) companyId = JSON.parse(user).companyId;
        }
        if (!companyId) return;
        const { getTrainingStatus } = await import('../lib/api');
        const statusData = await getTrainingStatus(companyId);
        const mlStatus = statusData?.ml_status || statusData || {};
        const status = mlStatus.status;
        const progress = mlStatus.progress || 0;
        const message = mlStatus.message || '';

        if (status === 'training' || status === 'saving') {
          // Resume training UI
          setUploadComplete(true);
          setFineTuning(true);
          setFineTuningProgress(progress);
          setTrainingStatusMessage(message || 'Training in progress...');

          // Resume polling
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = setInterval(async () => {
            try {
              const s = await getTrainingStatus(companyId);
              const mlSt = s?.ml_status || s || {};
              const st = mlSt.status;
              const pr = mlSt.progress || 0;
              const msg = mlSt.message || '';
              
              setFineTuningProgress(pr);
              setTrainingStatusMessage(msg);
              if (st === 'completed') {
                clearInterval(pollRef.current);
                pollRef.current = null;
                setFineTuningProgress(100);
                setFineTuningComplete(true);
                toast({ title: '🎉 Training Complete!', description: msg || 'Model trained successfully.' });
                setTimeout(() => navigate('/prediction'), 2000);
              } else if (st === 'failed') {
                clearInterval(pollRef.current);
                pollRef.current = null;
                setFineTuning(false);
                toast({ title: 'Training Failed', description: s?.error || 'Unknown error', variant: 'destructive' });
              }
            } catch (e) { /* continue polling */ }
          }, 1000);
        } else if (status === 'completed') {
          // Already done — show brief notification
          setUploadComplete(true);
          setFineTuningComplete(true);
          setFineTuningProgress(100);
          setTrainingStatusMessage(message || 'Training completed!');
        }
      } catch (e) {
        /* no active training */
      } finally {
        setCheckingState(false);
      }
    };
    checkActiveTraining();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (type, file) => {
    setFiles(prev => ({
      ...prev,
      [type]: file
    }));
  };

  const handleUpload = async () => {
    const filesToUpload = uploadType === 'single'
      ? [files.single].filter(Boolean)
      : [files.nodes, files.edges, files.demand].filter(Boolean);

    if (filesToUpload.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one file to upload",
        variant: "destructive"
      });
      return;
    }

    if (uploadType === 'multiple' && filesToUpload.length !== 3) {
      toast({
        title: "Error",
        description: "Please upload all three files: nodes.csv, edges.csv, and demand.csv",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      let companyId = localStorage.getItem('companyId');
      if (!companyId) {
        const user = localStorage.getItem('user');
        if (user) companyId = JSON.parse(user).companyId;
      }
      if (!companyId) throw new Error('Missing companyId');

      if (uploadType === 'single') {
        const singleFile = files.single;
        const res = await convertRaw(companyId, singleFile);
        setConvertedPaths(res.files);
        // Populate manual paths in Separate Files section
        setManualPaths({
          nodes: res.files?.nodes || '',
          edges: res.files?.edges || '',
          demand: res.files?.demand || ''
        });
        // Switch to Separate Files tab so user sees populated paths
        setUploadType('multiple');
        setUploadComplete(true);
        setUploadProgress(100);
        toast({ title: 'Success!', description: 'Dataset processed into nodes/edges/demand.' });
      } else {
        // Multiple files path (UI keeps them client-side). Here we mark complete only.
        setUploadComplete(true);
        setUploadProgress(100);
        toast({ title: 'Success!', description: 'Files staged. You can proceed to fine-tune.' });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Upload failed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      clearInterval(progressInterval);
    }
  };

  const handleCreateSample = async () => {
    try {
      let companyId = localStorage.getItem('companyId');
      if (!companyId) {
        const user = localStorage.getItem('user');
        if (user) companyId = JSON.parse(user).companyId;
      }
      if (!companyId) throw new Error('Missing companyId');

      const res = await createSample(companyId, 'small');
      setManualPaths({
        nodes: res.file_paths.nodes,
        edges: res.file_paths.edges,
        demand: res.file_paths.demand
      });
      // Switch to Separate Files tab to show paths
      setUploadType('multiple');
      setUploadComplete(true);
      toast({ title: 'Success!', description: 'Sample dataset created successfully' });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to create sample dataset",
        variant: "destructive"
      });
    }
  };

  const handleFineTuning = async (forceRetrain = true) => {
    // Always reset completion so UI shows progress on every run
    setFineTuningComplete(false);
    setFineTuning(true);
    setFineTuningProgress(0);

    try {
      let companyId = localStorage.getItem('companyId');
      if (!companyId) {
        const user = localStorage.getItem('user');
        if (user) companyId = JSON.parse(user).companyId;
      }
      if (!companyId) throw new Error('Missing companyId');

      console.log('[Training] Starting fine-tuning process', { companyId });

      // Determine nodes/edges/demand paths
      let nodesPath, edgesPath, demandPath;
      if (uploadType === 'single' && convertedPaths) {
        nodesPath = convertedPaths.nodes;
        edgesPath = convertedPaths.edges;
        demandPath = convertedPaths.demand;
      } else if (uploadType === 'multiple' && manualPaths.nodes && manualPaths.edges && manualPaths.demand) {
        nodesPath = manualPaths.nodes;
        edgesPath = manualPaths.edges;
        demandPath = manualPaths.demand;
      } else {
        // Fallback to existing dataset on the server if no new files were just uploaded
        console.log('[Training] No new files uploaded this session, using existing dataset from server');
        nodesPath = `uploads/${companyId}/nodes.csv`;
        edgesPath = `uploads/${companyId}/Edges (Plant).csv`;
        demandPath = `uploads/${companyId}/Sales Order.csv`;
      }

      console.log('[Training] File paths determined', { nodesPath, edgesPath, demandPath });

      // Show initial training message
      setTrainingStatusMessage('Initializing model training...');

      // Poll training status with real-time updates
      const pollStart = Date.now();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const statusResponse = await getTrainingStatus(companyId);
          const status = statusResponse?.status || statusResponse?.ml_status?.status;
          const progress = statusResponse?.progress !== undefined ? statusResponse.progress : (statusResponse?.ml_status?.progress || 0);
          const message = statusResponse?.message || statusResponse?.ml_status?.message || '';
          const error = statusResponse?.error || statusResponse?.ml_status?.error;
          const metrics = statusResponse?.metrics || null;

          // Log detailed training metrics if available
          if (metrics) {
            console.log('[Training] Training metrics', metrics);
            if (metrics.loss !== undefined) {
              console.log(`[Training] Current loss: ${metrics.loss.toFixed(6)}`);
            }
            if (metrics.accuracy !== undefined) {
              console.log(`[Training] Current accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);
            }
            if (metrics.epoch !== undefined) {
              console.log(`[Training] Current epoch: ${metrics.epoch}`);
            }
          }

          // Update progress bar and status message
          setFineTuningProgress(progress);
          if (message) {
            setTrainingStatusMessage(message);
          }

          if (status === 'completed') {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setFineTuningComplete(prev => {
              if (!prev) {
                setFineTuningProgress(100);
                console.log('[Training] Training completed successfully');

                // Log final model metrics
                if (metrics) {
                  console.log('[Training] Final model metrics', {
                    finalLoss: metrics.loss !== undefined ? metrics.loss.toFixed(6) : 'N/A',
                    finalAccuracy: metrics.accuracy !== undefined ? `${(metrics.accuracy * 100).toFixed(2)}%` : 'N/A',
                    totalEpochs: metrics.epoch !== undefined ? metrics.epoch : 'N/A'
                  });
                }

                toast({
                  title: 'Success!',
                  description: 'Fine-tuning completed successfully!'
                });
                setTimeout(() => navigate('/prediction'), 1500);
              }
              return true;
            });
          } else if (status === 'failed') {
            clearInterval(pollRef.current);
            pollRef.current = null;
            console.error('[Training] Training failed', error);
            setTrainingStatusMessage('Training failed: ' + (error || 'Unknown error'));
            toast({
              title: "Training Failed",
              description: error || "Training failed. Please try again.",
              variant: "destructive"
            });
          } else if (status === 'training') {
            if (metrics && metrics.epoch !== undefined) {
              setTrainingStatusMessage(`Training epoch ${metrics.epoch} - Loss: ${metrics.loss !== undefined ? metrics.loss.toFixed(6) : 'N/A'}`);
            }
          }
        } catch (pollError) {
          console.log('[Training] Status polling error (continuing)', pollError.message);
        }

        // Timeout after 30 minutes
        if (Date.now() - pollStart > 1800000) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          console.error('[Training] Training timeout');
          setTrainingStatusMessage('Training timeout - please check status manually');
        }
      }, 500); // Poll every 500ms for faster real-time updates

      try {
        // Start fine-tuning
        const fineTuneResponse = await fineTune(companyId, nodesPath, edgesPath, demandPath, forceRetrain);
        console.log('[Training] Fine-tuning completed', fineTuneResponse);
        
        clearInterval(pollRef.current);
        pollRef.current = null;
        setFineTuningComplete(prev => {
          if (!prev) {
            setFineTuningProgress(100);
            toast({
              title: 'Success!',
              description: 'Fine-tuning completed successfully!'
            });
            setTimeout(() => navigate('/prediction'), 1500);
          }
          return true;
        });
      } catch (fineTuneError) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setFineTuning(false);
        throw fineTuneError;
      }

    } catch (error) {
      console.error('[Training] Fine-tuning error', error);
      toast({
        title: "Error",
        description: error.message || "Fine-tuning failed. Please try again.",
        variant: "destructive"
      });
      setFineTuning(false);
    }
  };

  const handleCancelTraining = async () => {
    try {
      let companyId = localStorage.getItem('companyId');
      if (!companyId) {
        const user = localStorage.getItem('user');
        if (user) companyId = JSON.parse(user).companyId;
      }
      
      if (!companyId) return;
      
      await cancelTraining(companyId);
      
      // Stop polling
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      
      setFineTuning(false);
      setFineTuningComplete(false);
      setTrainingStatusMessage('');
      
      toast({
        title: "Training Cancelled",
        description: "The fine-tuning process was successfully cancelled.",
        variant: "default"
      });
    } catch (e) {
      toast({
        title: "Cancel Failed",
        description: e.message || "Failed to cancel training. It may have already completed.",
        variant: "destructive"
      });
    }
  };

  const FileUploadCard = ({ title, description, fileType, accept = ".csv" }) => (
    <Card className="border-dashed border-2 border-slate-200 dark:border-white/[0.08] hover:border-[#00B4D8]/50 transition-all duration-300 group hover:shadow-md dark:hover:shadow-[0_0_25px_rgba(0,180,216,0.15)] bg-slate-50 dark:bg-white/[0.01] hover:bg-slate-100/70 dark:hover:bg-white/[0.02] backdrop-blur-xl rounded-2xl relative overflow-hidden">
      <CardContent className="p-6">
        <div className="text-center">
          {convertedPaths && uploadType === 'single' ? (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto animate-bounce-gentle" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">File generated</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Open Separate Files tab to view paths</p>
              </div>
              <div className="w-full bg-slate-200/50 dark:bg-white/[0.04] rounded-full h-1.5 mt-2">
                <div className="bg-gradient-to-r from-emerald-400 to-[#00B4D8] h-1.5 rounded-full w-full"></div>
              </div>
            </div>
          ) : (uploadType === 'multiple' && manualPaths[fileType]) ? (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto animate-bounce-gentle" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">Files uploaded</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{fileType === 'nodes' ? 'nodes.csv' : fileType === 'edges' ? 'edges.csv' : 'demand.csv'} ready</p>
              </div>
              <div className="w-full bg-slate-200/50 dark:bg-white/[0.04] rounded-full h-1.5 mt-2">
                <div className="bg-gradient-to-r from-emerald-400 to-[#00B4D8] h-1.5 rounded-full w-full"></div>
              </div>
            </div>
          ) : files[fileType] ? (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto animate-bounce-gentle" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white truncate max-w-[200px] mx-auto">{files[fileType].name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {(files[fileType].size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="w-full bg-slate-200/50 dark:bg-white/[0.04] rounded-full h-1.5 mt-2">
                <div className="bg-gradient-to-r from-[#00B4D8] to-[#7B2FBE] h-1.5 rounded-full w-full animate-pulse"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative group-hover:scale-110 transition-transform duration-300">
                <UploadIcon className="h-12 w-12 text-slate-500 dark:text-slate-400 mx-auto group-hover:text-[#00B4D8] transition-colors" />
                <div className="absolute inset-0 bg-[#00B4D8]/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white group-hover:text-[#00B4D8] transition-colors">{title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
              </div>
            </div>
          )}
          {!(uploadType === 'single' && convertedPaths) && !(uploadType === 'multiple' && manualPaths[fileType]) && (
            <input
              type="file"
              accept={accept}
              onChange={(e) => handleFileChange(fileType, e.target.files[0])}
              className="mt-4 block w-full text-xs text-slate-500 dark:text-slate-400
                file:mr-4 file:py-1.5 file:px-3
                file:rounded-lg file:border file:border-slate-200 dark:file:border-white/[0.08]
                file:text-xs file:font-semibold
                file:bg-slate-100 dark:file:bg-white/[0.03] file:text-slate-700 dark:file:text-white
                hover:file:bg-slate-200 dark:hover:file:bg-white/[0.08] hover:file:border-slate-350 dark:hover:file:border-white/[0.12]
                file:cursor-pointer file:transition-all file:duration-300
                cursor-pointer transition-colors"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (checkingState) {
    return (
      <div className="min-h-screen py-12 px-4 flex justify-center items-center bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-white">
        <div className="text-center animate-pulse">
          <Brain className="h-12 w-12 text-[#00B4D8] mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-mono text-sm">Synchronizing neural node workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-[#000000] relative overflow-hidden text-slate-900 dark:text-white">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#00B4D8]/4 dark:bg-[#00B4D8]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] bg-[#7B2FBE]/3 dark:bg-[#7B2FBE]/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="inline-flex items-center space-x-2 bg-slate-200/50 dark:bg-white/[0.02] backdrop-blur-md px-4 py-2 rounded-full border border-slate-350 dark:border-white/[0.08] shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] mb-4">
            <Database className="h-4 w-4 text-[#00B4D8]" />
            <span className="text-xs font-semibold tracking-wider text-slate-600 dark:text-slate-300 uppercase">Data Upload Center</span>
            <Sparkles className="h-4 w-4 text-[#7B2FBE]" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-b from-slate-900 via-slate-800 to-slate-650 dark:from-white dark:to-slate-400 bg-clip-text text-transparent tracking-tight mb-4">
            Supply Chain Dataset ingestion
          </h1>
          <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Feed nodes, edges, and transactional sales demand into the deep forecasting GNN
          </p>
        </div>

        {/* Main Upload Card */}
        {!(fineTuning || fineTuningComplete) && (
          <div className="space-y-8 animate-fade-in-up">
            <Card className="border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.015] backdrop-blur-2xl rounded-2xl shadow-sm dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] overflow-hidden">
              <CardHeader className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01] p-6">
                <CardTitle className="flex items-center space-x-3 text-slate-800 dark:text-white text-lg font-semibold">
                  <Database className="h-5 w-5 text-[#00B4D8]" />
                  <span>Staging Area</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs value={uploadType} onValueChange={setUploadType} className="w-full">
                  <TabsList className="flex space-x-1 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-300 dark:border-white/[0.06] p-1.5 rounded-xl mb-8">
                    <TabsTrigger value="single" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-white/[0.06] data-[state=active]:text-[#00B4D8] data-[state=active]:border-slate-200 dark:data-[state=active]:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white">
                      <FileText className="h-4 w-4" />
                      <span>Single Dataset Ingestion</span>
                    </TabsTrigger>
                    <TabsTrigger value="multiple" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-white/[0.06] data-[state=active]:text-[#00B4D8] data-[state=active]:border-slate-200 dark:data-[state=active]:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white">
                      <Database className="h-4 w-4" />
                      <span>Unified Pipeline Nodes</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="space-y-4 outline-none">
                    <div className="mb-6 p-4 bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.06] rounded-xl hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors">
                      <p className="text-slate-800 dark:text-white text-sm font-semibold mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00B4D8]" />
                        Structured Raw Aggregator
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        Ingest a singular CSV containing comprehensive network history; our background worker splits nodes, edges, and orders on the fly.
                      </p>
                    </div>
                    
                    <FileUploadCard
                      title="Supply Chain Dataset"
                      description="Upload raw comprehensive database snapshot (CSV)"
                      fileType="single"
                    />

                    {convertedPaths && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                        <FileUploadCard
                          title="Nodes Structure"
                          description="nodes.csv ready"
                          fileType="nodes"
                        />
                        <FileUploadCard
                          title="Edges Topology"
                          description="edges.csv ready"
                          fileType="edges"
                        />
                        <FileUploadCard
                          title="Sales Orders"
                          description="demand.csv ready"
                          fileType="demand"
                        />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="multiple" className="space-y-4 outline-none">
                    <div className="mb-6 p-4 bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.06] rounded-xl hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors">
                      <p className="text-slate-800 dark:text-white text-sm font-semibold mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7B2FBE]" />
                        Custom Multi-File Pipeline
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        Stage specialized individual CSVs explicitly defining company nodes, network topology edges, and timestamped transaction counts.
                      </p>
                    </div>

                    {/* Sample Creation */}
                    <div className="mb-6 p-4 bg-slate-50 dark:bg-white/[0.02] border border-[#00B4D8]/20 rounded-xl">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-slate-800 dark:text-white text-sm font-semibold flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-[#00B4D8]" />
                            Pre-compiled Mock Topology
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Spin up a sample graph network to preview prediction models instantly.</p>
                        </div>
                        <Button
                          onClick={handleCreateSample}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-800 dark:text-white border border-slate-300 dark:border-white/[0.08] text-xs font-semibold rounded-lg py-1 px-4 transition-all shadow-sm"
                        >
                          Generate Sample Data
                        </Button>
                      </div>
                    </div>

                    {/* Manual Path Entry */}
                    <div className="mb-6 p-5 bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.06] rounded-2xl">
                      <h4 className="font-semibold text-slate-800 dark:text-white text-xs tracking-wider uppercase mb-4 flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-[#7B2FBE]" />
                        Staged File Target Paths
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-slate-500 dark:text-slate-400 font-medium text-xs">Nodes Path</Label>
                          <Input
                            value={manualPaths.nodes}
                            onChange={(e) => setManualPaths(prev => ({ ...prev, nodes: e.target.value }))}
                            placeholder="uploads/companyId/nodes.csv"
                            className="mt-1.5 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-white focus:border-[#00B4D8]/50 focus:ring-0 focus:outline-none placeholder-slate-400 dark:placeholder-slate-650 rounded-xl px-4 py-2 font-mono text-xs w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-500 dark:text-slate-400 font-medium text-xs">Edges Path</Label>
                          <Input
                            value={manualPaths.edges}
                            onChange={(e) => setManualPaths(prev => ({ ...prev, edges: e.target.value }))}
                            placeholder="uploads/companyId/edges.csv"
                            className="mt-1.5 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-white focus:border-[#00B4D8]/50 focus:ring-0 focus:outline-none placeholder-slate-400 dark:placeholder-slate-650 rounded-xl px-4 py-2 font-mono text-xs w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-500 dark:text-slate-400 font-medium text-xs">Demand Path</Label>
                          <Input
                            value={manualPaths.demand}
                            onChange={(e) => setManualPaths(prev => ({ ...prev, demand: e.target.value }))}
                            placeholder="uploads/companyId/demand.csv"
                            className="mt-1.5 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-white focus:border-[#00B4D8]/50 focus:ring-0 focus:outline-none placeholder-slate-400 dark:placeholder-slate-650 rounded-xl px-4 py-2 font-mono text-xs w-full"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FileUploadCard
                        title="Nodes Schema"
                        description="Store location properties"
                        fileType="nodes"
                      />
                      <FileUploadCard
                        title="Edges Network"
                        description="Topology & plant mapping"
                        fileType="edges"
                      />
                      <FileUploadCard
                        title="Demand Logs"
                        description="Time series order ledger"
                        fileType="demand"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Upload Progress */}
                {uploading && (
                  <div className="mt-6 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-350">Uploading datasets to cloud worker...</span>
                      <span className="text-xs font-bold text-[#00B4D8] font-mono">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="relative w-full h-2 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.06]">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00B4D8] to-[#7B2FBE] rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00B4D8]" />
                      <span>Validating schema column constraints...</span>
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-10 py-4 bg-gradient-to-r from-[#00B4D8] to-[#7B2FBE] hover:from-[#00D4F8] hover:to-[#9B3FFE] text-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_25px_rgba(0,180,216,0.35)] rounded-xl border-0 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                        Injesting files...
                      </>
                    ) : uploadComplete && (convertedPaths || (manualPaths && manualPaths.nodes)) ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4 text-emerald-400" />
                        Injest Complete
                      </>
                    ) : (
                      <>
                        <span>Process & Upload Files</span>
                        <UploadIcon className="ml-2 h-4 w-4 group-hover:translate-y-[-2px] transition-transform" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* File Requirements Section */}
            <Card className="border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.01] backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] overflow-hidden">
              <CardHeader className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.005] p-6">
                <CardTitle className="flex items-center space-x-2.5 text-slate-850 dark:text-white text-base font-semibold">
                  <Info className="h-4.5 w-4.5 text-[#00B4D8]" />
                  <span>Network Topology Constraints</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {uploadType === 'single' ? (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Single Dataset Guidelines:</h4>
                    <div className="bg-slate-50 dark:bg-white/[0.01] p-5 rounded-2xl border border-slate-200 dark:border-white/[0.06] space-y-4">
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Ensure your consolidated CSV has chronological demand patterns along with topological routing mappings.
                      </p>
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-1.5 h-1.5 bg-[#00B4D8] rounded-full shrink-0"></div>
                          <span className="text-slate-700 dark:text-slate-300"><strong>Date</strong> column (YYYY-MM-DD format) - mandatory timestamp reference.</span>
                        </div>
                        <div className="flex items-center space-x-2.5">
                          <div className="w-1.5 h-1.5 bg-[#7B2FBE] rounded-full shrink-0"></div>
                          <span className="text-slate-700 dark:text-slate-300"><strong>SKU Columns</strong> (must contain numerical demand units). These headers automatically construct product nodes.</span>
                        </div>
                        <div className="flex items-center space-x-2.5">
                          <div className="w-1.5 h-1.5 bg-pink-500 rounded-full shrink-0"></div>
                          <span className="text-slate-700 dark:text-slate-300"><strong>Optional routing attributes</strong> (e.g. <code>Plant</code>, <code>node1</code>, <code>node2</code>) map spatial edge vectors dynamically.</span>
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-[#00B4D8] bg-slate-100 dark:bg-black/40 p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.04]">
                        Example Header: Date, Plant, node1, node2, SKU_A, SKU_B, SKU_C
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Multi-File Specification:</h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* nodes */}
                      <div className="border-l-2 border-l-[#00B4D8]/70 border-t border-r border-b border-slate-250 dark:border-white/[0.05] bg-[#00B4D8]/[0.01] p-5 rounded-2xl hover:bg-[#00B4D8]/[0.02] transition-all">
                        <h5 className="font-semibold text-[#00B4D8] text-sm mb-2">nodes.csv</h5>
                        <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                          <li className="flex items-start gap-1">
                            <span className="text-[#00B4D8]">•</span>
                            <span><strong>Node</strong> - SKU identifier (must map to column headers in orders)</span>
                          </li>
                          <li className="flex items-start gap-1">
                            <span className="text-[#00B4D8]">•</span>
                            <span><strong>Plant</strong> - Facility or parent warehouse tag</span>
                          </li>
                        </ul>
                      </div>

                      {/* edges */}
                      <div className="border-l-2 border-l-[#7B2FBE]/70 border-t border-r border-b border-slate-250 dark:border-white/[0.05] bg-[#7B2FBE]/[0.01] p-5 rounded-2xl hover:bg-[#7B2FBE]/[0.02] transition-all">
                        <h5 className="font-semibold text-[#7B2FBE] text-sm mb-2">Edges (Plant).csv</h5>
                        <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                          <li className="flex items-start gap-1">
                            <span className="text-[#7B2FBE]">•</span>
                            <span><strong>Plant</strong> - Sourcing node hub</span>
                          </li>
                          <li className="flex items-start gap-1">
                            <span className="text-[#7B2FBE]">•</span>
                            <span><strong>node1</strong> / <strong>node2</strong> - Directional linking tags</span>
                          </li>
                        </ul>
                      </div>

                      {/* demand */}
                      <div className="border-l-2 border-l-pink-500/70 border-t border-r border-b border-slate-250 dark:border-white/[0.05] bg-pink-500/[0.01] p-5 rounded-2xl hover:bg-pink-500/[0.02] transition-all">
                        <h5 className="font-semibold text-pink-500 dark:text-pink-400 text-sm mb-2">Sales Order.csv</h5>
                        <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                          <li className="flex items-start gap-1">
                            <span className="text-pink-500 dark:text-pink-400">•</span>
                            <span><strong>Date</strong> - Aggregated daily stamp</span>
                          </li>
                          <li className="flex items-start gap-1">
                            <span className="text-pink-500 dark:text-pink-400">•</span>
                            <span><strong>SKUs</strong> - Column per SKU with daily volumes</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Fine-tuning Section */}
        {(uploadComplete || fineTuning) && (
          <Card className="border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.015] backdrop-blur-2xl rounded-2xl shadow-sm dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] overflow-hidden animate-fade-in-up">
            <CardHeader className="border-b border-slate-200 dark:border-white/[0.06] bg-gradient-to-r from-[#00B4D8]/10 to-[#7B2FBE]/10 p-6">
              <CardTitle className="flex items-center space-x-3 text-slate-800 dark:text-white text-lg font-semibold">
                <Brain className="h-5 w-5 text-[#7B2FBE]" />
                <span>Neural Net Engine Optimization</span>
                {fineTuning && <Zap className="h-4.5 w-4.5 text-yellow-400 animate-pulse" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center space-x-2 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">Snapshot Staged</span>
                </div>

                <div className="max-w-md mx-auto">
                  <p className="text-slate-600 dark:text-slate-350 text-sm leading-relaxed mb-4">
                    Ready to initiate localized GNN weights adjustment. This runs a spatial convolution backprop tailored to your network topology configuration.
                  </p>

                  {fineTuning && (
                    <div className="space-y-4 animate-fade-in pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">GNN Fine-Tuning Calibration...</span>
                        <span className="text-xs font-bold text-[#7B2FBE] font-mono">{Math.round(fineTuningProgress)}%</span>
                      </div>
                      <div className="relative w-full h-2 bg-slate-200/50 dark:bg-white/[0.04] rounded-full overflow-hidden border border-slate-300 dark:border-white/[0.06]">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00B4D8] to-[#7B2FBE] rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(123,47,190,0.5)]"
                          style={{ width: `${fineTuningProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <Brain className="h-3.5 w-3.5 animate-pulse text-[#7B2FBE]" />
                        <span>
                          {trainingStatusMessage ||
                            (fineTuningProgress < 10 ? "Initializing training weights..." :
                              fineTuningProgress < 20 ? "Checking topology dimensions..." :
                                fineTuningProgress < 30 ? "Booting neural transformer layer..." :
                                  fineTuningProgress < 40 ? "Formatting time-series vectors..." :
                                    fineTuningProgress < 50 ? "Checking edge convolution..." :
                                      fineTuningProgress < 90 ? "Propagating loss vectors..." :
                                        fineTuningProgress < 100 ? "Saving optimized weights..." :
                                          "Engine optimization complete!")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  {fineTuningComplete && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFineTuningComplete(false);
                        setUploadComplete(false);
                        setFineTuning(false);
                      }}
                      className="px-6 py-3.5 border border-slate-200 dark:border-white/[0.08] bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] text-slate-800 dark:text-white font-semibold rounded-xl text-xs tracking-wider uppercase transition-all"
                    >
                      <Database className="mr-2 h-4 w-4" />
                      Upload New Topology
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => handleFineTuning(true)}
                    disabled={fineTuning}
                    className="px-10 py-4 bg-gradient-to-r from-[#00B4D8] to-[#7B2FBE] hover:from-[#00D4F8] hover:to-[#9B3FFE] text-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_25px_rgba(0,180,216,0.35)] rounded-xl border-0 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {fineTuning ? (
                      <>
                        <Brain className="mr-2 h-4 w-4 animate-spin text-white" />
                        Fine-Tuning In Progress...
                      </>
                    ) : fineTuningComplete ? (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        <span>Force Reset Retrain</span>
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        <span>Boot GNN Optimization</span>
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                  
                  {fineTuning && !fineTuningComplete && (
                    <Button
                      onClick={handleCancelTraining}
                      variant="destructive"
                      className="px-6 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold rounded-xl text-xs tracking-wider uppercase transition-all"
                    >
                      Abort Session
                    </Button>
                  )}
                </div>

                {fineTuningComplete && (
                  <div className="animate-fade-in space-y-2 pt-4">
                    <p className="text-emerald-400 font-semibold flex items-center justify-center space-x-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      <span>Model engine calibrated successfully!</span>
                    </p>
                    <p className="text-slate-500 text-xs font-mono">Redirecting to prediction cockpit...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Display */}
        <div className="mt-10">
          <StatusDisplay companyId={localStorage.getItem('companyId') || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).companyId : null)} />
        </div>
      </div>
    </div>
  );
};

export default Upload;