-- =====================================================
-- KLYRA PARKING MANAGEMENT SYSTEM - SIMPLIFIED SCHEMA
-- No RLS (Row Level Security)
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS transaction_history CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS sensor_data CASCADE;
DROP TABLE IF EXISTS parking_spots CASCADE;
DROP TABLE IF EXISTS callback_requests CASCADE;
DROP TABLE IF EXISTS contact_us_requests CASCADE;
DROP TABLE IF EXISTS security_alerts CASCADE;

-- =====================================================
-- ADMINS TABLE (Simple admin authentication)
-- =====================================================
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default admin (username: admin_klyraa, password: KlyraAdmin123)
INSERT INTO admins (username, password) VALUES ('admin_klyraa', 'KlyraAdmin123');

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    credit_balance DECIMAL(10, 2) DEFAULT 500.00 NOT NULL,
    pending_debt DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TRANSACTION HISTORY TABLE
-- =====================================================
CREATE TABLE transaction_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- COUPONS TABLE
-- =====================================================
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT valid_uses CHECK (used_count <= max_uses)
);

-- =====================================================
-- PARKING SPOTS TABLE
-- =====================================================
CREATE TABLE parking_spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spot_number TEXT UNIQUE NOT NULL,
    location TEXT NOT NULL,
    camera_feed_url TEXT,
    is_available BOOLEAN DEFAULT true NOT NULL,
    sensor_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- SENSOR DATA TABLE (for Arduino IR sensors)
-- =====================================================
CREATE TABLE sensor_data (
    id TEXT PRIMARY KEY,
    obstacle BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- BOOKINGS TABLE (with overlap prevention)
-- =====================================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
    vehicle_number TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    buffer_end_time TIMESTAMPTZ,
    total_cost DECIMAL(10, 2) NOT NULL,
    actual_end_time TIMESTAMPTZ,
    overstay_hours DECIMAL(10, 2) DEFAULT 0,
    overstay_penalty DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'cancelled', 'overstayed')),
    cancellation_reason TEXT,
    reassigned_from UUID REFERENCES parking_spots(id),
    reassignment_notified BOOLEAN DEFAULT FALSE,
    cancellation_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT valid_booking_time CHECK (end_time > start_time),
    -- Prevent overlapping bookings with 30-minute buffer
    EXCLUDE USING GIST (
        spot_id WITH =,
        tstzrange(start_time, buffer_end_time) WITH &&
    ) WHERE (status = 'active')
);

-- Trigger to automatically set buffer_end_time
CREATE OR REPLACE FUNCTION set_buffer_end_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.buffer_end_time := NEW.end_time + INTERVAL '30 minutes';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_buffer_trigger
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION set_buffer_end_time();

-- =====================================================
-- CALLBACK REQUESTS TABLE (Manual Booking)
-- =====================================================
CREATE TABLE callback_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile_number TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- CONTACT US REQUESTS TABLE
-- =====================================================
CREATE TABLE contact_us_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- SECURITY ALERTS TABLE
-- =====================================================
CREATE TABLE security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
    spot_number TEXT NOT NULL,
    location TEXT NOT NULL,
    vehicle_number TEXT,
    screenshot_url TEXT,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewing', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT
);

-- =====================================================
-- TRIGGER: Auto-create profile on signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert new profile with 500 credit balance
    INSERT INTO public.profiles (id, username, email, credit_balance)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'User'),
        NEW.email,
        500.00
    );
    
    -- Add signup bonus transaction
    INSERT INTO public.transaction_history (user_id, amount, description)
    VALUES (
        NEW.id,
        500.00,
        'Sign up Bonus'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FUNCTION: Redeem Coupon
-- =====================================================
CREATE OR REPLACE FUNCTION redeem_coupon(
    p_user_id UUID,
    p_coupon_code TEXT
)
RETURNS JSON AS $$
DECLARE
    v_coupon_id UUID;
    v_amount DECIMAL(10, 2);
    v_used_count INTEGER;
    v_max_uses INTEGER;
    v_is_active BOOLEAN;
BEGIN
    -- Get coupon details
    SELECT id, amount, used_count, max_uses, is_active
    INTO v_coupon_id, v_amount, v_used_count, v_max_uses, v_is_active
    FROM coupons
    WHERE code = p_coupon_code;
    
    -- Check if coupon exists
    IF v_coupon_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Invalid coupon code');
    END IF;
    
    -- Check if coupon is active
    IF NOT v_is_active THEN
        RETURN json_build_object('success', false, 'message', 'Coupon is no longer active');
    END IF;
    
    -- Check if coupon is still valid
    IF v_used_count >= v_max_uses THEN
        RETURN json_build_object('success', false, 'message', 'Coupon has reached maximum uses');
    END IF;
    
    -- Update coupon usage
    UPDATE coupons
    SET used_count = used_count + 1
    WHERE id = v_coupon_id;
    
    -- Add amount to user balance
    UPDATE profiles
    SET credit_balance = credit_balance + v_amount
    WHERE id = p_user_id;
    
    -- Add transaction record
    INSERT INTO transaction_history (user_id, amount, description)
    VALUES (p_user_id, v_amount, 'Coupon Redeemed: ' || p_coupon_code);
    
    RETURN json_build_object(
        'success', true, 
        'message', 'Coupon redeemed successfully',
        'amount', v_amount
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Extend Booking
-- =====================================================
CREATE OR REPLACE FUNCTION extend_booking(
    p_booking_id UUID,
    p_extension_hours INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_booking RECORD;
    v_new_end_time TIMESTAMPTZ;
    v_new_buffer_end_time TIMESTAMPTZ;
    v_extension_cost DECIMAL(10, 2);
    v_user_balance DECIMAL(10, 2);
    v_overlapping_count INTEGER;
BEGIN
    -- Get booking details
    SELECT b.*, ps.sensor_id
    INTO v_booking
    FROM bookings b
    JOIN parking_spots ps ON b.spot_id = ps.id
    WHERE b.id = p_booking_id AND b.status = 'active';
    
    IF v_booking.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Booking not found or not active');
    END IF;
    
    -- Calculate new end times (no buffer for same user extension)
    v_new_end_time := v_booking.end_time + (p_extension_hours || ' hours')::INTERVAL;
    v_new_buffer_end_time := v_new_end_time + INTERVAL '30 minutes';
    
    -- Check for overlapping bookings (excluding current booking)
    SELECT COUNT(*) INTO v_overlapping_count
    FROM bookings
    WHERE spot_id = v_booking.spot_id
      AND id != p_booking_id
      AND status = 'active'
      AND tstzrange(start_time, buffer_end_time) && tstzrange(v_booking.end_time, v_new_buffer_end_time);
    
    IF v_overlapping_count > 0 THEN
        RETURN json_build_object('success', false, 'message', 'Slot already booked for the requested extension period');
    END IF;
    
    -- Calculate extension cost (₹50 per hour)
    v_extension_cost := p_extension_hours * 50;
    
    -- Check user balance
    SELECT credit_balance INTO v_user_balance
    FROM profiles
    WHERE id = v_booking.user_id;
    
    IF v_user_balance < v_extension_cost THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Required: ₹' || v_extension_cost);
    END IF;
    
    -- Update booking
    UPDATE bookings
    SET end_time = v_new_end_time,
        buffer_end_time = v_new_buffer_end_time,
        total_cost = total_cost + v_extension_cost
    WHERE id = p_booking_id;
    
    -- Deduct from user balance
    UPDATE profiles
    SET credit_balance = credit_balance - v_extension_cost
    WHERE id = v_booking.user_id;
    
    -- Add transaction record
    INSERT INTO transaction_history (user_id, amount, description)
    VALUES (v_booking.user_id, -v_extension_cost, 'Booking Extension - ' || p_extension_hours || ' hours');
    
    RETURN json_build_object(
        'success', true,
        'message', 'Booking extended successfully',
        'extension_hours', p_extension_hours,
        'cost', v_extension_cost,
        'new_end_time', v_new_end_time
    );
END;
$$ LANGUAGE plpgsql;

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
    v_compensation_per_hour DECIMAL(10, 2) := 15;
    v_affected_booking_hours DECIMAL(10, 2);
    v_compensation DECIMAL(10, 2);
    v_user_balance DECIMAL(10, 2);
    v_reassignments JSON[] := '{}';
    v_cancellations JSON[] := '{}';
    v_total_compensation DECIMAL(10, 2) := 0;
    v_system_penalty DECIMAL(10, 2);
BEGIN
    SELECT * INTO v_current_booking FROM bookings
    WHERE spot_id = p_spot_id AND status = 'active' AND end_time < p_current_time
    ORDER BY end_time DESC LIMIT 1;
    
    IF v_current_booking.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'No overstaying booking found');
    END IF;
    
    v_overstay_minutes := EXTRACT(EPOCH FROM (p_current_time - v_current_booking.end_time)) / 60;
    v_overstay_hours := v_overstay_minutes / 60.0;
    
    IF v_overstay_minutes < 5 THEN
        RETURN json_build_object('success', false, 'message', 'Within grace period');
    END IF;
    
    v_total_overstay_cost := v_overstay_hours * (v_hourly_charge + v_penalty_per_hour);
    
    UPDATE bookings SET overstay_hours = v_overstay_hours, overstay_penalty = v_total_overstay_cost
    WHERE id = v_current_booking.id;
    
    FOR v_affected_booking IN
        SELECT * FROM bookings WHERE spot_id = p_spot_id AND id != v_current_booking.id
        AND status = 'active' AND start_time <= p_current_time + INTERVAL '30 minutes'
        AND start_time > v_current_booking.end_time ORDER BY start_time
    LOOP
        SELECT ps.* INTO v_alternative_spot FROM parking_spots ps
        WHERE ps.id != p_spot_id AND ps.is_available = true
        AND ps.location = (SELECT location FROM parking_spots WHERE id = p_spot_id)
        AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.spot_id = ps.id AND b.status = 'active'
            AND tstzrange(b.start_time, b.buffer_end_time) && tstzrange(v_affected_booking.start_time, v_affected_booking.end_time))
        AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.id = ps.sensor_id
            AND sd.obstacle = true AND sd.updated_at > p_current_time - INTERVAL '5 minutes') LIMIT 1;
        
        IF v_alternative_spot.id IS NOT NULL THEN
            UPDATE bookings SET spot_id = v_alternative_spot.id, reassigned_from = p_spot_id,
                reassignment_notified = false WHERE id = v_affected_booking.id;
            v_reassignments := array_append(v_reassignments, json_build_object(
                'booking_id', v_affected_booking.id, 'user_id', v_affected_booking.user_id,
                'new_spot_number', v_alternative_spot.spot_number));
        ELSE
            v_affected_booking_hours := EXTRACT(EPOCH FROM (v_affected_booking.end_time - v_affected_booking.start_time)) / 3600;
            v_compensation := v_affected_booking_hours * v_compensation_per_hour;
            v_total_compensation := v_total_compensation + v_compensation;
            
            UPDATE bookings SET status = 'cancelled', cancellation_notified = false WHERE id = v_affected_booking.id;
            UPDATE profiles SET credit_balance = credit_balance + v_affected_booking.total_cost + v_compensation
            WHERE id = v_affected_booking.user_id;
            INSERT INTO transaction_history (user_id, amount, description) VALUES (
                v_affected_booking.user_id, v_affected_booking.total_cost + v_compensation,
                'Booking Cancelled (Overstay) - Refund + ₹' || ROUND(v_compensation, 2) || ' compensation');
            v_cancellations := array_append(v_cancellations, json_build_object(
                'booking_id', v_affected_booking.id, 'compensation', v_compensation));
        END IF;
    END LOOP;
    
    v_system_penalty := v_total_overstay_cost - v_total_compensation;
    SELECT credit_balance INTO v_user_balance FROM profiles WHERE id = v_current_booking.user_id;
    
    IF v_user_balance >= v_total_overstay_cost THEN
        UPDATE profiles SET credit_balance = credit_balance - v_total_overstay_cost WHERE id = v_current_booking.user_id;
    ELSE
        UPDATE profiles SET credit_balance = 0, pending_debt = pending_debt + (v_total_overstay_cost - v_user_balance)
        WHERE id = v_current_booking.user_id;
    END IF;
    
    INSERT INTO transaction_history (user_id, amount, description) VALUES (
        v_current_booking.user_id, -v_total_overstay_cost,
        'Overstay Penalty - ' || ROUND(v_overstay_hours, 2) || ' hours @ ₹80/hr');
    
    RETURN json_build_object('success', true, 'overstay_hours', v_overstay_hours,
        'total_penalty', v_total_overstay_cost, 'total_compensation_paid', v_total_compensation,
        'system_revenue', v_system_penalty, 'reassignments', v_reassignments, 'cancellations', v_cancellations);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Check All Overstays
-- =====================================================
CREATE OR REPLACE FUNCTION check_all_overstays() RETURNS JSON AS $$
DECLARE
    v_spot RECORD; v_sensor RECORD; v_result JSON; v_all_results JSON[] := '{}';
BEGIN
    FOR v_spot IN SELECT ps.* FROM parking_spots ps WHERE ps.sensor_id IS NOT NULL LOOP
        SELECT * INTO v_sensor FROM sensor_data WHERE id = v_spot.sensor_id AND updated_at > NOW() - INTERVAL '5 minutes';
        IF v_sensor.id IS NOT NULL AND v_sensor.obstacle = true THEN
            v_result := handle_overstay_enhanced(v_spot.id, NOW());
            IF (v_result->>'success')::boolean THEN v_all_results := array_append(v_all_results, v_result); END IF;
        END IF;
    END LOOP;
    RETURN json_build_object('success', true, 'overstays_processed', array_length(v_all_results, 1), 'results', v_all_results);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Complete Booking on Departure
-- =====================================================
CREATE OR REPLACE FUNCTION complete_booking_on_departure(p_spot_id UUID) RETURNS JSON AS $$
DECLARE v_booking RECORD; v_pending_debt DECIMAL(10, 2);
BEGIN
    SELECT * INTO v_booking FROM bookings WHERE spot_id = p_spot_id AND status = 'active'
    AND start_time <= NOW() ORDER BY start_time DESC LIMIT 1;
    IF v_booking.id IS NULL THEN RETURN json_build_object('success', false, 'message', 'No active booking found'); END IF;
    UPDATE bookings SET status = 'completed', actual_end_time = NOW() WHERE id = v_booking.id;
    SELECT pending_debt INTO v_pending_debt FROM profiles WHERE id = v_booking.user_id;
    RETURN json_build_object('success', true, 'booking_id', v_booking.id, 'pending_debt', v_pending_debt);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Validate Booking Start
-- =====================================================
CREATE OR REPLACE FUNCTION validate_booking_start(p_booking_id UUID) RETURNS JSON AS $$
DECLARE
    v_booking RECORD; v_spot RECORD; v_sensor RECORD; v_alternative_spot RECORD;
    v_compensation DECIMAL(10, 2); v_booking_hours DECIMAL(10, 2);
BEGIN
    SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND status = 'active';
    IF v_booking.id IS NULL THEN RETURN json_build_object('success', false); END IF;
    IF v_booking.start_time > NOW() + INTERVAL '5 minutes' THEN RETURN json_build_object('success', false); END IF;
    SELECT * INTO v_spot FROM parking_spots WHERE id = v_booking.spot_id;
    IF v_spot.sensor_id IS NULL THEN RETURN json_build_object('success', true); END IF;
    SELECT * INTO v_sensor FROM sensor_data WHERE id = v_spot.sensor_id AND updated_at > NOW() - INTERVAL '2 minutes';
    IF v_sensor.id IS NULL OR v_sensor.obstacle = false THEN RETURN json_build_object('success', true); END IF;
    
    SELECT ps.* INTO v_alternative_spot FROM parking_spots ps WHERE ps.id != v_booking.spot_id
    AND ps.is_available = true AND ps.location = v_spot.location
    AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.spot_id = ps.id AND b.status = 'active'
        AND tstzrange(b.start_time, b.buffer_end_time) && tstzrange(v_booking.start_time, v_booking.end_time))
    AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.id = ps.sensor_id
        AND sd.obstacle = true AND sd.updated_at > NOW() - INTERVAL '2 minutes') LIMIT 1;
    
    IF v_alternative_spot.id IS NOT NULL THEN
        UPDATE bookings SET spot_id = v_alternative_spot.id, reassigned_from = v_booking.spot_id,
            reassignment_notified = false WHERE id = v_booking.id;
        RETURN json_build_object('success', true, 'action', 'reassigned', 'new_spot_number', v_alternative_spot.spot_number);
    ELSE
        v_booking_hours := EXTRACT(EPOCH FROM (v_booking.end_time - v_booking.start_time)) / 3600;
        v_compensation := v_booking_hours * 15;
        UPDATE bookings SET status = 'cancelled', cancellation_notified = false WHERE id = v_booking.id;
        UPDATE profiles SET credit_balance = credit_balance + v_booking.total_cost + v_compensation WHERE id = v_booking.user_id;
        INSERT INTO transaction_history (user_id, amount, description) VALUES (
            v_booking.user_id, v_booking.total_cost + v_compensation,
            'Booking Cancelled (Spot Occupied) - Refund + ₹' || ROUND(v_compensation, 2) || ' compensation');
        RETURN json_build_object('success', true, 'action', 'cancelled', 'refund_amount', v_booking.total_cost, 'compensation', v_compensation);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Handle Top-up with Debt
-- =====================================================
CREATE OR REPLACE FUNCTION handle_topup_with_debt(p_user_id UUID, p_amount DECIMAL(10, 2)) RETURNS JSON AS $$
DECLARE v_pending_debt DECIMAL(10, 2); v_amount_after_debt DECIMAL(10, 2);
BEGIN
    SELECT pending_debt INTO v_pending_debt FROM profiles WHERE id = p_user_id;
    IF v_pending_debt > 0 THEN
        IF p_amount > v_pending_debt THEN
            v_amount_after_debt := p_amount - v_pending_debt;
            UPDATE profiles SET credit_balance = credit_balance + v_amount_after_debt, pending_debt = 0 WHERE id = p_user_id;
            INSERT INTO transaction_history (user_id, amount, description) VALUES (p_user_id, -v_pending_debt, 'Pending debt cleared');
            INSERT INTO transaction_history (user_id, amount, description) VALUES (p_user_id, v_amount_after_debt, 'Balance added');
        ELSE
            UPDATE profiles SET pending_debt = pending_debt - p_amount WHERE id = p_user_id;
            INSERT INTO transaction_history (user_id, amount, description) VALUES (p_user_id, -p_amount, 'Partial debt payment');
            v_amount_after_debt := 0;
        END IF;
    ELSE
        UPDATE profiles SET credit_balance = credit_balance + p_amount WHERE id = p_user_id;
        INSERT INTO transaction_history (user_id, amount, description) VALUES (p_user_id, p_amount, 'Balance top-up');
        v_amount_after_debt := p_amount;
    END IF;
    RETURN json_build_object('success', true, 'debt_paid', LEAST(v_pending_debt, p_amount), 'balance_added', v_amount_after_debt);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-update sensor data timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_sensor_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sensor_data_timestamp
BEFORE UPDATE ON sensor_data
FOR EACH ROW
EXECUTE FUNCTION update_sensor_timestamp();

-- =====================================================
-- SAMPLE PARKING SPOTS (Optional - for testing)
-- =====================================================
INSERT INTO parking_spots (spot_number, location, camera_feed_url, is_available, sensor_id)
VALUES 
    ('A-101', 'Sec. A', 'https://example.com/camera/a101', true, '1'),
    ('B-202', 'Sec. B', 'https://example.com/camera/a102', true, '2'),
    ('C-303', 'Sec. C', 'https://example.com/camera/b201', true, '3')
ON CONFLICT (spot_number) DO NOTHING;

-- =====================================================
-- SAMPLE SENSOR DATA (Optional - for testing)
-- =====================================================
INSERT INTO sensor_data (id, obstacle, updated_at)
VALUES 
    ('1', false, NOW()),
    ('2', false, NOW()),
    ('3', false, NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- INDEXES for better performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_transaction_history_user_id ON transaction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_history_created_at ON transaction_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_parking_spots_available ON parking_spots(is_available);
CREATE INDEX IF NOT EXISTS idx_callback_requests_created_at ON callback_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_us_created_at ON contact_us_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_booking_id ON security_alerts(booking_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_spot_id ON security_alerts(spot_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at DESC);
