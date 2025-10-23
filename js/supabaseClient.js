// Import Supabase from CDN
const { createClient } = supabase;

// Production credentials (safe to expose - anon key is public)
const supabaseUrl = 'https://qkfqxemmuzdnbbriecnq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZnF4ZW1tdXpkbmJicmllY25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjgyNTcsImV4cCI6MjA3NjcwNDI1N30.OFjfbDCTocSm4TH-NuDYX03hQg-CsOD93lT0DdG0dc4';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials');
}

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export { supabaseClient as supabase };

// Helper functions
export const isAuthenticated = async () => {
  const { data } = await supabaseClient.auth.getSession();
  return !!data.session;
};

export const getCurrentUser = async () => {
  const { data } = await supabaseClient.auth.getUser();
  return data.user;
};
