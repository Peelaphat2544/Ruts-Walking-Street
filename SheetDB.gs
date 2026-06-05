// ============================================================
//  SheetDB.gs  —  Database layer (อ่าน/เขียน Google Sheets)
//  ระบบบริหารตลาดนัดในสวน | ชมรมผู้ประกอบการฐานเทคโนโลยี
//  v2.0 — อัปเกรดเพิ่ม: ระบบยืนยันสิทธิ์, ระบบการตั้งค่า, การแจ้งเตือนผ่าน LINE OA
// ============================================================

// ---- CONFIG ------------------------------------------------
const SS_ID = '1je5lL-hWn8dsk2eSmBcVF52JW19EMlZlA9Fo_IqfJIw';

const SHEET = {
  SHOPS        : 'Shops',
  APPLICATIONS : 'Applications',
  LEAVES       : 'Leaves',
  SLOTS        : 'Slots',
  PAYMENTS     : 'Payments',
  RENEWALS     : 'Renewals',     // ระบบยืนยันสิทธิ์ประจำภาคเรียน
  SETTINGS     : 'Settings',    // การตั้งค่าระบบ
  AUDIT_LOG    : 'AuditLog',    // บันทึกการกระทำของแอดมิน
};

// ---- โครงสร้าง Header -----------------------------------------------
const HEADERS = {
  SHOPS: [
    'shopId','firstName','lastName','shopName','category',
    'items','slotCount','phone','lineId','religion',
    'memberType','status','slots','consentDate','notes',
    'createdAt','updatedAt',
  ],
  APPLICATIONS: [
    'appId','type','firstName','lastName','shopName',
    'category','items','slotCount','phone','lineId',
    'religion','memberType','notes','consent','status',
    'targetSlots','reviewNote','submittedAt','reviewedAt','reviewedBy',
  ],
  LEAVES: [
    'leaveId','shopId','shopName','reason','marketDate',
    'notes','status','isConsecutive','consecutiveCount',
    'submittedAt','reviewedAt','reviewedBy',
  ],
  SLOTS: [
    'slotNo','shopId','shopName','status','zone',
    'row','col','notes','updatedAt',
  ],
  PAYMENTS: [
    'payId','shopId','shopName','amount','slotCount',
    'marketDate','paidDate','method','status','notes',
    'recordedBy','createdAt',
  ],
  // ระบบยืนยันสิทธิ์ประจำภาคเรียน
  RENEWALS: [
    'renewalId','shopId','shopName','semester',   // เช่น "1/2568"
    'status',          // pending | confirmed | declined | expired
    'response',        // yes | no | (ว่าง)
    'responseNote',    // เหตุผลถ้า no
    'sentAt',          // วันส่งแบบฟอร์ม
    'respondedAt',     // วันที่ร้านตอบกลับ
    'deadline',        // วันสิ้นสุด
    'createdAt',
  ],
  // การตั้งค่าระบบ (key-value)
  SETTINGS: [
    'key','value','updatedAt','updatedBy',
  ],
  // บันทึก audit
  AUDIT_LOG: [
    'logId','action','adminUser','targetId','targetType',
    'detail','timestamp',
  ],
};

// ---- ค่า default ของ Settings --------------------------------
const DEFAULT_SETTINGS = {
  'system.applicationOpen'   : 'true',    // เปิด/ปิดรับสมัครร้านใหม่
  'system.substituteOpen'    : 'true',    // เปิด/ปิดรับสมัครแทน
  'system.mapPublic'         : 'true',    // เปิด/ปิดแผนผังสาธารณะ
  'system.renewalOpen'       : 'false',   // เปิด/ปิดระบบยืนยันสิทธิ์
  'system.renewalSemester'   : '',        // ภาคเรียนปัจจุบัน เช่น "1/2568"
  'system.renewalDeadline'   : '',        // วันสิ้นสุดยืนยัน เช่น "2568-05-31"
  'system.marketName'        : 'ตลาดนัดในสวน',
  'system.marketDay'         : 'ทุกวันพฤหัสบดี',
  'system.slotPrice1'        : '200',     // ราคาต่อล็อก (1 ล็อก)
  'system.slotPrice2'        : '380',
  'system.slotPrice3'        : '540',
  'notify.lineToken'         : '',        // LINE Notify Token (สำหรับแจ้ง admin)
  'notify.lineOaToken'       : '',        // LINE OA Channel Access Token
  'notify.adminLineId'       : '',        // LINE User ID ของ admin
  'notify.adminEmail'        : '',
};

// ---- Utility ------------------------------------------------

function getSheet(name) {
  return SpreadsheetApp.openById(SS_ID).getSheetByName(name);
}

function generateId(prefix, sheetName) {
  const sh = getSheet(sheetName);
  const lastRow = Math.max(sh.getLastRow(), 1);
  const num = String(lastRow).padStart(4, '0');
  return prefix + num;
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
  return obj;
}

function objToRow(headers, obj) {
  return headers.map(h => obj[h] !== undefined ? obj[h] : '');
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

function today() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
}

// ============================================================
//  SETUP
// ============================================================

function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const existing = ss.getSheets().map(s => s.getName());

  Object.entries(HEADERS).forEach(([key, headers]) => {
    const name = SHEET[key];
    let sh;
    if (!existing.includes(name)) {
      sh = ss.insertSheet(name);
    } else {
      sh = ss.getSheetByName(name);
    }
    if (sh.getLastRow() === 0) {
      sh.appendRow(headers);
      sh.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold').setBackground('#E8F0FE');
      sh.setFrozenRows(1);
    }
  });

  // สร้าง Slots 1-185
  const slotSh = ss.getSheetByName(SHEET.SLOTS);
  if (slotSh.getLastRow() <= 1) initSlots(slotSh);

  // สร้าง default settings
  initDefaultSettings();

  Logger.log('Setup v2 complete.');
  return { success: true, message: 'Setup complete' };
}

function initSlots(sh) {
  const rows = [];
  for (let i = 1; i <= 185; i++) {
    rows.push([i, '', '', 'empty', '', 0, 0, '', today()]);
  }
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function initDefaultSettings() {
  const sh = getSheet(SHEET.SETTINGS);
  const existing = {};
  const data = sh.getDataRange().getValues();
  data.slice(1).forEach(row => { existing[row[0]] = true; });

  Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
    if (!existing[key]) {
      sh.appendRow([key, value, now(), 'system']);
    }
  });
}

// ============================================================
//  SETTINGS
// ============================================================

function getSetting(key) {
  const sh = getSheet(SHEET.SETTINGS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return String(data[i][1]);
  }
  return DEFAULT_SETTINGS[key] !== undefined ? DEFAULT_SETTINGS[key] : '';
}

function getAllSettings() {
  const sh = getSheet(SHEET.SETTINGS);
  const data = sh.getDataRange().getValues();
  const result = { ...DEFAULT_SETTINGS };
  data.slice(1).forEach(row => { result[row[0]] = String(row[1]); });
  return result;
}

function setSetting(key, value, updatedBy) {
  const sh = getSheet(SHEET.SETTINGS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sh.getRange(i + 1, 2, 1, 3).setValues([[value, now(), updatedBy || 'admin']]);
      return;
    }
  }
  sh.appendRow([key, value, now(), updatedBy || 'admin']);
}

function setMultipleSettings(settingsObj, updatedBy) {
  Object.entries(settingsObj).forEach(([key, value]) => {
    setSetting(key, value, updatedBy);
  });
}

// ============================================================
//  SHOPS
// ============================================================

function getAllShops() {
  const sh = getSheet(SHEET.SHOPS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => rowToObj(HEADERS.SHOPS, row));
}

function getShopById(shopId) {
  return getAllShops().find(s => s.shopId === shopId) || null;
}

function getShopByName(shopName) {
  return getAllShops().find(s => s.shopName === shopName) || null;
}

function createShop(data) {
  const sh = getSheet(SHEET.SHOPS);
  const shopId = generateId('S', SHEET.SHOPS);
  const obj = {
    shopId,
    firstName   : data.firstName || '',
    lastName    : data.lastName || '',
    shopName    : data.shopName || '',
    category    : data.category || '',
    items       : data.items || '',
    slotCount   : data.slotCount || 1,
    phone       : data.phone || '',
    lineId      : data.lineId || '',
    religion    : data.religion || '',
    memberType  : data.memberType || 'ผู้ประกอบการทั่วไป',
    status      : 'pending',
    slots       : data.slots || '',
    consentDate : data.consent === 'yes' ? today() : '',
    notes       : data.notes || '',
    createdAt   : now(),
    updatedAt   : now(),
  };
  sh.appendRow(objToRow(HEADERS.SHOPS, obj));
  return obj;
}

function updateShop(shopId, updates) {
  const sh = getSheet(SHEET.SHOPS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === shopId) {
      const obj = rowToObj(HEADERS.SHOPS, data[i]);
      Object.assign(obj, updates, { updatedAt: now() });
      sh.getRange(i + 1, 1, 1, HEADERS.SHOPS.length)
        .setValues([objToRow(HEADERS.SHOPS, obj)]);
      return obj;
    }
  }
  return null;
}

function deleteShop(shopId) {
  // ไม่ลบจริง เปลี่ยนสถานะ
  return updateShop(shopId, { status: 'cancelled', slots: '' });
}

// ============================================================
//  APPLICATIONS
// ============================================================

function getAllApplications(type) {
  const sh = getSheet(SHEET.APPLICATIONS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  let apps = data.slice(1).map(row => rowToObj(HEADERS.APPLICATIONS, row));
  if (type) apps = apps.filter(a => a.type === type);
  return apps;
}

function getPendingApplications() {
  return getAllApplications().filter(a => a.status === 'pending');
}

function createApplication(data) {
  const sh = getSheet(SHEET.APPLICATIONS);
  const appId = generateId('A', SHEET.APPLICATIONS);
  const obj = {
    appId,
    type        : data.type || 'new',
    firstName   : data.firstName || '',
    lastName    : data.lastName || '',
    shopName    : data.shopName || '',
    category    : data.category || '',
    items       : data.items || '',
    slotCount   : data.slotCount || 1,
    phone       : data.phone || '',
    lineId      : data.lineId || '',
    religion    : data.religion || '',
    memberType  : data.memberType || '',
    notes       : data.notes || '',
    consent     : data.consent || 'no',
    status      : 'pending',
    targetSlots : '',
    reviewNote  : '',
    submittedAt : now(),
    reviewedAt  : '',
    reviewedBy  : '',
  };
  sh.appendRow(objToRow(HEADERS.APPLICATIONS, obj));
  return obj;
}

function updateApplication(appId, updates) {
  const sh = getSheet(SHEET.APPLICATIONS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === appId) {
      const obj = rowToObj(HEADERS.APPLICATIONS, data[i]);
      Object.assign(obj, updates);
      sh.getRange(i + 1, 1, 1, HEADERS.APPLICATIONS.length)
        .setValues([objToRow(HEADERS.APPLICATIONS, obj)]);
      return obj;
    }
  }
  return null;
}

// ============================================================
//  LEAVES
// ============================================================

function getAllLeaves(shopId) {
  const sh = getSheet(SHEET.LEAVES);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  let leaves = data.slice(1).map(row => rowToObj(HEADERS.LEAVES, row));
  if (shopId) leaves = leaves.filter(l => l.shopId === shopId);
  return leaves;
}

function getPendingLeaves() {
  return getAllLeaves().filter(l => l.status === 'pending');
}

function createLeave(data) {
  const sh = getSheet(SHEET.LEAVES);
  const leaveId = generateId('L', SHEET.LEAVES);

  const prevLeaves = getAllLeaves(data.shopId)
    .filter(l => l.status === 'approved')
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  let isConsecutive = false;
  let consecutiveCount = 0;
  if (prevLeaves.length > 0) {
    const last = prevLeaves[0];
    if (last.isConsecutive === 'true') {
      consecutiveCount = parseInt(last.consecutiveCount || 1) + 1;
      isConsecutive = true;
    } else {
      consecutiveCount = 1;
      isConsecutive = false;
    }
  }

  const obj = {
    leaveId,
    shopId           : data.shopId || '',
    shopName         : data.shopName || '',
    reason           : data.reason || '',
    marketDate       : data.marketDate || '',
    notes            : data.notes || '',
    status           : 'pending',
    isConsecutive    : String(isConsecutive),
    consecutiveCount : consecutiveCount,
    submittedAt      : now(),
    reviewedAt       : '',
    reviewedBy       : '',
  };
  sh.appendRow(objToRow(HEADERS.LEAVES, obj));
  return obj;
}

function updateLeave(leaveId, updates) {
  const sh = getSheet(SHEET.LEAVES);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === leaveId) {
      const obj = rowToObj(HEADERS.LEAVES, data[i]);
      Object.assign(obj, updates);
      sh.getRange(i + 1, 1, 1, HEADERS.LEAVES.length)
        .setValues([objToRow(HEADERS.LEAVES, obj)]);
      return obj;
    }
  }
  return null;
}

// ============================================================
//  SLOTS
// ============================================================

function getAllSlots() {
  const sh = getSheet(SHEET.SLOTS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => rowToObj(HEADERS.SLOTS, row));
}

function getEmptySlots() {
  return getAllSlots().filter(s => s.status === 'empty');
}

function updateSlot(slotNo, updates) {
  const sh = getSheet(SHEET.SLOTS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(slotNo)) {
      const obj = rowToObj(HEADERS.SLOTS, data[i]);
      Object.assign(obj, updates, { updatedAt: now() });
      sh.getRange(i + 1, 1, 1, HEADERS.SLOTS.length)
        .setValues([objToRow(HEADERS.SLOTS, obj)]);
      return obj;
    }
  }
  return null;
}

function assignShopToSlot(slotNo, shopId, shopName) {
  return updateSlot(slotNo, { shopId, shopName, status: 'active' });
}

function clearSlot(slotNo) {
  return updateSlot(slotNo, { shopId: '', shopName: '', status: 'empty' });
}

function getSlotsByShop(shopId) {
  return getAllSlots().filter(s => s.shopId === shopId);
}

// ============================================================
//  PAYMENTS
// ============================================================

function getAllPayments(shopId) {
  const sh = getSheet(SHEET.PAYMENTS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  let pays = data.slice(1).map(row => rowToObj(HEADERS.PAYMENTS, row));
  if (shopId) pays = pays.filter(p => p.shopId === shopId);
  return pays;
}

function createPayment(data) {
  const sh = getSheet(SHEET.PAYMENTS);
  const payId = generateId('P', SHEET.PAYMENTS);
  const obj = {
    payId,
    shopId    : data.shopId || '',
    shopName  : data.shopName || '',
    amount    : data.amount || 0,
    slotCount : data.slotCount || 1,
    marketDate: data.marketDate || '',
    paidDate  : data.paidDate || '',
    method    : data.method || 'cash',
    status    : data.status || 'pending',
    notes     : data.notes || '',
    recordedBy: data.recordedBy || 'admin',
    createdAt : now(),
  };
  sh.appendRow(objToRow(HEADERS.PAYMENTS, obj));
  return obj;
}

function updatePayment(payId, updates) {
  const sh = getSheet(SHEET.PAYMENTS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payId) {
      const obj = rowToObj(HEADERS.PAYMENTS, data[i]);
      Object.assign(obj, updates);
      sh.getRange(i + 1, 1, 1, HEADERS.PAYMENTS.length)
        .setValues([objToRow(HEADERS.PAYMENTS, obj)]);
      return obj;
    }
  }
  return null;
}

// ============================================================
//  RENEWALS — ระบบยืนยันสิทธิ์ประจำภาคเรียน
// ============================================================

function getAllRenewals(semester) {
  const sh = getSheet(SHEET.RENEWALS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  let rows = data.slice(1).map(row => rowToObj(HEADERS.RENEWALS, row));
  if (semester) rows = rows.filter(r => r.semester === semester);
  return rows;
}

function getRenewalByShop(shopId, semester) {
  return getAllRenewals(semester).find(r => r.shopId === shopId) || null;
}

function createRenewalBatch(semester, deadline) {
  // สร้าง renewal record สำหรับร้านที่ active ทุกร้าน
  const shops = getAllShops().filter(s => s.status === 'active');
  const sh = getSheet(SHEET.RENEWALS);
  const existing = getAllRenewals(semester).map(r => r.shopId);
  let created = 0;

  shops.forEach(shop => {
    if (existing.includes(shop.shopId)) return;
    const renewalId = generateId('R', SHEET.RENEWALS);
    sh.appendRow(objToRow(HEADERS.RENEWALS, {
      renewalId,
      shopId      : shop.shopId,
      shopName    : shop.shopName,
      semester,
      status      : 'pending',
      response    : '',
      responseNote: '',
      sentAt      : now(),
      respondedAt : '',
      deadline    : deadline || '',
      createdAt   : now(),
    }));
    created++;
  });
  return { created, total: shops.length };
}

function submitRenewal(shopId, semester, response, responseNote) {
  const sh = getSheet(SHEET.RENEWALS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === shopId && data[i][3] === semester) {
      const obj = rowToObj(HEADERS.RENEWALS, data[i]);
      obj.response     = response;
      obj.responseNote = responseNote || '';
      obj.status       = response === 'yes' ? 'confirmed' : 'declined';
      obj.respondedAt  = now();
      sh.getRange(i + 1, 1, 1, HEADERS.RENEWALS.length)
        .setValues([objToRow(HEADERS.RENEWALS, obj)]);
      return obj;
    }
  }
  return null;
}

function updateRenewal(renewalId, updates) {
  const sh = getSheet(SHEET.RENEWALS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === renewalId) {
      const obj = rowToObj(HEADERS.RENEWALS, data[i]);
      Object.assign(obj, updates);
      sh.getRange(i + 1, 1, 1, HEADERS.RENEWALS.length)
        .setValues([objToRow(HEADERS.RENEWALS, obj)]);
      return obj;
    }
  }
  return null;
}

// ============================================================
//  AUDIT LOG
// ============================================================

function writeAuditLog(action, adminUser, targetId, targetType, detail) {
  const sh = getSheet(SHEET.AUDIT_LOG);
  const logId = 'LOG' + String(sh.getLastRow()).padStart(5, '0');
  sh.appendRow([logId, action, adminUser, targetId, targetType, detail, now()]);
}

// ============================================================
//  STATISTICS
// ============================================================

function getStats() {
  const shops  = getAllShops();
  const slots  = getAllSlots();
  const leaves = getAllLeaves();
  const apps   = getAllApplications();
  const pays   = getAllPayments();
  const sem    = getSetting('system.renewalSemester');
  const renewals = sem ? getAllRenewals(sem) : [];

  return {
    totalShops      : shops.filter(s => s.status === 'active').length,
    pendingShops    : shops.filter(s => s.status === 'pending').length,
    cancelledShops  : shops.filter(s => s.status === 'cancelled').length,
    t2Shops         : shops.filter(s => s.status === 'T2').length,
    leaveShops      : shops.filter(s => s.status === 'leave').length,
    totalSlots      : slots.length,
    emptySlots      : slots.filter(s => s.status === 'empty').length,
    activeSlots     : slots.filter(s => s.status === 'active').length,
    disabledSlots   : slots.filter(s => s.status === 'disabled').length,
    pendingLeaves   : leaves.filter(l => l.status === 'pending').length,
    pendingApps     : apps.filter(a => a.status === 'pending').length,
    pendingNewApps  : apps.filter(a => a.status === 'pending' && a.type === 'new').length,
    pendingSubApps  : apps.filter(a => a.status === 'pending' && a.type === 'substitute').length,
    overduePayments : pays.filter(p => p.status === 'overdue').length,
    // renewal stats
    renewalPending  : renewals.filter(r => r.status === 'pending').length,
    renewalConfirmed: renewals.filter(r => r.status === 'confirmed').length,
    renewalDeclined : renewals.filter(r => r.status === 'declined').length,
  };
}