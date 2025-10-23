import { supabase } from './supabaseClient.js'

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        console.log('User signed in:', session.user.email)
        // You can add custom logic here, like showing a welcome message
    } else if (event === 'SIGNED_OUT') {
        console.log('User signed out')
        // Redirect to home or show logout message
    }
})

// Export for use in other files
export { supabase }