import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is logged in
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
        window.location.href = 'auth.html';
        return;
    }

    const paymentForm = document.getElementById('payment-form');
    const customAmountInput = document.getElementById('custom-amount');
    const summaryAmount = document.getElementById('summary-amount');
    const summaryTotal = document.getElementById('summary-total');
    const payBtn = document.getElementById('pay-btn');
    const successMessage = document.getElementById('success-message');
    const successContent = document.getElementById('success-content');

    let selectedAmount = 0;

    // Handle preset amount buttons
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            document.querySelectorAll('.amount-btn').forEach(b => {
                b.classList.remove('border-blue-500', 'bg-blue-50');
                b.classList.add('border-gray-300');
            });
            
            // Add active class to clicked button
            this.classList.remove('border-gray-300');
            this.classList.add('border-blue-500', 'bg-blue-50');
            
            // Set amount
            selectedAmount = parseInt(this.dataset.amount);
            customAmountInput.value = '';
            updateSummary();
        });
    });

    // Handle custom amount input
    customAmountInput.addEventListener('input', function() {
        // Remove active class from preset buttons
        document.querySelectorAll('.amount-btn').forEach(b => {
            b.classList.remove('border-blue-500', 'bg-blue-50');
            b.classList.add('border-gray-300');
        });
        
        selectedAmount = parseInt(this.value) || 0;
        updateSummary();
    });

    function updateSummary() {
        summaryAmount.textContent = selectedAmount;
        summaryTotal.textContent = selectedAmount;
        payBtn.disabled = selectedAmount < 50;
    }

    // Handle form submission
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (selectedAmount < 50) {
            alert('Minimum amount is ₹50');
            return;
        }

        const recipient = document.querySelector('input[name="recipient"]:checked').value;
        
        payBtn.disabled = true;
        payBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>Processing...';

        try {
            if (recipient === 'self') {
                // Add directly to user's wallet
                await addToWallet(user.id, selectedAmount);
                
                successContent.innerHTML = `
                    <p class="text-green-700 mb-2">₹${selectedAmount} has been added to your wallet!</p>
                    <p class="text-sm text-gray-600">Your new balance will be reflected in your dashboard.</p>
                `;
            } else {
                // Generate coupon code for gifting
                const couponCode = await generateCoupon(selectedAmount);
                
                successContent.innerHTML = `
                    <p class="text-green-700 mb-2">Coupon generated successfully!</p>
                    <div class="bg-white border-2 border-green-500 rounded-lg p-4 my-3">
                        <p class="text-sm text-gray-600 mb-1">Coupon Code:</p>
                        <p class="text-2xl font-bold text-gray-900 font-mono">${couponCode}</p>
                        <p class="text-sm text-gray-600 mt-2">Value: ₹${selectedAmount}</p>
                    </div>
                    <p class="text-sm text-gray-600">Share this code with the recipient. It can be redeemed once.</p>
                    <button 
                        onclick="navigator.clipboard.writeText('${couponCode}')" 
                        class="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                        <i class="fa fa-copy mr-1"></i> Copy Code
                    </button>
                `;
            }

            // Show success message
            paymentForm.classList.add('hidden');
            successMessage.classList.remove('hidden');

        } catch (error) {
            console.error('Payment error:', error);
            alert('Payment failed. Please try again.');
            payBtn.disabled = false;
            payBtn.innerHTML = '<i class="fa fa-lock mr-2"></i>Proceed to Payment';
        }
    });

    async function addToWallet(userId, amount) {
        // Update user balance
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        const newBalance = parseFloat(profile.credit_balance) + amount;

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ credit_balance: newBalance })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Add transaction record
        const { error: txError } = await supabase
            .from('transaction_history')
            .insert([{
                user_id: userId,
                amount: amount,
                description: `Wallet Top-up - ₹${amount}`
            }]);

        if (txError) throw txError;
    }

    async function generateCoupon(amount) {
        // Generate random coupon code
        const code = 'KLYRA' + Math.random().toString(36).substring(2, 10).toUpperCase();

        // Insert coupon into database
        const { error } = await supabase
            .from('coupons')
            .insert([{
                code: code,
                amount: amount,
                max_uses: 1,
                used_count: 0,
                is_active: true
            }]);

        if (error) throw error;

        return code;
    }
});
