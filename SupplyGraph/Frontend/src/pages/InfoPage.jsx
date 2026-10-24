import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { ArrowLeft, Shield, Sparkles, Brain, Cpu, Database, Mail } from 'lucide-react';

const PAGE_CONTENT = {
  '/about': {
    title: 'About SupplyGraph',
    subtitle: 'Spatio-Temporal Deep Learning for Enterprise Supply Chains',
    icon: Brain,
    content: (
      <div className="space-y-6 text-slate-600 dark:text-slate-300">
        <p>
          SupplyGraph is an enterprise-grade demand forecasting and autonomous replenishment engine designed to overcome the fundamental limitations of standard isolated time-series models.
        </p>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Why Spatio-Temporal Graphs?</h3>
        <p>
          Standard forecasting models (such as ARIMA, Prophet, or plain LSTMs) treat products and stores as disconnected time series. In modern complex supply chains, demand at a retail store is physically dependent on upstream warehouse inventories, regional distribution centers, and transportation lanes.
        </p>
        <p>
          SupplyGraph models entire supply chains as dynamic Spatio-Temporal Graphs, applying self-attention across time and Graph Transformer convolutions across physical network paths.
        </p>
      </div>
    )
  },
  '/features': {
    title: 'Platform Features',
    subtitle: 'Autonomous Forecasting & Procurement Intelligence',
    icon: Sparkles,
    content: (
      <div className="space-y-6 text-slate-600 dark:text-slate-300">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">1. STGT Neural Forecaster</h4>
            <p className="text-sm">Combines temporal self-attention with spatial TransformerConv message passing across physical supply chain topology.</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">2. Safety Stock Optimization</h4>
            <p className="text-sm">Dynamic service-level buffers calibrated against historical forecast variances and vendor lead-time volatility.</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">3. Procurement Auditor Agent</h4>
            <p className="text-sm">Automated inventory scanning against safety thresholds to flag stockouts and compute required reorder quantities.</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">4. Vendor Negotiator Agent</h4>
            <p className="text-sm">Resolves MOQ constraints, unlocks discount tiers, and generates simulation negotiation threads.</p>
          </div>
        </div>
      </div>
    )
  },
  '/pricing': {
    title: 'Enterprise Pricing',
    subtitle: 'Predictable Cloud Infrastructure for Every Fleet Scale',
    icon: Cpu,
    content: (
      <div className="space-y-6 text-slate-600 dark:text-slate-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
            <h4 className="font-bold text-slate-900 dark:text-white text-lg">Starter</h4>
            <div className="text-2xl font-bold text-[#00B4D8] mt-2 mb-4">$0 <span className="text-xs text-slate-400">/ trial</span></div>
            <p className="text-sm mb-4">Sample datasets, single-tenant demo sandbox, up to 15 SKUs.</p>
          </div>
          <div className="p-6 rounded-2xl border-2 border-[#00B4D8] bg-[#00B4D8]/[0.03]">
            <h4 className="font-bold text-slate-900 dark:text-white text-lg">Growth</h4>
            <div className="text-2xl font-bold text-[#00B4D8] mt-2 mb-4">$499 <span className="text-xs text-slate-400">/ mo</span></div>
            <p className="text-sm mb-4">Up to 500 SKUs, daily STGT fine-tuning, automated inventory replenishment alerts.</p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
            <h4 className="font-bold text-slate-900 dark:text-white text-lg">Enterprise</h4>
            <div className="text-2xl font-bold text-[#00B4D8] mt-2 mb-4">Custom</div>
            <p className="text-sm mb-4">Unlimited nodes, custom ERP connectors (SAP, NetSuite), dedicated GPU inference workers.</p>
          </div>
        </div>
      </div>
    )
  },
  '/blog': {
    title: 'Research & Engineering Blog',
    subtitle: 'Technical Notes on Deep Learning & Graph Architectures',
    icon: Brain,
    content: (
      <div className="space-y-6 text-slate-600 dark:text-slate-300">
        <article className="p-6 rounded-2xl border border-slate-200 dark:border-white/10">
          <span className="text-xs font-mono text-[#00B4D8]">October 2026</span>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-1 mb-2">
            Why Standard Time-Series Models Fail in Multi-Echelon Supply Chains
          </h4>
          <p className="text-sm leading-relaxed">
            A technical review of why isolated univariate ARIMA and LSTM forecasters generate bullwhip distortion, and how Spatio-Temporal Graph Transformers resolve spatial dependencies through message passing.
          </p>
        </article>
      </div>
    )
  },
  '/help': {
    title: 'Help Center & Documentation',
    subtitle: 'Guides for Data Ingestion, Model Training, and Integrations',
    icon: Database,
    content: (
      <div className="space-y-6 text-slate-600 dark:text-slate-300">
        <h4 className="font-semibold text-slate-900 dark:text-white">Required CSV Ingestion Schema</h4>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li><strong>nodes.csv</strong>: Contains `Node` (unique identifier) and optional `Type` (Region, City, Store, Plant).</li>
          <li><strong>edges.csv</strong> (or Edges Plant.csv): Contains `node1` and `node2` representing bidirectional supply lines.</li>
          <li><strong>sales.csv</strong> (or Sales Order.csv): Contains a `Date` column followed by product demand columns matching nodes.</li>
        </ul>
      </div>
    )
  },
  '/contact': {
    title: 'Contact Engineering & Support',
    subtitle: 'Get in Touch with the SupplyGraph Team',
    icon: Mail,
    content: (
      <div className="space-y-4 text-slate-600 dark:text-slate-300">
        <p>Have an inquiry or enterprise deployment question? Reach our team directly:</p>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
          <p className="font-mono text-sm text-slate-900 dark:text-white">Email: support@supplygraph.internal</p>
          <p className="font-mono text-sm text-slate-900 dark:text-white mt-1">Repository: github.com/Akifali-1/SupplyChainForecasting</p>
        </div>
      </div>
    )
  },
  '/privacy': {
    title: 'Privacy Policy',
    subtitle: 'Data Isolation & Encryption Standards',
    icon: Shield,
    content: (
      <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
        <p>SupplyGraph enforces strict multi-tenant isolation across all compute and storage layers.</p>
        <p>Tenant datasets are partitioned under distinct S3 object prefixes (`raw/{companyId}/` and `processed/{companyId}/`) with server-side AES256 encryption. DynamoDB single-table records are segregated by partitioned partition keys (`COMPANY#{companyId}`).</p>
      </div>
    )
  },
  '/terms': {
    title: 'Terms of Service',
    subtitle: 'Platform Usage Agreement',
    icon: Shield,
    content: (
      <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
        <p>By accessing SupplyGraph, your organization agrees to utilize the forecasting and procurement features in compliance with applicable commercial data governance standards.</p>
        <p>Predictions and procurement simulations are algorithmic recommendations designed to aid clinical and commercial operations.</p>
      </div>
    )
  },
  '/legal': {
    title: 'Legal & Compliance',
    subtitle: 'Security Certifications & Licensing',
    icon: Shield,
    content: (
      <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
        <p>SupplyGraph software and proprietary STGT deep learning architectures are maintained under enterprise governance protocols. All third-party neural libraries (PyTorch Geometric, HuggingFace, FastAPI) are utilized under permissive open-source licenses.</p>
      </div>
    )
  }
};

const InfoPage = () => {
  const location = useLocation();
  const page = PAGE_CONTENT[location.pathname] || {
    title: 'Information',
    subtitle: 'SupplyGraph Enterprise Platform',
    icon: Brain,
    content: <p>Information is being updated.</p>
  };

  const Icon = page.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Link>

        <Card className="border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/40 backdrop-blur-xl shadow-xl rounded-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8]">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#00B4D8]">
                SupplyGraph Docs
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {page.title}
            </h1>
            <p className="text-sm text-slate-550 dark:text-slate-400 mt-1">
              {page.subtitle}
            </p>
          </div>

          <CardContent className="p-8">
            {page.content}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InfoPage;
