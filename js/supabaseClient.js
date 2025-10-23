// supabaseClient.js

// Check if environment variables are injected
const supabaseUrl = "%SUPABASE_URL%";
const supabaseAnonKey = "%SUPABASE_ANON_KEY%";

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
