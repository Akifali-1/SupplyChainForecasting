// Homepage component
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Brain, TrendingUp, FileText, Settings, ArrowRight, CheckCircle, Sparkles, Zap, BarChart3, Network, Clock, MapPin, Database, Cpu, Activity, ChevronDown } from 'lucide-react';
import Spline from '@splinetool/react-spline';
import { useTheme } from '../contexts/ThemeContext';

const Homepage = () => {
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [showJourneyNav, setShowJourneyNav] = useState(false);
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);
  const splineRef = useRef(null);
  const verticalJourneyRef = useRef(null);
  const sectionRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const splineScene = isDarkMode
    ? '/models/scene_model.splinecode'
    : '/models/light_scene.splinecode';

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (heroRef.current && splineRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * 20;
        const rotateX = (y - 0.5) * -20;
        splineRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
        }
      });
    }, observerOptions);

    const featureCards = featuresRef.current?.querySelectorAll('.feature-card');
    const processCards = howItWorksRef.current?.querySelectorAll('.process-card');

    featureCards?.forEach((card) => observer.observe(card));
    processCards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleJourneyVisibility = () => {
      if (!heroRef.current) return;
      const heroBottom = heroRef.current.getBoundingClientRect().bottom;
      setShowJourneyNav(heroBottom <= 80);
    };

    window.addEventListener('scroll', handleJourneyVisibility);
    handleJourneyVisibility();

    return () => {
      window.removeEventListener('scroll', handleJourneyVisibility);
    };
  }, []);

  // Handle Spline load event
  const onSplineLoad = () => {
    setSplineLoaded(true);
  };

  useEffect(() => {
    setSplineLoaded(false);
  }, [splineScene]);

  // Handle vertical journey section visibility
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;

      // Determine which section is in view
      sectionRefs.forEach((ref, index) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.top <= windowHeight / 2 && rect.bottom >= windowHeight / 2) {
            setActiveSection(index);
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Function to scroll to a specific section
  const scrollToSection = (index) => {
    if (sectionRefs[index]?.current) {
      sectionRefs[index].current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      {/* Hero Section - Cinematic with Spline 3D */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-blue-50/20 to-white dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 pt-16">
        {/* Spline 3D Model Background - Parallax Layer */}
        <div className="absolute inset-0 flex items-center justify-center parallax-layer" data-speed="0.3">
          <div
            ref={splineRef}
            className="w-full h-full transition-transform duration-200 ease-out"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Spline 3D Model - Local File */}
            <Spline
              key={splineScene}
              scene={splineScene}
              onLoad={onSplineLoad}
            />
          </div>
        </div>

        {/* Loading placeholder for Spline */}
        {!splineLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
          </div>
        )}

        {/* Ambient Background Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-blue-400/10 to-cyan-400/10 dark:from-blue-500/20 dark:to-cyan-500/20 rounded-full blur-3xl glow-ambient"></div>
          <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-blue-500/10 to-blue-600/10 dark:from-blue-400/20 dark:to-blue-600/20 rounded-full blur-3xl glow-ambient" style={{ animationDelay: '2s' }}></div>
        </div>


        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce-gentle">
          <div className="w-6 h-10 border-2 border-blue-400 dark:border-blue-500 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Model Highlight Component - Glassmorphic */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-white via-blue-50/10 to-white dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950 section-blend">
        <div className="max-w-5xl mx-auto">
          <div className="relative group floating">
            {/* Ambient Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 dark:from-blue-400/30 dark:via-cyan-400/30 dark:to-blue-400/30 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition duration-700"></div>

            {/* Main Glass Card */}
            <div className="relative glass-strong rounded-3xl shadow-2xl overflow-hidden card-depth">
              <div className="p-8 md:p-12">
                {/* Icon & Title */}
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 rounded-2xl flex items-center justify-center shadow-lg neon-glow">
                    <Brain className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Our Technology</div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                      Adaptive Fusion GAT-LSTM
                    </h2>
                  </div>
                </div>

                {/* Description */}
                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
                  Proprietary forecasting combining <span className="font-semibold text-blue-700 dark:text-blue-400">Graph Attention Networks</span> with <span className="font-semibold text-blue-700 dark:text-blue-400">LSTM</span> for unprecedented supply chain accuracy.
                </p>

                {/* Dual Learning Cards */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {/* Spatial */}
                  <div className="glass rounded-2xl p-6 card-depth hover:scale-105 transition-transform duration-300">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Spatial Learning</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                      Captures relationships between supply chain nodes—how demand at one location influences network.
                    </p>
                  </div>

                  {/* Temporal */}
                  <div className="glass rounded-2xl p-6 card-depth hover:scale-105 transition-transform duration-300">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Temporal Learning</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                      Analyzes time-driven patterns, seasonality, and historical trends for precise future predictions.
                    </p>
                  </div>
                </div>

                {/* Why It Matters */}
                <div className="glass rounded-2xl p-6 border-l-4 border-blue-600 dark:border-blue-500">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                    <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                    Why This Matters
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                    Supply chains depend on both location relationships AND time patterns. Traditional models handle only one. Our dual-learning approach delivers significantly more accurate real-world predictions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Predict Demand with
              <span className="block bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 dark:from-blue-400 dark:via-blue-300 dark:to-blue-500 bg-clip-text text-transparent">
                AI Precision
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto leading-relaxed mb-12">
              Transform your supply chain with cutting-edge AI forecasting. Upload your data, fine-tune our models, and get accurate demand predictions that drive smarter business decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {[
              {
                icon: Sparkles,
                number: '500+',
                label: 'Companies Trust Us',
                color: 'from-blue-500 to-cyan-500',
                subtitle: 'Global Enterprise Clients'
              },
              {
                icon: BarChart3,
                number: '95%',
                label: 'Prediction Accuracy',
                color: 'from-blue-500 to-blue-600',
                subtitle: 'Industry Leading Precision'
              },
              {
                icon: TrendingUp,
                number: '$2M+',
                label: 'Cost Savings Generated',
                color: 'from-blue-500 to-cyan-500',
                subtitle: 'Annual Average Savings'
              }
            ].map((stat, index) => (
              <div
                key={index}
                className="floating glass-strong rounded-3xl p-8 text-center group card-depth"
              >
                {/* Ambient Glow on Hover */}
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/20 group-hover:to-cyan-500/20 rounded-3xl blur-xl transition duration-500"></div>

                <div className="relative z-10">
                  {/* Icon */}
                  <div className={`w-20 h-20 bg-gradient-to-r ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-all duration-300 shadow-lg neon-glow`}>
                    <stat.icon className="h-9 w-9 text-white" />
                  </div>
                  {/* Number */}
                  <div className="text-5xl font-bold text-slate-900 dark:text-white mb-2">
                    {stat.number}
                  </div>
                  {/* Subtitle */}
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    {stat.subtitle}
                  </div>
                  {/* Label */}
                  <div className="text-slate-700 dark:text-slate-300 font-medium text-lg">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supply Chain Management Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-white via-blue-50/10 to-white dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-slate-900 to-blue-600 dark:from-white dark:to-blue-400 bg-clip-text text-transparent">
                Supply Chain Management
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Our platform combines machine learning, statistical modeling, and demand forecasting to give you most comprehensive supply chain solution.
            </p>
          </div>
        </div>
      </section>

      {/* Vertical Storytelling Journey - AI Forecasting Flow */}
      <div ref={verticalJourneyRef} className="relative mt-16">
        {/* Fixed Timeline - Desktop Only */}
        {showJourneyNav && (
          <div className="hidden lg:block fixed left-10 top-1/2 transform -translate-y-1/2 z-20">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-96 bg-gradient-to-b from-blue-600/20 via-blue-600/50 to-blue-600/20"></div>

              {/* Timeline Nodes */}
              {[
                { icon: Brain, label: "AI Forecasting" },
                { icon: Database, label: "Data Ingestion" },
                { icon: Cpu, label: "Fine-Tuning" },
                { icon: Activity, label: "Prediction & Analytics" }
              ].map((node, index) => (
                <div
                  key={index}
                  className="relative flex items-center justify-center h-24 cursor-pointer group"
                  onClick={() => scrollToSection(index)}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${activeSection === index
                      ? 'bg-blue-600 scale-125 shadow-lg shadow-blue-500/50'
                      : 'bg-slate-300/30 dark:bg-slate-700/30 hover:bg-slate-400/50 dark:hover:bg-slate-600/50'
                      }`}
                  >
                    <node.icon
                      className={`h-6 w-6 transition-all duration-500 ${activeSection === index ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                        }`}
                    />
                  </div>
                  {activeSection === index && (
                    <div className="absolute left-full ml-4 px-3 py-1 bg-slate-900 dark:bg-slate-800 text-white text-sm rounded-lg whitespace-nowrap">
                      {node.label}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Timeline */}
        {showJourneyNav && (
          <div className="lg:hidden sticky top-0 z-20 bg-white dark:bg-slate-950 py-4 px-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center">
              {[
                { icon: Brain, label: "AI Forecasting" },
                { icon: Database, label: "Data Ingestion" },
                { icon: Cpu, label: "Fine-Tuning" },
                { icon: Activity, label: "Prediction & Analytics" }
              ].map((node, index) => (
                <div
                  key={index}
                  className={`flex flex-col items-center cursor-pointer ${activeSection === index ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'
                    }`}
                  onClick={() => scrollToSection(index)}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all duration-300 ${activeSection === index
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                  >
                    <node.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-center hidden sm:block">{node.label.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 1: AI Forecasting */}
        <div
          ref={sectionRefs[0]}
          className="min-h-screen relative overflow-hidden"
          style={{
            background: isDarkMode
              ? 'radial-gradient(ellipse at center, #0a1628 0%, #040611 100%)'
              : 'radial-gradient(ellipse at center, #f0f7ff 0%, #ffffff 100%)'
          }}
        >
          {/* Animated Background Blob */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute top-1/4 right-1/4 w-[800px] h-[800px] rounded-full blur-3xl animate-pulse ${isDarkMode
              ? 'bg-gradient-to-br from-blue-600/20 to-indigo-600/20'
              : 'bg-gradient-to-br from-blue-400/10 to-indigo-400/10'
              }`}></div>
            <div className={`absolute bottom-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl ${isDarkMode
              ? 'bg-gradient-to-tr from-blue-500/10 to-indigo-500/10'
              : 'bg-gradient-to-tr from-blue-300/5 to-indigo-300/5'
              }`} style={{ animationDelay: '2s' }}></div>
          </div>

          {/* Content */}
          <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 shadow-lg ${isDarkMode
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20'
                  }`}>
                  <Brain className="h-10 w-10 text-white" />
                </div>
                <h1 className={`text-5xl md:text-7xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                  AI Forecasting
                </h1>
                <p className={`text-xl max-w-2xl mx-auto leading-relaxed ${isDarkMode ? 'text-blue-100' : 'text-slate-600'
                  }`}>
                  Our advanced AI models analyze historical data and market trends to predict future demand with unparalleled accuracy.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className={`rounded-2xl p-6 border backdrop-blur-md ${isDarkMode
                  ? 'glass-strong border-blue-500/20'
                  : 'bg-white/80 border-blue-200/50 shadow-lg'
                  }`}>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                    }`}>
                    <TrendingUp className={`h-6 w-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Predictive Analytics</h3>
                  <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                    Advanced algorithms that identify patterns and predict future outcomes with 95% accuracy.
                  </p>
                </div>
                <div className={`rounded-2xl p-6 border backdrop-blur-md ${isDarkMode
                  ? 'glass-strong border-blue-500/20'
                  : 'bg-white/80 border-blue-200/50 shadow-lg'
                  }`}>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                    }`}>
                    <Network className={`h-6 w-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Network Analysis</h3>
                  <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                    Understand complex relationships between different nodes in your supply chain network.
                  </p>
                </div>
                <div className={`rounded-2xl p-6 border backdrop-blur-md ${isDarkMode
                  ? 'glass-strong border-blue-500/20'
                  : 'bg-white/80 border-blue-200/50 shadow-lg'
                  }`}>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                    }`}>
                    <Clock className={`h-6 w-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Time Series Analysis</h3>
                  <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                    Leverage temporal patterns to forecast demand across different time horizons.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce">
            <ChevronDown className={`h-8 w-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
        </div>

        {/* Section 2: Data Ingestion */}
        <div
          ref={sectionRefs[1]}
          className="min-h-screen relative overflow-hidden"
          style={{
            background: isDarkMode
              ? 'radial-gradient(ellipse at center, #0a1e2e 0%, #040611 100%)'
              : 'radial-gradient(ellipse at center, #f0f7ff 0%, #ffffff 100%)'
          }}
        >
          {/* Animated Background Blob */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute top-1/4 right-1/4 w-[800px] h-[800px] rounded-full blur-3xl animate-pulse ${isDarkMode
              ? 'bg-gradient-to-br from-blue-600/20 to-cyan-600/20'
              : 'bg-gradient-to-br from-blue-400/10 to-cyan-400/10'
              }`}></div>
            <div className={`absolute bottom-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl ${isDarkMode
              ? 'bg-gradient-to-tr from-blue-500/10 to-cyan-500/10'
              : 'bg-gradient-to-tr from-blue-300/5 to-cyan-300/5'
              }`} style={{ animationDelay: '2s' }}></div>
          </div>

          {/* Content */}
          <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 shadow-lg ${isDarkMode
                  ? 'bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/30'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20'
                  }`}>
                  <Database className="h-10 w-10 text-white" />
                </div>
                <h1 className={`text-5xl md:text-7xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                  Data Ingestion
                </h1>
                <p className={`text-xl max-w-2xl mx-auto leading-relaxed ${isDarkMode ? 'text-blue-100' : 'text-slate-600'
                  }`}>
                  Seamlessly integrate data from multiple sources into our platform with our flexible ingestion system.
                </p>
              </div>

              <div className={`rounded-2xl p-8 border backdrop-blur-md ${isDarkMode
                ? 'glass-strong border-blue-500/20'
                : 'bg-white/80 border-blue-200/50 shadow-lg'
                }`}>
                <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Supported Data Formats
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                      <FileText className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        CSV & Excel Files
                      </h4>
                      <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                        Direct upload of spreadsheets with automatic schema detection.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                      <Database className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Database Connections
                      </h4>
                      <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                        Connect directly to SQL, NoSQL, and data warehouses.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                      <Network className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        API Integrations
                      </h4>
                      <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                        Real-time data synchronization with REST and GraphQL APIs.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                      <Zap className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Streaming Data
                      </h4>
                      <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                        Process real-time data streams with Kafka and Kinesis.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce">
            <ChevronDown className={`h-8 w-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
        </div>

        {/* Section 3: Fine-Tuning */}
        <div
          ref={sectionRefs[2]}
          className="min-h-screen relative overflow-hidden"
          style={{
            background: isDarkMode
              ? 'radial-gradient(ellipse at center, #0f0e27 0%, #040611 100%)'
              : 'radial-gradient(ellipse at center, #f0f7ff 0%, #ffffff 100%)'
          }}
        >
          {/* Animated Background Blob */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute top-1/4 right-1/4 w-[800px] h-[800px] rounded-full blur-3xl animate-pulse ${isDarkMode
              ? 'bg-gradient-to-br from-indigo-600/20 to-violet-600/20'
              : 'bg-gradient-to-br from-indigo-400/10 to-violet-400/10'
              }`}></div>
            <div className={`absolute bottom-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl ${isDarkMode
              ? 'bg-gradient-to-tr from-indigo-500/10 to-violet-500/10'
              : 'bg-gradient-to-tr from-indigo-300/5 to-violet-300/5'
              }`} style={{ animationDelay: '2s' }}></div>
          </div>

          {/* Content */}
          <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 shadow-lg ${isDarkMode
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30'
                  : 'bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/20'
                  }`}>
                  <Cpu className="h-10 w-10 text-white" />
                </div>
                <h1 className={`text-5xl md:text-7xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                  Fine-Tuning
                </h1>
                <p className={`text-xl max-w-2xl mx-auto leading-relaxed ${isDarkMode ? 'text-indigo-100' : 'text-slate-600'
                  }`}>
                  Customize our AI models to your specific industry and business needs with our intuitive fine-tuning interface.
                </p>
              </div>

              <div className={`rounded-2xl p-8 border backdrop-blur-md ${isDarkMode
                ? 'glass-strong border-indigo-500/20'
                : 'bg-white/80 border-indigo-200/50 shadow-lg'
                }`}>
                <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Model Customization Options
                </h3>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'
                      }`}>
                      <Settings className={`h-5 w-5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Hyperparameter Optimization
                      </h4>
                      <p className={isDarkMode ? 'text-indigo-100' : 'text-slate-600'}>
                        Automatically adjust model parameters to maximize performance for your specific data.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'
                      }`}>
                      <Brain className={`h-5 w-5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Domain-Specific Training
                      </h4>
                      <p className={isDarkMode ? 'text-indigo-100' : 'text-slate-600'}>
                        Fine-tune models with industry-specific data to improve accuracy for your use case.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'
                      }`}>
                      <Activity className={`h-5 w-5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Continuous Learning
                      </h4>
                      <p className={isDarkMode ? 'text-indigo-100' : 'text-slate-600'}>
                        Models automatically improve over time as they process new data and feedback.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce">
            <ChevronDown className={`h-8 w-8 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </div>
        </div>

        {/* Section 4: Prediction & Analytics */}
        <div
          ref={sectionRefs[3]}
          className="min-h-screen relative overflow-hidden"
          style={{
            background: isDarkMode
              ? 'radial-gradient(ellipse at center, #040611 0%, #0a1929 100%)'
              : 'radial-gradient(ellipse at center, #f0f7ff 0%, #ffffff 100%)'
          }}
        >
          {/* Animated Background Blob */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute top-1/4 right-1/4 w-[800px] h-[800px] rounded-full blur-3xl animate-pulse ${isDarkMode
              ? 'bg-gradient-to-br from-blue-600/20 to-blue-800/20'
              : 'bg-gradient-to-br from-blue-400/10 to-blue-600/10'
              }`}></div>
            <div className={`absolute bottom-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl ${isDarkMode
              ? 'bg-gradient-to-tr from-blue-500/10 to-blue-700/10'
              : 'bg-gradient-to-tr from-blue-300/5 to-blue-500/5'
              }`} style={{ animationDelay: '2s' }}></div>
          </div>

          {/* Content */}
          <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 shadow-lg ${isDarkMode
                  ? 'bg-gradient-to-br from-blue-500 to-blue-800 shadow-blue-500/30'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20'
                  }`}>
                  <Activity className="h-10 w-10 text-white" />
                </div>
                <h1 className={`text-5xl md:text-7xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                  Prediction & Analytics
                </h1>
                <p className={`text-xl max-w-2xl mx-auto leading-relaxed ${isDarkMode ? 'text-blue-100' : 'text-slate-600'
                  }`}>
                  Get actionable insights from your data with our comprehensive analytics dashboard and prediction tools.
                </p>
              </div>

              <div className={`rounded-2xl p-8 border backdrop-blur-md ${isDarkMode
                ? 'glass-strong border-blue-500/20'
                : 'bg-white/80 border-blue-200/50 shadow-lg'
                }`}>
                <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Key Features
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                      <BarChart3 className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Interactive Dashboards
                      </h4>
                      <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                        Visualize predictions and trends with customizable dashboards.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                      <MapPin className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Geospatial Analysis
                      </h4>
                      <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                        View demand patterns across different regions and locations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                      <Clock className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Time Series Forecasting
                      </h4>
                      <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                        Predict demand across different time horizons from days to years.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                      <TrendingUp className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        What-If Scenarios
                      </h4>
                      <p className={isDarkMode ? 'text-blue-100' : 'text-slate-600'}>
                        Simulate different scenarios to understand potential outcomes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-blue-900 to-blue-900 dark:from-slate-900 dark:via-blue-900 dark:to-blue-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full" style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)'
            }}></div>
          </div>
          <div className="absolute top-20 right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 shadow-lg mb-8 group">
              {/* Shine effect on badge */}
              <div className="absolute inset-0 bg-white/10 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700 rounded-full"></div>
              <Sparkles className="h-4 w-4 text-yellow-300 relative z-10" />
              <span className="text-sm font-medium text-white relative z-10">Ready to Launch?</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight">
              Ready to Revolutionize Your
              <span className="block bg-gradient-to-r from-blue-300 to-blue-400 bg-clip-text text-transparent">
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
                  className="bg-gradient-to-r from-white to-blue-50 text-slate-900 hover:from-blue-50 hover:to-white dark:from-slate-700 dark:to-slate-800 dark:text-white dark:hover:from-slate-600 dark:hover:to-slate-700 px-12 py-4 text-lg font-semibold transition-all duration-500 hover:scale-110 hover:shadow-2xl group border-0 rounded-xl relative overflow-hidden"
                >
                  <span className="relative z-10">Get Started Today</span>
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform duration-300 relative z-10" />
                  <div className="absolute inset-0 bg-white/30 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700 rounded-xl"></div>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 px-12 py-4 text-lg font-semibold transition-all duration-300 hover:scale-105 rounded-xl backdrop-blur-sm relative overflow-hidden group"
              >
                <span className="relative z-10">Schedule Demo</span>
                <div className="absolute inset-0 bg-white/10 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700 rounded-xl"></div>
              </Button>
            </div>
          </div>
        </div>

        {/* Gradient Overlay for Smooth Transition to Footer */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-slate-950 pointer-events-none"></div>
      </section>

      {/* Footer - Webild-style Design */}
      <footer className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col">
            {/* Massive Text */}
            <div className="w-full mb-24 relative">
              <h1 className="text-[13vw] leading-[0.8] font-bold tracking-tighter text-center select-none">
                <span className="bg-gradient-to-b from-white via-white to-slate-600 bg-clip-text text-transparent">
                  Forecast AI
                </span>
              </h1>
              {/* Blue Glow Effect */}
              <div className="absolute top-0 right-[25%] w-[20vw] h-[20vw] bg-blue-600/40 rounded-full blur-[100px] pointer-events-none mix-blend-screen opacity-70"></div>
            </div>

            {/* Navigation Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm font-medium text-slate-400">
              {/* Left Column */}
              <div className="space-y-6 flex flex-col items-center md:items-start">
                <Link to="/about" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> About
                </Link>
                <Link to="/features" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> Features
                </Link>
                <Link to="/pricing" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> Pricing
                </Link>
              </div>

              {/* Center Column */}
              <div className="space-y-6 flex flex-col items-center">
                <Link to="/blog" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> Blog
                </Link>
                <Link to="/help" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> Help Center
                </Link>
                <Link to="/contact" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> Contact
                </Link>
              </div>

              {/* Right Column */}
              <div className="space-y-6 flex flex-col items-center md:items-end">
                <Link to="/privacy" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> Privacy Policy
                </Link>
                <Link to="/terms" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> Terms of Service
                </Link>
                <Link to="/legal" className="hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-500 group-hover:text-white transition-colors">&gt;</span> Legal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Add custom styles for animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-10px) translateX(5px);
          }
          50% {
            transform: translateY(0) translateX(10px);
          }
          75% {
            transform: translateY(10px) translateX(5px);
          }
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Glassmorphism styles */
        .glass {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .glass-strong {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .dark .glass {
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .dark .glass-strong {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        /* Floating animation */
        .floating {
          animation: float 6s ease-in-out infinite;
        }
        
        /* Card depth */
        .card-depth {
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }
        
        /* Neon glow */
        .neon-glow {
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
        }
        
        /* Premium button glow */
        .btn-premium-glow {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }
        
        /* Ambient glow */
        .glow-ambient {
          animation: glow 4s ease-in-out infinite alternate;
        }
        
        @keyframes glow {
          from {
            opacity: 0.3;
          }
          to {
            opacity: 0.7;
          }
        }
        
        /* Text overlap */
        .text-overlap {
          position: relative;
          z-index: 10;
        }
        
        /* Cinematic fade in */
        .cinematic-fade-in {
          animation: fadeIn 1.5s ease-out forwards;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        /* Section blend */
        .section-blend {
          position: relative;
        }
        
        .section-blend::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.8));
          z-index: 1;
        }
        
        .dark .section-blend::before {
          background: linear-gradient(to bottom, transparent, rgba(30, 41, 59, 0.8));
        }
        
        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }
        
        /* Scroll snap styles */
        .snap-y {
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
        }
        
        .snap-start {
          scroll-snap-align: start;
        }
        
        /* Mobile timeline styles */
        @media (max-width: 1024px) {
          .timeline-mobile {
            display: flex;
            justify-content: space-between;
            padding: 0 20px;
            margin-bottom: 20px;
          }
          
          .timeline-node-mobile {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 60px;
          }
          
          .timeline-node-mobile .node-circle {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            transition: all 0.3s ease;
          }
          
          .timeline-node-mobile.active .node-circle {
            transform: scale(1.2);
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
          }
          
          .timeline-node-mobile .node-label {
            font-size: 10px;
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
          }
          
          .timeline-node-mobile.active .node-label {
            color: white;
          }
        }
      `}</style>
    </div>
  );
};

export default Homepage;