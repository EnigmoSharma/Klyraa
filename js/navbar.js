// Navbar HTML template
const navbarHTML = `
<nav class="bg-white shadow p-4">
    <div class="flex justify-between items-center px-8">
        <a href="index.html" class="text-3xl font-bold text-blue-600">Klyra</a>
        <div class="flex space-x-4 items-center relative">
            <a href="index.html" class="text-gray-700 hover:text-blue-600">Home</a>
            <a href="aboutUs.html" class="text-gray-700 hover:text-blue-600">About Us</a>
            <div class="relative">
                <button id="profile-btn" class="text-gray-700 hover:text-blue-600 flex items-center focus:outline-none">
                    <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                    </svg>
                    Profile
                    <svg class="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
                <div id="profile-dropdown" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 hidden">
                    <a href="#" id="dashboard-link" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Go to Dashboard</a>
                    <a href="#" id="logout-link" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</a>
                </div>
            </div>
        </div>
    </div>
</nav>
`;

// Load navbar immediately (before DOMContentLoaded)
const navbarPlaceholder = document.getElementById('navbar-placeholder');
if (navbarPlaceholder) {
    navbarPlaceholder.innerHTML = navbarHTML;
}

// Then check auth status asynchronously
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const navbarPlaceholder = document.getElementById('navbar-placeholder');
        if (!navbarPlaceholder) return;

        // Wait for Supabase to be available
        if (typeof supabase === 'undefined') {
            console.warn('Supabase not loaded yet');
            return;
        }

        const { createClient } = supabase;
        const supabaseUrl = 'https://qkfqxemmuzdnbbriecnq.supabase.co';
        const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZnF4ZW1tdXpkbmJicmllY25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjgyNTcsImV4cCI6MjA3NjcwNDI1N30.OFjfbDCTocSm4TH-NuDYX03hQg-CsOD93lT0DdG0dc4';
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

        const profileBtn = navbarPlaceholder.querySelector('#profile-btn');
        const profileDropdown = navbarPlaceholder.querySelector('#profile-dropdown');
        const dashboardLink = navbarPlaceholder.querySelector('#dashboard-link');
        const logoutLink = navbarPlaceholder.querySelector('#logout-link');

        if (!profileBtn || !profileDropdown) return;

        const { data: { user } } = await supabaseClient.auth.getUser();

        if (user) {
            // Logged in
            profileBtn.innerHTML = `
                <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                </svg>
                Profile
                <svg class="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            `;

            profileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                profileDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                    profileDropdown.classList.add('hidden');
                }
            });

            dashboardLink.href = 'dashboard.html';

            logoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabaseClient.auth.signOut();
                window.location.reload();
            });

        } else {
            // Not logged in
            profileBtn.innerHTML = `
                <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                </svg>
                Login
            `;
            profileBtn.addEventListener('click', () => {
                window.location.href = 'auth.html';
            });
            profileDropdown.classList.add('hidden');
        }

    } catch (err) {
        console.error('Error loading navbar:', err);
    }
});
