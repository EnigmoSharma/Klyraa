// supabaseClient.js

// Production Supabase credentials
const supabaseUrl = "https://qkfqxemmuzdnbbriecnq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZnF4ZW1tdXpkbmJicmllY25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjgyNTcsImV4cCI6MjA3NjcwNDI1N30.OFjfbDCTocSm4TH-NuDYX03hQg-CsOD93lT0DdG0dc4";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials are missing. Please check your environment variables.');
}

// Initialize Supabase client
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export the client
export { supabaseClient as supabase };

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const { data } = await supabaseClient.auth.getSession();
  return !!data.session;
};

// Helper function to get the current logged-in user
export const getCurrentUser = async () => {
  const { data } = await supabaseClient.auth.getUser();
  return data.user;
};
