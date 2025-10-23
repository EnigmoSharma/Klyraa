import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', function() {
    const bookingForm = document.getElementById('booking-form');
    if (!bookingForm) return;

    const spotSelect = document.getElementById('spot-select');
    const dateInput = document.getElementById('date-input');
    const timeInput = document.getElementById('time-input');
    const durationInput = document.getElementById('duration-input');
    const durationType = document.getElementById('duration-type');
    const bookBtn = document.getElementById('book-btn');

    // Fetch and populate available spots from database
    async function loadAvailableSpots() {
        try {
            // Get all available parking spots with sensor data
            const { data: spots, error } = await supabase
                .from('parking_spots')
                .select(`
                    id, 
                    spot_number, 
                    location, 
                    is_available,
                    sensor_id
                `)
                .eq('is_available', true)
                .order('spot_number');

            if (error) throw error;

            // Get all sensor data
            const { data: sensors, error: sensorError } = await supabase
                .from('sensor_data')
                .select('id, obstacle, updated_at');

            const sensorMap = {};
            if (!sensorError && sensors) {
                sensors.forEach(s => {
                    sensorMap[s.id] = s;
                });
            }

            spotSelect.innerHTML = '<option value="">Select a spot</option>';
            
            if (spots && spots.length > 0) {
                const now = new Date();
                
                spots.forEach(spot => {
                    const opt = document.createElement('option');
                    opt.value = spot.id;
                    
                    // Check if spot has sensor and is currently occupied
                    let statusText = '';
                    if (spot.sensor_id && sensorMap[spot.sensor_id]) {
                        const sensor = sensorMap[spot.sensor_id];
                        const sensorUpdateTime = new Date(sensor.updated_at);
                        const sensorAge = (now - sensorUpdateTime) / (1000 * 60); // minutes
                        
                        // If sensor updated recently (within 2 min) and shows occupied
                        if (sensorAge < 2 && sensor.obstacle === true) {
                            statusText = ' [Currently Occupied]';
                            opt.disabled = true;
                            opt.style.color = '#999';
                        }
                    }
                    
                    opt.textContent = `${spot.spot_number} - ${spot.location}${statusText}`;
                    opt.dataset.spotNumber = spot.spot_number;
                    spotSelect.appendChild(opt);
                });
            } else {
                spotSelect.innerHTML = '<option value="">No spots available</option>';
            }
        } catch (error) {
            console.error('Error loading spots:', error);
            alert('Error loading parking spots. Please refresh the page.');
        }
    }

    // Load spots on page load
    loadAvailableSpots();

    // Date min/max
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setMonth(today.getMonth() + 1);

    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    dateInput.min = formatDate(today);
    dateInput.max = formatDate(maxDate);
    dateInput.value = formatDate(today);

    // Set default time to current time
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    timeInput.value = currentTime;

    // Duration limits
    const updateDurationLimits = () => {
        if (durationType.value === 'hours') { durationInput.min=1; durationInput.max=24; durationInput.placeholder='Number of hours'; }
        else { durationInput.min=1; durationInput.max=28; durationInput.placeholder='Number of days'; }
        durationInput.value = '';
    };
    durationType.addEventListener('change', updateDurationLimits);
    updateDurationLimits();

    // Booking submit
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check login
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Please login to book a spot');
            window.location.href = 'auth.html';
            return;
        }

        const bookingData = {
            spot: spotSelect.value,
            date: dateInput.value,
            time: timeInput.value,
            duration: parseInt(durationInput.value),
            durationType: durationType.value
        };

        if (!bookingData.spot || !bookingData.date || !bookingData.time || !bookingData.duration) {
            alert('Please fill all booking details');
            return;
        }

        const todayOnly = new Date(); todayOnly.setHours(0,0,0,0);
        const selected = new Date(bookingData.date); selected.setHours(0,0,0,0);

        if (selected < todayOnly) { alert('Cannot select past date'); return; }
        if (selected > maxDate) { alert('Booking only allowed within 1 month'); return; }

        const min = parseInt(durationInput.min);
        const max = parseInt(durationInput.max);
        if (bookingData.duration < min || bookingData.duration > max) {
            alert(`Duration must be between ${min} and ${max} ${bookingData.durationType}`);
            return;
        }

        bookBtn.textContent='Booking...'; bookBtn.disabled=true;

        try {
            // Parse the selected time
            const [startHours, startMinutes] = bookingData.time.split(':').map(Number);
            
            // Calculate start and end times
            const startTime = new Date(bookingData.date);
            startTime.setHours(startHours, startMinutes, 0, 0);
            
            // Validate that start time is not in the past
            const now = new Date();
            if (startTime < now) {
                alert('Cannot book for a past time. Please select a future date and time.');
                bookBtn.textContent='Book Spot'; 
                bookBtn.disabled=false;
                return;
            }
            
            const endTime = new Date(startTime);
            if (bookingData.durationType === 'hours') {
                endTime.setHours(endTime.getHours() + bookingData.duration);
            } else {
                endTime.setDate(endTime.getDate() + bookingData.duration);
            }

            // Calculate cost (₹50 per hour)
            const hours = (endTime - startTime) / (1000 * 60 * 60);
            const totalCost = hours * 50;

            // Check if booking starts now or very soon (within 5 minutes)
            const timeDiff = (startTime - now) / (1000 * 60); // difference in minutes
            const isImmediateBooking = timeDiff <= 5;

            // If immediate booking, check sensor status
            if (isImmediateBooking) {
                // Get parking spot's sensor_id
                const { data: spotData, error: spotError } = await supabase
                    .from('parking_spots')
                    .select('sensor_id, spot_number')
                    .eq('id', bookingData.spot)
                    .single();

                if (spotError) throw spotError;

                // Check sensor data if sensor_id exists
                if (spotData.sensor_id) {
                    const { data: sensorData, error: sensorError } = await supabase
                        .from('sensor_data')
                        .select('obstacle, updated_at')
                        .eq('id', spotData.sensor_id)
                        .single();

                    if (!sensorError && sensorData) {
                        // Check if sensor was updated recently (within last 2 minutes)
                        const sensorUpdateTime = new Date(sensorData.updated_at);
                        const sensorAge = (now - sensorUpdateTime) / (1000 * 60); // minutes

                        if (sensorAge < 2 && sensorData.obstacle === true) {
                            alert(`Cannot book spot ${spotData.spot_number}. The spot is currently occupied (sensor detected a vehicle). Please choose another spot or try again later.`);
                            bookBtn.textContent='Book Spot'; 
                            bookBtn.disabled=false;
                            return;
                        }
                    }
                }
            }

            // Get user profile to check balance
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('credit_balance')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            if (profile.credit_balance < totalCost) {
                alert(`Insufficient balance! You need ₹${totalCost.toFixed(2)} but have ₹${profile.credit_balance.toFixed(2)}`);
                bookBtn.textContent='Book Spot'; 
                bookBtn.disabled=false;
                return;
            }

            // Prompt for vehicle number
            const vehicleNumber = prompt('Enter your vehicle number:');
            if (!vehicleNumber) {
                bookBtn.textContent='Book Spot'; 
                bookBtn.disabled=false;
                return;
            }

            // Create booking
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .insert([{
                    user_id: user.id,
                    spot_id: bookingData.spot,
                    vehicle_number: vehicleNumber.toUpperCase(),
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    total_cost: totalCost,
                    status: 'active'
                }])
                .select()
                .single();

            if (bookingError) {
                if (bookingError.code === '23P01') {
                    alert('This spot is already booked for the selected time (including 30-minute buffer). Please choose a different time or spot.');
                } else {
                    throw bookingError;
                }
                bookBtn.textContent='Book Spot'; 
                bookBtn.disabled=false;
                return;
            }

            // Deduct cost from balance
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ credit_balance: profile.credit_balance - totalCost })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Add transaction record
            await supabase
                .from('transaction_history')
                .insert([{
                    user_id: user.id,
                    amount: -totalCost,
                    description: `Parking Booking - ${spotSelect.options[spotSelect.selectedIndex].dataset.spotNumber}`
                }]);

            alert(`✅ Booking successful!\nSpot: ${spotSelect.options[spotSelect.selectedIndex].text}\nCost: ₹${totalCost.toFixed(2)}\nVehicle: ${vehicleNumber}`);
            bookingForm.reset(); 
            updateDurationLimits();
            loadAvailableSpots(); // Reload spots
        } catch (error) {
            console.error('Booking error:', error);
            alert('Booking failed: ' + error.message);
        } finally {
            bookBtn.textContent='Book Spot'; 
            bookBtn.disabled=false;
        }
    });
});