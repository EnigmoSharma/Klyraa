-- =====================================================
-- FIX SECURITY ALERTS - Complete Setup
-- =====================================================

-- Drop table if it exists (to recreate with proper structure)
DROP TABLE IF EXISTS security_alerts CASCADE;

-- Create security_alerts table with proper foreign keys
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

-- Create indexes for better query performance
CREATE INDEX idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX idx_security_alerts_booking_id ON security_alerts(booking_id);
CREATE INDEX idx_security_alerts_spot_id ON security_alerts(spot_id);
CREATE INDEX idx_security_alerts_status ON security_alerts(status);
CREATE INDEX idx_security_alerts_created_at ON security_alerts(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE security_alerts IS 'Security alerts reported by users from live camera feeds';

-- Enable Row Level Security
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own alerts" ON security_alerts;
DROP POLICY IF EXISTS "Users can view their own alerts" ON security_alerts;
DROP POLICY IF EXISTS "Admins can view all alerts" ON security_alerts;
DROP POLICY IF EXISTS "Admins can update alerts" ON security_alerts;

-- Policy: Users can insert their own alerts
CREATE POLICY "Users can insert their own alerts"
ON security_alerts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own alerts
CREATE POLICY "Users can view their own alerts"
ON security_alerts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Allow anonymous (admin) to view all alerts
CREATE POLICY "Admins can view all alerts"
ON security_alerts
FOR SELECT
TO anon
USING (true);

-- Policy: Allow anonymous (admin) to update alerts
CREATE POLICY "Admins can update alerts"
ON security_alerts
FOR UPDATE
TO anon
USING (true);

-- Verify setup
SELECT 
    'Security Alerts Table Setup Complete!' as status,
    COUNT(*) as existing_alerts
FROM security_alerts;

-- Show table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'security_alerts'
ORDER BY ordinal_position;
