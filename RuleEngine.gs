// ============================================================
//  RuleEngine.gs  —  Business rules & validation
// ============================================================

function checkAndUpdateT2() {
  const leaves  = getAllLeaves();
  const shops   = getAllShops();
  const updated = [];

  shops.forEach(shop => {
    if (shop.status === 'cancelled') return;

    const shopLeaves = leaves
      .filter(l => l.shopId === shop.shopId && l.status === 'approved')
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    if (!shopLeaves.length) return;

    const latest = shopLeaves[0];
    const count  = parseInt(latest.consecutiveCount || 0);

    if (count >= 2 && shop.status !== 'T2') {
      updateShop(shop.shopId, { status: 'T2' });
      updated.push({ shopId: shop.shopId, shopName: shop.shopName });
      notifyT2(shop);
      writeAuditLog('AUTO_T2', 'system', shop.shopId, 'shop',
        `ระบบระงับสิทธิ์ (T2) อัตโนมัติ เนื่องจากหยุดจำหน่ายต่อเนื่อง ${count} ครั้ง`);
    }
  });
  return updated;
}

function resetConsecutiveLeave(shopId) {
  const sh = getSheet(SHEET.LEAVES);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === shopId) {
      const obj = rowToObj(HEADERS.LEAVES, data[i]);
      obj.isConsecutive    = 'false';
      obj.consecutiveCount = '0';
      sh.getRange(i + 1, 1, 1, HEADERS.LEAVES.length).setValues([objToRow(HEADERS.LEAVES, obj)]);
    }
  }
  updateShop(shopId, { status: 'active' });
}

function validateApplication(data) {
  const errors = [];
  if (data.type === 'new' && getSetting('system.applicationOpen') !== 'true') {
    errors.push('ขณะนี้ระบบปิดรับลงทะเบียนผู้ประกอบการรายใหม่ชั่วคราว กรุณาติดต่อคณะกรรมการชมรมผู้ประกอบการฐานเทคโนโลยี');
    return { valid: false, errors };
  }
  if (data.type === 'substitute' && getSetting('system.substituteOpen') !== 'true') {
    errors.push('ขณะนี้ระบบปิดรับลงทะเบียนผู้ประกอบการทดแทนชั่วคราว กรุณาติดต่อผู้ดูแลระบบ');
    return { valid: false, errors };
  }
  if (!data.firstName.trim())   errors.push('กรุณาระบุชื่อ');
  if (!data.lastName.trim())    errors.push('กรุณาระบุนามสกุล');
  if (!data.shopName.trim())    errors.push('กรุณาระบุชื่อสถานประกอบการ');
  if (!data.category)            errors.push('กรุณาระบุหมวดหมู่สินค้า');
  if (!data.items.trim())       errors.push('กรุณาระบุประเภทสินค้าหรือบริการ');
  if (!data.slotCount)           errors.push('กรุณาระบุจำนวนพื้นที่จำหน่าย');
  if (!data.phone || !/^[0-9]{9,10}$/.test(data.phone.replace(/-/g, '')))
    errors.push('หมายเลขโทรศัพท์ไม่ถูกต้อง (ต้องเป็นตัวเลข 9-10 หลัก)');
  if (!data.religion)            errors.push('กรุณาระบุศาสนา');
  if (data.consent !== 'yes')    errors.push('กรุณายอมรับข้อกำหนดและเงื่อนไขก่อนดำเนินการลงทะเบียน');

  if (data.type === 'new') {
    const existingShop = getShopByName(data.shopName);
    if (existingShop && existingShop.status !== 'cancelled') {
      errors.push('ชื่อสถานประกอบการนี้มีอยู่ในระบบแล้ว');
    }
    const allShops = getAllShops();
    const duplicateOwner = allShops.find(s => 
      (s.phone === data.phone || (s.firstName === data.firstName && s.lastName === data.lastName)) &&
      s.status !== 'cancelled'
    );
    if (duplicateOwner) {
      if (duplicateOwner.status === 'T2') {
        errors.push('ผู้ลงทะเบียนรายนี้ถูกระงับสิทธิ์ (T2) เนื่องจากหยุดจำหน่ายต่อเนื่อง ไม่อนุญาตให้ลงทะเบียนใหม่ กรุณาติดต่อผู้ดูแลระบบ');
      } else if (duplicateOwner.status === 'active' || duplicateOwner.status === 'pending') {
        errors.push(`ชื่อ-นามสกุล หรือหมายเลขโทรศัพท์นี้ ได้รับการลงทะเบียนในระบบแล้ว (สถานประกอบการ ${duplicateOwner.shopName})`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateLeave(data) {
  const errors = [];
  if (!data.shopId)           errors.push('ไม่พบข้อมูลสถานประกอบการ');
  if (!data.reason.trim())   errors.push('กรุณาระบุเหตุผลความจำเป็นในการหยุดจำหน่าย');
  if (!data.marketDate)       errors.push('กรุณาระบุวันที่ประสงค์ขอหยุดจำหน่าย');
  if (data.shopId) {
    const shop = getShopById(data.shopId);
    if (!shop) errors.push('ไม่พบข้อมูลสถานประกอบการในระบบ');
    else if (shop.status === 'T2') errors.push('สถานประกอบการของท่านถูกระงับสิทธิ์ (T2) ไม่สามารถดำเนินการแจ้งขอหยุดจำหน่ายได้ กรุณาติดต่อผู้ดูแลระบบ');
    else if (shop.status === 'cancelled') errors.push('สถานประกอบการนี้ถูกยกเลิกสิทธิ์การจำหน่ายแล้ว');
    else if (shop.status === 'pending') errors.push('สถานประกอบการนี้อยู่ระหว่างรอผลการพิจารณา');
  }
  return { valid: errors.length === 0, errors };
}

function validateRenewal(data) {
  const errors = [];
  if (getSetting('system.renewalOpen') !== 'true') {
    errors.push('ขณะนี้ระบบยังไม่เปิดให้ยืนยันสิทธิ์การจำหน่าย');
    return { valid: false, errors };
  }
  if (!data.shopId)   errors.push('ไม่พบข้อมูลสถานประกอบการ');
  if (!data.response || !['yes','no'].includes(data.response)) errors.push('กรุณาระบุความประสงค์ในการยืนยันสิทธิ์');
  const semester = getSetting('system.renewalSemester');
  if (!semester)      errors.push('ระบบยังไม่ได้กำหนดภาคการศึกษา');

  if (data.shopId && semester) {
    const shop = getShopById(data.shopId);
    if (!shop || shop.status !== 'active') errors.push('ไม่พบข้อมูลสถานประกอบการ หรือไม่อยู่ในสถานะเปิดจำหน่าย');
    const existing = getRenewalByShop(data.shopId, semester);
    if (!existing) errors.push('ไม่พบข้อมูลการให้สิทธิ์สำหรับสถานประกอบการนี้ กรุณาติดต่อผู้ดูแลระบบ');
    else if (existing.status !== 'pending') errors.push(`สถานประกอบการนี้ได้ดำเนินการยืนยันสิทธิ์ไปแล้ว (สถานะ ${existing.status})`);
    const deadline = getSetting('system.renewalDeadline');
    if (deadline && today() > deadline) errors.push(`สิ้นสุดระยะเวลาการยืนยันสิทธิ์แล้ว (ครบกำหนดเมื่อ ${deadline})`);
  }
  return { valid: errors.length === 0, errors };
}

function approveApplication(appId, targetSlots, reviewNote, reviewedBy) {
  const app = getAllApplications().find(a => a.appId === appId);
  if (!app) return { success: false, message: 'ไม่พบข้อมูลการลงทะเบียน' };
  if (app.status !== 'pending') return { success: false, message: 'ข้อมูลการลงทะเบียนนี้ได้รับการประมวลผลแล้ว' };
  const slotNos = targetSlots.split(',').map(s => s.trim()).filter(Boolean);
  const allSlots = getAllSlots();
  for (const no of slotNos) {
    const slot = allSlots.find(s => String(s.slotNo) === String(no));
    if (!slot) return { success: false, message: `ไม่พบพื้นที่จำหน่ายหมายเลข ${no}` };
    if (slot.status !== 'empty') return { success: false, message: `พื้นที่จำหน่ายหมายเลข ${no} ไม่ว่าง (สถานะปัจจุบัน ${slot.status})` };
  }
  const shop = createShop({ ...app, type: undefined, status: 'active', slots: targetSlots });
  slotNos.forEach(no => assignShopToSlot(no, shop.shopId, shop.shopName));
  updateShop(shop.shopId, { slots: targetSlots, status: 'active' });
  updateApplication(appId, {
    status: 'approved', targetSlots, reviewNote: reviewNote || '',
    reviewedAt: now(), reviewedBy: reviewedBy || 'admin',
  });
  notifyApplicationResult(app, 'approved', targetSlots, reviewNote);
  writeAuditLog('APPROVE_APP', reviewedBy || 'admin', appId, 'application', `อนุมัติการลงทะเบียน ${app.shopName} → พื้นที่จำหน่าย ${targetSlots}`);
  return { success: true, shopId: shop.shopId, message: 'ดำเนินการอนุมัติเสร็จสิ้น' };
}

function rejectApplication(appId, reviewNote, reviewedBy) {
  const app = getAllApplications().find(a => a.appId === appId);
  if (!app) return { success: false, message: 'ไม่พบข้อมูลการลงทะเบียน' };
  if (app.status !== 'pending') return { success: false, message: 'ข้อมูลการลงทะเบียนนี้ได้รับการประมวลผลแล้ว' };
  updateApplication(appId, {
    status: 'rejected', reviewNote: reviewNote || '',
    reviewedAt: now(), reviewedBy: reviewedBy || 'admin',
  });
  notifyApplicationResult(app, 'rejected', '', reviewNote);
  writeAuditLog('REJECT_APP', reviewedBy || 'admin', appId, 'application', `ไม่อนุมัติการลงทะเบียน ${app.shopName} ${reviewNote}`);
  return { success: true, message: 'ดำเนินการบันทึกข้อมูลการไม่อนุมัติเสร็จสิ้น' };
}

function approveLeave(leaveId, reviewedBy) {
  const leave = getAllLeaves().find(l => l.leaveId === leaveId);
  if (!leave) return { success: false, message: 'ไม่พบข้อมูลการแจ้งขอหยุดจำหน่าย' };
  if (leave.status !== 'pending') return { success: false, message: 'ข้อมูลนี้ได้รับการประมวลผลแล้ว' };
  updateLeave(leaveId, { status: 'approved', reviewedAt: now(), reviewedBy: reviewedBy || 'admin' });
  updateShop(leave.shopId, { status: 'leave' });
  checkAndUpdateT2();
  notifyLeaveResult(leave, 'approved');
  writeAuditLog('APPROVE_LEAVE', reviewedBy || 'admin', leaveId, 'leave', `อนุมัติการหยุดจำหน่าย ${leave.shopName} ประจำวันที่ ${leave.marketDate}`);
  return { success: true };
}

function rejectLeave(leaveId, reviewedBy) {
  const leave = getAllLeaves().find(l => l.leaveId === leaveId);
  if (!leave) return { success: false, message: 'ไม่พบข้อมูลการแจ้งขอหยุดจำหน่าย' };
  if (leave.status !== 'pending') return { success: false, message: 'ข้อมูลนี้ได้รับการประมวลผลแล้ว' };
  updateLeave(leaveId, { status: 'rejected', reviewedAt: now(), reviewedBy: reviewedBy || 'admin' });
  notifyLeaveResult(leave, 'rejected');
  writeAuditLog('REJECT_LEAVE', reviewedBy || 'admin', leaveId, 'leave', `ไม่อนุมัติการหยุดจำหน่าย ${leave.shopName}`);
  return { success: true };
}

function processRenewal(shopId, response, responseNote) {
  const semester = getSetting('system.renewalSemester');
  const result = submitRenewal(shopId, semester, response, responseNote);
  if (!result) return { success: false, message: 'ไม่พบรายการยืนยันสิทธิ์' };
  const shop = getShopById(shopId);
  notifyRenewalResponse(shop, semester, response, responseNote);
  writeAuditLog('RENEWAL_RESPONSE', shopId, shopId, 'renewal', `ภาคการศึกษา ${semester} ${response === 'yes' ? 'ยืนยันสิทธิ์' : 'สละสิทธิ์'}`);
  return { success: true, renewalId: result.renewalId };
}

function finalizeRenewal(semester, adminUser) {
  const renewals = getAllRenewals(semester);
  const declined = renewals.filter(r => r.status === 'declined');
  const expired  = renewals.filter(r => r.status === 'pending');
  let cancelledCount = 0;
  [...declined, ...expired].forEach(r => {
    updateShop(r.shopId, { status: 'cancelled' });
    if (r.shopId) {
      const shopSlots = getSlotsByShop(r.shopId);
      shopSlots.forEach(s => clearSlot(s.slotNo));
    }
    if (r.status === 'pending') updateRenewal(r.renewalId, { status: 'expired' });
    cancelledCount++;
  });
  writeAuditLog('FINALIZE_RENEWAL', adminUser, semester, 'renewal', `ประมวลผลขั้นสุดท้าย ภาคการศึกษา ${semester} ยกเลิกสิทธิ์สถานประกอบการ ${cancelledCount} แห่ง`);
  return { success: true, cancelledCount };
}

function moveShop(shopId, newSlots) {
  const shop = getShopById(shopId);
  if (!shop) return { success: false, message: 'ไม่พบข้อมูลสถานประกอบการ' };
  const newSlotNos = String(newSlots).split(',').map(s => s.trim()).filter(Boolean);
  const oldSlotNos = String(shop.slots).split(',').map(s => s.trim()).filter(Boolean);
  const allSlots   = getAllSlots();
  for (const no of newSlotNos) {
    const slot = allSlots.find(s => String(s.slotNo) === no);
    if (!slot) return { success: false, message: `ไม่พบพื้นที่จำหน่ายหมายเลข ${no}` };
    if (slot.status !== 'empty' && slot.shopId !== shopId) return { success: false, message: `พื้นที่จำหน่ายหมายเลข ${no} ไม่ว่าง (ผู้ประกอบการปัจจุบัน ${slot.shopName})` };
  }
  oldSlotNos.forEach(no => clearSlot(no));
  newSlotNos.forEach(no => assignShopToSlot(no, shopId, shop.shopName));
  updateShop(shopId, { slots: newSlots });
  writeAuditLog('MOVE_SHOP', 'admin', shopId, 'shop', `เปลี่ยนแปลงพื้นที่จำหน่าย ${shop.shopName} จากหมายเลข ${shop.slots} เป็นหมายเลข ${newSlots}`);
  return { success: true, message: `ดำเนินการเปลี่ยนแปลงพื้นที่จำหน่ายเป็นหมายเลข ${newSlots} เสร็จสิ้น` };
}

function sendRenewalBatch(semester, deadline, adminUser) {
  const result = createRenewalBatch(semester, deadline);
  setSetting('system.renewalSemester', semester, adminUser);
  setSetting('system.renewalDeadline', deadline, adminUser);
  setSetting('system.renewalOpen', 'true', adminUser);
  const shops = getAllShops().filter(s => s.status === 'active');
  let notified = 0;
  shops.forEach(shop => {
    if (shop.lineId.trim()) { notifyRenewalRequest(shop, semester, deadline); notified++; }
  });
  writeAuditLog('SEND_RENEWAL', adminUser, semester, 'renewal', `จัดส่งแบบฟอร์มยืนยันสิทธิ์ประจำภาคการศึกษา ${semester} จำนวน ${result.created} รายการ และแจ้งเตือนผ่าน LINE จำนวน ${notified} บัญชี`);
  return { success: true, ...result, notified };
}

function dailyCheck() {
  const t2List = checkAndUpdateT2();
  Logger.log('T2 check ' + JSON.stringify(t2List));
  const deadline = getSetting('system.renewalDeadline');
  if (deadline && today() > deadline && getSetting('system.renewalOpen') === 'true') {
    setSetting('system.renewalOpen', 'false', 'system');
    Logger.log('Renewal deadline passed — auto-closed.');
  }
}
