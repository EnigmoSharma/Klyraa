import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', function() {
    // Select form elements
    const contactForm = document.getElementById('contactForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const subjectInput = document.getElementById('subject');
    const messageInput = document.getElementById('message');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = contactForm.querySelector('button[type="submit"]');

    if (!contactForm || !nameInput || !emailInput || !subjectInput || !messageInput) {
        console.error('Contact form elements not found in DOM');
        return;
    }

    // Email validation regex for Gmail and Yahoo
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

    // Function to count words
    const wordCount = (str) => str.trim().split(/\s+/).filter(Boolean).length;

    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const subject = subjectInput.value.trim();
        const message = messageInput.value.trim();

        // Name required
        if (!name) {
            alert('Please enter your name.');
            return;
        }

        // Email validation
        if (!emailRegex.test(email)) {
            alert('Please enter a valid Gmail or Yahoo email (e.g., username@gmail.com or username@yahoo.com).');
            return;
        }

        // Subject word limit
        if (wordCount(subject) > 50) {
            alert('Subject cannot exceed 50 words.');
            return;
        }

        // Message word limit
        if (wordCount(message) > 500) {
            alert('Message cannot exceed 500 words.');
            return;
        }

        // Disable button and save to database
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        successMessage.classList.add('hidden');
        errorMessage.classList.add('hidden');

        saveContactRequest(name, email, subject, message);
    });

    // Function to save contact request to database
    async function saveContactRequest(name, email, subject, message) {
        try {
            const { data, error } = await supabase
                .from('contact_us_requests')
                .insert([{
                    name: name,
                    email: email,
                    subject: subject,
                    message: message
                }]);

            if (error) throw error;

            // Clear form
            nameInput.value = '';
            emailInput.value = '';
            subjectInput.value = '';
            messageInput.value = '';

            successMessage.classList.remove('hidden');
            setTimeout(() => successMessage.classList.add('hidden'), 5000);
        } catch (error) {
            console.error('Contact form error:', error);
            errorMessage.classList.remove('hidden');
            setTimeout(() => errorMessage.classList.add('hidden'), 5000);
        } finally {
            submitBtn.textContent = 'Send Message';
            submitBtn.disabled = false;
        }
    }

    // Optional: Real-time validation feedback (for UX)
    emailInput.addEventListener('input', () => {
        if (emailRegex.test(emailInput.value.trim().toLowerCase())) {
            emailInput.classList.remove('border-red-500');
        } else {
            emailInput.classList.add('border-red-500');
        }
    });

    subjectInput.addEventListener('input', () => {
        if (wordCount(subjectInput.value) > 50) {
            subjectInput.classList.add('border-red-500');
        } else {
            subjectInput.classList.remove('border-red-500');
        }
    });

    messageInput.addEventListener('input', () => {
        if (wordCount(messageInput.value) > 500) {
            messageInput.classList.add('border-red-500');
        } else {
            messageInput.classList.remove('border-red-500');
        }
    });
});
