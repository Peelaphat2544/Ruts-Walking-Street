# วิธีตั้ง Firestore Security Rules

## ขั้นตอนการตั้งค่า

### 1. เข้า Firebase Console
```
https://console.firebase.google.com
```

### 2. เลือกโปรเจกต์ `ruts-walking-street`

### 3. ไปที่ Firestore Database
- ด้านซ้าย: Click "Firestore Database"

### 4. ไปที่ Rules
- คลิก tab `Rules` ที่ด้านบน

### 5. Copy กฎทั้งหมด
- เปิดไฟล์ `firestore-rules.txt` จากโปรเจกต์
- Copy ทั้งหมด (Ctrl+A, Ctrl+C)

### 6. วาง Rules ใน Firebase Console
- ลบกฎเก่าทั้งหมด (หรือเลือกทั้งหมด)
- Paste rules ใหม่

### 7. คลิก "Publish"
- ปุ่มสีฟ้าที่ด้านขวาบน
- รอให้ publish เสร็จ (ประมาณ 1-2 นาที)

---

## ตรวจสอบว่าสำเร็จ

### ✅ ถ้า Publish สำเร็จ
```
"Rules updated at" + วันเวลา
```

### ❌ ถ้าเกิด Error
- ตรวจสอบการพิมพ์ (Syntax error)
- ตรวจสอบ email ที่ใช้ (ต้องเป็น rutswalkingstreet@gmail.com)
- ลองคัดลอก rules ใหม่

---

## สิ่งที่ Rules นี้ทำ

### Public (ทั้งหมด)
- ✅ ดูได้: shops, leaves, renewals, config
- ✅ สร้างได้: shops, leaves, renewals

### Private (Admin เท่านั้น)
- ✅ เขียนได้: payments, logs
- ✅ อนุมัติ/แก้ไข/ลบ: shops, leaves, renewals

---

## หากล็อกอินยังไม่ได้

1. **Publish Rules สำเร็จแล้ว?**
   - เข้า Firebase Console → Firestore → Rules
   - ตรวจสอบว่ามี "Rules updated at" ไหม

2. **Email ถูกต้องหรือ?**
   - ต้องใช้: `rutswalkingstreet@gmail.com`
   - ตรวจสอบใน Rules ว่าถูกต้อง

3. **Google Sign-In เปิดใช้งานหรือ?**
   - Firebase Console → Authentication
   - Sign-in method → Google (ต้องเปิด)

4. **ดูหา Error ใน Browser Console**
   - F12 → Console tab
   - ลองล็อกอินอีกครั้ง
   - ดูข้อมูลที่ปรากฏ

---

## ปัญหาเบื้องต้น

### "Permission denied" เมื่อล็อกอิน
- ✅ Rules ยังไม่ publish หรือ
- ✅ Email ไม่ตรงกับ admin email

### "auth/operation-not-allowed"
- ✅ Google Sign-In ยังไม่เปิด
- ไปที่ Authentication → Sign-in method → เปิด Google

### "auth/unauthorized-domain"
- ✅ ต้องเพิ่มโดเมนใน Firebase
- Authentication → Settings → Authorized domains
- เพิ่มโดเมนของเว็บไซต์

---

## ตรวจสอบ Rules ทำงานถูกต้อง

หลังจาก l็อกอิน ลองสิ่งต่อไปนี้:

1. **ดูร้านค้า (Shop)**
   - ✅ สามารถดูได้
   - ✅ สามารถเพิ่ม/แก้ไข/ลบได้ (ด้วยสิทธิ์ admin)

2. **ดูการแจ้งลา (Leaves)**
   - ✅ สามารถดูได้
   - ✅ สามารถอนุมัติได้ (ด้วยสิทธิ์ admin)

3. **ดูการยืนยันสิทธิ์ (Renewals)**
   - ✅ สามารถดูได้
   - ✅ สามารถอนุมัติได้ (ด้วยสิทธิ์ admin)

---

ถ้ายังมีปัญหา ให้ลองตรวจสอบข้อความใน Browser Console ว่าบอกว่าอะไร
