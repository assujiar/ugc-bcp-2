"use client";

import * as React from "react";
import { createBrowserClient } from "@supabase/ssr";

export interface UserProfile {
  user_id: string;
  user_code: string;
  full_name: string;
  role_name: string;
  dept_code: string;
  manager_user_id?: string;
}

interface UserContextValue {
  user: UserProfile | null;
  loading: boolean;
  isDirector: boolean;
  isSuperAdmin: boolean;
  isMarketingManager: boolean;
  isSalesManager: boolean;
  isFinance: boolean;
  isOps: boolean;
  isMarketing: boolean;
  isSales: boolean;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const UserContext = React.createContext<UserContextValue | null>(null);

interface UserProviderProps {
  children: React.ReactNode;
  initialUser?: UserProfile | null;
}

export function UserProvider({ children, initialUser = null }: UserProviderProps) {
  const [user, setUser] = React.useState<UserProfile | null>(initialUser);
  const [loading, setLoading] = React.useState(!initialUser);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchProfile = React.useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setUser(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      setUser(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    if (!initialUser) {
      fetchProfile();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
        } else if (event === "SIGNED_IN") {
          fetchProfile();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile, initialUser, supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  };

  const roleName = user?.role_name || "";

  const value: UserContextValue = {
    user,
    loading,
    isDirector: roleName === "Director",
    isSuperAdmin: roleName === "super admin",
    isMarketingManager: roleName === "Marketing Manager",
    isSalesManager: roleName === "sales manager",
    isFinance: roleName === "finance",
    isOps: [
      "EXIM Ops (operation)",
      "domestics Ops (operation)",
      "Import DTD Ops (operation)",
      "traffic & warehous (operation)",
    ].includes(roleName),
    isMarketing: [
      "Marketing Manager",
      "Marcomm (marketing staff)",
      "DGO (Marketing staff)",
      "MACX (marketing staff)",
      "VSDO (marketing staff)",
    ].includes(roleName),
    isSales: [
      "sales manager",
      "salesperson",
      "sales support",
    ].includes(roleName),
    signOut,
    refetch: fetchProfile,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = React.useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
