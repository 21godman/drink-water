import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function createAdminClient(): SupabaseClient {
  const secretKey =
    Deno.env.get("APP_SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secretKey) {
    throw new Error(
      "Missing APP_SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(requiredEnv("SUPABASE_URL"), secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function requireUser(request: Request): Promise<User> {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("missing_authorization");

  const publishableKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!publishableKey) {
    throw new Error(
      "Missing SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY",
    );
  }

  const client = createClient(requiredEnv("SUPABASE_URL"), publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("invalid_authorization");
  return data.user;
}

export function userAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "missing_authorization" ||
      error.message === "invalid_authorization")
  );
}
