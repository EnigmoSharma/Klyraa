// Admin Authentication JavaScript
const { createClient } = supabase;
const supabaseUrl = 'https://qkfqxemmuzdnbbriecnq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZnF4ZW1tdXpkbmJicmllY25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjgyNTcsImV4cCI6MjA3NjcwNDI1N30.OFjfbDCTocSm4TH-NuDYX03hQg-CsOD93lT0DdG0dc4';
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener('DOMContentLoaded', function() {
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminMessage = document.getElementById('admin-message');

    // Check if already logged in as admin
    const adminUsername = localStorage.getItem('admin_username');
    if (adminUsername) {
        window.location.href = 'admin.html';
        return;
    }

    // Admin Login
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('admin-username').value.trim();
        const password = document.getElementById('admin-password').value;

        try {
            // Query admin table
            const { data, error } = await supabaseClient
                .from('admins')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error || !data) {
                throw new Error('Invalid admin credentials');
            }

            // Store admin session
            localStorage.setItem('admin_username', data.username);
            
            adminMessage.textContent = '✅ Admin login successful! Redirecting...';
            adminMessage.className = 'text-center text-sm text-green-600';
            
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1500);

        } catch (err) {
            adminMessage.textContent = '❌ ' + err.message;
            adminMessage.className = 'text-center text-sm text-red-600';
        }
    });
});
