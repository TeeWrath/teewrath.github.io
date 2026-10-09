import { createClient } from '@supabase/supabase-js';

// The anon key is public by design; Row Level Security (see supabase/setup.sql)
// is what restricts writes to the author.
export const SUPABASE_URL = 'https://zxjyeifoutndgnvxkhwe.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4anllaWZvdXRuZGdudnhraHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NjY5MjAsImV4cCI6MjEwNzE0MjkyMH0.KM7ErVyN483UKFuBfiYWmKm3G71tboxY_4TaCUDX2G0';

export const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
