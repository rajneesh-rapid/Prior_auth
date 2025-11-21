import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.trim() !== '' && supabaseAnonKey.trim() !== '');
}

// Create Supabase client - only if properly configured, otherwise use placeholder
export const supabase: SupabaseClient<Database> = (() => {
  if (isSupabaseConfigured()) {
    return createClient<Database>(supabaseUrl!, supabaseAnonKey!);
  }
  
  // Return a placeholder client that won't crash the app
  // The app checks isSupabaseConfigured() before making actual Supabase calls
  console.warn('Supabase not configured. App will use localStorage fallback.');
  return createClient<Database>(
    'https://placeholder.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  );
})();