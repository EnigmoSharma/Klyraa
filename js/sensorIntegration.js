import { supabase } from './supabaseClient.js';

// Sensor Integration Module for Overstay Detection
class SensorIntegration {
    constructor() {
        this.checkInterval = 30000; // Check every 30 seconds
        this.isMonitoring = false;
        this.intervalId = null;
    }

    // Start monitoring sensors
    async startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('Sensor monitoring started');
        
        // Initial check
        await this.checkSensors();
        
        // Set up periodic checks
        this.intervalId = setInterval(async () => {
            await this.checkSensors();
        }, this.checkInterval);
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isMonitoring = false;
        console.log('Sensor monitoring stopped');
    }

    // Check all sensors for overstay conditions
    async checkSensors() {
        try {
            // Get all recent sensor data
            const { data: sensorData, error: sensorError } = await supabase
                .from('sensor_data')
                .select('*')
                .gte('updated_at', new Date(Date.now() - 120000).toISOString()); // Last 2 minutes

            if (sensorError) {
                console.error('Error fetching sensor data:', sensorError);
                return;
            }

            if (!sensorData || sensorData.length === 0) {
                return;
            }

            // Process each sensor reading
            for (const sensor of sensorData) {
                if (sensor.obstacle === true) {
                    await this.checkForOverstay(sensor);
                } else {
                    await this.checkForDeparture(sensor);
                }
            }
        } catch (err) {
            console.error('Sensor check error:', err);
        }
    }

    // Check if an occupied sensor indicates overstay
    async checkForOverstay(sensor) {
        try {
            // Find parking spot with this sensor
            const { data: spot, error: spotError } = await supabase
                .from('parking_spots')
                .select('*')
                .eq('sensor_id', sensor.id)
                .single();

            if (spotError || !spot) {
                return;
            }

            // Check for active bookings that have ended
            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('*')
                .eq('spot_id', spot.id)
                .eq('status', 'active')
                .lt('end_time', new Date().toISOString())
                .order('end_time', { ascending: false })
                .limit(1);

            if (bookingError || !bookings || bookings.length === 0) {
                return;
            }

            const booking = bookings[0];
            const endTime = new Date(booking.end_time);
            const now = new Date();
            const overstayMinutes = Math.round((now - endTime) / 60000);

            // If overstaying more than 5 minutes, handle it
            if (overstayMinutes > 5) {
                console.log(`Overstay detected for booking ${booking.id} at spot ${spot.spot_number}`);
                
                // Call the handle_overstay_enhanced function
                const { data, error } = await supabase.rpc('handle_overstay_enhanced', {
                    p_spot_id: spot.id,
                    p_current_time: now.toISOString()
                });

                if (error) {
                    console.error('Error handling overstay:', error);
                } else if (data && data.success) {
                    console.log('Overstay handled:', data);
                    
                    // Trigger notifications through overstay monitor
                    if (window.overstayMonitor) {
                        window.overstayMonitor.processOverstayResult(data);
                    }
                }
            }
        } catch (err) {
            console.error('Error checking for overstay:', err);
        }
    }

    // Check if a vehicle has left (sensor no longer detects obstacle)
    async checkForDeparture(sensor) {
        try {
            // Find parking spot with this sensor
            const { data: spot, error: spotError } = await supabase
                .from('parking_spots')
                .select('*')
                .eq('sensor_id', sensor.id)
                .single();

            if (spotError || !spot) {
                return;
            }

            // Check for active bookings (including overstaying ones)
            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('*')
                .eq('spot_id', spot.id)
                .eq('status', 'active')
                .lte('start_time', new Date().toISOString())
                .order('start_time', { ascending: false })
                .limit(1);

            if (bookingError || !bookings || bookings.length === 0) {
                return;
            }

            const booking = bookings[0];
            console.log(`Vehicle departure detected for booking ${booking.id} at spot ${spot.spot_number}`);

            // Call the complete_booking_on_departure function
            const { data, error } = await supabase.rpc('complete_booking_on_departure', {
                p_spot_id: spot.id
            });

            if (error) {
                console.error('Error completing booking on departure:', error);
            } else if (data && data.success) {
                console.log('Booking completed:', data);
                
                // If there was pending debt, notify user
                if (data.pending_debt > 0) {
                    if (window.overstayMonitor) {
                        window.overstayMonitor.showNotification(
                            'Booking Completed',
                            `Your booking has ended. You have a pending debt of ₹${data.pending_debt.toFixed(2)} from overstay charges.`,
                            'warning'
                        );
                    }
                }
                
                // Refresh dashboard if user is on it
                if (window.location.pathname.includes('dashboard')) {
                    window.dispatchEvent(new CustomEvent('refreshBookings'));
                }
            }
        } catch (err) {
            console.error('Error checking for departure:', err);
        }
    }

    // Manually trigger overstay check for a specific spot
    async checkSpotOverstay(spotId) {
        try {
            const { data, error } = await supabase.rpc('handle_overstay_enhanced', {
                p_spot_id: spotId,
                p_current_time: new Date().toISOString()
            });

            if (error) {
                console.error('Error checking spot overstay:', error);
                return { success: false, error: error.message };
            }

            return data;
        } catch (err) {
            console.error('Error in checkSpotOverstay:', err);
            return { success: false, error: err.message };
        }
    }
}

// Create global instance
const sensorIntegration = new SensorIntegration();

// Export for use in other modules
export { sensorIntegration };

// Auto-start monitoring if on admin page
if (window.location.pathname.includes('admin')) {
    document.addEventListener('DOMContentLoaded', () => {
        sensorIntegration.startMonitoring();
    });

    window.addEventListener('beforeunload', () => {
        sensorIntegration.stopMonitoring();
    });
}
