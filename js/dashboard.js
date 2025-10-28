import { supabase } from './supabaseClient.js';
import { overstayMonitor } from './overstayMonitor.js';

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
        
        // Check for pending debt
        const pendingDebt = await overstayMonitor.checkPendingDebt(user.id);
        if (pendingDebt > 0) {
            // Show debt warning in balance section
            const balanceSection = document.getElementById('balance-amount').parentElement;
            if (!document.getElementById('debt-warning')) {
                const debtWarning = document.createElement('p');
                debtWarning.id = 'debt-warning';
                debtWarning.className = 'text-red-600 text-sm mt-1';
                debtWarning.innerHTML = `<i class="fa fa-warning"></i> Pending debt: ₹${pendingDebt.toFixed(2)}`;
                balanceSection.appendChild(debtWarning);
            }
        }
        
        // Start overstay monitoring
        overstayMonitor.startMonitoring();

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
        
        // Setup refresh bookings listener
        document.addEventListener('reloadBookings', async () => {
            const { data: updatedBookings } = await supabase
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
            
            displayBookings(updatedBookings || []);
        });
        
        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            overstayMonitor.stopMonitoring();
        });

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
        
        // Check if booking is overstaying (past end time but still active)
        if (now > endTime && booking.status === 'active') {
            booking.isOverstaying = true;
            ongoingBookings.push(booking); // Keep overstaying bookings in ongoing
        } else if (now >= startTime && now <= endTime) {
            ongoingBookings.push(booking);
        } else if (now < startTime) {
            // Check if this booking was reassigned
            if (booking.reassigned_from) {
                booking.isReassigned = true;
            }
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

function createBookingCard(booking, isOngoing = false) {
    const startTime = new Date(booking.start_time);
    const endTime = new Date(booking.end_time);
    const spotNumber = booking.parking_spots?.spot_number || 'Unknown';
    const location = booking.parking_spots?.location || 'Unknown';
    const cameraUrl = booking.parking_spots?.camera_feed_url || '';
    
    // Determine booking status and styling
    let statusBadge = '';
    let borderColor = 'border-blue-600';
    let extraInfo = '';
    
    if (booking.isOverstaying) {
        statusBadge = '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">OVERSTAYING</span>';
        borderColor = 'border-red-600';
        const overstayMinutes = Math.round((new Date() - endTime) / 60000);
        extraInfo = `
            <p class="text-sm text-red-600 font-semibold mt-2">
                <i class="fa fa-warning"></i> Overstaying by ${overstayMinutes} minutes
                ${booking.overstay_penalty ? `(Penalty: ₹${booking.overstay_penalty})` : ''}
            </p>
        `;
    } else if (isOngoing) {
        statusBadge = '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">ONGOING</span>';
        borderColor = 'border-green-600';
    } else if (booking.isReassigned) {
        statusBadge = '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">REASSIGNED</span>';
        borderColor = 'border-yellow-600';
        extraInfo = `
            <p class="text-sm text-yellow-700 mt-2">
                <i class="fa fa-info-circle"></i> ${booking.cancellation_reason || 'Reassigned to different spot'}
            </p>
        `;
    } else {
        statusBadge = '<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">UPCOMING</span>';
    }
    
    const liveButton = isOngoing && cameraUrl ? 
        `<button onclick="openCameraFeed('${booking.id}', '${spotNumber}', '${location}', '${booking.vehicle_number}', '${startTime.toLocaleString()} - ${endTime.toLocaleString()}', '${cameraUrl}')" 
                class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
            <i class="fa fa-video-camera"></i> Watch Live Feed
        </button>` : '';
    
    const extendButton = isOngoing && !booking.isOverstaying ?
        `<button onclick="showExtendBookingModal('${booking.id}', '${spotNumber}')" 
                class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
            <i class="fa fa-clock-o"></i> Extend Booking
        </button>` : '';
    
    return `
        <div class="border-l-4 ${borderColor} bg-white shadow-sm rounded-lg p-4 mb-3">
            <div class="flex justify-between items-start">
                <div class="flex-grow">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="fa fa-car text-blue-600"></i>
                        <h3 class="font-semibold">${booking.vehicle_number}</h3>
                        ${statusBadge}
                    </div>
                    <p class="text-sm text-gray-600">
                        <i class="fa fa-map-marker"></i> Spot ${spotNumber} - ${location}
                    </p>
                    <p class="text-sm text-gray-600">
                        <i class="fa fa-calendar"></i> ${startTime.toLocaleDateString()}
                    </p>
                    <p class="text-sm text-gray-600">
                        <i class="fa fa-clock-o"></i> ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}
                    </p>
                    <p class="text-sm font-semibold text-gray-700 mt-2">
                        Cost: ₹${booking.total_cost}
                    </p>
                    ${extraInfo}
                </div>
                <div class="flex flex-col gap-2">
                    ${liveButton}
                    ${extendButton}
                </div>
            </div>
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
    const sendAlertBtn = document.getElementById('send-alert-btn');
    const alertMessage = document.getElementById('alert-message');
    
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
                    screenshot_url: null,
                    description: description.trim(),
                    status: 'pending'
                }])
                .select();
            
            if (error) throw error;
            
            alertMessage.textContent = '✅ Alert sent successfully! Admin team has been notified. If you took a screenshot, please keep it for reference.';
            alertMessage.className = 'mt-3 text-sm text-green-600 font-medium';
            
            sendAlertBtn.disabled = true;
            sendAlertBtn.classList.add('opacity-50', 'cursor-not-allowed');
            sendAlertBtn.innerHTML = '<i class="fa fa-check"></i> Alert Sent';
            
        } catch (err) {
            console.error('Alert error:', err);
            alertMessage.textContent = '❌ Error sending alert. Please try again.';
            alertMessage.className = 'mt-3 text-sm text-red-600';
        }
    };
}
