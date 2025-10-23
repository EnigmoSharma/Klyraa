-- =====================================================
-- SECURITY ALERTS TABLE
-- For users to report unusual activity from live feed
-- =====================================================

CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
    spot_number TEXT NOT NULL,
    location TEXT NOT NULL,
    vehicle_number TEXT,
    screenshot_url TEXT,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_spot_id ON security_alerts(spot_id);

-- Insert sample data (optional - remove in production)
COMMENT ON TABLE security_alerts IS 'Security alerts reported by users from live camera feeds';
