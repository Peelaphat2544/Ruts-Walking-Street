// ============================================================
//  Notify.gs  —  LINE Messaging API + Gmail notifications
// ============================================================

function sendLineMessage(userId, messages) {
  const token = getSetting('notify.lineOaToken');
  if (!userId?.trim() || !token || token === 'YOUR_LINE_CHANNEL_ACCESS_TOKEN') return;
  const payload = { to: userId, messages: Array.isArray(messages) ? messages : [messages] };
  const options = { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
  } catch (e) { Logger.log('LINE push error: ' + e.message); }
}

function sendLineNotify(message) {
  const token = getSetting('notify.lineToken');
  if (!token || token === '') return;
  try {
    UrlFetchApp.fetch('https://notify-api.line.me/api/notify', {
      method: 'post', headers: { Authorization: 'Bearer ' + token }, payload: { message }, muteHttpExceptions: true
    });
  } catch (e) { Logger.log('LINE Notify error: ' + e.message); }
}

function lineTextMsg(text) { return { type: 'text', text }; }

function notifyAdmin(text) {
  const adminId = getSetting('notify.adminLineId');
  if (adminId) sendLineMessage(adminId, lineTextMsg(text));
  sendLineNotify(text); 
  const adminEmail = getSetting('notify.adminEmail');
  if (adminEmail) sendEmail(adminEmail, '[ระบบบริหารจัดการตลาดนัด] แจ้งเตือนผู้ดูแลระบบ', `<pre>${text}</pre>`);
}

function notifyNewApplication(app) {
  const marketName = getSetting('system.marketName');
  const msg = `[${marketName}] แจ้งเตือนการลงทะเบียนผู้ประกอบการรายใหม่\nชื่อ-นามสกุล: ${app.firstName} ${app.lastName}\nสถานประกอบการ: ${app.shopName} (${app.category})\nจำนวนพื้นที่จำหน่าย: ${app.slotCount} | ศาสนา: ${app.religion}\nหมายเลขโทรศัพท์: ${app.phone}\nหมายเลขอ้างอิง: ${app.appId}`;
  notifyAdmin(msg);
}

function notifyApplicationResult(app, result, targetSlots, reviewNote) {
  if (!app.lineId?.trim()) return;
  const marketName = getSetting('system.marketName');
  let msg = '';
  if (result === 'approved') {
    msg = `[${marketName}] แจ้งผลการพิจารณาการลงทะเบียน\nการลงทะเบียนสถานประกอบการ "${app.shopName}" ได้รับการอนุมัติเรียบร้อยแล้ว\nพื้นที่จำหน่ายที่ได้รับการจัดสรร: ${targetSlots}\n` + (reviewNote ? `ข้อมูลเพิ่มเติม: ${reviewNote}\n` : '') + `หมายเลขอ้างอิง: ${app.appId}`;
  } else {
    msg = `[${marketName}] แจ้งผลการพิจารณาการลงทะเบียน\nการลงทะเบียนสถานประกอบการ "${app.shopName}" ไม่ผ่านการพิจารณา\n` + (reviewNote ? `เหตุผลประกอบการพิจารณา: ${reviewNote}\n` : '') + `หมายเลขอ้างอิง: ${app.appId}\nหากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ`;
  }
  sendLineMessage(app.lineId, lineTextMsg(msg));
}

function notifyNewLeave(leave) {
  const marketName = getSetting('system.marketName');
  const msg = `[${marketName}] แจ้งความประสงค์ขอหยุดจำหน่ายสินค้า\nสถานประกอบการ: ${leave.shopName}\nวันที่ประสงค์ขอหยุดจำหน่าย: ${leave.marketDate}\nเหตุผลความจำเป็น: ${leave.reason}\nการหยุดจำหน่ายต่อเนื่อง: ${leave.isConsecutive === 'true' ? 'ต่อเนื่อง (' + leave.consecutiveCount + ' ครั้ง)' : 'ไม่ต่อเนื่อง'}\nหมายเลขอ้างอิง: ${leave.leaveId}`;
  notifyAdmin(msg);
}

function notifyLeaveResult(leave, result) {
  const shop = getShopById(leave.shopId);
  if (!shop?.lineId?.trim()) return;
  const marketName = getSetting('system.marketName');
  const msg = result === 'approved'
    ? `[${marketName}] แจ้งผลการพิจารณาการขอหยุดจำหน่าย\nสถานประกอบการ "${shop.shopName}" ได้รับการอนุมัติให้หยุดจำหน่ายในวันที่ ${leave.marketDate} เรียบร้อยแล้ว`
    : `[${marketName}] แจ้งผลการพิจารณาการขอหยุดจำหน่าย\nการแจ้งขอหยุดจำหน่ายของสถานประกอบการ "${shop.shopName}" ประจำวันที่ ${leave.marketDate} ไม่ผ่านการพิจารณา กรุณาติดต่อผู้ดูแลระบบ`;
  sendLineMessage(shop.lineId, lineTextMsg(msg));
}

function notifyT2(shop) {
  const marketName = getSetting('system.marketName');
  if (shop.lineId?.trim()) {
    const msg = `[${marketName}] แจ้งเตือนการระงับสิทธิ์การจำหน่าย (สถานะ T2)\nสถานประกอบการ "${shop.shopName}" มีการหยุดจำหน่ายต่อเนื่อง 2 ครั้ง\nระบบได้ดำเนินการระงับสิทธิ์การจำหน่าย (สถานะ T2) ชั่วคราว\nกรุณาติดต่อผู้ดูแลระบบเพื่อดำเนินการในขั้นตอนต่อไป`;
    sendLineMessage(shop.lineId, lineTextMsg(msg));
  }
  notifyAdmin(`[แจ้งเตือนระบบ] สถานประกอบการ "${shop.shopName}" (${shop.shopId}) ถูกระงับสิทธิ์ (T2) อัตโนมัติ`);
}

function notifyRenewalRequest(shop, semester, deadline) {
  if (!shop.lineId?.trim()) return;
  const marketName = getSetting('system.marketName');
  const webUrl = getSetting('system.webUrl') || '';
  const msg = `[${marketName}] แจ้งกำหนดการยืนยันสิทธิ์การจำหน่าย ประจำภาคการศึกษา ${semester}\nเรียน ผู้ประกอบการสถานประกอบการ "${shop.shopName}"\nกรุณาดำเนินการยืนยันความประสงค์ในการจำหน่ายสินค้าประจำภาคการศึกษา ${semester}\nภายในวันที่: ${deadline}\n` + (webUrl ? `\nลิงก์สำหรับดำเนินการ: ${webUrl}?page=renewal\n` : '') + `\nหากพ้นกำหนดเวลาดังกล่าว ระบบจะถือว่าท่านสละสิทธิ์การจำหน่าย`;
  sendLineMessage(shop.lineId, lineTextMsg(msg));
}

function notifyRenewalResponse(shop, semester, response, note) {
  if (!shop) return;
  const marketName = getSetting('system.marketName');
  const adminMsg = `[${marketName}] แจ้งผลการยืนยันสิทธิ์การจำหน่าย\nสถานประกอบการ: ${shop.shopName} (${shop.shopId})\nภาคการศึกษา: ${semester}\nความประสงค์: ${response === 'yes' ? 'ประสงค์จำหน่ายสินค้าต่อ' : 'ไม่ประสงค์จำหน่ายสินค้า (สละสิทธิ์)'}\n` + (note ? `เหตุผลความจำเป็น: ${note}` : '');
  notifyAdmin(adminMsg);
}

function sendEmail(to, subject, htmlBody) {
  if (!to || to === 'admin@example.com' || to === '') return;
  try { MailApp.sendEmail({ to, subject, htmlBody }); } catch (e) { Logger.log('Email error: ' + e.message); }
}