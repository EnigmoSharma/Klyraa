import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async function() {
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    const welcomeName = document.getElementById('welcome-name');
    const transactionsContainer = document.getElementById('transactions-container');

    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            window.location.href = 'auth.html';
            return;
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Profile error:', profileError);
            loading.textContent = 'Error loading profile. Please try again.';
            return;
        }

        // Update welcome message and balance
        welcomeName.textContent = profile.username;
        document.getElementById('balance-amount').textContent = parseFloat(profile.credit_balance).toFixed(2);

        // Setup coupon form
        setupCouponForm(user.id);

        // Get transaction history
        const { data: transactions, error: transError } = await supabase
            .from('transaction_history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (transError) {
            console.error('Transaction error:', transError);
        }

        // Get bookings with parking spot details
        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select(`
                *,
                parking_spots (
                    spot_number,
                    location,
                    camera_feed_url
                )
            `)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('start_time', { ascending: true });

        if (bookingsError) {
            console.error('Bookings error:', bookingsError);
        }

        // Display data
        displayTransactions(transactions || []);
        displayBookings(bookings || []);

        // Setup camera modal
        setupCameraModal();

        // Setup buy coupon button
        setupBuyCouponButton();

        // Hide loading, show content
        loading.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (err) {
        console.error('Dashboard error:', err);
        loading.textContent = 'Error loading dashboard. Please refresh the page.';
    }
});

function setupCouponForm(userId) {
    const couponForm = document.getElementById('coupon-form');
    const couponCodeInput = document.getElementById('coupon-code');
    const couponMessage = document.getElementById('coupon-message');

    couponForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = couponCodeInput.value.trim().toUpperCase();

        if (!code) {
            showCouponMessage('Please enter a coupon code', 'error');
            return;
        }

        try {
            // Call the redeem_coupon function
            const { data, error } = await supabase.rpc('redeem_coupon', {
                p_user_id: userId,
                p_coupon_code: code
            });

            if (error) {
                console.error('Coupon error:', error);
                showCouponMessage('Error redeeming coupon. Please try again.', 'error');
                return;
            }

            if (data.success) {
                showCouponMessage(`Success! ₹${data.amount} added to your balance`, 'success');
                couponCodeInput.value = '';
                
                // Reload the page to show updated balance and transactions
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showCouponMessage(data.message, 'error');
            }
        } catch (err) {
            console.error('Coupon redemption error:', err);
            showCouponMessage('Error redeeming coupon. Please try again.', 'error');
        }
    });
}

function showCouponMessage(message, type) {
    const couponMessage = document.getElementById('coupon-message');
    couponMessage.textContent = message;
    couponMessage.className = `mt-3 text-sm ${type === 'success' ? 'text-green-600' : 'text-red-600'}`;
}

function displayBookings(bookings) {
    const ongoingContainer = document.getElementById('ongoing-bookings-container');
    const upcomingContainer = document.getElementById('upcoming-bookings-container');
    
    if (!bookings || bookings.length === 0) {
        ongoingContainer.innerHTML = '<p class="text-gray-500 text-center">No ongoing bookings</p>';
        upcomingContainer.innerHTML = '<p class="text-gray-500 text-center">No upcoming bookings</p>';
        return;
    }

    const now = new Date();
    const ongoingBookings = [];
    const upcomingBookings = [];

    // Separate bookings into ongoing and upcoming
    bookings.forEach(booking => {
        const startTime = new Date(booking.start_time);
        const endTime = new Date(booking.end_time);
        
        if (now >= startTime && now <= endTime) {
            ongoingBookings.push(booking);
        } else if (now < startTime) {
            upcomingBookings.push(booking);
        }
    });

    // Display ongoing bookings
    if (ongoingBookings.length === 0) {
        ongoingContainer.innerHTML = '<p class="text-gray-500 text-center">No ongoing bookings</p>';
    } else {
        ongoingContainer.innerHTML = ongoingBookings.map(booking => createBookingCard(booking, true)).join('');
    }

    // Display upcoming bookings
    if (upcomingBookings.length === 0) {
        upcomingContainer.innerHTML = '<p class="text-gray-500 text-center">No upcoming bookings</p>';
    } else {
        upcomingContainer.innerHTML = upcomingBookings.map(booking => createBookingCard(booking, false)).join('');
    }
}

function createBookingCard(booking, isOngoing) {
    const startTime = new Date(booking.start_time).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
    const endTime = new Date(booking.end_time).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    const statusBadge = isOngoing 
        ? '<span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1"><i class="fa fa-circle text-xs"></i>Active</span>'
        : '<span class="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Upcoming</span>';

    const liveFeedButton = isOngoing
        ? `<button 
            class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            onclick="openCameraFeed('${booking.id}', '${booking.parking_spots.spot_number}', '${booking.parking_spots.location}', '${booking.vehicle_number}', '${startTime} - ${endTime}', '${booking.parking_spots.camera_feed_url}')"
        >
            <i class="fa fa-video-camera"></i>
            Watch Live Feed
        </button>`
        : `<button 
            class="w-full bg-gray-400 text-white py-2 px-4 rounded-lg cursor-not-allowed font-medium flex items-center justify-center gap-2"
            disabled
        >
            <i class="fa fa-video-camera"></i>
            Live Feed (Available at start time)
        </button>`;

    const extendButton = isOngoing
        ? `<button 
            class="w-full mt-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
            onclick="showExtendBookingModal('${booking.id}', '${booking.parking_spots.spot_number}')"
        >
            <i class="fa fa-clock-o"></i>
            Extend Booking
        </button>`
        : '';

    return `
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${isOngoing ? 'border-l-4 border-l-green-500' : ''}">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-semibold text-lg text-gray-900">Spot ${booking.parking_spots.spot_number}</h4>
                    <p class="text-sm text-gray-600">${booking.parking_spots.location}</p>
                </div>
                ${statusBadge}
            </div>
            <div class="space-y-2 text-sm text-gray-600 mb-4">
                <p><i class="fa fa-car mr-2"></i><strong>Vehicle:</strong> ${booking.vehicle_number}</p>
                <p><i class="fa fa-clock-o mr-2"></i><strong>Start:</strong> ${startTime}</p>
                <p><i class="fa fa-clock-o mr-2"></i><strong>End:</strong> ${endTime}</p>
                <p><i class="fa fa-money mr-2"></i><strong>Cost:</strong> ₹${parseFloat(booking.total_cost).toFixed(2)}</p>
            </div>
            ${liveFeedButton}
            ${extendButton}
        </div>
    `;
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactions-container');
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No transactions yet</p>';
        return;
    }

    container.innerHTML = transactions.map(tx => {
        const isPositive = tx.amount >= 0;
        const amountClass = isPositive ? 'text-green-600' : 'text-red-600';
        const sign = isPositive ? '+' : '';
        const date = new Date(tx.created_at).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        return `
            <div class="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div>
                    <p class="font-medium text-gray-900">${tx.description}</p>
                    <p class="text-sm text-gray-500">${date}</p>
                </div>
                <div class="text-right">
                    <p class="font-semibold ${amountClass}">₹${sign}${Math.abs(tx.amount).toFixed(2)}</p>
                </div>
            </div>
        `;
    }).join('');
}

function setupCameraModal() {
    const modal = document.getElementById('camera-modal');
    const closeBtn = document.getElementById('close-modal');

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        document.getElementById('camera-iframe').src = '';
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            document.getElementById('camera-iframe').src = '';
        }
    });
}

function setupBuyCouponButton() {
    const buyCouponBtn = document.getElementById('buy-coupon-btn');
    buyCouponBtn.addEventListener('click', () => {
        window.location.href = 'payment.html';
    });
}

// Global function to open camera feed
window.openCameraFeed = function(bookingId, spotNumber, location, vehicle, time, cameraUrl) {
    const modal = document.getElementById('camera-modal');
    const iframe = document.getElementById('camera-iframe');
    
    document.getElementById('modal-spot-number').textContent = spotNumber;
    document.getElementById('modal-location').textContent = location;
    document.getElementById('modal-vehicle').textContent = vehicle;
    document.getElementById('modal-time').textContent = time;
    
    // Set camera feed URL with mute and autoplay parameters
    const urlParams = cameraUrl.includes('?') ? '&' : '?';
    iframe.src = `${cameraUrl}${urlParams}autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0`;
    
    // Store current booking data for alert
    modal.dataset.bookingId = bookingId;
    modal.dataset.spotNumber = spotNumber;
    modal.dataset.location = location;
    modal.dataset.vehicle = vehicle;
    
    // Setup screenshot and alert buttons
    setupSecurityAlertButtons(bookingId, spotNumber, location, vehicle);
    
    modal.classList.remove('hidden');
};

// Global function to show extend booking modal
window.showExtendBookingModal = function(bookingId, spotNumber) {
    const hours = prompt(`Extend booking for Spot ${spotNumber}\n\nEnter number of hours to extend:`);
    
    if (!hours || isNaN(hours) || hours < 1) {
        if (hours !== null) {
            alert('Please enter a valid number of hours (minimum 1)');
        }
        return;
    }
    
    extendBooking(bookingId, parseInt(hours));
};

async function extendBooking(bookingId, hours) {
    try {
        const { data, error } = await supabase.rpc('extend_booking', {
            p_booking_id: bookingId,
            p_extension_hours: hours
        });
        
        if (error) {
            console.error('Extension error:', error);
            alert('Error extending booking. Please try again.');
            return;
        }
        
        if (data.success) {
            alert(`Success! Booking extended by ${data.extension_hours} hours.\nCost: ₹${data.cost}\nNew end time: ${new Date(data.new_end_time).toLocaleString('en-IN')}`);
            window.location.reload();
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error('Extension error:', err);
        alert('Error extending booking. Please try again.');
    }
}

// Setup security alert buttons
function setupSecurityAlertButtons(bookingId, spotNumber, location, vehicle) {
    const takeScreenshotBtn = document.getElementById('take-screenshot-btn');
    const sendAlertBtn = document.getElementById('send-alert-btn');
    const alertMessage = document.getElementById('alert-message');
    
    let screenshotTaken = false;
    let screenshotData = null;
    
    // Take screenshot button
    takeScreenshotBtn.onclick = async () => {
        try {
            alertMessage.textContent = '📸 Capturing screenshot...';
            alertMessage.className = 'mt-3 text-sm text-blue-600 font-medium';
            
            // Create a canvas with information overlay
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            
            // Dark background
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add camera placeholder
            ctx.fillStyle = '#2d2d2d';
            ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 200);
            
            // Add "Live Feed" text in center
            ctx.fillStyle = '#666';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🎥 LIVE CAMERA FEED', canvas.width / 2, canvas.height / 2 - 60);
            
            ctx.font = '32px Arial';
            ctx.fillText('Security Alert Screenshot', canvas.width / 2, canvas.height / 2);
            
            // Add timestamp
            const now = new Date();
            ctx.font = '24px Arial';
            ctx.fillStyle = '#999';
            ctx.fillText(now.toLocaleString('en-IN'), canvas.width / 2, canvas.height / 2 + 50);
            
            // Add information overlay at bottom
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, canvas.height - 140, canvas.width, 140);
            
            // Add spot details
            ctx.fillStyle = '#000';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`📍 Spot: ${spotNumber}`, 50, canvas.height - 95);
            ctx.fillText(`📌 Location: ${location}`, 50, canvas.height - 55);
            
            ctx.textAlign = 'right';
            ctx.fillText(`🚗 Vehicle: ${vehicle}`, canvas.width - 50, canvas.height - 95);
            ctx.fillText(`⏰ ${now.toLocaleTimeString('en-IN')}`, canvas.width - 50, canvas.height - 55);
            
            // Add watermark
            ctx.font = '20px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('Klyra Parking Management System', canvas.width / 2, canvas.height - 15);
            
            // Convert to blob and download
            canvas.toBlob(async (blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                link.download = `parking-alert-${spotNumber}-${timestamp}.png`;
                link.href = url;
                link.click();
                
                URL.revokeObjectURL(url);
                
                alertMessage.textContent = '📸 Screenshot saved! Contains spot details and timestamp. You can now send the alert.';
                alertMessage.className = 'mt-3 text-sm text-green-600 font-medium';
                
                screenshotTaken = true;
                screenshotData = link.download;
                
                takeScreenshotBtn.innerHTML = '<i class="fa fa-check"></i> Screenshot Taken';
                takeScreenshotBtn.classList.remove('bg-orange-600', 'hover:bg-orange-700');
                takeScreenshotBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            }, 'image/png');
            
        } catch (err) {
            console.error('Screenshot error:', err);
            alertMessage.textContent = '❌ Error taking screenshot. Please try again.';
            alertMessage.className = 'mt-3 text-sm text-red-600';
        }
    };
    
    // Send alert button
    sendAlertBtn.onclick = async () => {
        const description = prompt('Describe the unusual activity you observed:');
        
        if (!description || description.trim() === '') {
            alertMessage.textContent = '⚠️ Please provide a description of the activity.';
            alertMessage.className = 'mt-3 text-sm text-yellow-600';
            return;
        }
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                alertMessage.textContent = '❌ You must be logged in to send alerts.';
                alertMessage.className = 'mt-3 text-sm text-red-600';
                return;
            }
            
            // Get spot_id from booking
            const { data: booking } = await supabase
                .from('bookings')
                .select('spot_id')
                .eq('id', bookingId)
                .single();
            
            // Insert security alert
            const { data, error } = await supabase
                .from('security_alerts')
                .insert([{
                    user_id: user.id,
                    booking_id: bookingId,
                    spot_id: booking.spot_id,
                    spot_number: spotNumber,
                    location: location,
                    vehicle_number: vehicle,
                    screenshot_url: screenshotTaken ? screenshotData : null,
                    description: description.trim(),
                    status: 'pending'
                }])
                .select();
            
            if (error) throw error;
            
            alertMessage.textContent = '✅ Alert sent successfully! Admin team has been notified.';
            alertMessage.className = 'mt-3 text-sm text-green-600 font-medium';
            
            sendAlertBtn.disabled = true;
            sendAlertBtn.classList.add('opacity-50', 'cursor-not-allowed');
            sendAlertBtn.innerHTML = '<i class="fa fa-check"></i> Alert Sent';
            
            // Reset screenshot button
            setTimeout(() => {
                screenshotTaken = false;
                screenshotData = null;
                takeScreenshotBtn.innerHTML = '<i class="fa fa-camera"></i> Take Screenshot';
                takeScreenshotBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                takeScreenshotBtn.classList.add('bg-orange-600', 'hover:bg-orange-700');
            }, 3000);
            
        } catch (err) {
            console.error('Alert error:', err);
            alertMessage.textContent = '❌ Error sending alert. Please try again.';
            alertMessage.className = 'mt-3 text-sm text-red-600';
        }
    };
}
