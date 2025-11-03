import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { useToast } from '../hooks/use-toast';
import { mockUpload } from '../utils/mockData';
import { convertRaw, fineTune, getTrainingStatus, createSample } from '../lib/api';
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

  const handleFineTuning = async () => {
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
      if (uploadType === 'single') {
        if (!convertedPaths) throw new Error('Files not processed');
        nodesPath = convertedPaths.nodes;
        edgesPath = convertedPaths.edges;
        demandPath = convertedPaths.demand;
      } else {
        // Use manual paths or sample paths
        if (manualPaths.nodes && manualPaths.edges && manualPaths.demand) {
          nodesPath = manualPaths.nodes;
          edgesPath = manualPaths.edges;
          demandPath = manualPaths.demand;
        } else {
          throw new Error('Please provide file paths or create a sample dataset');
        }
      }

      console.log('[Training] File paths determined', { nodesPath, edgesPath, demandPath });

      // Start fine-tuning
      const fineTuneResponse = await fineTune(companyId, nodesPath, edgesPath, demandPath);
      console.log('[Training] Fine-tuning initiated', fineTuneResponse);

      // Show initial training message
      setTrainingStatusMessage('Initializing model training...');

      // Poll training status with real-time updates
      const pollStart = Date.now();
      const poll = setInterval(async () => {
        try {
          console.log('[Training] Polling training status');
          const statusResponse = await getTrainingStatus(companyId);
          const status = statusResponse?.status || statusResponse?.ml_status?.status;
          const progress = statusResponse?.progress || 0;
          const message = statusResponse?.message || '';
          const error = statusResponse?.error;
          const metrics = statusResponse?.metrics || null;

          // Log detailed training metrics if available
          if (metrics) {
            console.log('[Training] Training metrics', metrics);
            // Log loss if available
            if (metrics.loss !== undefined) {
              console.log(`[Training] Current loss: ${metrics.loss.toFixed(6)}`);
            }
            // Log accuracy if available
            if (metrics.accuracy !== undefined) {
              console.log(`[Training] Current accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);
            }
            // Log epoch if available
            if (metrics.epoch !== undefined) {
              console.log(`[Training] Current epoch: ${metrics.epoch}`);
            }
          }

          console.log('[Training] Status update', { status, progress, message });

          // Update progress bar and status message
          setFineTuningProgress(progress);
          if (message) {
            setTrainingStatusMessage(message);
          }

          if (status === 'completed') {
            clearInterval(poll);
            setFineTuningComplete(true);
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
          } else if (status === 'failed') {
            clearInterval(poll);
            console.error('[Training] Training failed', error);
            throw new Error(error || 'Training failed');
          } else if (status === 'training') {
            // Provide more detailed training updates
            if (metrics && metrics.epoch !== undefined) {
              setTrainingStatusMessage(`Training epoch ${metrics.epoch} - Loss: ${metrics.loss !== undefined ? metrics.loss.toFixed(6) : 'N/A'}`);
            }
          }
        } catch (pollError) {
          console.log('[Training] Status polling error (continuing)', pollError.message);
          // Don't break on polling errors, continue trying
        }

        // Timeout after 5 minutes
        if (Date.now() - pollStart > 300000) {
          clearInterval(poll);
          console.error('[Training] Training timeout');
          throw new Error('Training timeout - please check status manually');
        }
      }, 2000); // Poll every 2 seconds

    } catch (error) {
      console.error('[Training] Fine-tuning error', error);
      toast({
        title: "Error",
        description: error.message || "Fine-tuning failed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setFineTuning(false);
    }
  };

  const FileUploadCard = ({ title, description, fileType, accept = ".csv", gradient }) => (
    <Card className={`border-dashed border-2 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-400 transition-all duration-300 group hover:shadow-lg bg-gradient-to-br ${gradient} dark:from-slate-800 dark:to-slate-800`}>
      <CardContent className="p-6">
        <div className="text-center">
          {convertedPaths && uploadType === 'single' ? (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto animate-bounce-gentle" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">File generated</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Open Separate Files tab to view paths</p>
              </div>
              <div className="w-full bg-green-100 dark:bg-green-900/50 rounded-full h-2">
                <div className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full w-full"></div>
              </div>
            </div>
          ) : (uploadType === 'multiple' && manualPaths[fileType]) ? (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto animate-bounce-gentle" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Files uploaded</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{fileType === 'nodes' ? 'nodes.csv' : fileType === 'edges' ? 'edges.csv' : 'demand.csv'} ready</p>
              </div>
              <div className="w-full bg-green-100 dark:bg-green-900/50 rounded-full h-2">
                <div className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full w-full"></div>
              </div>
            </div>
          ) : files[fileType] ? (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto animate-bounce-gentle" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{files[fileType].name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {(files[fileType].size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="w-full bg-green-100 dark:bg-green-900/50 rounded-full h-2">
                <div className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full w-full animate-pulse"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative group-hover:scale-110 transition-transform duration-300">
                <UploadIcon className="h-12 w-12 text-slate-400 mx-auto group-hover:text-blue-500 transition-colors" />
                <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{title}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
              </div>
            </div>
          )}
          {!(uploadType === 'single' && convertedPaths) && !(uploadType === 'multiple' && manualPaths[fileType]) && (
            <input
              type="file"
              accept={accept}
              onChange={(e) => handleFileChange(fileType, e.target.files[0])}
              className="mt-4 block w-full text-sm text-slate-500 dark:text-slate-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-gradient-to-r file:from-blue-50 file:to-purple-50 dark:file:from-slate-700 dark:file:to-slate-700
                file:text-blue-700 dark:file:text-blue-300
                hover:file:from-blue-100 hover:file:to-purple-100 dark:hover:file:from-slate-600 dark:hover:file:to-slate-600
                file:cursor-pointer file:transition-all file:duration-300
                cursor-pointer transition-colors"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-200 dark:border-slate-700 shadow-lg mb-4">
            <Database className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Data Upload Center</span>
            <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent mb-4">
            Upload Your Supply Chain Data
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Upload your supply chain data to start building your custom AI forecasting model
          </p>
        </div>

        {/* Main Upload Card */}
        <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up mb-8" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
              <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span>Data Upload</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs value={uploadType} onValueChange={setUploadType} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800">
                <TabsTrigger value="single" className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md">
                  <FileText className="h-4 w-4" />
                  <span>Single Dataset</span>
                </TabsTrigger>
                <TabsTrigger value="multiple" className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md">
                  <Database className="h-4 w-4" />
                  <span>Separate Files</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-4">
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-blue-200 dark:border-slate-700">
                  <p className="text-slate-700 dark:text-slate-300 mb-2 font-medium">📊 Single Dataset Upload</p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Upload a single CSV file containing your complete supply chain dataset with all necessary columns
                  </p>
                </div>
                <FileUploadCard
                  title="Supply Chain Dataset"
                  description="Upload your complete dataset (CSV format)"
                  fileType="single"
                  gradient="from-blue-50 to-cyan-50"
                />
                {convertedPaths && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FileUploadCard
                      title="Nodes File (generated)"
                      description="nodes.csv path"
                      fileType="nodes"
                      gradient="from-green-50 to-emerald-50"
                    />
                    <FileUploadCard
                      title="Edges File (generated)"
                      description="edges.csv path"
                      fileType="edges"
                      gradient="from-orange-50 to-amber-50"
                    />
                    <FileUploadCard
                      title="Demand File (generated)"
                      description="demand.csv path"
                      fileType="demand"
                      gradient="from-pink-50 to-rose-50"
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="multiple" className="space-y-4">
                <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-purple-200 dark:border-slate-700">
                  <p className="text-slate-700 dark:text-slate-300 mb-2 font-medium">📁 Multi-File Upload</p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Upload three separate CSV files or use sample data for comprehensive supply chain network analysis
                  </p>
                </div>

                {/* Sample Creation */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-blue-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-700 dark:text-slate-300 mb-1 font-medium">🎯 Quick Start with Sample Data</p>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">Create a sample dataset to test the system</p>
                    </div>
                    <Button
                      onClick={handleCreateSample}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 dark:from-blue-700 dark:to-cyan-700 dark:hover:from-blue-600 dark:hover:to-cyan-600 text-white"
                    >
                      Create Sample
                    </Button>
                  </div>
                </div>

                {/* Manual Path Entry */}
                <div className="mb-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-white mb-3">Manual File Paths</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-700 dark:text-slate-300 font-medium">Nodes Path</Label>
                      <Input
                        value={manualPaths.nodes}
                        onChange={(e) => setManualPaths(prev => ({ ...prev, nodes: e.target.value }))}
                        placeholder="uploads/companyId/nodes.csv"
                        className="mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-700 dark:text-slate-300 font-medium">Edges Path</Label>
                      <Input
                        value={manualPaths.edges}
                        onChange={(e) => setManualPaths(prev => ({ ...prev, edges: e.target.value }))}
                        placeholder="uploads/companyId/edges.csv"
                        className="mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-700 dark:text-slate-300 font-medium">Demand Path</Label>
                      <Input
                        value={manualPaths.demand}
                        onChange={(e) => setManualPaths(prev => ({ ...prev, demand: e.target.value }))}
                        placeholder="uploads/companyId/demand.csv"
                        className="mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FileUploadCard
                    title="Nodes File"
                    description="nodes.csv - Store and location data"
                    fileType="nodes"
                    gradient="from-green-50 to-emerald-50"
                  />
                  <FileUploadCard
                    title="Edges File"
                    description="edges.csv - Connection relationships"
                    fileType="edges"
                    gradient="from-orange-50 to-amber-50"
                  />
                  <FileUploadCard
                    title="Demand File"
                    description="demand.csv - Historical demand data"
                    fileType="demand"
                    gradient="from-pink-50 to-rose-50"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Upload Progress */}
            {uploading && (
              <div className="mt-6 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Uploading files...</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-3" />
                <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing your data securely...</span>
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="mt-8 flex justify-center">
              <Button
                onClick={handleUpload}
                disabled={uploading || uploadComplete}
                className="px-10 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-700 dark:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-xl group border-0 rounded-xl"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : uploadComplete ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 animate-bounce-gentle" />
                    Upload Complete
                  </>
                ) : (
                  <>
                    Upload Files
                    <UploadIcon className="ml-2 h-4 w-4 group-hover:translate-y-[-2px] transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* File Requirements Section */}
        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm animate-fade-in-up mb-8" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>File Requirements</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {uploadType === 'single' ? (
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 dark:text-white">Single Dataset Requirements:</h4>
                <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded-lg border border-blue-200 dark:border-slate-700">
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">Your CSV file should contain the following columns:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span><strong>warehouse_id</strong> - Warehouse identifier</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span><strong>product_id</strong> - Product identifier</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span><strong>store_name</strong> - Store location name</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span><strong>demand</strong> - Historical demand values</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                      <span><strong>date</strong> - Date (YYYY-MM-DD format)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                      <span><strong>category</strong> - Product category</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h4 className="font-semibold text-slate-800 dark:text-white">Multi-File Requirements:</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-slate-800 p-4 rounded-lg border border-green-200 dark:border-slate-700">
                    <h5 className="font-semibold text-green-800 dark:text-green-400 mb-2">nodes.csv</h5>
                    <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                      <li>• <strong>node_id</strong> - Unique node identifier</li>
                      <li>• <strong>store_name</strong> - Store location name</li>
                      <li>• <strong>warehouse_id</strong> - Warehouse identifier</li>
                      <li>• <strong>location</strong> - Geographic location</li>
                    </ul>
                  </div>

                  <div className="bg-orange-50 dark:bg-slate-800 p-4 rounded-lg border border-orange-200 dark:border-slate-700">
                    <h5 className="font-semibold text-orange-800 dark:text-orange-400 mb-2">edges.csv</h5>
                    <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                      <li>• <strong>edge_id</strong> - Unique edge identifier</li>
                      <li>• <strong>from_node</strong> - Source node ID</li>
                      <li>• <strong>to_node</strong> - Destination node ID</li>
                      <li>• <strong>weight</strong> - Connection strength</li>
                    </ul>
                  </div>

                  <div className="bg-pink-50 dark:bg-slate-800 p-4 rounded-lg border border-pink-200 dark:border-slate-700">
                    <h5 className="font-semibold text-pink-800 dark:text-pink-400 mb-2">demand.csv</h5>
                    <ul className="text-sm text-pink-700 dark:text-pink-300 space-y-1">
                      <li>• <strong>node_id</strong> - Reference to node</li>
                      <li>• <strong>product_id</strong> - Product identifier</li>
                      <li>• <strong>date</strong> - Date (YYYY-MM-DD)</li>
                      <li>• <strong>demand</strong> - Demand quantity</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fine-tuning Section */}
        {uploadComplete && (
          <Card className="shadow-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm animate-fade-in-up">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-slate-900 dark:text-white">
                <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <span>AI Model Fine-tuning</span>
                {fineTuning && <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center space-x-2 bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-full border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Data uploaded successfully</span>
                </div>

                <div className="max-w-md mx-auto">
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Ready to train your custom AI model! This process will optimize the forecasting algorithm specifically for your data patterns.
                  </p>

                  {fineTuning && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Training AI model...</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">{Math.round(fineTuningProgress)}%</span>
                      </div>
                      <Progress value={fineTuningProgress} className="h-3" />
                      <div className="flex items-center justify-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <Brain className="h-4 w-4 animate-pulse text-purple-500 dark:text-purple-400" />
                        <span>
                          {trainingStatusMessage ||
                            (fineTuningProgress < 10 ? "Initializing training process..." :
                              fineTuningProgress < 20 ? "Validating input files..." :
                                fineTuningProgress < 30 ? "Loading base model..." :
                                  fineTuningProgress < 40 ? "Preparing training data..." :
                                    fineTuningProgress < 50 ? "Checking model compatibility..." :
                                      fineTuningProgress < 90 ? "Training neural network..." :
                                        fineTuningProgress < 100 ? "Saving trained model..." :
                                          "Training completed!")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleFineTuning}
                  disabled={fineTuning || fineTuningComplete}
                  size="lg"
                  className="px-10 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 dark:from-purple-700 dark:to-pink-700 dark:hover:from-purple-600 dark:hover:to-pink-600 text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-xl group border-0 rounded-xl"
                >
                  {fineTuning ? (
                    <>
                      <Brain className="mr-2 h-5 w-5 animate-pulse" />
                      Fine-tuning in Progress...
                    </>
                  ) : fineTuningComplete ? (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5 animate-bounce-gentle" />
                      Fine-tuning Complete
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Start AI Fine-tuning
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>

                {fineTuningComplete && (
                  <div className="animate-fade-in space-y-2">
                    <p className="text-green-600 dark:text-green-400 font-semibold flex items-center justify-center space-x-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Model training completed successfully!</span>
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Redirecting to predictions page...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Display */}
        <div className="mt-8">
          <StatusDisplay companyId={localStorage.getItem('companyId') || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).companyId : null)} />
        </div>
      </div>
    </div>
  );
};

export default Upload;