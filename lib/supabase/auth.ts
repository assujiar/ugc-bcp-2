import { createServerClient } from "./server";

export async function getSession() {
  const supabase = await createServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error getting session:", error);
    return null;
  }
  return session;
}

export async function getUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting user:", error);
    return null;
  }
  return user;
}

export async function getProfile() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Error getting profile:", error);
    return null;
  }

  return profile;
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}
