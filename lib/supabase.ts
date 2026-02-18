import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables
const getEnvVar = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key];
  }
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {}
  return undefined;
};

// Default credentials provided for this instance
// Note: In a production environment, you should ensure these are set via environment variables (VITE_SUPABASE_URL, etc.)
const DEFAULT_URL = 'https://tfpzehyrkzbenjobkdsz.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcHplaHlya3piZW5qb2JrZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDc1MjIsImV4cCI6MjA4Njk4MzUyMn0.p5NEtPP5xAlqBbZwibnkZv2MH4RVYfVKqt8MewTHNsQ';

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || DEFAULT_URL;
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || DEFAULT_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is missing. Please check your environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);