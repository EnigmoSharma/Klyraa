# 📹 Live Camera Feed Setup Guide

## 🎯 Quick Start (5 Minutes)

### **Step 1: Start YouTube Live on Your Phone**

1. Open **YouTube app** on your phone
2. Tap the **+** button at bottom
3. Select **"Go Live"**
4. Configure:
   - **Title**: "Parking Spot A-101"
   - **Privacy**: Select **"Unlisted"** ⚠️ Important!
   - **Category**: Other
5. Tap **"Go Live"**
6. Your camera is now streaming!

### **Step 2: Get the Video ID**

While streaming:
1. Tap **Share** button
2. Copy the link (e.g., `https://youtu.be/dQw4w9WgXcQ`)
3. Extract the VIDEO_ID (the part after `youtu.be/`)
   - Example: `dQw4w9WgXcQ` is the VIDEO_ID

### **Step 3: Update Camera URL in Admin Panel**

**Option A: Using Admin Dashboard (EASIEST)**
1. Login to admin panel
2. Click on any parking spot
3. Click **"Update URL"** button in the modal
4. Enter: `https://www.youtube.com/embed/VIDEO_ID`
   - Replace VIDEO_ID with your actual ID
5. Click OK
6. Done! ✅

**Option B: Using Supabase SQL**
1. Go to Supabase SQL Editor
2. Run:
```sql
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/YOUR_VIDEO_ID'
WHERE spot_number = 'A-101';
```

### **Step 4: Test**

1. Go to your website
2. Login as user
3. Create a booking for that spot
4. Click **"Watch Live Feed"**
5. You should see your phone's camera! 🎉

---

## 📱 **Multiple Cameras Setup**

### **For 3 Parking Spots:**

**You need:**
- 3 phones (or 3 YouTube accounts)
- Each phone streams one spot

**Setup:**

**Phone 1 - Spot A-101:**
1. Start YouTube Live
2. Get VIDEO_ID_1
3. Update: `https://www.youtube.com/embed/VIDEO_ID_1`

**Phone 2 - Spot B-202:**
1. Start YouTube Live
2. Get VIDEO_ID_2
3. Update: `https://www.youtube.com/embed/VIDEO_ID_2`

**Phone 3 - Spot C-303:**
1. Start YouTube Live
2. Get VIDEO_ID_3
3. Update: `https://www.youtube.com/embed/VIDEO_ID_3`

---

## 🎥 **URL Format Examples**

### ✅ **Correct Formats:**
```
https://www.youtube.com/embed/dQw4w9WgXcQ
https://www.youtube.com/embed/jfKfPfyJRdk
```

### ❌ **Wrong Formats:**
```
https://youtu.be/dQw4w9WgXcQ          ❌ (not embed format)
https://www.youtube.com/watch?v=ABC   ❌ (not embed format)
https://youtube.com/dQw4w9WgXcQ       ❌ (missing /embed/)
```

### 🔄 **How to Convert:**
```
Original:  https://youtu.be/dQw4w9WgXcQ
Embed:     https://www.youtube.com/embed/dQw4w9WgXcQ
           ↑ Just replace youtu.be with youtube.com/embed
```

---

## 🆓 **Why YouTube Live is Best**

✅ **100% FREE** - No limits, no costs  
✅ **Global Access** - Works anywhere in the world  
✅ **Unlimited Bandwidth** - Stream 24/7 if you want  
✅ **Reliable** - YouTube's infrastructure  
✅ **Easy Embed** - Works perfectly with iframes  
✅ **Mobile Friendly** - Works on all devices  
✅ **No Account Needed** - Viewers don't need YouTube account  

---

## 🔧 **Alternative Options**

### **Option 2: Twitch**
- Similar to YouTube
- Free streaming
- Embed URL: `https://player.twitch.tv/?channel=YOUR_CHANNEL&parent=klyraa.onrender.com`

### **Option 3: IP Webcam App + ngrok**
- More technical setup
- Requires running ngrok on computer
- Good for permanent installations

### **Option 4: Dedicated IP Cameras**
- Buy IP cameras (₹2000-5000 each)
- Use RTSP streams
- More professional but costs money

---

## 📊 **Current Camera URLs**

To view all camera URLs in your database:

```sql
SELECT 
    spot_number, 
    location, 
    camera_feed_url,
    CASE 
        WHEN camera_feed_url IS NULL THEN '❌ Not Set'
        WHEN camera_feed_url LIKE '%youtube%' THEN '✅ YouTube'
        ELSE '✅ Custom'
    END as status
FROM parking_spots 
ORDER BY spot_number;
```

---

## 🎬 **Demo/Testing**

Want to test without starting a live stream? Use these demo feeds:

### **Lofi Music Stream (24/7 Live):**
```sql
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/jfKfPfyJRdk'
WHERE spot_number = 'A-101';
```

### **Earth Live Stream:**
```sql
UPDATE parking_spots 
SET camera_feed_url = 'https://www.youtube.com/embed/86YLFOog4GM'
WHERE spot_number = 'B-202';
```

---

## 🔒 **Privacy Settings**

⚠️ **IMPORTANT:** Always set YouTube stream to **"Unlisted"**

- ✅ **Unlisted**: Only people with link can view (PERFECT)
- ❌ **Public**: Anyone can find it on YouTube (NOT RECOMMENDED)
- ❌ **Private**: Only you can view (WON'T WORK on website)

---

## 🐛 **Troubleshooting**

### **Problem: "Video unavailable"**
**Solution:**
- Check if stream is still live
- Verify URL is in embed format
- Make sure privacy is "Unlisted" not "Private"

### **Problem: Video not loading**
**Solution:**
- Clear browser cache
- Check if URL has `/embed/` in it
- Try opening URL directly in new tab

### **Problem: Black screen**
**Solution:**
- Phone camera might be off
- Check YouTube stream is active
- Restart the stream

### **Problem: Can't update URL in admin**
**Solution:**
- Make sure you're logged in as admin
- Click on a parking spot first
- Then click "Update URL"

---

## 📞 **Quick Support**

**Test URL Format:**
```
https://www.youtube.com/embed/dQw4w9WgXcQ
```
Copy this and replace `dQw4w9WgXcQ` with your video ID.

**Need Help?**
1. Check if YouTube stream is live
2. Verify URL format is correct
3. Test URL in browser first
4. Then update in admin panel

---

## ✅ **Checklist**

- [ ] YouTube Live started on phone
- [ ] Stream set to "Unlisted"
- [ ] Video ID copied
- [ ] URL converted to embed format
- [ ] URL updated in admin panel
- [ ] Tested on website
- [ ] Camera feed visible in live feed modal

---

## 🎉 **You're Done!**

Your live camera feed is now working globally! Users can watch their parking spots in real-time from anywhere in the world. 🌍

**Total Cost: ₹0** 💰
