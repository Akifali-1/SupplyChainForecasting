import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { setupCompany } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { TrendingUp, Building2, ArrowRight, Loader2, Sparkles } from 'lucide-react';

const SUGGESTIONS = ['Walmart Supply Co.', 'Amazon Logistics', 'Reliance Retail', 'Target Corp.', 'Flipkart SCM'];

const SetupCompany = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Guard: if not admin or already setup, bounce out
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) { navigate('/login'); return; }
      if (user && user.role !== 'admin') { navigate('/dashboard'); return; }
      if (user && !user.needsSetup) { navigate('/dashboard'); return; }
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) { setError('Please enter a company name.'); return; }
    setLoading(true);
    setError('');
    try {
      await setupCompany(companyName.trim());
      // Force a fresh session fetch so AuthContext has updated companyName
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
      setLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="p-2.5 bg-gradient-to-tr from-blue-500 to-violet-600 rounded-xl shadow-lg shadow-blue-500/20">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              SupplyGraph
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Top gradient line */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500" />

          <div className="p-8 space-y-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <span>Welcome, {user?.name?.split(' ')[0] || 'Admin'}! One last step.</span>
              </div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Building2 className="h-6 w-6 text-blue-400" />
                Name your organization
              </h1>
              <p className="text-slate-400 text-sm">
                This name will appear across dashboards and invite links sent to your team.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-slate-300 text-sm font-medium">
                  Company / Organization Name
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="e.g. Walmart Supply Co."
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); setError(''); }}
                  className="h-12 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 text-base rounded-lg"
                  autoFocus
                  maxLength={80}
                />
                {error && (
                  <p className="text-red-400 text-xs mt-1">{error}</p>
                )}
              </div>

              {/* Quick suggestions */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Quick picks</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCompanyName(s)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/5 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !companyName.trim()}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</>
                ) : (
                  <>Launch Dashboard <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600">
          You can rename your organization later from admin settings.
        </p>
      </div>
    </div>
  );
};

export default SetupCompany;
