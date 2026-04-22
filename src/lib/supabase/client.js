import { createClient } from "@supabase/supabase-js";

const DEFAULT_PROJECT_REF = "cpccsdnuxsodjlriyass";
const DEFAULT_SUPABASE_URL = `https://${DEFAULT_PROJECT_REF}.supabase.co`;

const runtimeEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabasePublishableKey =
  runtimeEnv.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || runtimeEnv.VITE_SUPABASE_ANON_KEY || "";

let supabaseInstance = null;

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    hasPublishableKey: Boolean(supabasePublishableKey),
    projectRef: DEFAULT_PROJECT_REF,
  };
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "db_v1_supabase_auth",
      },
    });
  }
  return supabaseInstance;
}
