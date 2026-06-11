"use client";

import { createBrowserClient } from "@supabase/ssr";
import { wayfinderAuthOptions } from "./auth-client-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    ...wayfinderAuthOptions,
  });
}
