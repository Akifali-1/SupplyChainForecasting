// Homepage component
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Brain, TrendingUp, FileText, Settings, ArrowRight, CheckCircle, Sparkles, Zap, BarChart3 } from 'lucide-react';
import { mockFeatures } from '../utils/mockData';

const iconMap = {
  brain: Brain,
  'trending-up': TrendingUp,
  'file-text': FileText,
  settings: Settings
};

const Homepage = () => {
  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const cardIndex = Array.from(featureCards || []).indexOf(entry.target);
          const isEven = cardIndex % 2 === 0;
          entry.target.classList.add(isEven ? 'animate-slide-in-left' : 'animate-slide-in-right');
        }
      });
    }, observerOptions);

    const featureCards = featuresRef.current?.querySelectorAll('.feature-card');
    const processCards = howItWorksRef.current?.querySelectorAll('.process-card');
    
    featureCards?.forEach((card) => observer.observe(card));
    processCards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Project Info Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-100 px-4 py-2 rounded-full mb-6">
            <Brain className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Supply Chain AI Platform</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Supply Chain Demand Prediction (GNN)
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Upload your supply chain data to generate nodes, edges, and demand files. 
            A GCN/GNN model is fine-tuned per company to forecast demand and visualize results with cutting-edge AI technology.
          </p>
        </div>
      </section>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"></div>
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-2xl animate-spin-slow"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto text-center z-10">
          <div className="animate-fade-in-up">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-200 shadow-lg animate-bounce-gentle">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700">AI-Powered Forecasting</span>
                <Zap className="h-4 w-4 text-yellow-500" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent animate-gradient">
                Smart Supply Chain
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent animate-gradient-reverse">
                Demand Forecasting
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-700 mb-8 max-w-4xl mx-auto leading-relaxed font-light">
              Harness the power of <span className="font-semibold text-blue-600">AI and machine learning</span> to predict demand patterns, 
              optimize inventory levels, and make <span className="font-semibold text-purple-600">data-driven decisions</span> for your supply chain.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link to="/register">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-4 text-lg font-semibold transition-all duration-500 hover:scale-110 hover:shadow-2xl group border-0 rounded-xl"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform duration-300" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-10 py-4 text-lg font-semibold border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300 hover:scale-105 hover:shadow-lg rounded-xl"
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Predict Demand with
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                AI Precision
              </span>
            </h2>
            <p className="text-xl text-slate-600 max-w-4xl mx-auto leading-relaxed mb-12">
              Transform your supply chain with cutting-edge AI forecasting. Upload your data, fine-tune our models, and get accurate demand predictions that drive smarter business decisions.
            </p>
            {/* Buttons intentionally removed in this section */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
            {[
              { icon: Sparkles, number: '500+', label: 'Companies Trust Us', color: 'from-blue-500 to-cyan-500', bgColor: 'from-blue-50 to-cyan-50' },
              { icon: BarChart3, number: '95%', label: 'Prediction Accuracy', color: 'from-purple-500 to-pink-500', bgColor: 'from-purple-50 to-pink-50' },
              { icon: TrendingUp, number: '$2M+', label: 'Cost Savings Generated', color: 'from-green-500 to-emerald-500', bgColor: 'from-green-50 to-emerald-50' }
            ].map((stat, index) => (
              <Card key={index} className={`text-center border-0 bg-gradient-to-br ${stat.bgColor} hover:shadow-2xl transition-all duration-500 hover:-translate-y-4 group`}>
                <CardContent className="p-8">
                  <div className={`w-20 h-20 bg-gradient-to-r ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <stat.icon className="h-9 w-9 text-white" />
                  </div>
                  <div className="text-5xl font-bold text-slate-900 mb-3">{stat.number}</div>
                  <div className="text-slate-600 font-medium text-lg">{stat.label}</div>
                  <div className={`mt-4 h-1 bg-gradient-to-r ${stat.color} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`}></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-64 h-64 bg-blue-300/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-300/10 rounded-full blur-3xl animate-float-delayed"></div>
        </div>
        <div className="relative max-w-7xl mx-auto z-10">
          <div className="text-center mb-20 animate-fade-in-up">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-slate-800 to-blue-600 bg-clip-text text-transparent">
                Powerful Features for Modern Supply Chains
              </span>
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Our platform combines machine learning, statistical modeling, and demand forecasting to give you the most comprehensive supply chain solution.
            </p>
          </div>
          
          <div className="space-y-32">
            {mockFeatures.map((feature, index) => {
              const IconComponent = iconMap[feature.icon];
              const isEven = index % 2 === 0;
              
              return (
                <div 
                  key={index} 
                  className="feature-card opacity-0"
                >
                  <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${
                    !isEven ? 'lg:grid-flow-col-dense' : ''
                  }`}>
                    {/* Content */}
                    <div className={`space-y-8 ${!isEven ? 'lg:col-start-2' : ''}`}>
                      <div className="inline-flex items-center space-x-3">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
                          <IconComponent className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-1">Feature</div>
                          <h3 className="text-3xl font-bold text-slate-900">
                            {feature.title}
                          </h3>
                        </div>
                      </div>
                      <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                      <p className="text-xl text-slate-600 leading-relaxed">
                        {feature.description}
                      </p>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-slate-700">Industry Leading</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-slate-700">99.9% Uptime</span>
                        </div>
                      </div>
                      <Button 
                        size="lg"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 font-semibold transition-all duration-300 hover:scale-105 group border-0 rounded-xl"
                      >
                        Learn More
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                    
                    {/* Visual Card */}
                    <div className={`${!isEven ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                      <Card className="group hover:shadow-2xl transition-all duration-500 hover:-translate-y-6 border-0 bg-gradient-to-br from-white to-blue-50/80 backdrop-blur-sm overflow-hidden">
                        <CardContent className="p-10">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-2xl blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
                            <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-8 border border-blue-100/50 shadow-inner">
                              <div className="flex items-center space-x-4 mb-6">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                                  <IconComponent className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1 space-y-3">
                                  <div className="h-3 bg-gradient-to-r from-blue-200 to-purple-200 rounded-full"></div>
                                  <div className="h-3 bg-gradient-to-r from-blue-300 to-purple-300 rounded-full w-4/5"></div>
                                  <div className="h-3 bg-gradient-to-r from-blue-200 to-purple-200 rounded-full w-3/5"></div>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div className="grid grid-cols-4 gap-3">
                                  {[...Array(8)].map((_, i) => (
                                    <div key={i} className={`h-12 rounded-lg ${
                                      i % 3 === 0 ? 'bg-gradient-to-r from-blue-100 to-blue-200' : 
                                      i % 3 === 1 ? 'bg-gradient-to-r from-purple-100 to-purple-200' : 
                                      'bg-gradient-to-r from-green-100 to-green-200'
                                    } animate-pulse`} style={{animationDelay: `${i * 0.1}s`}}></div>
                                  ))}
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                                  <span className="text-sm text-slate-500 font-medium">Status: Active</span>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                                    <span className="text-sm text-green-600 font-medium">Online</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={howItWorksRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-indigo-50 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-300/20 rounded-full blur-2xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-purple-300/20 rounded-full blur-2xl animate-float-delayed"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-slate-800 to-indigo-600 bg-clip-text text-transparent">
                How It Works
              </span>
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Three simple steps to start forecasting your demand with AI precision
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Your Data',
                description: 'Upload your supply chain data - single dataset or separate node, edge, and demand files.',
                color: 'from-blue-500 to-cyan-500',
                bgColor: 'from-blue-50 to-cyan-50'
              },
              {
                step: '02',
                title: 'AI Model Training',
                description: 'Our advanced AI system processes your data and fine-tunes the forecasting model for your specific needs.',
                color: 'from-purple-500 to-pink-500',
                bgColor: 'from-purple-50 to-pink-50'
              },
              {
                step: '03',
                title: 'Get Predictions',
                description: 'Input store and product names to get accurate demand predictions and actionable insights.',
                color: 'from-indigo-500 to-blue-500',
                bgColor: 'from-indigo-50 to-blue-50'
              }
            ].map((item, index) => (
              <div key={index} className="process-card opacity-0 transform translate-y-10 transition-all duration-1000" style={{transitionDelay: `${index * 0.2}s`}}>
                <Card className={`group hover:shadow-2xl transition-all duration-500 hover:-translate-y-6 border-0 bg-gradient-to-br ${item.bgColor} backdrop-blur-sm h-full`}>
                  <CardContent className="p-8 text-center h-full flex flex-col">
                    <div className="mb-6">
                      <div className={`w-20 h-20 bg-gradient-to-br ${item.color} text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                        {item.step}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-4 group-hover:text-slate-900 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed flex-1 group-hover:text-slate-700 transition-colors">
                      {item.description}
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-200/50">
                      <div className={`w-full h-1 bg-gradient-to-r ${item.color} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`}></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full" style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)'
            }}></div>
          </div>
          <div className="absolute top-20 right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 shadow-lg mb-8">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              <span className="text-sm font-medium text-white">Ready to Launch?</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight">
              Ready to Revolutionize Your 
              <span className="block bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                Forecasting?
              </span>
            </h2>
            <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join thousands of businesses already using AI to optimize their supply chains and stay ahead of market demands.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link to="/register">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-white to-blue-50 text-slate-900 hover:from-blue-50 hover:to-white px-12 py-4 text-lg font-semibold transition-all duration-500 hover:scale-110 hover:shadow-2xl group border-0 rounded-xl"
                >
                  Get Started Today
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform duration-300" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg" 
                className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 px-12 py-4 text-lg font-semibold transition-all duration-300 hover:scale-105 rounded-xl backdrop-blur-sm"
              >
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
            {/* Company Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">ForecastAI</span>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-md">
                Empowering businesses with AI-powered demand forecasting and supply chain optimization. Transform your operations with cutting-edge machine learning technology.
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>SOC 2 Compliant</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>99.9% Uptime</span>
                </div>
              </div>
            </div>

            {/* Product */}
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-white">Product</h4>
              <ul className="space-y-3">
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors">Demand Forecasting</Link></li>
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors">Supply Chain Analytics</Link></li>
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors">Inventory Optimization</Link></li>
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors">Real-time Insights</Link></li>
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors">API Integration</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-white">Company</h4>
              <ul className="space-y-3">
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">About Us</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Careers</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Press</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Blog</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Partners</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-white">Support</h4>
              <ul className="space-y-3">
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Help Center</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Documentation</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Contact Support</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">System Status</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="pt-8 border-t border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="flex items-center space-x-6">
                <p className="text-slate-400 text-sm">
                  © 2025 ForecastAI. All rights reserved.
                </p>
                <div className="flex items-center space-x-4 text-sm text-slate-400">
                  <Link to="/" className="hover:text-white transition-colors">Privacy Policy</Link>
                  <Link to="/" className="hover:text-white transition-colors">Terms of Service</Link>
                  <Link to="/" className="hover:text-white transition-colors">Cookie Policy</Link>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>All systems operational</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-slate-400">Follow us:</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors cursor-pointer">
                      <span className="text-xs text-slate-400">tw</span>
                    </div>
                    <div className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors cursor-pointer">
                      <span className="text-xs text-slate-400">li</span>
                    </div>
                    <div className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors cursor-pointer">
                      <span className="text-xs text-slate-400">gh</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;