# 📹 How to Set Up Live Camera Feeds

## 🎯 Quick Setup with YouTube Live (FREE & EASY)

### **Step 1: Start YouTube Live Stream on Phone**

1. **Open YouTube App** on your phone
2. Tap **+** (Create) → **Go Live**
3. Set up your stream:
   - Title: "Parking Spot A-101" (or your spot number)
   - Privacy: **Unlisted** (only people with link can view)
   - Category: Other
4. **Start Streaming**
5. Your phone camera is now live!

### **Step 2: Get the Stream URL**

1. While streaming, tap **Share**
2. Copy the URL (looks like: `https://youtu.be/ABC123xyz`)
3. Convert to embed format:
   ```
   Original: https://youtu.be/ABC123xyz
   Embed:    https://www.youtube.com/embed/ABC123xyz
   ```

### **Step 3: Update Database**

Go to **Supabase SQL Editor** and run:

```sql
-- For Spot A-101
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/YOUR_VIDEO_ID'
WHERE spot_number = 'A-101';

-- For Spot B-202
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/YOUR_VIDEO_ID'
WHERE spot_number = 'B-202';

-- Add more spots as needed
```

### **Step 4: Test**

1. Go to your Klyra website
2. Login and create a booking
3. Click **"Watch Live Feed"**
4. You should see your phone's camera stream!

---

## 🔄 **Alternative: Use Pre-recorded Video (For Demo)**

If you want to test without live streaming:

```sql
-- Use a demo video
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
WHERE spot_number = 'A-101';
```

---

## 📱 **Multiple Camera Setup**

### **For Each Parking Spot:**

1. **Use different phones** or **multiple YouTube accounts**
2. Start separate live streams for each spot
3. Update each spot with its own embed URL

Example:
```sql
-- Spot A-101 (Phone 1)
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/VIDEO_ID_1'
WHERE spot_number = 'A-101';

-- Spot B-202 (Phone 2)
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/VIDEO_ID_2'
WHERE spot_number = 'B-202';

-- Spot C-303 (Phone 3)
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/VIDEO_ID_3'
WHERE spot_number = 'C-303';
```

---

## 🎥 **Other Free Options**

### **Option 2: Twitch**
1. Download Twitch app
2. Start streaming
3. Get embed URL: `https://player.twitch.tv/?channel=YOUR_CHANNEL&parent=your-domain.onrender.com`

### **Option 3: Facebook Live**
1. Start Facebook Live (set to Unlisted)
2. Get embed code
3. Extract video URL

### **Option 4: IP Webcam + ngrok**
1. Install IP Webcam app
2. Install ngrok: `ngrok http 8080`
3. Use ngrok URL in database

---

## ⚙️ **Current Camera URLs in Database**

To see all current camera feeds:

```sql
SELECT spot_number, location, camera_feed_url 
FROM parking_spots 
ORDER BY spot_number;
```

To update a specific spot:

```sql
UPDATE parking_spots 
SET camera_feed_url = 'YOUR_NEW_URL_HERE'
WHERE spot_number = 'SPOT_NUMBER';
```

---

## 🔧 **Troubleshooting**

### **Issue: Video not loading**
- ✅ Check if URL is in embed format (`/embed/` not `/watch?v=`)
- ✅ Verify stream is live on YouTube
- ✅ Check if video is set to Unlisted (not Private)

### **Issue: "Video unavailable"**
- ✅ Make sure stream is active
- ✅ Check YouTube stream settings
- ✅ Try refreshing the page

### **Issue: Can't see on mobile**
- ✅ YouTube embed works on all devices
- ✅ Make sure you're using HTTPS URLs

---

## 📊 **Recommended Setup for Production**

### **For 10 Parking Spots:**

**Budget Option (FREE):**
- Use 2-3 old phones
- Each phone streams 3-4 spots (wide angle)
- YouTube Live for each phone
- Total cost: ₹0

**Better Option:**
- 1 IP camera per spot
- Use YouTube Live or IP Webcam
- Mount cameras permanently
- Total cost: ~₹2000-3000 per camera

---

## 🎯 **Quick Test**

Want to test right now? Use this demo feed:

```sql
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/jfKfPfyJRdk'
WHERE spot_number = 'A-101';
```

This is a live lofi music stream - just for testing the embed functionality!

---

## ✅ **Summary**

1. **Easiest**: YouTube Live (100% free, unlimited)
2. **Most Reliable**: YouTube Live
3. **Best Quality**: YouTube Live
4. **No Limits**: YouTube Live

**YouTube Live is the winner!** 🏆

Start streaming from your phone and update the database with the embed URL. That's it!
