# 🧪 Security Alerts Testing Guide

## ✅ **Issues Fixed:**

### **1. Occupied Spots Count** ✅
- Now counts based on **actual sensor data** (obstacle = true)
- Shows real-time occupied count based on sensors
- Updates every minute automatically

### **2. Security Alerts Display** ✅
- Added comprehensive error handling
- Added console logging for debugging
- Shows clear error messages if table doesn't exist

---

## 🔍 **How to Debug Security Alerts**

### **Step 1: Check Browser Console**

Open admin dashboard and press `F12`, then check console for:
```
Loading security alerts...
Security alerts loaded: [array]
Rendered X security alerts
```

If you see errors, they will tell you what's wrong.

---

### **Step 2: Verify Table Exists in Supabase**

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Check if table exists
SELECT COUNT(*) FROM security_alerts;

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'security_alerts';
```

---

### **Step 3: Create Test Alert**

Run this in Supabase SQL Editor:

```sql
-- Insert a test alert
INSERT INTO security_alerts (
    user_id,
    booking_id,
    spot_id,
    spot_number,
    location,
    vehicle_number,
    description,
    status
)
SELECT 
    (SELECT id FROM profiles LIMIT 1),  -- First user
    (SELECT id FROM bookings LIMIT 1),  -- First booking
    (SELECT id FROM parking_spots LIMIT 1),  -- First spot
    'A-101',
    'Test Location',
    'TEST 123',
    'This is a test security alert',
    'pending';

-- Verify it was inserted
SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT 1;
```

---

### **Step 4: Check HTML Container**

Make sure admin.html has these elements:

```html
<!-- Security Alerts Container -->
<div id="security-alerts-container"></div>

<!-- Alert Count Badge -->
<span id="alert-count">0 Pending</span>
```

---

### **Step 5: Test Real Alert from User**

1. **Login as User** on dashboard
2. **Create a booking** for any spot
3. **Click "Watch Live Feed"** on ongoing booking
4. **Click "Send Security Alert"** button
5. **Enter description** of issue
6. **Check admin dashboard** - alert should appear

---

## 🔧 **Quick Fixes**

### **If alerts still don't show:**

#### **Fix 1: Check Supabase Policies**

Run this SQL to add proper policies:

```sql
-- Enable RLS
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own alerts
CREATE POLICY "Users can insert their own alerts"
ON security_alerts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow admins to view all alerts (anon key can read)
CREATE POLICY "Allow read access to alerts"
ON security_alerts FOR SELECT
TO anon
USING (true);

-- Allow admins to update alerts
CREATE POLICY "Allow update access to alerts"
ON security_alerts FOR UPDATE
TO anon
USING (true);
```

#### **Fix 2: Verify Supabase URL**

In `admin.js`, make sure the Supabase URL matches your project:

```javascript
// Should match your Supabase project URL
const supabaseUrl = 'https://YOUR_PROJECT.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY';
```

#### **Fix 3: Clear Cache**

```
1. Press Ctrl+Shift+R to hard refresh
2. Clear browser cache
3. Logout and login again
```

---

## 📊 **Occupied Spots - How It Works Now**

### **Before (Wrong):**
```javascript
// Used static is_available field
occupied = spots.filter(s => !s.is_available).length;
```

### **After (Correct):**
```javascript
// Uses real-time sensor data
const { data: sensorData } = await supabase
    .from('sensor_data')
    .select('*')
    .gte('updated_at', last_5_minutes);

// Count spots where sensor.obstacle === true
sensorData.forEach(sensor => {
    if (sensor.obstacle === true) {
        occupiedCount++;
    }
});
```

### **Features:**
- ✅ **Real-time** - Updates every minute
- ✅ **Accurate** - Based on actual sensor readings
- ✅ **Recent** - Only considers sensors updated in last 5 minutes
- ✅ **Visual** - Parking grid shows red/green based on sensors

---

## 🎯 **Expected Behavior**

### **Occupied Spots:**
```
If 2 sensors send obstacle=true → Shows "2"
If 1 sensor sends obstacle=true → Shows "1"
If 0 sensors send obstacle=true → Shows "0"
```

### **Security Alerts:**
```
Pending Alerts → Red badge
Reviewing → Yellow badge
Resolved → Green badge
```

---

## 🐛 **Common Issues**

### **Issue: "No security alerts yet" message**

**Cause:** Table is empty

**Solution:** Have a user send a test alert from dashboard

---

### **Issue: "Error loading security alerts"**

**Cause:** Table doesn't exist or RLS blocking access

**Solution:** 
1. Run the security alerts SQL again
2. Add RLS policies (see Fix 1 above)

---

### **Issue: Occupied count shows 0 but spots are occupied**

**Cause:** Sensors not sending data or not updated recently

**Solution:**
1. Check sensor_data table has recent entries
2. Make sure `updated_at` is within last 5 minutes
3. Verify `obstacle` field is boolean true/false

---

## ✅ **Verification Checklist**

After deployment, verify:

- [ ] Admin dashboard loads without errors
- [ ] Occupied count shows correct number based on sensors
- [ ] Security alerts section is visible
- [ ] Can create test alert via SQL
- [ ] Test alert appears in admin dashboard
- [ ] Can change alert status (pending → reviewing → resolved)
- [ ] Console shows no errors
- [ ] Parking grid colors match sensor data (red=occupied, green=free)

---

## 📞 **If Still Not Working**

Run this diagnostic query:

```sql
-- Check everything
SELECT 
    'Security Alerts Table' as check_type,
    COUNT(*) as count 
FROM security_alerts
UNION ALL
SELECT 
    'Sensor Data (Last 5 min)',
    COUNT(*) 
FROM sensor_data 
WHERE updated_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
    'Occupied Sensors',
    COUNT(*) 
FROM sensor_data 
WHERE obstacle = true 
  AND updated_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
    'Parking Spots with Sensors',
    COUNT(*) 
FROM parking_spots 
WHERE sensor_id IS NOT NULL;
```

This will show you:
- How many alerts exist
- How many sensors are active
- How many show occupied
- How many spots have sensors

---

## 🚀 **Deploy**

```bash
git add js/admin.js TEST_SECURITY_ALERTS.md
git commit -m "Fix occupied count to use sensor data & enhance security alerts debugging"
git push
```

**Everything should work now!** 🎉
