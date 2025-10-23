import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const authMessage = document.getElementById('auth-message');

    // Tab switching
    loginTab.addEventListener('click', () => {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        loginTab.classList.add('bg-blue-600','text-white');
        loginTab.classList.remove('bg-gray-200','text-gray-700');
        signupTab.classList.add('bg-gray-200','text-gray-700');
        signupTab.classList.remove('bg-blue-600','text-white');
        authMessage.textContent = '';
    });

    signupTab.addEventListener('click', () => {
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        signupTab.classList.add('bg-blue-600','text-white');
        signupTab.classList.remove('bg-gray-200','text-gray-700');
        loginTab.classList.add('bg-gray-200','text-gray-700');
        loginTab.classList.remove('bg-blue-600','text-white');
        authMessage.textContent = '';
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            authMessage.textContent = 'Login successful! Redirecting...';
            authMessage.className = 'mt-4 text-center text-sm text-green-600';
            setTimeout(() => window.location.href = 'index.html', 1500);
        } catch (err) {
            authMessage.textContent = err.message;
            authMessage.className = 'mt-4 text-center text-sm text-red-600';
        }
    });

    // Signup
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (password !== confirmPassword) {
            authMessage.textContent = 'Passwords do not match';
            authMessage.className = 'mt-4 text-center text-sm text-red-600';
            return;
        }

        try {
            // Sign up with Supabase Auth, passing username in metadata
            const { data: userData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username
                    }
                }
            });
            if (signUpError) throw signUpError;

            // Profile is automatically created by database trigger
            // No need for manual insertion

            authMessage.textContent = 'Signup successful! Check your email for verification.';
            authMessage.className = 'mt-4 text-center text-sm text-green-600';
        } catch (err) {
            authMessage.textContent = err.message;
            authMessage.className = 'mt-4 text-center text-sm text-red-600';
        }
    });
});
