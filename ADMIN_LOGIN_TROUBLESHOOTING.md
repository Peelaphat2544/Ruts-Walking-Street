# Admin Login Troubleshooting Guide

## ปัญหา: ล็อกอินเข้าระบบหลังบ้านไม่ได้

### ขั้นตอนในการ Debug:

#### 1. **ตรวจสอบ Browser Console**
   - กด `F12` เพื่อเปิด Developer Tools
   - ไปที่ tab `Console`
   - ลองล็อกอินอีกครั้ง
   - ตรวจสอบข้อมูลที่ปรากฏ

   **ดูหา:**
   - `Auth state changed: User: ...` - ล็อกอินสำเร็จ
   - `Login error: auth/...` - ข้อผิดพลาดการล็อกอิน
   - `Non-admin user tried to access:` - Email ไม่ตรงกับ admin

#### 2. **ตรวจสอบ Email**
   - ต้องใช้ **rutswalkingstreet@gmail.com** เท่านั้น
   - ห้ามใช้ email อื่น
   - ถ้าล็อกอินด้วย email ที่ไม่ถูกต้อง จะเห็นข้อความ: 
     ```
     ⚠️ คุณไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน
     ```

#### 3. **ตรวจสอบ Firebase Configuration**
   ถ้าเห็น error codes ต่อไปนี้:

   - **`auth/operation-not-allowed`**
     ```
     ❌ Google Sign-In ยังไม่ได้เปิดใช้งานใน Firebase Console
     ```
     **วิธีแก้:**
     1. ไปที่ Firebase Console: https://console.firebase.google.com
     2. เลือกโปรเจกต์ `ruts-walking-street`
     3. ไปที่ Authentication → Sign-in method
     4. เปิดใช้งาน **Google**
     5. ตั้ง Email support และ Project public name

   - **`auth/unauthorized-domain`**
     ```
     ❌ โดเมนนี้ไม่ได้รับอนุญาต
     ```
     **วิธีแก้:**
     1. ไปที่ Firebase Console → Authentication
     2. ไปที่ Settings
     3. เพิ่มโดเมนปัจจุบันลงใน Authorized domains
     4. ตัวอย่าง: `localhost:5000`, `example.com`

   - **`auth/invalid-api-key`**
     ```
     ❌ Firebase API key ไม่ถูกต้อง
     ```
     **วิธีแก้:**
     1. ตรวจสอบ API key ใน Firebase Console → Project Settings
     2. ตรวจสอบว่า `apiKey` ใน script.js ตรงกับ Firebase Console

   - **`auth/popup-blocked`**
     ```
     ❌ Popup ถูกปิดกั้น
     ```
     **วิธีแก้:**
     1. ตรวจสอบการตั้งค่า popup ของเบราว์เซอร์
     2. อนุญาต popup จากเว็บไซต์นี้

   - **`auth/network-request-failed`**
     ```
     ❌ เชื่อมต่อเน็ตเวิร์กล้มเหลว
     ```
     **วิธีแก้:**
     1. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
     2. ลองเปิด incognito mode
     3. ลองเบราว์เซอร์อื่น

#### 4. **ตรวจสอบ Network Tab**
   - ไปที่ `Network` tab ใน Developer Tools
   - ลองล็อกอินอีกครั้ง
   - ตรวจหาการร้องขอไปยัง:
     - `identitytoolkit.googleapis.com`
     - `securetoken.googleapis.com`
   - ถ้ามี error (HTTP 4xx, 5xx) นั่นคือปัญหา

#### 5. **ตรวจสอบ Firestore Security Rules**
   ถ้า login สำเร็จ แต่ข้อมูลไม่โหลด:
   
   1. ไปที่ Firebase Console → Firestore Database
   2. ไปที่ `Rules` tab
   3. ตรวจสอบว่ามี rule สำหรับ admin:
      ```
      match /shops/{document=**} {
        allow read, write: if request.auth.token.email == "rutswalkingstreet@gmail.com";
      }
      ```

#### 6. **ลองใช้ Browser อื่น**
   - บางครั้ง browser cache หรือ extensions มีปัญหา
   - ลองใช้ Chrome/Firefox/Safari ที่ต่างกัน

#### 7. **Clear Browser Cache**
   1. กด `Ctrl+Shift+Delete` (Windows) หรือ `Cmd+Shift+Delete` (Mac)
   2. เลือก "All time"
   3. เลือก "Cookies and other site data"
   4. เลือก "Cached images and files"
   5. คลิก "Clear data"

### ถ้ายังใช้ไม่ได้:
1. ตรวจสอบ Console ให้ละเอียด
2. จดบันทึก error message ที่ได้
3. ตรวจสอบ Firebase Console settings
4. ลองสร้าง test account ใหม่ใน Firebase

### ข้อมูลที่ต้องการสำหรับ Debug:
- Screenshot ของ error message
- Error code จาก Console
- Browser ที่ใช้
- URL ของเว็บไซต์
- Firebase Project ID: `ruts-walking-street`
- Admin Email: `rutswalkingstreet@gmail.com`
