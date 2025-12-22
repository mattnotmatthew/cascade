// Supabase client initialization
// Returns null if environment variables are not configured

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create client only if both env vars are present
let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log("[Supabase] Client initialized successfully");
  } catch (error) {
    console.error("[Supabase] Failed to initialize client:", error);
    supabaseClient = null;
  }
} else {
  console.log("[Supabase] Missing environment variables, running in offline mode");
}

export const supabase = supabaseClient;

export function isSupabaseEnabled(): boolean {
  return supabaseClient !== null;
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error("Supabase client not initialized. Check environment variables.");
  }
  return supabaseClient;
}
