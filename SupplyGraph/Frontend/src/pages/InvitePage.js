import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { verifyInvite, getGoogleAuthUrl } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Loader2, AlertOctagon, TrendingUp, Sparkles, LogIn } from "lucide-react";

const InvitePage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    const checkInviteToken = async () => {
      try {
        setLoading(true);
        const data = await verifyInvite(token);
        if (data && data.success) {
          setCompanyInfo(data);
        } else {
          setError(data?.error || "This invitation link is invalid.");
        }
      } catch (err) {
        setError(err.message || "Failed to verify invitation link. It may have expired or been deactivated.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      checkInviteToken();
    } else {
      setError("No invitation token was provided.");
      setLoading(false);
    }
  }, [token]);

  const handleGoogleLogin = () => {
    window.location.href = getGoogleAuthUrl();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full space-y-8 z-10">
        {/* Brand Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SupplyGraph
            </span>
          </Link>
        </div>

        <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden relative">
          {/* Top accent glow line */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${error ? 'from-rose-500 to-orange-500' : 'from-blue-500 to-purple-500'}`}></div>
          
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl font-bold text-slate-100">
              {loading ? "Verifying invitation..." : error ? "Invitation Error" : "Join Organization"}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            {loading ? (
              <div className="space-y-4 py-8 flex flex-col items-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-sm text-slate-400">Verifying secure token with server...</p>
              </div>
            ) : error ? (
              <div className="space-y-6 py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-inner">
                  <AlertOctagon className="h-8 w-8 text-rose-500 animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-200">Unable to Join</h3>
                  <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                    {error}
                  </p>
                </div>

                <div className="pt-4 flex flex-col space-y-3">
                  <Button 
                    asChild
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50"
                  >
                    <Link to="/">Go to Homepage</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-blue-400" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-slate-300">
                    You have been invited to join
                  </h3>
                  <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent py-1">
                    {companyInfo?.companyName}
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Accepting this invite will link your Google profile to this company space with standard team member permissions.
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleGoogleLogin}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2 rounded-lg shadow-lg shadow-blue-500/15"
                  >
                    <LogIn className="w-5 h-5" />
                    <span>Accept & Sign in with Google</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          <p>SupplyGraph platform secure single-sign-on integration</p>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;
