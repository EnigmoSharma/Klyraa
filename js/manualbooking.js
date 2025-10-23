import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', function() {
    const manualBookingForm = document.getElementById('manual-booking-form');
    const phoneInput = document.getElementById('phone-input');
    const callbackBtn = document.getElementById('callback-btn');

    if (!manualBookingForm || !phoneInput || !callbackBtn) {
        console.error('Manual booking elements not found in DOM');
        return;
    }

    // Allow only digits, up to 10 characters
    phoneInput.addEventListener('input', function(e) {
        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
        e.target.value = value;
    });

    // Handle form submission
    manualBookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const phone = phoneInput.value.trim();

        // Validation checks
        const isTenDigits = /^\d{10}$/.test(phone);
        const isValidStart = /^[6-9]/.test(phone); // Indian numbers start with 6–9
        const isNotRepeated = !/^(\d)\1{9}$/.test(phone); // not same digit repeated

        if (!isTenDigits || !isValidStart || !isNotRepeated) {
            alert('Please enter a valid 10-digit mobile number');
            return;
        }

        // Save to database
        callbackBtn.textContent = 'Submitting...';
        callbackBtn.disabled = true;

        saveCallbackRequest(phone);
    });

    // Function to save callback request to database
    async function saveCallbackRequest(mobileNumber) {
        try {
            const { data, error } = await supabase
                .from('callback_requests')
                .insert([{
                    mobile_number: mobileNumber,
                    description: 'Manual booking callback request from homepage'
                }]);

            if (error) throw error;

            alert('✅ Callback requested! We will contact you shortly at ' + mobileNumber);
            phoneInput.value = '';
        } catch (error) {
            console.error('Callback request error:', error);
            alert('Failed to submit callback request. Please try again.');
        } finally {
            callbackBtn.textContent = 'Request a CallBack';
            callbackBtn.disabled = false;
        }
    }
});