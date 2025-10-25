# 🔍 Debug Occupied Count Showing 0

## 🐛 **Issue:**
Occupied count shows **0** even though sensor is sending `obstacle = true`

## ✅ **Fix Applied:**
Added comprehensive console logging to track exactly what's happening.

---

## 📋 **Debugging Steps:**

### **Step 1: Deploy the Updated Code**

```bash
git add js/admin.js
git commit -m "Add debug logging for occupied count"
git push
```

### **Step 2: Open Admin Dashboard**

1. Go to admin dashboard
2. Press **F12** to open Developer Console
3. Go to **Console** tab
4. Refresh the page

### **Step 3: Check Console Logs**

You should see logs like this:

```
Sensor data fetched: [{id: "xxx", obstacle: true, ...}]
Sensor xxx: obstacle=true, updated=...
Spot A-101: sensor_id=xxx, occupied=true
Total occupied count: 1
```

---

## 🔍 **What to Look For:**

### **Check 1: Sensor Data Fetched**

Look for: `Sensor data fetched: [...]`

**Expected:** Should show array with your sensors
```javascript
[{
  id: "sensor_123",
  obstacle: true,
  updated_at: "2025-10-25T..."
}]
```

**If empty `[]`:**
- Sensor data table is empty
- Run query in Supabase: `SELECT * FROM sensor_data;`

---

### **Check 2: Sensor Values**

Look for: `Sensor xxx: obstacle=true, updated=...`

**Expected:** Should show `obstacle=true` for occupied sensor

**If showing `obstacle=false`:**
- Sensor isn't actually sending true
- Check your sensor sending code

---

### **Check 3: Spot-Sensor Mapping**

Look for: `Spot A-101: sensor_id=xxx, occupied=true`

**Expected:** 
- `sensor_id` should match the sensor ID
- `occupied` should be true

**If `sensor_id=null` or `sensor_id=undefined`:**
- Parking spot doesn't have sensor_id assigned
- Run in Supabase:
```sql
SELECT spot_number, sensor_id FROM parking_spots;
```

**If `sensor_id` exists but `occupied=false`:**
- The sensor IDs don't match
- Check if `spot.sensor_id` matches `sensor.id`

---

## 🔧 **Common Issues & Fixes:**

### **Issue 1: Parking Spot Has No sensor_id**

**Check:**
```sql
SELECT spot_number, sensor_id FROM parking_spots;
```

**Fix:**
```sql
-- Assign sensor to parking spot
UPDATE parking_spots 
SET sensor_id = 'your_sensor_id_here'
WHERE spot_number = 'A-101';
```

---

### **Issue 2: Sensor IDs Don't Match**

**Check both tables:**
```sql
-- Check sensor IDs
SELECT id, obstacle FROM sensor_data;

-- Check spot sensor IDs
SELECT spot_number, sensor_id FROM parking_spots;
```

**The IDs must match exactly!**

---

### **Issue 3: Sensor Not Sending obstacle=true**

**Check current sensor values:**
```sql
SELECT * FROM sensor_data ORDER BY updated_at DESC;
```

**Expected:** `obstacle` column should be `true` (boolean), not `"true"` (string)

**If obstacle is NULL or false:**
- Your sensor code isn't sending data correctly
- Check your ESP32/Arduino code

---

### **Issue 4: Data Type Mismatch**

**Check data type:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sensor_data' 
AND column_name = 'obstacle';
```

**Should be:** `boolean`

**If it's text/varchar:**
```sql
-- Fix data type
ALTER TABLE sensor_data 
ALTER COLUMN obstacle TYPE BOOLEAN 
USING obstacle::boolean;
```

---

## 🧪 **Test Query:**

Run this to see what the system should see:

```sql
SELECT 
    ps.spot_number,
    ps.sensor_id,
    sd.obstacle,
    sd.updated_at,
    CASE 
        WHEN sd.obstacle = true THEN 'OCCUPIED'
        ELSE 'AVAILABLE'
    END as status
FROM parking_spots ps
LEFT JOIN sensor_data sd ON ps.sensor_id = sd.id
ORDER BY ps.spot_number;
```

**This shows:**
- Each parking spot
- Its sensor ID
- Current obstacle status
- Whether it should show as occupied

---

## ✅ **Expected Result:**

After fixing, console should show:

```
Sensor data fetched: [{id: "abc123", obstacle: true, ...}]
Sensor abc123: obstacle=true, updated=2025-10-25T...
Spot A-101: sensor_id=abc123, occupied=true
Total occupied count: 1
```

And dashboard should show: **Occupied: 1**

---

## 🎯 **Quick Fix Commands:**

### **1. Verify sensor data exists:**
```sql
SELECT COUNT(*) FROM sensor_data WHERE obstacle = true;
```

### **2. Link spot to sensor:**
```sql
-- Replace with your actual IDs
UPDATE parking_spots 
SET sensor_id = (SELECT id FROM sensor_data LIMIT 1)
WHERE spot_number = 'A-101';
```

### **3. Test sensor update:**
```sql
-- Force a sensor to show occupied
UPDATE sensor_data 
SET obstacle = true, updated_at = NOW()
LIMIT 1;
```

---

## 📞 **Report Back:**

After deploying and checking console, report:

1. What does `Sensor data fetched:` show?
2. What does `Spot X: sensor_id=...` show?
3. What does `Total occupied count:` show?
4. Any errors in console?

This will help identify the exact issue! 🔍
