import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/supabase/auth";
import { UserProvider } from "@/lib/contexts/user-context";
import { ProtectedShell } from "@/components/layout/protected-shell";

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is authenticated
  const user = await getUser();

  if (!user) {
    // User is not authenticated, redirect to login
    redirect("/login");
  }

  // User is authenticated, get their profile
  const profile = await getProfile();

  if (!profile) {
    // User is authenticated but has no profile in the database
    redirect("/login?error=profile_not_found");
  }

  return (
    <UserProvider initialUser={profile}>
      <ProtectedShell>{children}</ProtectedShell>
    </UserProvider>
  );
}
