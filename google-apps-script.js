// =====================================================================
// โค้ดสำหรับ Google Apps Script (Backend รับไฟล์รูปไปเก็บใน Google Drive)
// =====================================================================
// วิธีใช้งาน:
// 1. ไปที่ https://script.google.com/ สร้างโปรเจกต์ใหม่
// 2. ลบโค้ดเก่าทิ้ง แล้ว Copy โค้ดทั้งหมดนี้ไปวาง
// 3. กำหนดค่า MAIN_FOLDER_ID ด้านล่าง (ต้องสร้างโฟลเดอร์หลักใน Drive ก่อน แล้วเอา ID มาใส่)
// 4. กด "Deploy" (การทำให้ใช้งานได้) -> "New deployment" (การทำให้ใช้งานได้รายการใหม่)
// 5. เลือกประเภท "Web App" (เว็บแอป)
//    - Execute as: "Me" (อีเมลของคุณ)
//    - Who has access: "Anyone" (ทุกคน)
// 6. กด Deploy แล้ว Copy "Web app URL" ที่ได้ ไปใส่ในไฟล์ script.js ของโปรเจกต์
// =====================================================================

// ใส่ ID ของโฟลเดอร์หลักที่จะเก็บรูปร้านค้าทั้งหมด (เช่น "RUTS_Shop_Images")
// วิธีเอา ID: เข้า Google Drive เปิดโฟลเดอร์นั้น ดูที่ URL เช่น https://drive.google.com/drive/u/0/folders/1abcde... (เอาแค่ตัวอักษร 1abcde...)
const MAIN_FOLDER_ID = "ใส่_ID_โฟลเดอร์หลักของคุณที่นี่"; 

function doPost(e) {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No data received" }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(headers); // *Note: Apps Script standard response might override custom headers, 
                              // but using ContentService typically works for standard web apps if deployed correctly.
    }

    const data = JSON.parse(e.postData.contents);
    const shopName = data.shopName || "Unknown_Shop";
    const images = data.images || []; // Array ของ base64 strings

    if (images.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No images provided" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // เข้าถึงโฟลเดอร์หลัก
    const mainFolder = DriveApp.getFolderById(MAIN_FOLDER_ID);
    
    // สร้างชื่อโฟลเดอร์ย่อยตามชื่อร้านและวันที่
    const timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
    const subFolderName = "ร้าน_" + shopName + "_" + timestamp;
    
    // สร้างโฟลเดอร์ใหม่
    const shopFolder = mainFolder.createFolder(subFolderName);
    
    // กำหนดสิทธิ์ให้ทุกคนที่มี link สามารถดูได้ (เผื่อแอดมินคนอื่นดู)
    shopFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileUrls = [];

    // วนลูปอัพโหลดแต่ละไฟล์
    images.forEach(function(img, index) {
      const split = img.split(',');
      const mimeType = split[0].split(':')[1].split(';')[0]; 
      const base64Data = split[1];
      
      const extension = mimeType === "image/png" ? ".png" : ".jpg";
      const fileName = shopName + "_img" + (index + 1) + extension;
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
      const file = shopFolder.createFile(blob);
      
      fileUrls.push(file.getUrl());
    });

    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      folderUrl: shopFolder.getUrl(),
      fileUrls: fileUrls
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: error.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
