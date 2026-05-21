import React, { useState, useEffect } from "react";
import { getCompanyMembers, revokeMember, generateInvite } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { 
  Users, 
  UserMinus, 
  UserPlus, 
  Copy, 
  Check, 
  Loader2, 
  Shield, 
  Mail, 
  Calendar,
  AlertCircle,
  Sparkles
} from "lucide-react";

const UserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await getCompanyMembers();
      setMembers(data);
    } catch (error) {
      toast({
        title: "Error fetching members",
        description: error.message || "Failed to load company member roster.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleRevokeAccess = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to revoke access for ${memberName}?`)) {
      return;
    }

    try {
      await revokeMember(memberId);
      toast({
        title: "Access Revoked",
        description: `Successfully removed ${memberName} from the organization.`,
      });
      // Refresh list
      fetchMembers();
    } catch (error) {
      toast({
        title: "Revocation Failed",
        description: error.message || "Could not complete member removal.",
        variant: "destructive"
      });
    }
  };

  const handleCreateInvite = async () => {
    try {
      setGeneratingInvite(true);
      const result = await generateInvite();
      if (result && result.token) {
        const fullLink = `${window.location.origin}/invite/${result.token}`;
        setInviteUrl(fullLink);
        setCopied(false);
        toast({
          title: "Invite Link Generated",
          description: "New membership token created successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Invite Generation Failed",
        description: error.message || "Could not generate a new invitation link.",
        variant: "destructive"
      });
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-slate-100 relative overflow-hidden font-sans pb-16 transition-colors duration-300">
      {/* Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-indigo-600/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-purple-600/10 to-transparent rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-gradient-to-r from-blue-500/5 to-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 z-10 w-full relative">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-slate-200 dark:border-white/[0.08] pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Organization Workspace
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Manage teammates, configure roles, and generate secure invite tokens for{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-300">{user?.companyName}</span>.
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={handleCreateInvite}
              disabled={generatingInvite}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium hover:scale-[1.02] shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all duration-300 rounded-xl px-5 py-2.5 flex items-center space-x-2 border-0"
            >
              {generatingInvite ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>Invite Member</span>
            </Button>
          </div>
        </div>

        {/* Invite Generation Details */}
        {inviteUrl && (
          <Card className="border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-[0_0_30px_rgba(99,102,241,0.1)] p-6 relative overflow-hidden transition-all duration-300">
            <CardHeader className="pb-2 p-0">
              <CardTitle className="text-indigo-600 dark:text-indigo-400 text-lg flex items-center space-x-2">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <span>Active Invitation Link Generated</span>
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 mt-1">
                Share this secure link with team members. They can register and instantly link to your company space. This link expires in 7 days.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] px-4 py-3 rounded-xl font-mono text-sm text-indigo-600 dark:text-indigo-200 break-all select-all flex items-center">
                  {inviteUrl}
                </div>
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  className="flex items-center space-x-2 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-500/50 text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 font-semibold h-auto py-3 px-5 rounded-xl bg-transparent transition-all duration-200"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? "Copied" : "Copy Link"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members Management Table */}
        <Card className="border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.015] backdrop-blur-2xl rounded-2xl shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-white/[0.05] p-6">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-slate-900 dark:text-white">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span>Active Team Members</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 mt-1">
              List of users currently authorized to access forecasting models and database dashboards.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading member directory...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4 border-2 border-dashed border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.005] rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-slate-400 dark:text-slate-400" />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">No teammates found</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs text-center leading-relaxed">
                  Use the invite button above to share joining tokens with your developers.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-white/[0.06] text-left">
                  <thead>
                    <tr className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="pb-4 pt-2 px-4">Member</th>
                      <th className="pb-4 pt-2 px-4">Email</th>
                      <th className="pb-4 pt-2 px-4">Role</th>
                      <th className="pb-4 pt-2 px-4">Joined Date</th>
                      <th className="pb-4 pt-2 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-sm">
                    {members.map((member) => {
                      const isSelf = member._id === user?._id;
                      const isAdmin = member.role === "admin";
                      return (
                        <tr
                          key={member._id}
                          className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-all duration-200"
                        >
                          <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 dark:from-indigo-500/20 dark:to-purple-500/20 border border-slate-200 dark:border-white/[0.1] flex items-center justify-center text-sm font-bold font-mono text-indigo-600 dark:text-indigo-300 shadow-inner">
                              {member.name ? member.name[0].toUpperCase() : "?"}
                            </div>
                            <span className="flex items-center">
                              {member.name || "Unnamed User"}
                              {isSelf && (
                                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-300">
                                  You
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                            <span className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                              <span>{member.email}</span>
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {isAdmin ? (
                              <span className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-300 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase inline-flex items-center">
                                <Shield className="h-3 w-3 mr-1" />
                                <span>{member.role}</span>
                              </span>
                            ) : (
                              <span className="bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase inline-flex items-center">
                                <span>{member.role}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                            <span className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                              <span>{new Date(member.createdAt).toLocaleDateString()}</span>
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            {!isSelf && !isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRevokeAccess(
                                    member._id,
                                    member.name || member.email
                                  )
                                }
                                className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-2 flex items-center space-x-1.5 transition-all duration-200 ml-auto bg-transparent"
                              >
                                <UserMinus className="h-4 w-4" />
                                <span>Revoke Access</span>
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserManagement;
