import { supabase } from './supabaseClient.js';

// Overstay monitoring system
class OverstayMonitor {
    constructor() {
        this.checkInterval = 60000; // Check every minute
        this.isMonitoring = false;
        this.intervalId = null;
    }

    // Start monitoring for overstays
    async startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('Overstay monitoring started');
        
        // Initial check
        await this.checkOverstays();
        
        // Set up periodic checks
        this.intervalId = setInterval(async () => {
            await this.checkOverstays();
        }, this.checkInterval);
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isMonitoring = false;
        console.log('Overstay monitoring stopped');
    }

    // Check for overstays
    async checkOverstays() {
        try {
            // Call the database function to check all overstays
            const { data, error } = await supabase.rpc('check_all_overstays');
            
            if (error) {
                console.error('Error checking overstays:', error);
                return;
            }

            if (data && data.success && data.overstays_processed > 0) {
                console.log(`Processed ${data.overstays_processed} overstays`);
                
                // Process results and trigger notifications
                if (data.results && Array.isArray(data.results)) {
                    data.results.forEach(result => {
                        this.processOverstayResult(result);
                    });
                }
            }
        } catch (err) {
            console.error('Overstay check error:', err);
        }
    }

    // Process individual overstay result
    processOverstayResult(result) {
        if (!result || !result.success) return;

        // Handle reassignments
        if (result.reassignments && result.reassignments.length > 0) {
            result.reassignments.forEach(reassignment => {
                this.notifyReassignment(reassignment);
            });
        }

        // Handle cancellations
        if (result.cancellations && result.cancellations.length > 0) {
            result.cancellations.forEach(cancellation => {
                this.notifyCancellation(cancellation);
            });
        }
    }

    // Notify user about reassignment
    async notifyReassignment(reassignment) {
        try {
            // Check if this is the current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || user.id !== reassignment.user_id) return;

            // Check if already notified
            const { data: booking } = await supabase
                .from('bookings')
                .select('reassignment_notified')
                .eq('id', reassignment.booking_id)
                .single();

            if (booking && !booking.reassignment_notified) {
                // Show notification
                this.showNotification(
                    'Booking Reassigned',
                    `Your booking has been reassigned to Spot ${reassignment.new_spot_number} due to a previous booking overstay. No additional charges apply.`,
                    'info'
                );

                // Mark as notified
                await supabase
                    .from('bookings')
                    .update({ reassignment_notified: true })
                    .eq('id', reassignment.booking_id);

                // Refresh dashboard
                this.refreshDashboard();
            }
        } catch (err) {
            console.error('Error notifying reassignment:', err);
        }
    }

    // Notify user about cancellation
    async notifyCancellation(cancellation) {
        try {
            // Check if this is the current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || user.id !== cancellation.user_id) return;

            // Check if already notified
            const { data: booking } = await supabase
                .from('bookings')
                .select('cancellation_notified')
                .eq('id', cancellation.booking_id)
                .single();

            if (booking && !booking.cancellation_notified) {
                // Show notification
                this.showNotification(
                    'Booking Cancelled',
                    `Your booking has been cancelled due to a previous booking overstay. You will receive a full refund of ₹${cancellation.refund_amount} plus ₹${cancellation.compensation} compensation.`,
                    'warning'
                );

                // Mark as notified
                await supabase
                    .from('bookings')
                    .update({ cancellation_notified: true })
                    .eq('id', cancellation.booking_id);

                // Refresh dashboard
                this.refreshDashboard();
            }
        } catch (err) {
            console.error('Error notifying cancellation:', err);
        }
    }

    // Show notification to user
    showNotification(title, message, type = 'info') {
        // Check if notification container exists, create if not
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }

        // Create notification element
        const notification = document.createElement('div');
        const bgColor = type === 'warning' ? 'bg-yellow-100 border-yellow-400 text-yellow-700' : 
                        type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : 
                        'bg-blue-100 border-blue-400 text-blue-700';
        
        notification.className = `${bgColor} border px-4 py-3 rounded relative max-w-md animate-slideIn`;
        notification.innerHTML = `
            <strong class="font-bold">${title}</strong>
            <span class="block sm:inline">${message}</span>
            <span class="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onclick="this.parentElement.remove()">
                <svg class="fill-current h-6 w-6" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <title>Close</title>
                    <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                </svg>
            </span>
        `;

        container.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    // Refresh dashboard
    refreshDashboard() {
        // Dispatch custom event to refresh bookings
        window.dispatchEvent(new CustomEvent('refreshBookings'));
        
        // If on dashboard page, reload bookings section
        if (window.location.pathname.includes('dashboard')) {
            const event = new Event('reloadBookings');
            document.dispatchEvent(event);
        }
    }

    // Check for pending debt when user logs in or tops up
    async checkPendingDebt(userId) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('pending_debt')
                .eq('id', userId)
                .single();

            if (profile && profile.pending_debt > 0) {
                this.showNotification(
                    'Pending Debt',
                    `You have a pending debt of ₹${profile.pending_debt.toFixed(2)} from overstay charges. This will be deducted from your next top-up.`,
                    'warning'
                );
                return profile.pending_debt;
            }
            return 0;
        } catch (err) {
            console.error('Error checking pending debt:', err);
            return 0;
        }
    }
}

// Create global instance
const overstayMonitor = new OverstayMonitor();

// Export for use in other modules
export { overstayMonitor };

// Add CSS for animations
if (!document.getElementById('overstay-styles')) {
    const style = document.createElement('style');
    style.id = 'overstay-styles';
    style.innerHTML = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .animate-slideIn {
            animation: slideIn 0.3s ease-out;
        }
    `;
    document.head.appendChild(style);
}
