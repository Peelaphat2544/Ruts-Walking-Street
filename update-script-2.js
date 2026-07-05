const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf-8');

const target3 = `            pending += \`<tr>
              <td>\${a.createdAt?.toDate().toLocaleDateString('th-TH') || '—'}</td>
              <td><strong>\${a.shopName}</strong>\${subDate}</td>
              <td>\${a.firstName} \${a.lastName}</td>
              <td>\${a.phone}</td>
              <td>\${a.category || '—'}</td>
              <td><button class="btn btn-primary btn-sm" onclick="window.openApprove('\${a.id}','\${a.shopName}', \${isSub})">จัดการ</button></td>
            </tr>\`;`;

const replacement3 = `            const btnGallery = (a.fileUrls && a.fileUrls.length > 0) || a.folderUrl ? \`<button class="btn btn-ghost btn-sm" style="margin-right:4px;" onclick="window.openGallery('\${a.id}')">📷 ดูรูป</button>\` : '';
            pending += \`<tr>
              <td>\${a.createdAt?.toDate().toLocaleDateString('th-TH') || '—'}</td>
              <td><strong>\${a.shopName}</strong>\${subDate}</td>
              <td>\${a.firstName} \${a.lastName}</td>
              <td>\${a.phone}</td>
              <td>\${a.category || '—'}</td>
              <td>\${btnGallery}<button class="btn btn-primary btn-sm" onclick="window.openApprove('\${a.id}','\${a.shopName}', \${isSub})">จัดการ</button></td>
            </tr>\`;`;

js = js.replace(target3, replacement3);

const galleryLogic = `
  /* ─── GALLERY LOGIC ─── */
  window.openGallery = (shopId) => {
    const shopData = _shopsCache[shopId];
    if (!shopData) return;
    document.getElementById('gallery-shop-name').innerText = shopData.shopName || 'ไม่มีชื่อร้าน';
    const container = document.getElementById('gallery-container');
    container.innerHTML = '';
    
    if (shopData.fileUrls && shopData.fileUrls.length > 0) {
      container.innerHTML = shopData.fileUrls.map(url => \`
        <div class="gallery-img-wrap">
          <img src="\${url}" onclick="window.open('\${url}','_blank')" alt="Shop Image">
        </div>
      \`).join('');
    } else {
      container.innerHTML = '<div class="td-empty">ไม่มีรูปภาพสินค้า</div>';
    }

    if (shopData.folderUrl) {
      container.innerHTML += \`<div style="grid-column: 1 / -1; margin-top: 10px; text-align: center;">
        <a href="\${shopData.folderUrl}" target="_blank" class="btn btn-primary" style="text-decoration:none; display:inline-block;">📂 เปิดดูใน Google Drive</a>
      </div>\`;
    }

    document.getElementById('modal-gallery').style.display = 'block';
    document.getElementById('modal-bg').style.display = 'block';
  };
`;

js = js + galleryLogic;

fs.writeFileSync('script.js', js, 'utf-8');
console.log('script.js gallery updated successfully!');
