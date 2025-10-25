-- =====================================================
-- ENHANCED OVERSTAY MANAGEMENT SYSTEM
-- =====================================================

-- Add new columns to profiles table to allow negative balance tracking
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pending_debt DECIMAL(10, 2) DEFAULT 0;

-- Add notification tracking to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reassigned_from UUID REFERENCES parking_spots(id),
ADD COLUMN IF NOT EXISTS reassignment_notified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cancellation_notified BOOLEAN DEFAULT FALSE;

-- =====================================================
-- FUNCTION: Enhanced Overstay Detection and Handling
-- =====================================================
CREATE OR REPLACE FUNCTION handle_overstay_enhanced(
    p_spot_id UUID,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
    v_current_booking RECORD;
    v_affected_booking RECORD;
    v_alternative_spot RECORD;
    v_overstay_minutes INTEGER;
    v_overstay_hours DECIMAL(10, 2);
    v_hourly_charge DECIMAL(10, 2) := 50;
    v_penalty_per_hour DECIMAL(10, 2) := 30;
    v_total_overstay_cost DECIMAL(10, 2);
    v_compensation DECIMAL(10, 2) := 50; -- Fixed compensation for affected users
    v_user_balance DECIMAL(10, 2);
    v_result JSON;
    v_affected_users JSON[] := '{}';
    v_reassignments JSON[] := '{}';
    v_cancellations JSON[] := '{}';
BEGIN
    -- Find current booking that should have ended but hasn't (overstaying)
    SELECT * INTO v_current_booking
    FROM bookings
    WHERE spot_id = p_spot_id
      AND status = 'active'
      AND end_time < p_current_time
      AND (actual_end_time IS NULL OR actual_end_time > p_current_time)
    ORDER BY end_time DESC
    LIMIT 1;
    
    IF v_current_booking.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'No overstaying booking found');
    END IF;
    
    -- Calculate overstay duration
    v_overstay_minutes := EXTRACT(EPOCH FROM (p_current_time - v_current_booking.end_time)) / 60;
    v_overstay_hours := v_overstay_minutes / 60.0;
    
    -- Only process if overstay is more than 5 minutes (grace period)
    IF v_overstay_minutes < 5 THEN
        RETURN json_build_object('success', false, 'message', 'Within grace period');
    END IF;
    
    -- Calculate overstay cost
    v_total_overstay_cost := v_overstay_hours * (v_hourly_charge + v_penalty_per_hour);
    
    -- Update overstaying booking to show overstay but keep as 'active' (ongoing)
    UPDATE bookings
    SET overstay_hours = v_overstay_hours,
        overstay_penalty = v_total_overstay_cost,
        actual_end_time = NULL -- Keep NULL to show it's still ongoing
    WHERE id = v_current_booking.id;
    
    -- Find all affected bookings (bookings that should have started or are about to start)
    FOR v_affected_booking IN
        SELECT * FROM bookings
        WHERE spot_id = p_spot_id
          AND id != v_current_booking.id
          AND status = 'active'
          AND start_time <= p_current_time + INTERVAL '30 minutes' -- Include bookings starting soon
          AND start_time > v_current_booking.end_time
        ORDER BY start_time
    LOOP
        -- Try to find an alternative spot
        SELECT ps.* INTO v_alternative_spot
        FROM parking_spots ps
        WHERE ps.id != p_spot_id
          AND ps.is_available = true
          AND ps.location = (SELECT location FROM parking_spots WHERE id = p_spot_id)
          AND NOT EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.spot_id = ps.id
                AND b.status = 'active'
                AND (
                    (b.start_time <= v_affected_booking.start_time AND b.buffer_end_time > v_affected_booking.start_time)
                    OR (b.start_time < v_affected_booking.end_time AND b.buffer_end_time >= v_affected_booking.end_time)
                )
          )
          AND NOT EXISTS (
              SELECT 1 FROM sensor_data sd
              WHERE sd.id = ps.sensor_id
                AND sd.obstacle = true
                AND sd.updated_at > p_current_time - INTERVAL '5 minutes'
          )
        LIMIT 1;
        
        IF v_alternative_spot.id IS NOT NULL THEN
            -- Reassign to alternative spot
            UPDATE bookings
            SET spot_id = v_alternative_spot.id,
                reassigned_from = p_spot_id,
                reassignment_notified = false,
                cancellation_reason = 'Reassigned to Spot ' || v_alternative_spot.spot_number || 
                                    ' due to previous booking overstay. No additional charges.'
            WHERE id = v_affected_booking.id;
            
            v_reassignments := array_append(v_reassignments, json_build_object(
                'booking_id', v_affected_booking.id,
                'user_id', v_affected_booking.user_id,
                'old_spot', p_spot_id,
                'new_spot', v_alternative_spot.id,
                'new_spot_number', v_alternative_spot.spot_number
            ));
        ELSE
            -- No alternative spot available - cancel booking
            UPDATE bookings
            SET status = 'cancelled',
                cancellation_notified = false,
                cancellation_reason = 'Cancelled due to previous booking overstay. Full refund + ₹' || 
                                    v_compensation || ' compensation will be processed.'
            WHERE id = v_affected_booking.id;
            
            -- Process refund with compensation
            UPDATE profiles
            SET credit_balance = credit_balance + v_affected_booking.total_cost + v_compensation
            WHERE id = v_affected_booking.user_id;
            
            -- Add refund transaction
            INSERT INTO transaction_history (user_id, amount, description)
            VALUES (
                v_affected_booking.user_id,
                v_affected_booking.total_cost + v_compensation,
                'Booking Cancelled (Overstay) - Refund + ₹' || v_compensation || ' compensation'
            );
            
            v_cancellations := array_append(v_cancellations, json_build_object(
                'booking_id', v_affected_booking.id,
                'user_id', v_affected_booking.user_id,
                'refund_amount', v_affected_booking.total_cost,
                'compensation', v_compensation
            ));
        END IF;
    END LOOP;
    
    -- Charge overstaying user (allow negative balance)
    SELECT credit_balance INTO v_user_balance
    FROM profiles
    WHERE id = v_current_booking.user_id;
    
    IF v_user_balance >= v_total_overstay_cost THEN
        -- Deduct from balance
        UPDATE profiles
        SET credit_balance = credit_balance - v_total_overstay_cost
        WHERE id = v_current_booking.user_id;
    ELSE
        -- Set balance to 0 and track debt
        UPDATE profiles
        SET credit_balance = 0,
            pending_debt = pending_debt + (v_total_overstay_cost - v_user_balance)
        WHERE id = v_current_booking.user_id;
    END IF;
    
    -- Add penalty transaction
    INSERT INTO transaction_history (user_id, amount, description)
    VALUES (
        v_current_booking.user_id,
        -v_total_overstay_cost,
        'Overstay Penalty - ' || ROUND(v_overstay_hours, 2) || ' hours (₹50/hr + ₹30 penalty/hr)'
    );
    
    RETURN json_build_object(
        'success', true,
        'overstaying_booking_id', v_current_booking.id,
        'overstay_minutes', v_overstay_minutes,
        'overstay_cost', v_total_overstay_cost,
        'reassignments', v_reassignments,
        'cancellations', v_cancellations,
        'message', 'Overstay handled successfully'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Check and Handle All Overstays
-- To be called periodically (e.g., every minute)
-- =====================================================
CREATE OR REPLACE FUNCTION check_all_overstays()
RETURNS JSON AS $$
DECLARE
    v_spot RECORD;
    v_sensor RECORD;
    v_result JSON;
    v_all_results JSON[] := '{}';
    v_booking RECORD;
BEGIN
    -- Check all spots with sensors for overstays
    FOR v_spot IN
        SELECT ps.* 
        FROM parking_spots ps
        WHERE ps.sensor_id IS NOT NULL
    LOOP
        -- Get sensor data
        SELECT * INTO v_sensor
        FROM sensor_data
        WHERE id = v_spot.sensor_id
          AND updated_at > NOW() - INTERVAL '5 minutes'; -- Only consider recent sensor data
        
        IF v_sensor.id IS NOT NULL AND v_sensor.obstacle = true THEN
            -- Sensor shows occupied, check for overstay
            SELECT * INTO v_booking
            FROM bookings
            WHERE spot_id = v_spot.id
              AND status = 'active'
              AND end_time < NOW()
            ORDER BY end_time DESC
            LIMIT 1;
            
            IF v_booking.id IS NOT NULL THEN
                -- Handle overstay
                v_result := handle_overstay_enhanced(v_spot.id, NOW());
                IF (v_result->>'success')::boolean THEN
                    v_all_results := array_append(v_all_results, v_result);
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'overstays_processed', array_length(v_all_results, 1),
        'results', v_all_results
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Complete Booking When Vehicle Leaves
-- =====================================================
CREATE OR REPLACE FUNCTION complete_booking_on_departure(
    p_spot_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_booking RECORD;
    v_final_cost DECIMAL(10, 2);
    v_pending_debt DECIMAL(10, 2);
BEGIN
    -- Find the active/overstaying booking
    SELECT * INTO v_booking
    FROM bookings
    WHERE spot_id = p_spot_id
      AND status = 'active'
      AND start_time <= NOW()
    ORDER BY start_time DESC
    LIMIT 1;
    
    IF v_booking.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'No active booking found');
    END IF;
    
    -- Calculate final cost including any overstay
    v_final_cost := v_booking.total_cost + COALESCE(v_booking.overstay_penalty, 0);
    
    -- Update booking to completed
    UPDATE bookings
    SET status = 'completed',
        actual_end_time = NOW()
    WHERE id = v_booking.id;
    
    -- Check if user has pending debt from this overstay
    SELECT pending_debt INTO v_pending_debt
    FROM profiles
    WHERE id = v_booking.user_id;
    
    RETURN json_build_object(
        'success', true,
        'booking_id', v_booking.id,
        'total_charged', v_final_cost,
        'pending_debt', v_pending_debt,
        'message', 'Booking completed successfully'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Handle Top-up with Pending Debt
-- =====================================================
CREATE OR REPLACE FUNCTION handle_topup_with_debt(
    p_user_id UUID,
    p_amount DECIMAL(10, 2)
)
RETURNS JSON AS $$
DECLARE
    v_pending_debt DECIMAL(10, 2);
    v_amount_after_debt DECIMAL(10, 2);
BEGIN
    -- Get pending debt
    SELECT pending_debt INTO v_pending_debt
    FROM profiles
    WHERE id = p_user_id;
    
    IF v_pending_debt > 0 THEN
        IF p_amount > v_pending_debt THEN
            -- Pay off debt and add remainder to balance
            v_amount_after_debt := p_amount - v_pending_debt;
            
            UPDATE profiles
            SET credit_balance = credit_balance + v_amount_after_debt,
                pending_debt = 0
            WHERE id = p_user_id;
            
            -- Add transaction for debt payment
            INSERT INTO transaction_history (user_id, amount, description)
            VALUES (p_user_id, -v_pending_debt, 'Pending debt cleared from top-up');
            
            -- Add transaction for balance addition
            INSERT INTO transaction_history (user_id, amount, description)
            VALUES (p_user_id, v_amount_after_debt, 'Balance added after debt clearance');
        ELSE
            -- Reduce debt
            UPDATE profiles
            SET pending_debt = pending_debt - p_amount
            WHERE id = p_user_id;
            
            -- Add transaction for debt reduction
            INSERT INTO transaction_history (user_id, amount, description)
            VALUES (p_user_id, -p_amount, 'Partial debt payment');
            
            v_amount_after_debt := 0;
        END IF;
    ELSE
        -- No debt, add full amount to balance
        UPDATE profiles
        SET credit_balance = credit_balance + p_amount
        WHERE id = p_user_id;
        
        -- Add transaction
        INSERT INTO transaction_history (user_id, amount, description)
        VALUES (p_user_id, p_amount, 'Balance top-up');
        
        v_amount_after_debt := p_amount;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'debt_paid', LEAST(v_pending_debt, p_amount),
        'balance_added', v_amount_after_debt,
        'remaining_debt', GREATEST(0, v_pending_debt - p_amount)
    );
END;
$$ LANGUAGE plpgsql;
