import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  Database, 
  Sliders, 
  Brain, 
  BarChart3, 
  Package, 
  Network, 
  Moon, 
  Sun, 
  LogOut, 
  ArrowRight, 
  ChevronDown, 
  User,
  Cpu 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ParticleField from '../components/ParticleField';
import FadeIn from '../components/FadeIn';
import StackingCard from '../components/StackingCard';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import PipelineCard from '../components/PipelineCard';

interface PipelineCardData {
  stage: string;
  name: string;
  icon: React.ComponentType<any>;
  accent: string;
  description: string;
}

interface ServiceMetric {
  label: string;
  value: string;
  change: string;
  changeType: 'positive' | 'neutral' | 'negative';
}

interface ServiceCardData {
  stage: string;
  name: string;
  icon: React.ComponentType<any>;
  accent: string;
  description: string;
  tags: string[];
  metrics: ServiceMetric[];
}

// ── Module-level constants — allocated once, never recreated on re-render ────
const PIPELINE_CARDS: PipelineCardData[] = [
  {
    stage: "01", name: "Data Ingestion", icon: Database, accent: "#00B4D8",
    description: "Connect to ERP systems, IoT, APIs, and databases to collect real-time supply chain data."
  },
  {
    stage: "02", name: "Cleansing & Preprocessing", icon: Sliders, accent: "#06B6D4",
    description: "Automated outlier removal, missing value interpolation, and temporal aligning for forecasting readiness."
  },
  {
    stage: "03", name: "Feature Engineering", icon: Sliders, accent: "#7B2FBE",
    description: "Generate spatial-temporal features, localized event patterns, holiday schedules, and promotional variables."
  },
  {
    stage: "04", name: "SCM Graph Mapping", icon: Network, accent: "#6366F1",
    description: "Model supply chains as dynamic heterogeneous graphs, mapping nodes (warehouses/SKUs) and relations (routes)."
  },
  {
    stage: "05", name: "STGT Retraining", icon: Brain, accent: "#EC4899",
    description: "Train Graph Neural Networks to learn complex relational patterns and spatial dependencies across the network."
  },
  {
    stage: "06", name: "Multi-Horizon Forecasts", icon: TrendingUp, accent: "#00D4AA",
    description: "Forecast multi-step demand trajectories with confidence boundaries mapped directly to specific SKUs."
  },
  {
    stage: "07", name: "Disruption Simulation", icon: Package, accent: "#EF4444",
    description: "Simulate 'what-if' port bottlenecks, severe weather, and supplier failures to evaluate downstream vulnerabilities."
  },
  {
    stage: "08", name: "Actionable Insights", icon: BarChart3, accent: "#F59E0B",
    description: "Surface safety stock rules, automated reorder flags, and capital allocation suggestions."
  },
];

const SERVICE_CARDS: ServiceCardData[] = [
  {
    stage: "01", name: "Demand Forecasting", icon: TrendingUp, accent: "#00B4D8",
    description: "AI-powered multi-horizon demand predictions across SKUs, regions, and channels — with confidence intervals and anomaly flags built in.",
    tags: ["SKU-Level", "Multi-Horizon", "Real-Time"],
    metrics: [
      { label: "FORECAST ACCURACY", value: "98.4%", change: "+1.2% vs last month", changeType: "positive" },
      { label: "REAL-TIME LATENCY", value: "<140ms", change: "Continuous flow", changeType: "neutral" }
    ]
  },
  {
    stage: "02", name: "Inventory Optimization", icon: Package, accent: "#7B2FBE",
    description: "Automated reorder point calculations, safety stock recommendations, and overstock risk detection to keep your inventory lean and profitable.",
    tags: ["Reorder Alerts", "Safety Stock", "Cost Reduction"],
    metrics: [
      { label: "REORDER AUTOMATION", value: "99.8%", change: "Full automation", changeType: "positive" },
      { label: "CARRYING COSTS", value: "-22.5%", change: "Minimized overstock", changeType: "positive" }
    ]
  },
  {
    stage: "03", name: "Supplier Intelligence", icon: Network, accent: "#00D4AA",
    description: "Continuous monitoring of supplier reliability, lead time variability, and risk scores — so disruptions are predicted before they happen.",
    tags: ["Risk Scoring", "Lead Times", "Alerts"],
    metrics: [
      { label: "SUPPLIER RELIABILITY", value: "94.6", change: "Low risk index", changeType: "positive" },
      { label: "LEAD TIME DEV.", value: "-0.8 Days", change: "More predictable", changeType: "positive" }
    ]
  },
  {
    stage: "04", name: "Supply Chain Analytics", icon: BarChart3, accent: "#F59E0B",
    description: "Rich visual dashboards surfacing actionable KPIs: fill rates, stockout frequency, forecast accuracy, and working capital efficiency.",
    tags: ["KPI Dashboards", "Drill-Down", "Export"],
    metrics: [
      { label: "ORDER FILL RATE", value: "99.1%", change: "+0.5% fill rate", changeType: "positive" },
      { label: "STOCKOUT EVENTS", value: "0", change: "Last 30 days", changeType: "neutral" }
    ]
  },
  {
    stage: "05", name: "Model Fine-Tuning", icon: Sliders, accent: "#EC4899",
    description: "Continuously retrain and fine-tune forecasting models on your proprietary data, seasonal events, and business rules — no ML team required.",
    tags: ["AutoML", "Custom Models", "Continuous Learning"],
    metrics: [
      { label: "TRAINING STATUS", value: "Synced", change: "AutoML active", changeType: "positive" },
      { label: "ACTIVE MODELS", value: "12", change: "Optimized per node", changeType: "neutral" }
    ]
  },
];

const CARD_BACKGROUNDS: string[] = ["#000000", "#000000", "#000000", "#000000", "#000000"];

export const Homepage: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  // Lazy initializer — reads window once at mount, never on re-render
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  // Hover state eliminated — all pipeline card hover effects driven by CSS.
  // hoveredPipelineCard / handlePipelineEnter / handlePipelineLeave removed.
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [isRobotInteractive, setIsRobotInteractive] = useState(false);
  const robotContainerRef = useRef<HTMLDivElement>(null);
  const [isRobotVisible, setIsRobotVisible] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const unmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pipelineSectionRef = useRef<HTMLDivElement>(null);
  const servicesSectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: pipelineScrollProgress } = useScroll({
    target: pipelineSectionRef,
    offset: ["start end", "end start"]
  });

  const { scrollYProgress: servicesScrollYProgress } = useScroll({
    target: servicesSectionRef,
    offset: ["start start", "end end"]
  });

  // useSpring wraps scroll progress — makes pipeline row animation feel smooth and physical
  // instead of a direct linear map to scroll position (which causes visible jitter)
  const smoothProgress = useSpring(pipelineScrollProgress, {
    stiffness: 60,
    damping: 25,
    restDelta: 0.001,
  });

  const translateXRow1 = useTransform(smoothProgress, [0, 1], [100, -200]);
  const translateXRow2 = useTransform(smoothProgress, [0, 1], [-200, 100]);

  // Debounced mobile check
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setIsMobile(window.innerWidth < 768), 150);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener('resize', handleResize); };
  }, []);

  // IntersectionObserver with 3-second delayed unmount cache window
  useEffect(() => {
    if (isMobile) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (unmountTimeoutRef.current) {
            clearTimeout(unmountTimeoutRef.current);
            unmountTimeoutRef.current = null;
          }
          setIsRobotVisible(true);
        } else {
          if (!unmountTimeoutRef.current) {
            unmountTimeoutRef.current = setTimeout(() => {
              setIsRobotVisible(false);
              setIframeLoaded(false);
              setShowPrompt(false);
              unmountTimeoutRef.current = null;
            }, 3000);
          }
        }
      },
      { threshold: 0.05 }
    );

    if (robotContainerRef.current) {
      observer.observe(robotContainerRef.current);
    }

    return () => {
      observer.disconnect();
      if (unmountTimeoutRef.current) {
        clearTimeout(unmountTimeoutRef.current);
      }
    };
  }, [isMobile]);

  // Robust prompt display timer
  useEffect(() => {
    if (isRobotVisible) {
      const t = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(t);
    } else {
      setShowPrompt(false);
    }
  }, [isRobotVisible]);

  // Set the document title as requested
  useEffect(() => {
    document.title = "SupplyGraph — AI Supply Chain Forecasting";
  }, []);

  // Pipeline card data — referenced from module-level constant
  const pipelineCards = PIPELINE_CARDS;


  // Service card data — referenced from module-level constant
  const serviceCards = SERVICE_CARDS;
  const cardBackgrounds = theme === 'dark'
    ? ["#000000", "#000000", "#000000", "#000000", "#000000"]
    : ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"];
  const isDark = theme === 'dark';

  const renderServiceVisual = (index: number, accent: string) => {
    const strokeColor = isDark ? "white" : "black";
    const lineOpacity = isDark ? "0.04" : "0.08";
    const baseOpacity = isDark ? "0.08" : "0.12";
    const primaryText = isDark ? "text-white" : "text-slate-800";

    switch (index) {
      case 0: // Demand Forecasting
        return (
          <svg className="w-full h-full min-h-[180px] max-h-[220px]" viewBox="0 0 300 180" fill="none">
            {/* Grid lines */}
            <line x1="10" y1="30" x2="290" y2="30" stroke={strokeColor} strokeOpacity={lineOpacity} />
            <line x1="10" y1="75" x2="290" y2="75" stroke={strokeColor} strokeOpacity={lineOpacity} />
            <line x1="10" y1="120" x2="290" y2="120" stroke={strokeColor} strokeOpacity={lineOpacity} />
            <line x1="10" y1="160" x2="290" y2="160" stroke={strokeColor} strokeOpacity={baseOpacity} />
            
            {/* Confidence interval area */}
            <path 
              d="M 30 110 Q 80 70, 130 90 T 230 50 L 270 40 L 270 90 L 230 110 T 130 120 Q 80 130, 30 115 Z" 
              fill={`${accent}15`} 
            />

            {/* Historical Demand */}
            <path 
              d="M 30 110 Q 80 100, 130 105 T 190 85" 
              stroke={strokeColor} 
              strokeWidth="3" 
              strokeLinecap="round"
              opacity={isDark ? "0.8" : "0.7"} 
            />

            {/* AI Forecast */}
            <path 
              d="M 190 85 T 230 65 T 270 45" 
              stroke={accent} 
              strokeWidth="3" 
              strokeDasharray="6,4" 
              strokeLinecap="round"
              className="animate-flow" 
            />
            
            {/* Current Day marker */}
            <line x1="190" y1="10" x2="190" y2="160" stroke={strokeColor} strokeOpacity={isDark ? "0.3" : "0.4"} strokeDasharray="3,3" />
            <circle cx="190" cy="85" r="5" fill={accent} />
            <circle cx="190" cy="85" r="10" stroke={accent} strokeWidth="1.5" className="animate-pulse-glow" />
          </svg>
        );
      case 1: // Inventory Optimization
        return (
          <svg className="w-full h-full min-h-[180px] max-h-[220px]" viewBox="0 0 300 180" fill="none">
            {/* Safety Stock Area */}
            <rect x="20" y="130" width="260" height="30" fill={`${accent}15`} rx="4" />
            <line x1="20" y1="130" x2="280" y2="130" stroke={accent} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6" />
            
            {/* Reorder Point Line */}
            <line x1="20" y1="95" x2="280" y2="95" stroke="#00B4D8" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6" />
            
            {/* Stock Sawtooth Curve */}
            <path 
              d="M 20 40 L 90 130 L 90 45 L 170 130 L 170 45 L 250 130" 
              stroke={strokeColor} 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            
            {/* Reorder triggers */}
            <circle cx="63" cy="95" r="4" fill="#00B4D8" />
            <circle cx="143" cy="95" r="4" fill="#00B4D8" />
            <circle cx="215" cy="95" r="4" fill="#00B4D8" />
            <circle cx="215" cy="95" r="8" stroke="#00B4D8" strokeWidth="1.5" className="animate-pulse-glow" />
          </svg>
        );
      case 2: // Supplier Intelligence
        return (
          <svg className="w-full h-full min-h-[180px] max-h-[220px]" viewBox="0 0 300 180" fill="none">
            {/* Network Paths */}
            <path d="M 40 90 L 120 50 M 40 90 L 120 130 M 120 50 L 220 90 M 120 130 L 220 90 M 220 90 L 270 90" stroke={strokeColor} strokeOpacity={isDark ? "0.15" : "0.2"} strokeWidth="2" />
            
            {/* Flow Lines */}
            <path d="M 40 90 L 120 50" stroke={accent} strokeWidth="2.5" className="animate-flow" />
            <path d="M 120 130 L 220 90" stroke={accent} strokeWidth="2.5" className="animate-flow" />
            
            {/* Nodes */}
            <circle cx="40" cy="90" r="8" fill={isDark ? "#000000" : "#ffffff"} stroke={strokeColor} strokeWidth="2" />
            <circle cx="120" cy="50" r="8" fill={isDark ? "#000000" : "#ffffff"} stroke={accent} strokeWidth="2" />
            <circle cx="120" cy="130" r="8" fill={isDark ? "#000000" : "#ffffff"} stroke="#F59E0B" strokeWidth="2" />
            <circle cx="120" cy="130" r="14" stroke="#F59E0B" strokeWidth="1.5" className="animate-pulse-glow" />
            <circle cx="220" cy="90" r="10" fill={isDark ? "#000000" : "#ffffff"} stroke={strokeColor} strokeWidth="2" />
            <circle cx="270" cy="90" r="6" fill={isDark ? "#000000" : "#ffffff"} stroke={strokeColor} strokeWidth="1.5" />
          </svg>
        );
      case 3: // Supply Chain Analytics
        return (
          <div className="w-full h-full flex flex-col justify-around p-2 gap-4">
            <div className="flex items-center justify-around gap-4">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className={isDark ? "text-white/5" : "text-slate-900/5"} stroke="currentColor" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-[#F59E0B]" strokeDasharray="92, 100" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute text-center">
                  <span className={`${primaryText} font-bold text-sm`}>92%</span>
                  <span className="block text-[8px] text-[#64748B] uppercase">Fill</span>
                </div>
              </div>
              <div className="flex items-end gap-3 h-[70px]">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3.5 ${isDark ? 'bg-white/10' : 'bg-slate-900/10'} rounded-t-sm h-[30px]`} />
                  <div className="w-3.5 bg-amber-500 rounded-t-sm h-[50px] -mt-[50px]" />
                  <span className="text-[8px] text-[#64748B] uppercase mt-1">East</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3.5 ${isDark ? 'bg-white/10' : 'bg-slate-900/10'} rounded-t-sm h-[40px]`} />
                  <div className="w-3.5 bg-amber-500 rounded-t-sm h-[65px] -mt-[65px]" />
                  <span className="text-[8px] text-[#64748B] uppercase mt-1">West</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3.5 ${isDark ? 'bg-white/10' : 'bg-slate-900/10'} rounded-t-sm h-[20px]`} />
                  <div className="w-3.5 bg-amber-500 rounded-t-sm h-[35px] -mt-[35px]" />
                  <span className="text-[8px] text-[#64748B] uppercase mt-1">Cent</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 4: // Model Fine-Tuning
        return (
          <svg className="w-full h-full min-h-[180px] max-h-[220px]" viewBox="0 0 300 180" fill="none">
            {/* Layer 1: Left */}
            <circle cx="40" cy="50" r="5" fill={strokeColor} opacity="0.4" />
            <circle cx="40" cy="90" r="5" fill={strokeColor} opacity="0.4" />
            <circle cx="40" cy="130" r="5" fill={strokeColor} opacity="0.4" />
            
            {/* Layer 2: Center */}
            <circle cx="120" cy="35" r="5" fill={accent} opacity="0.7" />
            <circle cx="120" cy="70" r="5" fill={accent} opacity="0.7" />
            <circle cx="120" cy="110" r="5" fill={accent} opacity="0.7" />
            <circle cx="120" cy="145" r="5" fill={accent} opacity="0.7" />
            
            {/* Layer 3: Right */}
            <circle cx="200" cy="65" r="5" fill={strokeColor} opacity="0.8" />
            <circle cx="200" cy="115" r="5" fill={strokeColor} opacity="0.8" />
            
            {/* Connections */}
            <line x1="45" y1="50" x2="115" y2="35" stroke={strokeColor} strokeOpacity="0.08" />
            <line x1="45" y1="50" x2="115" y2="70" stroke={strokeColor} strokeOpacity="0.08" />
            <line x1="45" y1="90" x2="115" y2="70" stroke={strokeColor} strokeOpacity="0.08" />
            <line x1="45" y1="90" x2="115" y2="110" stroke={strokeColor} strokeOpacity="0.08" />
            <line x1="45" y1="130" x2="115" y2="110" stroke={strokeColor} strokeOpacity="0.08" />
            <line x1="45" y1="130" x2="115" y2="145" stroke={strokeColor} strokeOpacity="0.08" />
            
            <line x1="125" y1="35" x2="195" y2="65" stroke={accent} strokeOpacity="0.2" className="animate-flow" />
            <line x1="125" y1="70" x2="195" y2="65" stroke={accent} strokeOpacity="0.2" />
            <line x1="125" y1="110" x2="195" y2="115" stroke={accent} strokeOpacity="0.2" />
            <line x1="125" y1="145" x2="195" y2="115" stroke={accent} strokeOpacity="0.2" className="animate-flow" />
            
            {/* Right loss curve */}
            <path d="M 220 50 Q 240 130, 280 135" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="280" cy="135" r="3" fill="#EC4899" />
            <text x="225" y="45" fill="#EC4899" fontSize="8" fontWeight="bold">Loss &rarr; 0</text>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <main className="main-wrapper bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-white min-h-screen relative w-full">
      
      {/* 1. HERO SECTION */}
      <section className="relative h-screen w-full flex flex-col justify-between overflow-hidden bg-white dark:bg-black text-slate-900 dark:text-white z-0">
        
        {/* Animated Particle Field */}
        <ParticleField />

        {/* Floating Capsule Navbar */}
        <div className="fixed top-6 left-0 right-0 w-full px-6 md:px-12 z-50 flex items-center justify-between pointer-events-none">
          {/* Left: Floating Logo Bubble */}
          <div className="pointer-events-auto flex items-center gap-2 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-full px-4 py-2 hover:border-slate-350 dark:hover:border-white/20 transition-all duration-300 shadow-xl">
            <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <div className="w-[28px] h-[28px] rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                <TrendingUp className="w-[15px] h-[15px] text-[#00B4D8]" />
              </div>
              <span className="text-slate-800 dark:text-white font-semibold text-sm tracking-tight">SupplyGraph</span>
            </Link>
          </div>

          {/* Right: Glassmorphic Capsule */}
          <div className="pointer-events-auto flex items-center bg-white/80 dark:bg-black/65 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-full p-1.5 pl-6 gap-6 md:gap-8 max-w-max shadow-2xl">
            {/* Nav links (Only shown if authenticated) */}
            {isAuthenticated && (
              <div className="hidden lg:flex items-center gap-6">
                <Link to="/dashboard" className="text-slate-500 dark:text-[#94A3B8] font-semibold text-[10px] uppercase tracking-widest hover:text-slate-900 hover:dark:text-white transition-colors duration-200">
                  Dashboard
                </Link>
                <Link to="/prediction" className="text-slate-500 dark:text-[#94A3B8] font-semibold text-[10px] uppercase tracking-widest hover:text-slate-900 hover:dark:text-white transition-colors duration-200">
                  Predictions
                </Link>
                <Link to="/inventory" className="text-slate-500 dark:text-[#94A3B8] font-semibold text-[10px] uppercase tracking-widest hover:text-slate-900 hover:dark:text-white transition-colors duration-200">
                  Inventory
                </Link>
                
                {/* Admin Dropdown */}
                {user?.role === 'admin' && (
                  <div className="relative">
                    <button 
                      onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                      className="flex items-center gap-1 text-slate-500 dark:text-[#94A3B8] font-semibold text-[10px] uppercase tracking-widest hover:text-slate-900 hover:dark:text-white transition-colors duration-200 focus:outline-none"
                    >
                      <span>Admin</span>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showAdminDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showAdminDropdown && (
                      <div className="absolute top-8 left-0 w-44 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-2xl p-1.5 shadow-2xl z-50">
                        <Link 
                          to="/upload" 
                          onClick={() => setShowAdminDropdown(false)}
                          className="block px-3 py-2 text-[10px] font-medium tracking-wide uppercase text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 hover:dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        >
                          Upload Data
                        </Link>
                        <Link 
                          to="/settings/members" 
                          onClick={() => setShowAdminDropdown(false)}
                          className="block px-3 py-2 text-[10px] font-medium tracking-wide uppercase text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 hover:dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        >
                          Manage Team
                        </Link>
                        <Link 
                          to="/reorder" 
                          onClick={() => setShowAdminDropdown(false)}
                          className="block px-3 py-2 text-[10px] font-medium tracking-wide uppercase text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 hover:dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        >
                          Reorder
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme} 
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 hover:dark:text-white transition-colors duration-200"
              aria-label="Theme toggle"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Auth Pill button */}
            {isAuthenticated ? (
              <button 
                onClick={logout} 
                className="bg-slate-950 dark:bg-white hover:bg-slate-900 dark:hover:bg-white/90 text-white dark:text-black font-semibold text-[10px] uppercase tracking-wider px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-1.5 shadow-lg select-none"
              >
                <span className="font-bold">{user?.name || "Akif"} @ {user?.companyName || "Walmart"}</span>
                <LogOut className="w-3 h-3 text-white/70 dark:text-black/70" />
              </button>
            ) : (
              <div className="flex items-center gap-4 pr-2">
                <Link 
                  to="/login" 
                  className="text-slate-550 dark:text-[#94A3B8] font-semibold text-[10px] uppercase tracking-widest hover:text-slate-900 hover:dark:text-white transition-colors duration-200"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="bg-slate-950 dark:bg-white hover:bg-slate-900 dark:hover:bg-white/90 text-white dark:text-black font-semibold text-[10px] uppercase tracking-wider px-4 py-2 rounded-full transition-all duration-200 shadow-lg select-none"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Hero Content */}
        <div className="absolute top-[42vh] md:top-[46vh] left-8 md:left-16 max-w-4xl z-10 select-none pr-8 pointer-events-none">
          <FadeIn delay={0.15} y={40}>
            <h1 
              className="text-slate-900 dark:text-white font-bold leading-[0.9] tracking-tighter"
              style={{ fontSize: 'clamp(2.5rem, 6.5vw, 5.5rem)' }}
            >
              Smart Supply Chain
            </h1>
          </FadeIn>
          <FadeIn delay={0.3} y={40}>
            <h1 
              className="text-slate-900 dark:text-white font-bold leading-[0.9] tracking-tighter mt-4"
              style={{ fontSize: 'clamp(2.5rem, 6.5vw, 5.5rem)' }}
            >
              Demand Forecasting
            </h1>
          </FadeIn>
        </div>

        {/* 3D Spline Robot — High-tech Black Holographic Chamber panel */}
        <div 
          ref={robotContainerRef}
          className="absolute inset-0 w-full h-full z-0 flex items-center justify-center overflow-hidden bg-white dark:bg-black border-0 rounded-none shadow-none transition-all duration-500 scale-100"
          onMouseLeave={() => setIsRobotInteractive(false)}
        >
          {isMobile ? (
            /* Mobile: static placeholder, zero GPU cost */
            <div className="absolute inset-0 flex items-end justify-center">
              <div className="w-[260px] h-[380px] rounded-[40px] bg-gradient-to-b from-[#00B4D8]/10 via-[#7B2FBE]/5 to-transparent border border-white/[0.06] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#00B4D8]/50 animate-pulse" />
              </div>
            </div>
          ) : (
            /* Desktop: Mount dual-layer system inside strictly black container */
            <>
              {/* Layer 1: Glowing Glassmorphic Image Proxy (Instant visual presence) */}
              <div 
                className={`absolute inset-0 transition-all duration-700 flex items-end justify-center pointer-events-none ${
                  iframeLoaded ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                }`}
              >
                <div className="w-[380px] h-[580px] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
                    <img 
                      src={theme === 'dark' ? "/models/spline robo model.png" : "/models/spline robo model white bg.png"} 
                      alt="Nexbot Concept Preview" 
                      className={`w-full h-full object-cover scale-[1.09] -translate-y-[12px] ${theme === 'dark' ? 'opacity-75' : 'opacity-90'}`}
                    />
                  </div>
 
                  {/* Soft cyberpunk WebGL status pill */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-black/60 backdrop-blur-md border border-slate-200 dark:border-white/10 px-4 py-2 rounded-full flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00B4D8] animate-ping" />
                    <span className="text-[10px] text-slate-700 dark:text-white/90 uppercase tracking-widest font-mono select-none">Booting WebGL...</span>
                  </div>
                </div>
              </div>
 
              {/* Layer 2: WebGL Engine (Mounts only in viewport, fades in smoothly when fully loaded) */}
              {isRobotVisible && (
                <>
                  {!isRobotInteractive && (
                    <div 
                      onClick={() => setIsRobotInteractive(true)}
                      className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
                    />
                  )}
                  {!isRobotInteractive && (iframeLoaded || showPrompt) && (
                    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-white/80 dark:bg-black/60 backdrop-blur-md border border-slate-200 dark:border-[#00B4D8]/30 px-4 py-2 rounded-full flex items-center gap-2 animate-bounce pointer-events-none shadow-lg shadow-cyan-500/10 dark:shadow-cyan-500/5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00B4D8] animate-ping" />
                      <span className="text-[10px] text-slate-700 dark:text-white/90 uppercase tracking-widest font-mono select-none">Click to interact with robo</span>
                    </div>
                  )}
                  <iframe
                    src="https://my.spline.design/nexbotrobotcharacterconceptforpersonaluse-v8tp6nPDwio23WZ3bXL8KlWY/?background=0"
                    frameBorder="0"
                    width="100%"
                    loading="eager"
                    title="Spline Nexbot 3D Robot Concept"
                    onLoad={() => {
                      setIframeLoaded(true);
                      setShowPrompt(true);
                    }}
                    className={`absolute w-full h-[calc(100%+200px)] -top-[100px] transition-all duration-1000 ${
                      isRobotInteractive ? 'pointer-events-auto' : 'pointer-events-none'
                    } ${
                      iframeLoaded ? 'opacity-95 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
                    }`}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 opacity-60">
          <div className={`w-[24px] h-[40px] border-2 ${isDark ? 'border-white/30' : 'border-slate-350'} rounded-full flex justify-center pt-2`}>
            <div className={`w-[6px] h-[10px] ${isDark ? 'bg-white' : 'bg-slate-800'} rounded-full scroll-dot`} />
          </div>
        </div>

      </section>

      {/* 2. PIPELINE SECTION */}
      <section 
        ref={pipelineSectionRef}
        className="relative bg-slate-50 dark:bg-[#000000] pt-32 pb-20 overflow-hidden w-full border-b border-slate-205 dark:border-white/[0.05]"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          
          <FadeIn delay={0} y={30} className="text-center">
            <span className="text-[#00B4D8] font-bold text-xs tracking-[0.2em] uppercase">
              HOW IT WORKS
            </span>
          </FadeIn>
          
          <FadeIn delay={0.1} y={30} className="text-center mt-4">
            <h2 
              className="text-slate-900 dark:text-white font-light tracking-[0.03em] uppercase leading-tight"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
            >
              The AI Pipeline
            </h2>
          </FadeIn>

          <FadeIn delay={0.2} y={30} className="text-center mt-4 flex justify-center">
            <p className="text-slate-550 dark:text-[#64748B] font-light max-w-xl leading-relaxed text-sm">
              From raw data to accurate forecasts — eight intelligent stages working in sequence.
            </p>
          </FadeIn>
        </div>

        {/* Two Rows of Pipeline Cards with GPU Accelerated Scroll Translation */}
        <div className="relative mt-16 w-full overflow-hidden flex flex-col gap-6">
          
          {/* Row 1: Left to Right */}
          <div className="w-full overflow-hidden">
            <motion.div 
              className={`flex gap-5 px-6 md:px-16 ${
                isMobile 
                  ? 'overflow-x-auto snap-x snap-mandatory scrollbar-none pb-4' 
                  : 'w-max justify-center'
              }`}
              style={{ 
                x: isMobile ? 0 : translateXRow1,
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
            >
              {PIPELINE_CARDS.slice(0, 4).map((card, index) => (
                <PipelineCard
                  key={card.stage}
                  card={card}
                  index={index}
                />
              ))}
            </motion.div>
          </div>

          {/* Row 2: Right to Left */}
          <div className="w-full overflow-hidden">
            <motion.div 
              className={`flex gap-5 px-6 md:px-16 ${
                isMobile 
                  ? 'overflow-x-auto snap-x snap-mandatory scrollbar-none pb-4' 
                  : 'w-max justify-center'
              }`}
              style={{ 
                x: isMobile ? 0 : translateXRow2,
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
            >
              {PIPELINE_CARDS.slice(4, 8).map((card, index) => (
                <PipelineCard
                  key={card.stage}
                  card={card}
                  index={index + 4}
                />
              ))}
            </motion.div>
          </div>

        </div>

      </section>

      {/* 3. SERVICES SECTION */}
      <section 
        ref={servicesSectionRef}
        className="relative bg-slate-50 dark:bg-[#000000] rounded-t-[50px] -mt-12 z-10 px-5 sm:px-8 md:px-10 py-24 border-t border-slate-205 dark:border-white/5"
      >
        <div className="max-w-7xl mx-auto mb-20">
          <FadeIn delay={0} y={40} className="text-center">
            <span className="text-[#00B4D8] font-medium text-sm tracking-wider uppercase">
              WHAT WE OFFER
            </span>
            <h2 
              className="cyan-heading font-black uppercase leading-tight mt-4 text-slate-900 dark:text-white"
              style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)' }}
            >
              Our Services
            </h2>
          </FadeIn>
        </div>

        {/* Sticky Stacking Service Cards */}
        <div className="max-w-5xl mx-auto flex flex-col items-center">
          {serviceCards.map((service, index) => {
            return (
              <StackingCard 
                key={index} 
                index={index} 
                totalCards={serviceCards.length}
                scrollYProgress={servicesScrollYProgress}
              >
                <div 
                  className="w-full rounded-[40px] sm:rounded-[50px] md:rounded-[60px] border-2 border-slate-200 dark:border-white/10 p-6 sm:p-8 md:p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-slate-350 dark:hover:border-white/20"
                  style={{ backgroundColor: cardBackgrounds[index] }}
                >
                  {/* Top Row: Header */}
                  <div className="flex items-center justify-between gap-4 w-full border-b border-slate-100 dark:border-white/5 pb-6 mb-6">
                    <div className="flex items-center gap-4 sm:gap-6">
                      <span className="font-black text-slate-800 dark:text-white leading-none text-5xl sm:text-6xl md:text-7xl select-none tracking-tighter">
                        {service.stage}
                      </span>
                      <div className="flex flex-col">
                        <span 
                          className="text-[10px] sm:text-xs font-black tracking-widest uppercase"
                          style={{ color: service.accent }}
                        >
                          SERVICE MODULE
                        </span>
                        <h3 className="text-slate-800 dark:text-white font-black uppercase text-base sm:text-lg md:text-xl tracking-wide mt-1">
                          {service.name}
                        </h3>
                      </div>
                    </div>
                    <Link 
                      to="/prediction"
                      className="border-2 hover:bg-slate-100 dark:hover:bg-[#D7E2EA]/10 text-slate-800 dark:text-white rounded-full px-4 py-1.5 sm:px-5 sm:py-2 text-[10px] sm:text-xs uppercase font-bold tracking-widest transition-all duration-300 whitespace-nowrap"
                      style={{ borderColor: service.accent }}
                    >
                      LIVE DEMO
                    </Link>
                  </div>

                  {/* Bottom Row: Split Grid Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 w-full items-stretch">
                    {/* Left Column (Colspan 2): Metrics */}
                    <div className="lg:col-span-2 flex flex-col gap-4 justify-between">
                      {service.metrics.map((metric, mIdx) => (
                        <div 
                          key={mIdx}
                          className="flex-1 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] rounded-[20px] p-4 flex flex-col justify-between min-h-[90px] relative overflow-hidden group hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors duration-300"
                        >
                          <div>
                            <span className="text-[10px] text-[#64748B] font-bold tracking-wider block">
                              {metric.label}
                            </span>
                            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white block mt-1 tracking-tight">
                              {metric.value}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 self-start">
                            <span 
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                metric.changeType === 'positive' 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                  : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 dark:text-[#94A3B8]'
                              }`}
                            >
                              {metric.change}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Right Column (Colspan 3): Visual asset */}
                    <div className="lg:col-span-3 bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.05] rounded-[24px] p-4 flex items-center justify-center min-h-[220px] relative overflow-hidden group hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-colors duration-300">
                      {renderServiceVisual(index, service.accent)}
                    </div>
                  </div>

                  {/* Description & Tags Footer */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                    <p className="text-slate-500 dark:text-[#64748B] text-xs sm:text-sm font-light max-w-xl">
                      {service.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 self-end sm:self-center">
                      {service.tags.map((tag, tIdx) => (
                        <span 
                          key={tIdx}
                          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-550 dark:text-[#94A3B8] text-[10px] rounded-full px-2.5 py-0.5 font-medium whitespace-nowrap"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </StackingCard>
            );
          })}
        </div>

      </section>

      {/* 4. FOOTER */}
      <footer className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#000000]">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col">
            {/* Massive Text */}
            <div className="w-full mb-16 relative">
              <h1 className="text-[13vw] leading-[0.8] font-bold tracking-tighter text-center select-none">
                <span className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-650 dark:from-white dark:via-white dark:to-slate-600 bg-clip-text text-transparent">
                  Forecast AI
                </span>
              </h1>
            </div>

            {/* Navigation Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-sm font-medium text-slate-550 dark:text-slate-400 w-full">
              {/* Left Column */}
              <div className="space-y-6 flex flex-col items-start">
                <Link to="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">&gt;</span> About
                </Link>
                <Link to="/features" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">&gt;</span> Features
                </Link>
                <Link to="/pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">&gt;</span> Pricing
                </Link>
              </div>

              {/* Center Column */}
              <div className="space-y-6 flex flex-col items-start">
                <Link to="/blog" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">&gt;</span> Blog
                </Link>
                <Link to="/help" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">&gt;</span> Help Center
                </Link>
                <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">&gt;</span> Contact
                </Link>
              </div>

              {/* Right Column */}
              <div className="space-y-6 flex flex-col items-start">
                <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">&gt;</span> Privacy Policy
                </Link>
                <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">&gt;</span> Terms of Service
                </Link>
                <Link to="/legal" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center group">
                  <span className="mr-2 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">&gt;</span> Legal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
};

export default Homepage;
