// Authentication service for Supabase Auth
// Supports email/password and Google OAuth

import type { User, AuthError } from "@supabase/supabase-js";
import { supabase, isSupabaseEnabled } from "./supabase";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  emailConfirmed: boolean;
}

export interface AuthResult {
  user: AuthUser | null;
  error: string | null;
}

function mapUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: user.user_metadata?.name ?? user.email?.split("@")[0] ?? null,
    emailConfirmed: user.email_confirmed_at !== null,
  };
}

function mapError(error: AuthError | null): string | null {
  if (!error) return null;
  // Map common errors to user-friendly messages
  switch (error.message) {
    case "Invalid login credentials":
      return "Invalid email or password";
    case "Email not confirmed":
      return "Please check your email to confirm your account";
    case "User already registered":
      return "An account with this email already exists";
    default:
      return error.message;
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isSupabaseEnabled() || !supabase) {
    return { user: null, error: "Authentication not available" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    user: mapUser(data.user),
    error: mapError(error),
  };
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isSupabaseEnabled() || !supabase) {
    return { user: null, error: "Authentication not available" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  return {
    user: mapUser(data.user),
    error: mapError(error),
  };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!isSupabaseEnabled() || !supabase) {
    return { user: null, error: "Authentication not available" };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    return { user: null, error: mapError(error) };
  }

  // OAuth redirects, so we return null user (will be set on callback)
  return { user: null, error: null };
}

export async function signOut(): Promise<{ error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { error: null };
  }

  const { error } = await supabase.auth.signOut();
  return { error: mapError(error) };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseEnabled() || !supabase) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  return mapUser(data.user);
}

export async function getSession() {
  if (!isSupabaseEnabled() || !supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(
  callback: (user: AuthUser | null) => void
): () => void {
  if (!isSupabaseEnabled() || !supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(mapUser(session?.user ?? null));
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

/**
 * Update the user's display name in the profiles table
 */
export async function updateDisplayName(
  displayName: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { success: false, error: "Authentication not available" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[AuthService] Error updating display name:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Get the user's profile from the profiles table
 */
export async function getUserProfile(): Promise<{
  displayName: string | null;
  username: string | null;
} | null> {
  if (!isSupabaseEnabled() || !supabase) {
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    displayName: data.display_name,
    username: data.username,
  };
}
