import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/auth";
import { UserProvider } from "@/lib/contexts/user-context";
import { ProtectedShell } from "@/components/layout/protected-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <UserProvider initialUser={profile}>
      <ProtectedShell>{children}</ProtectedShell>
    </UserProvider>
  );
}
