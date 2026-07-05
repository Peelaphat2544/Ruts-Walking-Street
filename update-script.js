const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf-8');

const replacement1 = `
  /* ─── UPLOAD IMAGES LOGIC ─── */
  const APPS_SCRIPT_URL = ''; // ให้ผู้ใช้ใส่ URL ตรงนี้
  let selectedImages = [];
  const maxImages = 3;
  
  const uploadZone = document.getElementById('upload-zone');
  const imageInput = document.getElementById('image-upload-input');
  const previewGrid = document.getElementById('preview-grid');
  const uploadError = document.getElementById('upload-error');
  
  if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault(); uploadZone.classList.remove('dragover');
      handleImageSelection(e.dataTransfer.files);
    });
    imageInput.addEventListener('change', (e) => handleImageSelection(e.target.files));
  }
  
  function handleImageSelection(files) {
    if(uploadError) uploadError.style.display = 'none';
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    if (selectedImages.length + newFiles.length > maxImages) {
      if(uploadError) { uploadError.innerText = 'เลือกรูปได้สูงสุด 3 รูปเท่านั้น'; uploadError.style.display = 'block'; }
      return;
    }
    
    newFiles.forEach(file => {
      if (file.size > 100 * 1024 * 1024) {
        if(uploadError) { uploadError.innerText = 'ขนาดไฟล์ต้องไม่เกิน 100MB'; uploadError.style.display = 'block'; }
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        compressImage(e.target.result, 1200, (compressedBase64) => {
          selectedImages.push(compressedBase64);
          renderPreviews();
        });
      };
      reader.readAsDataURL(file);
    });
    imageInput.value = '';
  }
  
  function compressImage(base64Str, maxWidth, callback) {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
  }
  
  function renderPreviews() {
    if (!previewGrid) return;
    previewGrid.innerHTML = selectedImages.map((src, i) => \`
      <div class="preview-item">
        <img src="\${src}" alt="Preview">
        <button type="button" class="preview-remove" onclick="removeImage(\${i})">✕</button>
      </div>
    \`).join('');
  }
  
  window.removeImage = (index) => {
    selectedImages.splice(index, 1);
    renderPreviews();
  };

  /* ─── APPLY FORM (with duplicate phone check) ─── */
  document.getElementById('form-apply').addEventListener('submit', async (e) => {`;

js = js.replace(/  \/\* ─── APPLY FORM \(with duplicate phone check\) ─── \*\/\r?\n  document\.getElementById\('form-apply'\)\.addEventListener\('submit', async \(e\) => \{/, replacement1);


const target2 = `      }

      btn.textContent = '⏳ กำลังส่งข้อมูล...';
      data.status    = 'pending';
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "shops"), data);
      window.showToast('ส่งข้อมูลสำเร็จ! คณะกรรมการจะพิจารณาและแจ้งผลภายหลัง', 'success', 6000);
      e.target.reset();
      document.getElementById('substitute-options').style.display = 'none';
    } catch(err) {
      window.showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');`;

const replacement2 = `      }

      // Check Images
      if (selectedImages.length < 2) {
        if(uploadError) { uploadError.innerText = 'กรุณาอัพโหลดรูปสินค้าอย่างน้อย 2 รูป'; uploadError.style.display = 'block'; }
        btn.disabled = false;
        btn.textContent = 'ส่งข้อมูลลงทะเบียน →';
        return;
      }
      
      if (!APPS_SCRIPT_URL) {
        window.showToast('ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ในโค้ด', 'error');
        btn.disabled = false;
        btn.textContent = 'ส่งข้อมูลลงทะเบียน →';
        return;
      }

      btn.textContent = '⏳ กำลังอัพโหลดรูปภาพ... (อาจใช้เวลาสักครู่)';
      const progressWrap = document.getElementById('upload-progress-wrap');
      const progressBar = document.getElementById('upload-progress-bar');
      if(progressWrap) progressWrap.style.display = 'block';
      if(progressBar) progressBar.style.width = '30%';

      // Upload Images to Apps Script
      const uploadRes = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ shopName: data.shopName, images: selectedImages })
      }).catch(err => { throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์อัพโหลดรูปได้: ' + err.message); });

      if(progressBar) progressBar.style.width = '80%';
      const uploadResult = await uploadRes.json();
      
      if (!uploadResult.success) {
        throw new Error('อัพโหลดรูปไม่สำเร็จ: ' + uploadResult.error);
      }
      if(progressBar) progressBar.style.width = '100%';

      btn.textContent = '⏳ กำลังบันทึกข้อมูล...';
      data.status    = 'pending';
      data.createdAt = serverTimestamp();
      data.folderUrl = uploadResult.folderUrl;
      data.fileUrls  = uploadResult.fileUrls || [];

      await addDoc(collection(db, "shops"), data);
      
      window.showToast('ส่งข้อมูลสำเร็จ! คณะกรรมการจะพิจารณาและแจ้งผลภายหลัง', 'success', 6000);
      e.target.reset();
      selectedImages = [];
      renderPreviews();
      if(progressWrap) progressWrap.style.display = 'none';
      if(progressBar) progressBar.style.width = '0%';
      document.getElementById('substitute-options').style.display = 'none';
    } catch(err) {
      window.showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
      if(document.getElementById('upload-progress-wrap')) document.getElementById('upload-progress-wrap').style.display = 'none';`;

js = js.replace(target2, replacement2);

fs.writeFileSync('script.js', js, 'utf-8');
console.log('script.js updated successfully!');
