import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const cloudConfiguration = {
  supabaseUrl,
  supabasePublishableKey,
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "",
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "",
};

export const isCloudConfigured = Boolean(
  cloudConfiguration.supabaseUrl &&
    cloudConfiguration.supabasePublishableKey &&
    cloudConfiguration.vapidPublicKey &&
    cloudConfiguration.turnstileSiteKey,
);

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isCloudConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
