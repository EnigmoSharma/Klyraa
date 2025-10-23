// Admin Dashboard JavaScript
const { createClient } = supabase;
const supabaseUrl = 'https://qkfqxemmuzdnbbriecnq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZnF4ZW1tdXpkbmJicmllY25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjgyNTcsImV4cCI6MjA3NjcwNDI1N30.OFjfbDCTocSm4TH-NuDYX03hQg-CsOD93lT0DdG0dc4';
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

let currentSpotId = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Check if admin is logged in
    const adminUsername = localStorage.getItem('admin_username');
    if (!adminUsername) {
        window.location.href = 'auth.html?admin=true';
        return;
    }

    // Load dashboard data
    await loadDashboard();

    // Setup coupon form
    document.getElementById('coupon-form').addEventListener('submit', generateCoupon);
});

async function loadDashboard() {
    try {
        // Load parking spots
        const { data: spots, error } = await supabaseClient
            .from('parking_spots')
            .select('*')
            .order('spot_number');

        if (error) throw error;

        // Load active bookings
        const { data: bookings, error: bookingsError } = await supabaseClient
            .from('bookings')
            .select('*')
            .gte('end_time', new Date().toISOString());

        if (bookingsError) throw bookingsError;

        // Update stats
        document.getElementById('total-spots').textContent = spots.length;
        document.getElementById('available-spots').textContent = spots.filter(s => s.is_available).length;
        document.getElementById('occupied-spots').textContent = spots.filter(s => !s.is_available).length;
        document.getElementById('active-bookings').textContent = bookings.length;

        // Render parking grid
        renderParkingGrid(spots, bookings);

    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Error loading dashboard data');
    }
}

function renderParkingGrid(spots, bookings) {
    const grid = document.getElementById('parking-grid');
    grid.innerHTML = '';

    spots.forEach(spot => {
        const isOccupied = !spot.is_available;
        const activeBooking = bookings.find(b => b.spot_id === spot.id && new Date(b.end_time) > new Date());

        const spotDiv = document.createElement('div');
        spotDiv.className = `
            p-6 rounded-lg cursor-pointer transition-all duration-200 text-center font-bold text-white
            ${isOccupied ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}
        `;
        spotDiv.innerHTML = `
            <div class="text-2xl mb-2">${spot.spot_number}</div>
            <div class="text-sm">${isOccupied ? 'Occupied' : 'Available'}</div>
            ${activeBooking ? '<div class="text-xs mt-1">Booked</div>' : ''}
        `;
        spotDiv.onclick = () => showSpotDetails(spot.id);
        grid.appendChild(spotDiv);
    });
}

async function showSpotDetails(spotId) {
    currentSpotId = spotId;
    
    try {
        // Get spot details
        const { data: spot, error: spotError } = await supabaseClient
            .from('parking_spots')
            .select('*')
            .eq('id', spotId)
            .single();

        if (spotError) throw spotError;

        // Get all bookings for this spot
        const { data: allBookings, error: bookingsError } = await supabaseClient
            .from('bookings')
            .select(`
                *,
                profiles:user_id (username, email)
            `)
            .eq('spot_id', spotId)
            .order('start_time', { ascending: false });

        if (bookingsError) throw bookingsError;

        const now = new Date();
        const upcoming = allBookings.filter(b => new Date(b.start_time) > now);
        const past = allBookings.filter(b => new Date(b.end_time) <= now);

        // Update modal
        document.getElementById('modal-title').textContent = `Spot ${spot.spot_number} - ${spot.location}`;

        // Camera feed
        const cameraFeed = document.getElementById('camera-feed');
        if (spot.camera_feed_url) {
            cameraFeed.innerHTML = `
                <img src="${spot.camera_feed_url}" 
                     class="w-full h-full object-cover rounded-lg" 
                     alt="Live Feed"
                     onerror="this.parentElement.innerHTML='<p class=\\'text-gray-500\\'>Camera feed unavailable</p>'">
            `;
        } else {
            cameraFeed.innerHTML = '<p class="text-gray-500">No camera configured</p>';
        }

        // Upcoming bookings
        const upcomingDiv = document.getElementById('upcoming-bookings');
        if (upcoming.length === 0) {
            upcomingDiv.innerHTML = '<p class="text-gray-500">No upcoming bookings</p>';
        } else {
            upcomingDiv.innerHTML = upcoming.map(b => `
                <div class="border border-gray-200 rounded p-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-semibold">${b.profiles?.username || 'Unknown'}</p>
                            <p class="text-sm text-gray-600">${b.vehicle_number}</p>
                            <p class="text-sm text-gray-600">
                                ${new Date(b.start_time).toLocaleString()} - ${new Date(b.end_time).toLocaleString()}
                            </p>
                        </div>
                        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Upcoming</span>
                    </div>
                </div>
            `).join('');
        }

        // Past bookings
        const pastDiv = document.getElementById('past-bookings');
        if (past.length === 0) {
            pastDiv.innerHTML = '<p class="text-gray-500">No past bookings</p>';
        } else {
            pastDiv.innerHTML = past.slice(0, 10).map(b => `
                <div class="border border-gray-200 rounded p-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-semibold">${b.profiles?.username || 'Unknown'}</p>
                            <p class="text-sm text-gray-600">${b.vehicle_number}</p>
                            <p class="text-sm text-gray-600">
                                ${new Date(b.start_time).toLocaleString()} - ${new Date(b.end_time).toLocaleString()}
                            </p>
                        </div>
                        <span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Completed</span>
                    </div>
                </div>
            `).join('');
        }

        // Show modal
        document.getElementById('spot-modal').classList.remove('hidden');

    } catch (error) {
        console.error('Error loading spot details:', error);
        alert('Error loading spot details');
    }
}

function closeModal() {
    document.getElementById('spot-modal').classList.add('hidden');
}

async function generateCoupon(e) {
    e.preventDefault();

    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const amount = parseFloat(document.getElementById('coupon-amount').value);
    const maxUses = parseInt(document.getElementById('coupon-max-uses').value);

    try {
        const { data, error } = await supabaseClient
            .from('coupons')
            .insert([{
                code: code,
                amount: amount,
                max_uses: maxUses,
                used_count: 0,
                is_active: true
            }])
            .select();

        if (error) throw error;

        // Show success message
        const messageDiv = document.getElementById('coupon-message');
        messageDiv.className = 'mt-4 p-4 bg-green-100 text-green-700 rounded';
        messageDiv.textContent = `✅ Coupon "${code}" generated successfully! Amount: ₹${amount}, Max Uses: ${maxUses}`;
        messageDiv.classList.remove('hidden');

        // Reset form
        document.getElementById('coupon-form').reset();

        // Hide message after 5 seconds
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 5000);

    } catch (error) {
        console.error('Error generating coupon:', error);
        const messageDiv = document.getElementById('coupon-message');
        messageDiv.className = 'mt-4 p-4 bg-red-100 text-red-700 rounded';
        messageDiv.textContent = `❌ Error: ${error.message}`;
        messageDiv.classList.remove('hidden');
    }
}

// Admin logout function
function adminLogout() {
    localStorage.removeItem('admin_username');
    window.location.href = 'admin-auth.html';
}

// Make functions available globally
window.closeModal = closeModal;
window.adminLogout = adminLogout;
