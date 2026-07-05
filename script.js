import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
  import {
    getFirestore, collection, addDoc, getDocs, doc,
    updateDoc, query, where, serverTimestamp, orderBy,
    limit, deleteDoc, getDoc, setDoc
  } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
  import {
    getAuth, signInWithPopup, GoogleAuthProvider,
    onAuthStateChanged, signOut
  } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

  /* ─── CONFIG ─── */
  const firebaseConfig = {
    apiKey: "AIzaSyARN_CaKaCZ6zPUHhJmeWvOrwfz8WMcLGI",
    authDomain: "ruts-walking-street.firebaseapp.com",
    projectId: "ruts-walking-street",
    storageBucket: "ruts-walking-street.firebasestorage.app",
    messagingSenderId: "600846308323",
    appId: "1:600846308323:web:9cfae5100824f2ed6b86d6",
    measurementId: "G-2T6D49EDVP"
  };

  const app  = initializeApp(firebaseConfig);
  const db   = getFirestore(app);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  const ADMIN_EMAIL = "rutswalkingstreet@gmail.com";
  let currentId = null;
  // Cache of shops for leave table name resolution
  let _shopsCache = {};

  /* ══════════════════════════════════════════
     TOAST NOTIFICATION SYSTEM
  ══════════════════════════════════════════ */
  const TOAST_ICONS = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };

  window.showToast = (msg, type = 'success', duration = 4000) => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${TOAST_ICONS[type]}</span>
      <span class="toast-msg">${msg}</span>
      <button class="toast-close" onclick="this.parentElement.classList.add('out'); setTimeout(()=>this.parentElement.remove(), 300)">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 320);
    }, duration);
  };

  /* ══════════════════════════════════════════
     CUSTOM CONFIRM DIALOG
  ══════════════════════════════════════════ */
  window._confirmResolve = null;

  window.showConfirm = (msg, title = 'ยืนยันการดำเนินการ', icon = '⚠️', okLabel = 'ยืนยัน', okClass = 'btn-danger') => {
    return new Promise(resolve => {
      document.getElementById('confirm-msg').innerHTML   = msg;
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-icon').textContent  = icon;
      document.getElementById('confirm-ok-btn').textContent = okLabel;
      document.getElementById('confirm-ok-btn').className   = `btn ${okClass}`;
      document.getElementById('confirm-box').style.display = 'block';
      document.getElementById('confirm-bg').style.display  = 'block';
      window._confirmResolve = (result) => {
        document.getElementById('confirm-box').style.display = 'none';
        document.getElementById('confirm-bg').style.display  = 'none';
        resolve(result);
      };
    });
  };

  /* ══════════════════════════════════════════
     AUDIT LOG
  ══════════════════════════════════════════ */
  async function logAction(action, detail, type = 'action') {
    try {
      await addDoc(collection(db, "logs"), {
        admin:     auth.currentUser?.email || 'system',
        action,
        detail,
        type,
        timestamp: serverTimestamp()
      });
    } catch(e) { console.warn('logAction:', e); }
  }

  /* ─── NAVIGATION ─── */
  window.showPage = (name, btn) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');

    if (btn) {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }

    if (name === 'home')  loadStats();
    if (name === 'map')   loadMap();
    if (name === 'leave') loadShopDropdown('leave-shopId');
    if (name === 'renew') loadShopDropdown('renew-shopId');
  };

  window.closeModal = () => {
    document.querySelectorAll('.modal-box, .modal-bg').forEach(el => el.style.display = 'none');
  };

  window.openCheckStatusModal = () => {
    document.getElementById('modal-check-status').style.display = 'block';
    document.getElementById('modal-bg').style.display = 'block';
    document.getElementById('check-res').innerHTML = '';
    document.getElementById('check-phone').value = '';
  };

  /* ─── STATS (PUBLIC) ─── */
  async function loadStats() {
    try {
      const snap  = await getDocs(collection(db, "shops"));
      const shops = snap.docs.map(d => d.data());
      const active = shops.filter(s => s.status === 'active').length;
      const leave  = shops.filter(s => s.status === 'leave').length;
      document.getElementById('st-active').innerText  = active + leave;
      document.getElementById('st-pending').innerText = shops.filter(s => s.status === 'pending').length;
      document.getElementById('st-empty').innerText   = 185 - active - leave;
    } catch(e) { console.warn('loadStats:', e); }
  }

  /* ─── SHOP DROPDOWN ─── */
  async function loadShopDropdown(id) {
    try {
      const q    = query(collection(db, "shops"), where("status", "in", ["active", "leave", "T2"]));
      const snap = await getDocs(q);
      const html = '<option value="">— เลือกชื่อร้านค้า —</option>'
        + snap.docs.map(d => `<option value="${d.id}">${d.data().shopName}</option>`).join('');
      document.getElementById(id).innerHTML = html;
    } catch(e) { console.warn('loadShopDropdown:', e); }
  }


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
    previewGrid.innerHTML = selectedImages.map((src, i) => `
      <div class="preview-item">
        <img src="${src}" alt="Preview">
        <button type="button" class="preview-remove" onclick="removeImage(${i})">✕</button>
      </div>
    `).join('');
  }
  
  window.removeImage = (index) => {
    selectedImages.splice(index, 1);
    renderPreviews();
  };

  /* ─── APPLY FORM (with duplicate phone check) ─── */
  document.getElementById('form-apply').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-apply');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังตรวจสอบข้อมูล...';
    try {
      const data = Object.fromEntries(new FormData(e.target));

      // Check duplicate phone
      const dupQ    = query(collection(db, "shops"), where("phone", "==", data.phone));
      const dupSnap = await getDocs(dupQ);
      if (!dupSnap.empty) {
        const existing = dupSnap.docs[0].data();
        const ok = await window.showConfirm(
          `พบข้อมูลเบอร์โทร <strong>${data.phone}</strong> อยู่ในระบบแล้ว<br>
          (ร้าน: <strong>${existing.shopName}</strong> สถานะ: ${existing.status})<br><br>
          ต้องการส่งใบสมัครใหม่ต่อไปหรือไม่?`,
          'พบเบอร์โทรซ้ำในระบบ', '⚠️', 'ส่งต่อไป', 'btn-primary'
        );
        if (!ok) {
          btn.disabled = false;
          btn.textContent = 'ส่งข้อมูลลงทะเบียน →';
          return;
        }
      }

      btn.textContent = '⏳ กำลังส่งข้อมูล...';
      data.status    = 'pending';
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "shops"), data);
      window.showToast('ส่งข้อมูลสำเร็จ! คณะกรรมการจะพิจารณาและแจ้งผลภายหลัง', 'success', 6000);
      e.target.reset();
      document.getElementById('substitute-options').style.display = 'none';
    } catch(err) {
      window.showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'ส่งข้อมูลลงทะเบียน →';
    }
  });

  /* ─── LEAVE FORM ─── */
  document.getElementById('form-leave').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-leave');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังส่งคำขอ...';
    try {
      const data = Object.fromEntries(new FormData(e.target));
      if (!data.shopId) { window.showToast('กรุณาเลือกร้านค้า', 'warning'); return; }
      data.status    = 'pending';
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "leaves"), data);
      window.showToast('ส่งคำขอแจ้งหยุดสำเร็จ! รอคณะกรรมการอนุมัติ', 'success', 5000);
      e.target.reset();
    } catch(err) {
      window.showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'ส่งคำขอแจ้งหยุดจำหน่าย';
    }
  });

  /* ─── RENEW FORM ─── */
  document.getElementById('form-renew').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(e.target));
      if (!data.shopId) { window.showToast('กรุณาเลือกร้านค้า', 'warning'); return; }
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "renewals"), data);

      if (data.response === 'no') {
        window.showToast('ระบบได้รับแจ้งการสละสิทธิ์ของท่านแล้ว คณะกรรมการจะดำเนินการต่อไป', 'info', 6000);
      } else {
        window.showToast('บันทึกผลการยืนยันสิทธิ์เรียบร้อย ขอบคุณครับ', 'success');
      }
      e.target.reset();
      window.showPage('home');
    } catch(err) {
      window.showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  });

  /* ─── CHECK STATUS ─── */
  window.checkStatus = async () => {
    const phone = document.getElementById('check-phone').value.trim();
    const res   = document.getElementById('check-res');
    if (phone.length < 9) { res.innerHTML = '<div class="info-box amber">⚠️ กรุณากรอกเบอร์โทรให้ครบ</div>'; return; }

    res.innerHTML = '<div style="text-align:center; padding:16px; color:var(--muted);">⏳ กำลังค้นหา...</div>';
    try {
      const q    = query(collection(db, "shops"), where("phone", "==", phone));
      const snap = await getDocs(q);
      if (snap.empty) {
        res.innerHTML = '<div class="info-box amber">❌ ไม่พบข้อมูล กรุณาตรวจสอบเบอร์โทรอีกครั้ง</div>';
        return;
      }
      const statusMap = {
        active:    { label: 'เปิดขายปกติ',       cls: 'badge-active' },
        pending:   { label: 'รอการอนุมัติ',       cls: 'badge-pending' },
        leave:     { label: 'แจ้งลา',             cls: 'badge-leave' },
        T2:        { label: 'ระงับสิทธิ์ (T2)',   cls: 'badge-t2' },
        cancelled: { label: 'ยกเลิกสิทธิ์',      cls: 'badge-cancelled' }
      };
      res.innerHTML = snap.docs.map(d => {
        const s  = d.data();
        const st = statusMap[s.status] || { label: s.status, cls: '' };
        return `<div style="background:var(--surface); padding:16px; border-radius:10px; margin-bottom:8px; border:1px solid var(--border-l);">
          <div style="font-weight:700; font-size:15px; margin-bottom:6px;">${s.shopName}</div>
          <div style="font-size:13px; color:var(--muted); margin-bottom:8px;">
            ${s.firstName} ${s.lastName} · ล็อก: ${s.slots || 'ยังไม่กำหนด'} · ${s.category || ''}
          </div>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>`;
      }).join('');
    } catch(err) {
      res.innerHTML = '<div class="info-box amber">เกิดข้อผิดพลาด: ' + err.message + '</div>';
    }
  };

  /* ─── MAP ─── */
  window.renderMap = (canvasId, shopsBySlot) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:inline-grid; grid-template-columns: auto 18px auto 1fr; grid-template-rows: auto 18px auto 18px auto; gap:6px; align-items:end; padding:10px;';

    const colorMap = {
      'อาหาร':                    { bg: 'var(--slot-food-bg)',    b: 'var(--slot-food-b)' },
      'เครื่องดื่ม':              { bg: 'var(--slot-drink-bg)',   b: 'var(--slot-drink-b)' },
      'เสื้อผ้าและของใช้':       { bg: 'var(--slot-fashion-bg)', b: 'var(--slot-fashion-b)' },
      'รถฟู้ดทรัค (Food Truck)': { bg: 'var(--slot-truck-bg)',   b: 'var(--slot-truck-b)' }
    };

    const makeCell = (i) => {
      const s   = shopsBySlot[i];
      const div = document.createElement('div');
      div.className = 'slot-cell';
      if (s) {
        if (s.status === 'T2') {
          div.style.backgroundColor = 'var(--slot-t2-bg)';
          div.style.borderColor     = 'var(--slot-t2-b)';
        } else if (s.status === 'leave') {
          div.style.backgroundColor = 'var(--slot-leave-bg)';
          div.style.borderColor     = 'var(--slot-leave-b)';
        } else if (colorMap[s.category]) {
          div.style.backgroundColor = colorMap[s.category].bg;
          div.style.borderColor     = colorMap[s.category].b;
        }
      }
      div.innerHTML = `<span class="slot-no">${i}</span><span class="slot-name">${s?.shopName || ''}</span>`;

      if (window.adminMode && s) {
        div.style.cursor = 'pointer';
        div.title = 'คลิกเพื่อแก้ไขข้อมูลร้าน';
        div.addEventListener('click', () => window.openEditShop(s.id));
      } else if (window.adminMode && !s) {
        div.style.cursor = 'pointer';
        div.title = 'คลิกเพื่อเพิ่มร้านค้าใหม่';
        div.addEventListener('click', () => window.openAddShop(i));
      }

      div.addEventListener('mouseenter', (e) => {
        const tt = document.getElementById('slot-tooltip');
        tt.innerHTML = s
          ? `<strong>${s.shopName}</strong><br>ล็อก: ${i} · ${s.category || '—'}<br>สถานะ: ${s.status}`
          : `<strong>ล็อก ${i}</strong><br>ว่าง`;
        tt.style.display = 'block';
      });
      div.addEventListener('mousemove', (e) => {
        const tt = document.getElementById('slot-tooltip');
        tt.style.left = (e.clientX + 14) + 'px';
        tt.style.top  = (e.clientY + 14) + 'px';
      });
      div.addEventListener('mouseleave', () => {
        document.getElementById('slot-tooltip').style.display = 'none';
      });
      return div;
    };

    const left = document.createElement('div');
    left.style.cssText = 'grid-column:1; display:flex; flex-direction:column; gap:4px;';
    for (let i = 185; i >= 146; i--) left.appendChild(makeCell(i));

    const aisleV = document.createElement('div');
    aisleV.style.cssText = 'grid-column:2; height:100%; background:#e8ede9; border-radius:4px; writing-mode:vertical-rl; text-align:center; font-size:10px; color:#aaa; display:flex; align-items:center; justify-content:center;';
    aisleV.innerText = 'ทางเดิน';

    const right = document.createElement('div');
    right.style.cssText = 'grid-column:3; display:flex; flex-direction:column; gap:4px;';
    for (let i = 1; i <= 41; i++) right.appendChild(makeCell(i));

    const park = document.createElement('div');
    park.style.cssText = 'grid-column:4; display:flex; align-items:flex-end; padding:20px;';
    park.innerHTML = `<div style="background:linear-gradient(135deg,#f0fff7,#e4faf0); border:2px dashed #6dcf9e; border-radius:14px; width:100%; min-width:260px; height:200px; display:flex; align-items:center; justify-content:center; color:#1a6640; font-weight:bold; font-size:15px; font-family:'Mitr',sans-serif;">🌳 ลานกิจกรรม<br>พื้นที่สีเขียว</div>`;

    const botRow = document.createElement('div');
    botRow.style.cssText = 'grid-column:1/span 4; grid-row:3; display:flex; gap:4px; overflow-x:auto; padding-bottom:4px;';
    for (let i = 42; i <= 92; i++) botRow.appendChild(makeCell(i));

    const aisleH = document.createElement('div');
    aisleH.style.cssText = 'grid-column:1/span 4; grid-row:4; height:18px; background:#e8ede9; border-radius:4px; display:flex; align-items:center; padding:0 10px; font-size:10px; color:#aaa;';
    aisleH.innerText = 'ทางเดินหลัก';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'grid-column:1/span 4; grid-row:5; display:flex; gap:4px; overflow-x:auto; padding-bottom:4px;';
    for (let i = 145; i >= 93; i--) topRow.appendChild(makeCell(i));

    wrap.append(left, aisleV, right, park, botRow, aisleH, topRow);
    canvas.appendChild(wrap);
  };

  async function loadMap() {
    const loading = document.getElementById('map-loading');
    if (loading) loading.style.display = 'block';
    try {
      const snap = await getDocs(collection(db, "shops"));
      const map  = {};
      snap.forEach(d => {
        const data = d.data();
        data.id = d.id;
        String(data.slots || '').split(',').forEach(s => {
          const n = s.trim();
          if (n) map[n] = data;
        });
      });
      window.renderMap('map-canvas', map);
    } catch(e) { console.warn('loadMap:', e); }
    finally { if (loading) loading.style.display = 'none'; }
  }

  /* ══════════════════════════════════════════
     PAYMENTS (with stats bar)
  ══════════════════════════════════════════ */
  window.loadPaymentGrid = async () => {
    const date = document.getElementById('pay-date').value;
    if (!date) { window.showToast('กรุณาเลือกวันที่', 'warning'); return; }

    try {
      const shopsSnap = await getDocs(query(collection(db, "shops"), where("status", "==", "active")));
      const paySnap   = await getDocs(query(collection(db, "payments"), where("date", "==", date)));
      const paidIds   = paySnap.docs.map(d => d.data().shopId);

      const shopsData = [];
      shopsSnap.forEach(d => {
        const s = d.data(); s.id = d.id;
        shopsData.push(s);
      });
      shopsData.sort((a, b) => {
        const fn = (slots) => { if (!slots) return 9999; const f = String(slots).split(',')[0].trim(); return parseInt(f) || 9999; };
        return fn(a.slots) - fn(b.slots);
      });

      const paidCount   = shopsData.filter(s => paidIds.includes(s.id)).length;
      const unpaidCount = shopsData.length - paidCount;
      const pct         = shopsData.length ? Math.round(paidCount / shopsData.length * 100) : 0;

      // Stats bar
      const statsBar = document.getElementById('payment-stats-bar');
      statsBar.style.display = 'grid';
      statsBar.innerHTML = `
        <div class="pay-stat paid"><div class="pn">${paidCount}</div><div class="pl">✅ จ่ายแล้ว</div></div>
        <div class="pay-stat unpaid"><div class="pn">${unpaidCount}</div><div class="pl">❌ ยังไม่จ่าย</div></div>
        <div class="pay-stat total"><div class="pn">${shopsData.length}</div><div class="pl">🏪 ทั้งหมด (${pct}%)</div></div>
      `;
      const progress = document.getElementById('payment-progress');
      progress.style.display = 'block';
      setTimeout(() => {
        document.getElementById('payment-progress-fill').style.width = pct + '%';
      }, 100);

      let rows = '';
      shopsData.forEach(s => {
        const isPaid = paidIds.includes(s.id);
        rows += `<tr>
          <td>${s.slots || '—'}</td>
          <td><strong>${s.shopName}</strong></td>
          <td>${isPaid ? '<span class="badge badge-active">✅ จ่ายแล้ว</span>' : '<span class="badge badge-t2">❌ ยังไม่จ่าย</span>'}</td>
          <td>${isPaid ? '' : `<button class="btn btn-primary btn-sm" onclick="window.confirmPay('${s.id}','${date}')">บันทึกรับเงิน</button>`}</td>
        </tr>`;
      });

      document.getElementById('payment-grid-wrap').innerHTML = `
        <table>
          <thead><tr><th>พื้นที่</th><th>ร้านค้า</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="td-empty">ไม่มีร้านค้า</td></tr>'}</tbody>
        </table>`;
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  window.confirmPay = async (shopId, date) => {
    try {
      await addDoc(collection(db, "payments"), {
        shopId, date,
        timestamp: serverTimestamp(),
        admin: auth.currentUser?.email || 'unknown'
      });
      await logAction('บันทึกชำระเงิน', `shopId: ${shopId}, วันที่: ${date}`);
      window.showToast('บันทึกการชำระเงินสำเร็จ', 'success');
      window.loadPaymentGrid();
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  window.exportPaymentPDF = () => {
    const date = document.getElementById('pay-date').value;
    if (!date) return window.showToast('กรุณาเลือกวันที่และดึงรายชื่อก่อน Export', 'warning');
    const element = document.getElementById('payment-grid-wrap');
    if (!element || element.innerHTML.includes('ไม่มีร้านค้า')) return window.showToast('ไม่มีข้อมูลสำหรับ Export', 'warning');
    const tempDiv = document.createElement('div');
    tempDiv.style.padding = '20px';
    tempDiv.style.fontFamily = "'Sarabun', sans-serif";
    tempDiv.innerHTML = `
      <h2 style="text-align:center; font-family:'Mitr', sans-serif; color:#1A7A52; margin-bottom:20px;">
        รายงานสถานะการชำระเงิน RUTS Walking Street
      </h2>
      <p style="text-align:center; font-size:14px; margin-bottom:20px;">ประจำวันที่: ${new Date(date).toLocaleDateString('th-TH')}</p>
      ${element.outerHTML}
    `;
    const buttons = tempDiv.querySelectorAll('button');
    buttons.forEach(b => b.style.display = 'none');
    const ths = tempDiv.querySelectorAll('th');
    if (ths.length > 0) ths[ths.length - 1].innerText = 'หมายเหตุ';
    const opt = {
      margin: 10,
      filename: `Payment_Report_${date}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 800 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' }
    };
    html2pdf().set(opt).from(tempDiv).save();
  };

  /* ─── SYSTEM CONFIG ─── */
  async function loadSystemConfig() {
    try {
      const snap = await getDoc(doc(db, "config", "system"));
      if (!snap.exists()) return;
      const c = snap.data();
      const v = c.visibility || {};

      const applyBtn = document.getElementById('btn-m-apply');
      const mapBtn   = document.getElementById('btn-m-map');
      if (applyBtn) applyBtn.style.display = v.apply ? '' : 'none';
      if (mapBtn)   mapBtn.style.display   = v.map   ? '' : 'none';

      const statsGrid = document.getElementById('public-stats-grid');
      if (statsGrid) statsGrid.style.display = v.stats ? 'grid' : 'none';

      document.querySelectorAll('.service-card').forEach(card => {
        const oc = card.getAttribute('onclick') || '';
        if (oc.includes("showPage('apply'")) card.style.display = v.apply ? '' : 'none';
        if (oc.includes("showPage('map'"))   card.style.display = v.map   ? '' : 'none';
      });

      const banner  = document.getElementById('announcement-banner');
      const annText = document.getElementById('announcement-text');
      if (c.announcement) {
        annText.innerText    = c.announcement;
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }

      const r = c.renew_period || {};
      document.getElementById('renew-box-open').style.display   = r.open ? 'block' : 'none';
      document.getElementById('renew-box-closed').style.display = r.open ? 'none'  : 'block';
      if (r.open) {
        document.getElementById('renew-sem-label').innerText      = r.semester || '';
        document.getElementById('renew-deadline-label').innerText = r.deadline || '';
      }

      const sub    = c.substitute_period || {};
      const subMsg = document.getElementById('substitute-schedule-msg');
      if (sub.start && sub.end) {
        subMsg.innerHTML = `เปิดรับลงทะเบียนขายแทน:<br>ตั้งแต่วันที่ ${new Date(sub.start).toLocaleDateString('th-TH')} ถึง ${new Date(sub.end).toLocaleDateString('th-TH')}`;
        const now = new Date();
        if (now >= new Date(sub.start) && now <= new Date(sub.end)) {
          document.getElementById('substituteDateInput').disabled = false;
        } else {
          document.getElementById('substituteDateInput').disabled = true;
          subMsg.innerHTML += '<br><span style="color:red;">(ขณะนี้อยู่นอกช่วงเวลาลงทะเบียน)</span>';
        }
      } else {
        subMsg.innerHTML = 'ยังไม่มีการกำหนดช่วงเวลาลงทะเบียนขายแทน';
        document.getElementById('substituteDateInput').disabled = true;
      }

      document.getElementById('apply-closed-msg').style.display = v.apply ? 'none' : 'flex';

      if (window.adminMode) {
        document.getElementById('vis-apply').checked    = !!v.apply;
        document.getElementById('vis-map').checked      = !!v.map;
        document.getElementById('vis-stats').checked    = !!v.stats;
        document.getElementById('set-renew-sem').value  = r.semester || '';
        document.getElementById('set-renew-end').value  = r.deadline || '';
        document.getElementById('set-renew-open').checked = !!r.open;
        document.getElementById('set-announcement').value = c.announcement || '';
        if (c.leave_period) {
          document.getElementById('set-leave-start').value = c.leave_period.start || '';
          document.getElementById('set-leave-end').value   = c.leave_period.end   || '';
        }
        if (c.substitute_period) {
          document.getElementById('set-sub-start').value = c.substitute_period.start || '';
          document.getElementById('set-sub-end').value   = c.substitute_period.end   || '';
        }
      }
    } catch(e) { console.warn('loadSystemConfig:', e); }
  }

  window.saveConfig = async (type) => {
    try {
      const ref = doc(db, "config", "system");
      let update = {};
      if (type === 'visibility') {
        update.visibility = {
          apply: document.getElementById('vis-apply').checked,
          map:   document.getElementById('vis-map').checked,
          stats: document.getElementById('vis-stats').checked
        };
      } else if (type === 'renew_period') {
        update.renew_period = {
          semester: document.getElementById('set-renew-sem').value,
          deadline: document.getElementById('set-renew-end').value,
          open:     document.getElementById('set-renew-open').checked
        };
      } else if (type === 'announcement') {
        update.announcement = document.getElementById('set-announcement').value;
      } else if (type === 'leave_period') {
        update.leave_period = {
          start: document.getElementById('set-leave-start').value,
          end:   document.getElementById('set-leave-end').value
        };
      } else if (type === 'substitute_period') {
        update.substitute_period = {
          start: document.getElementById('set-sub-start').value,
          end:   document.getElementById('set-sub-end').value
        };
      }
      await setDoc(ref, update, { merge: true });
      await logAction('บันทึกการตั้งค่า', `ประเภท: ${type}`);
      window.showToast('บันทึกการตั้งค่าสำเร็จ', 'success');
      loadSystemConfig();
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  /* ─── AUTOMATED TASKS ─── */
  async function autoResetSubstitutes() {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const q = query(collection(db, "shops"), where("applyType", "==", "substitute"), where("status", "==", "active"));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const sub = d.data();
        if (sub.substituteDate && sub.substituteDate < todayStr) {
          await updateDoc(doc(db, "shops", d.id), { status: 'cancelled' });
          if (sub.slots) {
            const slotArray  = sub.slots.split(',').map(s => s.trim());
            const leaveSnap  = await getDocs(query(collection(db, "shops"), where("status", "==", "leave")));
            leaveSnap.forEach(async (ld) => {
              const origShop = ld.data();
              if (origShop.slots) {
                const origSlots  = origShop.slots.split(',').map(s => s.trim());
                const hasOverlap = origSlots.some(s => slotArray.includes(s));
                if (hasOverlap) await updateDoc(doc(db, "shops", ld.id), { status: 'active' });
              }
            });
          }
        }
      }
    } catch(e) { console.warn('autoResetSubstitutes error:', e); }
  }

  /* ─── ADMIN AUTH ─── */
  window.adminLogin  = () => signInWithPopup(auth, provider);
  window.adminLogout = () => signOut(auth);

  onAuthStateChanged(auth, async (user) => {
    if (user && user.email === ADMIN_EMAIL) {
      window.adminMode = true;
      document.getElementById('admin-login-wrap').style.display = 'none';
      document.getElementById('admin-panel').style.display      = 'block';
      document.getElementById('admin-email-display').innerText  = user.email;
      await autoResetSubstitutes();
      loadAdminData();
      loadSystemConfig();
    } else {
      window.adminMode = false;
      document.getElementById('admin-login-wrap').style.display = 'block';
      document.getElementById('admin-panel').style.display      = 'none';
      loadSystemConfig();
    }
  });

  window.showAdminTab = (tab, btn) => {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('admin-tab-' + tab).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (tab === 'renewals') loadRenewals();
    if (tab === 'logs')     loadLogs();
  };

  /* ══════════════════════════════════════════
     ADMIN DATA (with resolved leave names)
  ══════════════════════════════════════════ */
  async function loadAdminData() {
    try {
      // Load skeleton while fetching
      document.getElementById('tbody-pending').innerHTML = skeletonRows(6, 6);
      document.getElementById('tbody-admin-shops').innerHTML = skeletonRows(5, 6);

      const snap = await getDocs(collection(db, "shops"));
      let pending = '', resign = '';
      let cntActive = 0, cntPending = 0, cntLeave = 0, cntT2 = 0;
      const shopsData = [];

      // Build shops cache for name resolution
      _shopsCache = {};
      snap.forEach(d => { _shopsCache[d.id] = d.data(); });

      const leaveSnap = await getDocs(query(collection(db, "shops"), where("status", "==", "leave")));
      window.availableLeaveSlots = leaveSnap.docs.map(doc => doc.data().slots).filter(s => s).join(', ');

      snap.forEach(d => {
        const a = d.data(); a.id = d.id;
        shopsData.push(a);

        if (a.status === 'active')  cntActive++;
        if (a.status === 'pending') cntPending++;
        if (a.status === 'leave')   cntLeave++;
        if (a.status === 'T2')      cntT2++;

        if (a.status === 'pending') {
          if (a.isResign) {
            resign += `<tr>
              <td><strong>${a.shopName}</strong></td>
              <td>${a.slots || '—'}</td>
              <td>${a.firstName} ${a.lastName}</td>
              <td>${a.phone}</td>
              <td><button class="btn btn-primary btn-sm" onclick="window.openApprove('${a.id}','${a.shopName}', false)">พิจารณา</button></td>
            </tr>`;
          } else {
            const isSub   = a.applyType === 'substitute';
            const subDate = isSub && a.substituteDate ? `<br><small style="color:var(--amber);">ขายแทนวันที่: ${a.substituteDate}</small>` : '';
            pending += `<tr>
              <td>${a.createdAt?.toDate().toLocaleDateString('th-TH') || '—'}</td>
              <td><strong>${a.shopName}</strong>${subDate}</td>
              <td>${a.firstName} ${a.lastName}</td>
              <td>${a.phone}</td>
              <td>${a.category || '—'}</td>
              <td><button class="btn btn-primary btn-sm" onclick="window.openApprove('${a.id}','${a.shopName}', ${isSub})">จัดการ</button></td>
            </tr>`;
          }
        }
      });

      // Sort by slot
      shopsData.sort((a, b) => {
        const fn = s => { if (!s) return 9999; const f = String(s).split(',')[0].trim(); return parseInt(f) || 9999; };
        return fn(a.slots) - fn(b.slots);
      });

      // Store for filter
      window._allShopsRows = [];
      let shopsHtml = '';
      shopsData.forEach(a => {
        const statusLabel = {
          active:    '<span class="badge badge-active">เปิดขายปกติ</span>',
          pending:   '<span class="badge badge-pending">รออนุมัติ</span>',
          leave:     '<span class="badge badge-leave">แจ้งลา</span>',
          T2:        '<span class="badge badge-t2">ระงับ T2</span>',
          cancelled: '<span class="badge badge-cancelled">ยกเลิก</span>'
        }[a.status] || `<span class="badge">${a.status}</span>`;

        const row = `<tr class="shop-row" data-status="${a.status}" data-name="${(a.shopName||'').toLowerCase()}" data-phone="${(a.phone||'').toLowerCase()}">
          <td class="shop-name-col"><strong>${a.shopName}</strong></td>
          <td>${a.slots || '—'}</td>
          <td>${a.category || '—'}</td>
          <td>${statusLabel}</td>
          <td class="shop-phone-col">${a.phone || '—'}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="window.openEditShop('${a.id}')">แก้ไข</button></td>
        </tr>`;
        shopsHtml += row;
        window._allShopsRows.push({ status: a.status, name: (a.shopName||'').toLowerCase(), phone: (a.phone||'').toLowerCase(), html: row });
      });

      document.getElementById('tbody-pending').innerHTML      = pending  || '<tr><td colspan="6" class="td-empty">ไม่มีคำขอรออนุมัติ</td></tr>';
      document.getElementById('tbody-admin-resign').innerHTML = resign   || '<tr><td colspan="5" class="td-empty">ไม่มีคำขอสละสิทธิ์</td></tr>';
      document.getElementById('tbody-admin-shops').innerHTML  = shopsHtml|| '<tr><td colspan="6" class="td-empty">ไม่มีข้อมูล</td></tr>';

      // Update filter count
      document.getElementById('filter-count').textContent = `ทั้งหมด ${shopsData.length} ร้าน`;

      // Admin quick stats
      document.getElementById('adm-st-active').innerText  = cntActive;
      document.getElementById('adm-st-pending').innerText = cntPending;
      document.getElementById('adm-st-leave').innerText   = cntLeave;
      document.getElementById('adm-st-t2').innerText      = cntT2;

      // Leaves — resolved shop names
      const lSnap = await getDocs(query(collection(db, "leaves"), where("status", "==", "pending")));
      document.getElementById('tbody-admin-leaves').innerHTML = lSnap.docs.map(d => {
        const l = d.data();
        const shopData = _shopsCache[l.shopId] || {};
        const shopName = shopData.shopName || l.shopId;
        const shopSlots = shopData.slots || '—';
        return `<tr>
          <td><strong>${shopName}</strong><br><small style="color:var(--muted);">ล็อก: ${shopSlots}</small></td>
          <td>${l.marketDate}</td>
          <td>${l.reason}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="window.approveLeave('${d.id}','${l.shopId}')">อนุมัติ</button>
            <button class="btn btn-danger btn-sm" style="margin-top:4px;" onclick="window.rejectLeave('${d.id}')">ปฏิเสธ</button>
          </td>
        </tr>`;
      }).join('') || '<tr><td colspan="4" class="td-empty">ไม่มีคำขอแจ้งลา</td></tr>';

    } catch(e) { console.warn('loadAdminData:', e); }
  }

  // Skeleton row helper
  function skeletonRows(cols, n = 4) {
    return Array(n).fill(null).map(() =>
      `<tr class="skeleton-row">${Array(cols).fill(`<td><div class="skeleton skeleton-cell"></div></td>`).join('')}</tr>`
    ).join('');
  }

  /* ══════════════════════════════════════════
     SHOP FILTER (Admin)
  ══════════════════════════════════════════ */
  window.applyShopFilter = () => {
    const statusFilter = document.getElementById('filter-status-admin').value;
    const textFilter   = (document.getElementById('search-shop-admin').value || '').toLowerCase();
    const rows = window._allShopsRows || [];
    let visible = 0;
    const tbody = document.getElementById('tbody-admin-shops');
    tbody.innerHTML = '';
    rows.forEach(r => {
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchText   = !textFilter   || r.name.includes(textFilter) || r.phone.includes(textFilter);
      if (matchStatus && matchText) { tbody.innerHTML += r.html; visible++; }
    });
    if (visible === 0) tbody.innerHTML = '<tr><td colspan="6" class="td-empty">ไม่พบร้านค้าที่ตรงกับเงื่อนไข</td></tr>';
    document.getElementById('filter-count').textContent = `แสดง ${visible} / ${rows.length} ร้าน`;
  };

  document.getElementById('search-shop-admin').addEventListener('input', window.applyShopFilter);

  /* ══════════════════════════════════════════
     RENEWALS (Admin Tab)
  ══════════════════════════════════════════ */
  async function loadRenewals() {
    const list = document.getElementById('renewals-list');
    list.innerHTML = '<div class="td-empty">⏳ กำลังโหลด...</div>';
    try {
      const snap = await getDocs(query(collection(db, "renewals"), orderBy("createdAt", "desc")));
      if (snap.empty) {
        list.innerHTML = '<div class="td-empty">ยังไม่มีร้านค้ายืนยันสิทธิ์</div>';
        document.getElementById('renewal-stats').textContent = '';
        return;
      }

      // Resolve shop names
      const shopIds = [...new Set(snap.docs.map(d => d.data().shopId).filter(Boolean))];
      const nameMap = {};
      for (const id of shopIds) {
        if (_shopsCache[id]) { nameMap[id] = _shopsCache[id].shopName; }
        else {
          try { const s = await getDoc(doc(db, "shops", id)); if (s.exists()) nameMap[id] = s.data().shopName; } catch {}
        }
      }

      let yes = 0, no = 0;
      const html = snap.docs.map(d => {
        const r      = d.data();
        const name   = nameMap[r.shopId] || r.shopId;
        const isYes  = r.response === 'yes';
        const date   = r.createdAt?.toDate().toLocaleDateString('th-TH') || '—';
        if (isYes) yes++; else no++;
        return `<div class="renewal-card ${isYes ? 'confirmed' : 'resigned'}">
          <div>
            <div style="font-weight:700; font-size:14px;">${name}</div>
            <div style="font-size:12px; color:var(--muted); margin-top:2px;">ยืนยันวันที่ ${date}</div>
          </div>
          <span class="badge ${isYes ? 'badge-active' : 'badge-t2'}">${isYes ? '✅ ขายต่อ' : '❌ สละสิทธิ์'}</span>
        </div>`;
      }).join('');

      list.innerHTML = html;
      document.getElementById('renewal-stats').textContent = `✅ ขายต่อ ${yes} ร้าน · ❌ สละสิทธิ์ ${no} ร้าน`;
    } catch(e) {
      list.innerHTML = '<div class="td-empty">เกิดข้อผิดพลาดในการโหลด</div>';
      console.warn('loadRenewals:', e);
    }
  }

  /* ══════════════════════════════════════════
     AUDIT LOGS (Admin Tab)
  ══════════════════════════════════════════ */
  async function loadLogs() {
    const tbody = document.getElementById('tbody-admin-logs');
    tbody.innerHTML = skeletonRows(4, 5);
    try {
      const snap = await getDocs(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(100)));
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="4" class="td-empty">ยังไม่มีบันทึกกิจกรรม</td></tr>';
        return;
      }
      tbody.innerHTML = snap.docs.map(d => {
        const l   = d.data();
        const ts  = l.timestamp?.toDate().toLocaleString('th-TH') || '—';
        const isDelete = l.action?.includes('ลบ');
        const isWarn   = l.action?.includes('ปฏิเสธ') || l.action?.includes('ระงับ');
        const cls  = isDelete ? 'del' : isWarn ? 'warn' : '';
        return `<tr>
          <td style="white-space:nowrap; font-size:12px;">${ts}</td>
          <td style="font-size:12px;">${l.admin || '—'}</td>
          <td><span class="log-action-badge ${cls}">${l.action || '—'}</span></td>
          <td style="font-size:13px; color:var(--muted);">${l.detail || '—'}</td>
        </tr>`;
      }).join('');
    } catch(e) {
      tbody.innerHTML = '<tr><td colspan="4" class="td-empty">เกิดข้อผิดพลาดในการโหลด</td></tr>';
    }
  }

  /* ─── APPROVE APPLICATION ─── */
  window.openApprove = (id, name, isSubstitute) => {
    currentId = id;
    let detailHtml = `<strong>${name}</strong>`;
    if (isSubstitute) {
      const availSlots = window.availableLeaveSlots || 'ไม่มีพื้นที่ที่แจ้งลาในขณะนี้';
      detailHtml += `<br><span style="color:var(--amber); font-weight:600; font-size:12px;">(สมัครขายแทน) พื้นที่ลาปัจจุบัน: ${availSlots}</span>`;
    }
    document.getElementById('app-detail').innerHTML = detailHtml;
    document.getElementById('modal-slots').value    = '';
    document.getElementById('modal-approve').style.display = 'block';
    document.getElementById('modal-bg').style.display      = 'block';
  };

  window.actionApp = async (action) => {
    try {
      const slots  = document.getElementById('modal-slots').value;
      const update = { status: action, isResign: null };
      if (action === 'approved' && slots) update.slots = slots;
      const shopData = _shopsCache[currentId] || {};
      await updateDoc(doc(db, "shops", currentId), update);
      await logAction(action === 'approved' ? 'อนุมัติคำขอ' : 'ปฏิเสธคำขอ', `ร้าน: ${shopData.shopName || currentId}`, action === 'approved' ? 'action' : 'warn');
      window.showToast(action === 'approved' ? 'อนุมัติเรียบร้อยแล้ว' : 'ไม่อนุมัติ/ยกเลิกสิทธิ์เรียบร้อย', action === 'approved' ? 'success' : 'warning');
      window.closeModal();
      loadAdminData();
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  /* ─── APPROVE / REJECT LEAVE ─── */
  window.approveLeave = async (leaveId, shopId) => {
    try {
      await updateDoc(doc(db, "leaves", leaveId), { status: 'approved' });
      await updateDoc(doc(db, "shops",  shopId),  { status: 'leave' });
      const shopData = _shopsCache[shopId] || {};
      await logAction('อนุมัติการแจ้งลา', `ร้าน: ${shopData.shopName || shopId}`);
      window.showToast('อนุมัติการแจ้งลาเรียบร้อย', 'success');
      loadAdminData();
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  window.rejectLeave = async (leaveId) => {
    const ok = await window.showConfirm('ต้องการปฏิเสธคำขอแจ้งลานี้ใช่หรือไม่?', 'ปฏิเสธการแจ้งลา', '🗓️', 'ปฏิเสธ', 'btn-danger');
    if (!ok) return;
    try {
      await updateDoc(doc(db, "leaves", leaveId), { status: 'rejected' });
      await logAction('ปฏิเสธการแจ้งลา', `leaveId: ${leaveId}`, 'warn');
      window.showToast('ปฏิเสธคำขอแจ้งลาเรียบร้อย', 'warning');
      loadAdminData();
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  /* ─── ADD SHOP (Admin) ─── */
  window.openAddShop = (slotNum = '') => {
    document.getElementById('form-add-shop').reset();
    document.getElementById('add-slots').value = slotNum;
    document.getElementById('modal-add-shop').style.display = 'block';
    document.getElementById('modal-bg').style.display = 'block';
  };

  document.getElementById('form-add-shop').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-add-shop');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังบันทึก...';
    try {
      const data = Object.fromEntries(new FormData(e.target));
      data.createdAt = serverTimestamp();
      data.items     = 'เพิ่มข้อมูลโดยผู้ดูแลระบบ';
      data.religion  = 'ไม่ระบุ';
      data.applyType = 'new';
      await addDoc(collection(db, "shops"), data);
      await logAction('เพิ่มร้านค้าใหม่', `ร้าน: ${data.shopName}, ล็อก: ${data.slots || 'ยังไม่กำหนด'}`);
      window.showToast('เพิ่มร้านค้าสำเร็จ', 'success');
      window.closeModal();
      loadAdminData();
    } catch(err) {
      window.showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 บันทึกเพิ่มร้านค้า';
    }
  });

  /* ─── EDIT SHOP ─── */
  window.openEditShop = async (id) => {
    currentId = id;
    try {
      const snap = await getDoc(doc(db, "shops", id));
      const d    = snap.data();
      document.getElementById('edit-shopName').value = d.shopName || '';
      document.getElementById('edit-slots').value    = d.slots    || '';
      document.getElementById('edit-phone').value    = d.phone    || '';
      document.getElementById('edit-status').value   = d.status   || 'active';
      document.getElementById('modal-edit-shop').style.display = 'block';
      document.getElementById('modal-bg').style.display        = 'block';
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  window.updateShopData = async () => {
    try {
      const data = Object.fromEntries(new FormData(document.getElementById('form-edit-shop')));
      await updateDoc(doc(db, "shops", currentId), data);
      await logAction('แก้ไขข้อมูลร้าน', `ร้าน: ${data.shopName}, สถานะ: ${data.status}, ล็อก: ${data.slots || '—'}`);
      window.showToast('บันทึกข้อมูลร้านค้าสำเร็จ', 'success');
      window.closeModal();
      loadAdminData();
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  window.deleteShop = async () => {
    const shopName = document.getElementById('edit-shopName').value;
    const ok = await window.showConfirm(
      `ต้องการลบร้าน <strong>"${shopName}"</strong> ออกจากระบบ?<br>การกระทำนี้ <strong>ไม่สามารถย้อนกลับได้</strong>`,
      'ยืนยันการลบร้านค้า', '🗑️', 'ลบเลย', 'btn-danger'
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "shops", currentId));
      await logAction('ลบร้านค้า', `ร้าน: ${shopName}`, 'del');
      window.showToast(`ลบร้าน "${shopName}" ออกจากระบบแล้ว`, 'warning');
      window.closeModal();
      loadAdminData();
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  /* ─── EXPORT (CSV) ─── */
  window.exportShops = async () => {
    try {
      const snap = await getDocs(collection(db, "shops"));
      let csv = "ชื่อร้าน,พื้นที่,สถานะ,เบอร์โทร,หมวดหมู่\n";
      const shopsData = [];
      snap.forEach(d => shopsData.push(d.data()));
      shopsData.sort((a, b) => {
        const fn = s => { if (!s) return 9999; const f = String(s).split(',')[0].trim(); return parseInt(f) || 9999; };
        return fn(a.slots) - fn(b.slots);
      });
      shopsData.forEach(a => {
        const slotsStr = a.slots ? `"${a.slots}"` : '""';
        const nameStr  = a.shopName ? `"${a.shopName}"` : '""';
        const phoneStr = a.phone ? `="${a.phone}"` : '""';
        csv += `${nameStr},${slotsStr},"${a.status}",${phoneStr},"${a.category || ''}"\n`;
      });
      const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `shops_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.showToast('Export CSV สำเร็จ', 'success');
    } catch(e) { window.showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  };

  /* ─── INIT ─── */
  loadStats();
  loadSystemConfig();

  /* ─── GALLERY LOGIC ─── */
  window.openGallery = (shopId) => {
    const shopData = _shopsCache[shopId];
    if (!shopData) return;
    document.getElementById('gallery-shop-name').innerText = shopData.shopName || 'ไม่มีชื่อร้าน';
    const container = document.getElementById('gallery-container');
    container.innerHTML = '';
    
    if (shopData.fileUrls && shopData.fileUrls.length > 0) {
      container.innerHTML = shopData.fileUrls.map(url => `
        <div class="gallery-img-wrap">
          <img src="${url}" onclick="window.open('${url}','_blank')" alt="Shop Image">
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div class="td-empty">ไม่มีรูปภาพสินค้า</div>';
    }

    if (shopData.folderUrl) {
      container.innerHTML += `<div style="grid-column: 1 / -1; margin-top: 10px; text-align: center;">
        <a href="${shopData.folderUrl}" target="_blank" class="btn btn-primary" style="text-decoration:none; display:inline-block;">📂 เปิดดูใน Google Drive</a>
      </div>`;
    }

    document.getElementById('modal-gallery').style.display = 'block';
    document.getElementById('modal-bg').style.display = 'block';
  };
