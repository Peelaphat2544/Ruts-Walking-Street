# Firebase Login Error: auth/cancelled-popup-request

## ปัญหา
- ขึ้นข้อความ "ยกเลิกการล็อกอิน" (cancelled-popup-request)
- เหมือนก่อนเคย Login ได้ แต่ตอนนี้ล็อกอินไม่ได้

## สาเหตุที่เป็นไปได้

### 1. **Firestore Security Rules ยังไม่ได้ Publish** ⚠️ (สำคัญที่สุด)
- ระบบ frontend ส่ง request ไปหา Firestore
- ถ้า rules ไม่ถูกต้อง → Firestore ปฏิเสธ → popup error

### 2. **Google Sign-In ไม่ enable ใน Firebase**
- ต้อง enable Google as authentication provider

### 3. **Authorized domains ไม่ได้ add**
- Firebase ต้องรู้ว่า domain ไหน authorize ได้

### 4. **Multiple rapid login attempts**
- Code มี rate limiting: max 3 ครั้งใน 5 วินาที
- ถ้ากด login button หลายครั้งเร็วๆ → ขึ้นข้อความ "คุณกำลังล็อกอินบ่อยเกินไป"

---

## วิธีแก้ทีละขั้นตอน

### ขั้นตอน 1: Publish Firestore Security Rules (ลำดับความสำคัญ 🔴 สูงสุด)

**ในการเข้า Firebase Console:**

1. ไปที่ https://console.firebase.google.com/
2. เลือกโปรเจค **Ruts-Walking-Street**
3. เลือก **Firestore Database** จากเมนูด้านซ้าย
4. เลือก tab **Rules**
5. คัดลอก content จาก file `firestore-rules.txt` ในโปรเจค
6. Paste ลงในช่อง Rules editor
7. คลิก **Publish**

**Rules ควรมี:**
```
- isAdmin() function ที่เช็ค email == 'rutswalkingstreet@gmail.com'
- 6 collections: shops, leaves, renewals, config, payments, logs
- logs collection (ไม่ใช่ audit_logs)
```

✅ **ตรวจสอบว่า Rules published:** Click "Publish" ปุ่ม ต้องขึ้น green checkmark

---

### ขั้นตอน 2: Enable Google Sign-In Provider

1. ไปที่ **Authentication** > **Sign-in method** (เมนูด้านซ้าย)
2. ดู provider list ต้องมี **Google** โดยสถานะ enabled (green)
3. ถ้ายังไม่ enable:
   - คลิก **Google** provider
   - คลิก toggle **Enable**
   - Enter **Project name** (e.g., "Ruts Walking Street")
   - Enter **Project support email** (e.g., rutswalkingstreet@gmail.com)
   - Click **Save**

✅ **ตรวจสอบ:** Google provider ต้องมี green badge ว่า "Enabled"

---

### ขั้นตอน 3: Add Authorized Domains

1. ไปที่ **Authentication** > **Settings** (ไอคอน gear ด้านบนขวา)
2. ไปที่ tab **Authorized domains**
3. ต้องมี domain:
   - `localhost` (สำหรับ local development)
   - `rutswalkingstreet.web.app` (สำหรับ Firebase Hosting)
   - `YOUR_DOMAIN.com` (ถ้าใช้ domain เอง)

4. ถ้ายังไม่มี:
   - คลิก **Add domain**
   - Enter domain (e.g., `localhost`, `rutswalkingstreet.web.app`)
   - Click **Add**

✅ **ตรวจสอบ:** domain ต้องอยู่ในลิสต์

---

### ขั้นตอน 4: ทดสอบ Login

**ใน Browser:**

1. Open DevTools: Press `F12`
2. ไปที่ tab **Console**
3. Refresh หน้า: `Ctrl+R` หรือ `Cmd+R`
4. คลิก **Login** button
5. ดูผลลัพธ์:
   - ✅ **สำเร็จ:** Login popup ขึ้น → Enter email `rutswalkingstreet@gmail.com`
   - ❌ **Failed:** ดู error message ใน Console

---

## Common Error Messages & Solutions

| Error | สาเหตุ | วิธีแก้ |
|-------|-------|---------|
| `auth/cancelled-popup-request` | Firebase popup ถูก cancel หรือ Rules ไม่ถูก | Publish rules, check console |
| `auth/popup-blocked` | Browser block popup | Allow popups ใน browser settings |
| `auth/unauthorized-domain` | Domain ไม่ authorize | Add authorized domain (ขั้นตอน 3) |
| `auth/operation-not-allowed` | Google Sign-In ไม่ enable | Enable Google provider (ขั้นตอน 2) |
| `auth/invalid-api-key` | Firebase API key invalid | ตรวจสอบ firebaseConfig ใน script.js |
| `auth/network-request-failed` | Network error หรือ internet ไม่เชื่อมต่อ | Check internet connection |

---

## Debug Mode: Check Console Logs

**ทดสอบด้วย DevTools (F12):**

ควรเห็น log messages แบบนี้:

```javascript
// เมื่อ login สำเร็จ:
Auth state changed: User: rutswalkingstreet@gmail.com
Admin access granted: rutswalkingstreet@gmail.com

// เมื่อ login ล้มเหลว:
Auth state changed: No user
[Error message จะแสดงใน toast]
```

---

## Troubleshooting Checklist

- [ ] **Firestore Rules Published?** (ขั้นตอน 1)
  - Go to Firestore > Rules > Check "Last published" date
  
- [ ] **Google Sign-In Enabled?** (ขั้นตอน 2)
  - Go to Authentication > Sign-in method > Google has green badge
  
- [ ] **Authorized Domains Added?** (ขั้นตอน 3)
  - Go to Authentication > Settings > Authorized domains includes your URL
  
- [ ] **Firebase Config Correct?** (ใน script.js)
  - Check firebaseConfig object has: apiKey, authDomain, projectId, etc.
  
- [ ] **Browser Console Clear?** (F12)
  - No red errors shown
  - Auth state change logged correctly
  
- [ ] **Email is Admin Email?**
  - Verify email = `rutswalkingstreet@gmail.com`
  - Check ADMIN_EMAIL constant ใน script.js

---

## Still Not Working?

**ตรวจสอบเพิ่มเติม:**

1. **Clear Browser Cache:**
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Select "Cookies and cached images and files"
   - Click "Clear"

2. **Check Firebase Console Status:**
   - https://status.firebase.google.com/
   - Ensure all services are "Operational"

3. **Contact Support:**
   - Include error message from DevTools Console
   - Include firebaseConfig details
   - Mention steps already tried

---

## Quick Reference: Expected Behavior

### ✅ Login Success Flow:
```
1. User clicks "เข้าสู่ระบบหลังบ้าน"
2. Google popup appears
3. User signs in with rutswalkingstreet@gmail.com
4. Firestore Rules allow access
5. Admin panel appears
6. Dashboard loads with shop data
```

### ❌ Login Failure Flow:
```
1. User clicks "เข้าสู่ระบบหลังบ้าน"
2. Google popup appears/doesn't appear
3. Error message shows in toast
4. Check DevTools > Console for details
5. Apply fixes from this guide
```

---

**Last Updated:** 2025
**Firebase Security Rules Status:** firestore-rules.txt (Ready to publish)
