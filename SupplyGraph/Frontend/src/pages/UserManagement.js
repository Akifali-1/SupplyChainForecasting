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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-slate-800 dark:text-slate-100">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-slate-200 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Organization Workspace</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage teammates, configure roles, and generate secure invite tokens for <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.companyName}</span>.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={handleCreateInvite}
            disabled={generatingInvite}
            className="bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 flex items-center space-x-2 shadow-md transition-all duration-200"
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
        <Card className="border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-500/10 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-indigo-600 dark:text-indigo-400 text-lg flex items-center space-x-2">
              <Sparkles className="h-5 w-5" />
              <span>Active Invitation Link Generated</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Share this secure link with team members. They can register and instantly link to your company space. This link expires in 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 bg-white dark:bg-neutral-950 px-4 py-3 rounded-lg border border-slate-200 dark:border-neutral-800 font-mono text-sm break-all flex items-center select-all select-none">
                {inviteUrl}
              </div>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="flex items-center space-x-2 border-indigo-500/20 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 h-auto py-3 px-4 font-semibold"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Copied" : "Copy Link"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members Management Table */}
      <Card className="border border-slate-200 dark:border-neutral-800 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-xl font-bold">
            <Users className="h-5 w-5 text-blue-500" />
            <span>Active Team Members</span>
          </CardTitle>
          <CardDescription>
            List of users currently authorized to access forecasting models and database dashboards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading member directory...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2 border-2 border-dashed border-slate-200 dark:border-neutral-800 rounded-xl">
              <AlertCircle className="h-8 w-8 text-slate-400" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">No teammates found</p>
              <p className="text-sm text-slate-400 max-w-xs text-center">Use the invite button above to share joining tokens with your developers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-neutral-800 text-left">
                <thead>
                  <tr className="text-xs uppercase font-semibold text-slate-500 tracking-wider">
                    <th className="pb-3 pt-1 px-4">Member</th>
                    <th className="pb-3 pt-1 px-4">Email</th>
                    <th className="pb-3 pt-1 px-4">Role</th>
                    <th className="pb-3 pt-1 px-4">Joined Date</th>
                    <th className="pb-3 pt-1 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-850 text-sm">
                  {members.map((member) => {
                    const isSelf = member._id === user?._id;
                    const isAdmin = member.role === "admin";
                    return (
                      <tr key={member._id} className="hover:bg-slate-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                        <td className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-900 flex items-center justify-center text-xs font-bold font-mono">
                            {member.name ? member.name[0].toUpperCase() : "?"}
                          </div>
                          <span>
                            {member.name || "Unnamed User"}
                            {isSelf && <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">You</span>}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-500 dark:text-slate-400">
                          <span className="flex items-center space-x-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span>{member.email}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            isAdmin 
                              ? "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300"
                              : "bg-slate-100 dark:bg-neutral-900 text-slate-800 dark:text-slate-300"
                          }`}>
                            {isAdmin ? <Shield className="h-3 w-3 mr-1" /> : null}
                            <span>{member.role}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                          <span className="flex items-center space-x-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{new Date(member.createdAt).toLocaleDateString()}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {!isSelf && !isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeAccess(member._id, member.name || member.email)}
                              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center space-x-1.5 ml-auto border border-transparent hover:border-rose-500/20"
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
  );
};

export default UserManagement;
