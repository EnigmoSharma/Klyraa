-- =====================================================
-- KLYRA PARKING MANAGEMENT SYSTEM - SIMPLIFIED SCHEMA
-- No RLS (Row Level Security)
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS transaction_history CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS sensor_data CASCADE;
DROP TABLE IF EXISTS parking_spots CASCADE;
DROP TABLE IF EXISTS callback_requests CASCADE;
DROP TABLE IF EXISTS contact_us_requests CASCADE;

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
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
    vehicle_number TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    buffer_end_time TIMESTAMPTZ NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    actual_end_time TIMESTAMPTZ,
    overstay_hours DECIMAL(10, 2) DEFAULT 0,
    overstay_penalty DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'cancelled', 'overstayed')),
    cancellation_reason TEXT,
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
-- FUNCTION: Handle Overstay and Cancel Affected Bookings
-- =====================================================
CREATE OR REPLACE FUNCTION handle_overstay(
    p_overstaying_booking_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_overstay_booking RECORD;
    v_affected_booking RECORD;
    v_overstay_hours DECIMAL(10, 2);
    v_hourly_charge DECIMAL(10, 2) := 50;
    v_penalty_per_hour DECIMAL(10, 2) := 30;
    v_total_overstay_cost DECIMAL(10, 2);
    v_compensation DECIMAL(10, 2);
    v_user_balance DECIMAL(10, 2);
    v_affected_count INTEGER := 0;
BEGIN
    -- Get overstaying booking details
    SELECT * INTO v_overstay_booking
    FROM bookings
    WHERE id = p_overstaying_booking_id;
    
    IF v_overstay_booking.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Booking not found');
    END IF;
    
    -- Calculate overstay hours
    v_overstay_hours := EXTRACT(EPOCH FROM (NOW() - v_overstay_booking.buffer_end_time)) / 3600;
    
    IF v_overstay_hours <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'No overstay detected');
    END IF;
    
    -- Calculate total cost: (₹50/hour + ₹30 penalty/hour)
    v_total_overstay_cost := v_overstay_hours * (v_hourly_charge + v_penalty_per_hour);
    
    -- Find and cancel affected bookings
    FOR v_affected_booking IN
        SELECT * FROM bookings
        WHERE spot_id = v_overstay_booking.spot_id
          AND id != p_overstaying_booking_id
          AND status = 'active'
          AND start_time >= v_overstay_booking.buffer_end_time
          AND start_time <= NOW()
        ORDER BY start_time
    LOOP
        v_affected_count := v_affected_count + 1;
        
        -- Calculate compensation (₹20 from penalty)
        v_compensation := LEAST(20 * v_overstay_hours, v_affected_booking.total_cost);
        
        -- Refund affected user with compensation
        UPDATE profiles
        SET credit_balance = credit_balance + v_affected_booking.total_cost + v_compensation
        WHERE id = v_affected_booking.user_id;
        
        -- Cancel affected booking
        UPDATE bookings
        SET status = 'cancelled',
            cancellation_reason = 'Previous booking overstayed. We apologize for the inconvenience. Full refund + ₹' || v_compensation || ' compensation provided.'
        WHERE id = v_affected_booking.id;
        
        -- Add refund transaction
        INSERT INTO transaction_history (user_id, amount, description)
        VALUES (
            v_affected_booking.user_id,
            v_affected_booking.total_cost + v_compensation,
            'Booking Cancelled (Overstay) - Refund + ₹' || v_compensation || ' compensation'
        );
    END LOOP;
    
    -- Charge overstaying user
    UPDATE profiles
    SET credit_balance = credit_balance - v_total_overstay_cost
    WHERE id = v_overstay_booking.user_id;
    
    -- Update overstaying booking
    UPDATE bookings
    SET actual_end_time = NOW(),
        overstay_hours = v_overstay_hours,
        overstay_penalty = v_total_overstay_cost,
        status = 'overstayed'
    WHERE id = p_overstaying_booking_id;
    
    -- Add penalty transaction
    INSERT INTO transaction_history (user_id, amount, description)
    VALUES (
        v_overstay_booking.user_id,
        -v_total_overstay_cost,
        'Overstay Penalty - ' || ROUND(v_overstay_hours, 2) || ' hours (₹50/hr + ₹30 penalty/hr)'
    );
    
    RETURN json_build_object(
        'success', true,
        'overstay_hours', v_overstay_hours,
        'total_charge', v_total_overstay_cost,
        'affected_bookings', v_affected_count
    );
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
