"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  Target,
  AlertCircle,
  ChevronLeft,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { pageLabels, navLabels } from "@/lib/terminology/labels";

interface TeamMember {
  user_id: string;
  full_name: string;
  role_name: string;
  user_code: string;
}

interface TeamStats {
  memberCount: number;
  avgAchievement: number;
  onTrack: number;
  atRisk: number;
}

export default function TeamKpiPage() {
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [stats, setStats] = React.useState<TeamStats>({
    memberCount: 0,
    avgAchievement: 0,
    onTrack: 0,
    atRisk: 0,
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchTeamData() {
      const supabase = createClient();

      try {
        // Get current user's profile to find team members
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        // Get current user's profile
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("user_id, role_name")
          .eq("user_id", user.id)
          .single();

        if (!currentProfile) {
          setLoading(false);
          return;
        }

        // Fetch team members (users who have this user as manager)
        const { data: teamData, error } = await supabase
          .from("profiles")
          .select("user_id, full_name, role_name, user_code")
          .eq("manager_user_id", user.id);

        if (error) throw error;

        const typedTeam = (teamData || []) as TeamMember[];
        setTeamMembers(typedTeam);

        setStats({
          memberCount: typedTeam.length,
          avgAchievement: 0, // No performance data yet
          onTrack: 0,
          atRisk: 0,
        });
      } catch (error) {
        console.error("Error fetching team data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeamData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-64 skeleton rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/kpi" className="btn-ghost h-10 w-10 p-0">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Performance</h1>
          <p className="text-muted-foreground">Monitor your team performance metrics</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.memberCount}</p>
            <p className="text-sm text-muted-foreground">Team Members</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.avgAchievement}%</p>
            <p className="text-sm text-muted-foreground">Avg. Achievement</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
            <Target className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-success">{stats.onTrack}</p>
            <p className="text-sm text-muted-foreground">On Track</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
            <AlertCircle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-warning">{stats.atRisk}</p>
            <p className="text-sm text-muted-foreground">At Risk</p>
          </div>
        </div>
      </div>

      {/* Team Table */}
      <div className="card-flush overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Team Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Metrics
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Achievement
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Last Activity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {teamMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Team Members</h3>
                  <p className="text-muted-foreground">
                    No team members are assigned to you yet.
                  </p>
                </td>
              </tr>
            ) : (
              teamMembers.map((member) => (
                <tr key={member.user_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                        {member.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground">{member.role_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">0/0</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                        <div className="h-full w-0 rounded-full bg-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">0%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge badge-default">No Data</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">-</td>
                  <td className="px-6 py-4">
                    <button className="btn-ghost h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
