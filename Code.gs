// ============================================================
//  Code.gs  —  Web App entry point (doGet / doPost)
// ============================================================

const ADMIN_PASSWORD = 'market2568';

function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('ระบบบริหารจัดการตลาดนัดในสวน')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, message: 'รูปแบบข้อมูลไม่ถูกต้อง (Invalid JSON)' });
  }

  const action = body.action || '';

  try {
    switch (action) {

      // ==== PUBLIC ACTIONS =====================================
      case 'submitApplication': {
        const v = validateApplication({ ...body.data, type: 'new' });
        if (!v.valid) return jsonResponse({ success: false, errors: v.errors });
        const app = createApplication({ ...body.data, type: 'new' });
        notifyNewApplication(app);
        return jsonResponse({ success: true, appId: app.appId, message: 'ส่งข้อมูลการลงทะเบียนเรียบร้อยแล้ว กรุณารอการพิจารณาจากคณะกรรมการ' });
      }

      case 'submitSubstitute': {
        const v = validateApplication({ ...body.data, type: 'substitute' });
        if (!v.valid) return jsonResponse({ success: false, errors: v.errors });
        const app = createApplication({ ...body.data, type: 'substitute' });
        notifyNewApplication(app);
        return jsonResponse({ success: true, appId: app.appId, message: 'ส่งข้อมูลการลงทะเบียนพื้นที่ชั่วคราวเรียบร้อยแล้ว' });
      }

      case 'submitLeave': {
        const v = validateLeave(body.data);
        if (!v.valid) return jsonResponse({ success: false, errors: v.errors });
        const leave = createLeave(body.data);
        notifyNewLeave(leave);
        return jsonResponse({ success: true, leaveId: leave.leaveId, message: 'บันทึกข้อมูลการแจ้งขอหยุดจำหน่ายเรียบร้อยแล้ว' });
      }

      case 'getMapData': {
        const slots = getAllSlots();
        const shops = getAllShops().reduce((acc, s) => { acc[s.shopId] = s; return acc; }, {});
        const pendingCount = getAllApplications().filter(a => a.status === 'pending').length;
        return jsonResponse({ success: true, slots, shops, pendingCount: pendingCount });
      }

      case 'getSystemStatus': {
        return jsonResponse({
          success: true,
          marketName: getSetting('system.marketName'),
          marketDay: getSetting('system.marketDay'),
          renewalOpen: getSetting('system.renewalOpen') === 'true',
          renewalSemester: getSetting('system.renewalSemester'),
          renewalDeadline: getSetting('system.renewalDeadline'),
          mapPublic: getSetting('system.mapPublic') === 'true'
        });
      }

      case 'getActiveShops': {
        const shops = getAllShops()
          .filter(s => s.status === 'active')
          .map(s => ({ shopId: s.shopId, shopName: s.shopName || 'ไม่มีชื่อ' }));
        shops.sort((a, b) => String(a.shopName).localeCompare(String(b.shopName)));
        return jsonResponse({ success: true, shops });
      }

      case 'searchShop': {
        const q = (body.query || '').toLowerCase();
        const res = getAllShops()
          .filter(s => s.status === 'active' && (s.shopName.toLowerCase().includes(q) || s.shopId.toLowerCase().includes(q)))
          .slice(0, 10).map(s => ({ shopId: s.shopId, shopName: s.shopName, slots: s.slots, status: s.status }));
        return jsonResponse({ success: true, results: res });
      }

      case 'searchShopForRenewal': {
        const q = (body.query || '').toLowerCase();
        const renewals = getAllRenewals();
        const res = getAllShops()
          .filter(s => s.status === 'active' && (s.shopName.toLowerCase().includes(q) || s.shopId.toLowerCase().includes(q)))
          .slice(0, 10).map(s => {
            const rn = renewals.reverse().find(r => r.shopId === s.shopId);
            return { shopId: s.shopId, shopName: s.shopName, slots: s.slots, renewalStatus: rn ? rn.status : 'not_found' };
          });
        return jsonResponse({ success: true, results: res });
      }

      case 'checkStatusByPhone': {
        const phone = body.phone;
        if (!phone) return jsonResponse({ success: false, message: 'กรุณาระบุหมายเลขโทรศัพท์' });

        const normalizedInputPhone = String(phone).replace(/^0+/, '');

        let shop = getAllShops().find(s => String(s.phone || '').replace(/^0+/, '') === normalizedInputPhone && s.status !== 'cancelled');
        let app = null;
        
        if (!shop) {
          app = getAllApplications().find(a => String(a.phone || '').replace(/^0+/, '') === normalizedInputPhone && a.status === 'pending');
        }

        if (!shop && !app) {
          return jsonResponse({ success: false, message: 'ไม่พบข้อมูลในระบบจากหมายเลขโทรศัพท์นี้' });
        }

        const targetShopId = shop ? shop.shopId : null;
        let absences = 0;
        let payments = [];

        if (targetShopId) {
          try {
            const leaves = getAllLeaves().filter(l => l.shopId === targetShopId && l.status === 'approved');
            absences = leaves.length;
            payments = getAllPayments(targetShopId).slice(0, 5); 
          } catch(e) { Logger.log(e); }
        }

        return jsonResponse({
          success: true,
          data: {
            isPending: !shop && !!app,
            shopId: targetShopId || 'รอการจัดสรร',
            shopName: shop ? shop.shopName : app.shopName,
            sellerName: shop ? `${shop.firstName} ${shop.lastName}` : `${app.firstName} ${app.lastName}`,
            items: shop ? shop.items : app.items,
            slots: shop ? (shop.slots || app.slotCount) : app.slotCount,
            status: shop ? shop.status : app.status,
            absences: absences,
            payments: payments
          }
        });
      }

      case 'submitRenewal': {
        const d = body.data;
        const currentSemester = getSetting('system.renewalSemester'); 
        const res = submitRenewal(d.shopId, currentSemester, d.response, d.responseNote);
        if (res) return jsonResponse({ success: true, message: 'บันทึกข้อมูลการยืนยันสิทธิ์การจำหน่ายเรียบร้อยแล้ว' });
        else return jsonResponse({ success: false, message: 'ไม่พบข้อมูลสถานประกอบการนี้ กรุณาติดต่อผู้ดูแลระบบ' });
      }

      // ==== ADMIN ACTIONS =====================================
      case 'adminLogin': {
        const ok = body.password === ADMIN_PASSWORD;
        return jsonResponse({ success: ok, message: ok ? 'เข้าสู่ระบบสำเร็จ' : 'รหัสผ่านไม่ถูกต้อง' });
      }

      case 'adminGetDashboard': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse({ success: true, stats: getStats(), pendingApps: getPendingApplications(), pendingLeaves: getPendingLeaves() });
      }

      case 'adminGetShops': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse({ success: true, shops: getAllShops() });
      }

      case 'adminGetSlots': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse({ success: true, slots: getAllSlots() });
      }

      case 'adminMoveShop': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse(moveShop(body.shopId, body.newSlots));
      }

      case 'adminUpdateSlotStatus': {
        if (!verifyAdmin(body.password)) return unauthorized();
        const res = updateSlot(body.slotNo, { status: body.status, notes: body.notes || '' });
        return jsonResponse({ success: !!res });
      }

      case 'adminDeleteShop': {
        if (!verifyAdmin(body.password)) return unauthorized();
        deleteShop(body.shopId);
        getAllSlots().filter(s => s.shopId === body.shopId).forEach(s => clearSlot(s.slotNo));
        return jsonResponse({ success: true });
      }

      case 'adminResetT2': {
        if (!verifyAdmin(body.password)) return unauthorized();
        resetConsecutiveLeave(body.shopId);
        return jsonResponse({ success: true, message: 'ดำเนินการคืนสถานะระงับสิทธิ์ (T2) สำเร็จ' });
      }

      case 'adminAddShop': {
        if (!verifyAdmin(body.password)) return unauthorized();
        const d = body.data;
        if (!d.shopName || !d.firstName || !d.slots) {
           return jsonResponse({ success: false, message: 'กรุณาระบุข้อมูลที่จำเป็นให้ครบถ้วน' });
        }
        
        const slotNos = d.slots.split(',').map(s => s.trim()).filter(Boolean);
        const allSlots = getAllSlots();
        for (const no of slotNos) {
          const slot = allSlots.find(s => String(s.slotNo) === String(no));
          if (!slot) return jsonResponse({ success: false, message: `ไม่พบพื้นที่จำหน่ายหมายเลข ${no}` });
          if (slot.status !== 'empty') return jsonResponse({ success: false, message: `พื้นที่จำหน่ายหมายเลข ${no} ไม่ว่าง (สถานะปัจจุบัน: ${slot.status})` });
        }

        // หารหัสร้านค้าล่าสุดเพื่อรันเลขต่อไปให้ทันที
        const allShops = getAllShops();
        let newShopId = 'S0001';
        if (allShops.length > 0) {
          const maxNum = allShops.reduce((max, shop) => {
             const numMatch = String(shop.shopId).match(/\d+/);
             const num = numMatch ? parseInt(numMatch[0], 10) : 0;
             return num > max ? num : max;
          }, 0);
          newShopId = 'S' + String(maxNum + 1).padStart(4, '0');
        }

        const shop = createShop({
          shopId: newShopId,
          firstName: d.firstName, lastName: d.lastName, shopName: d.shopName,
          category: d.category, items: d.items, phone: d.phone, lineId: d.lineId,
          religion: d.religion, memberType: d.memberType, 
          status: 'active', // บังคับ Active ทันที
          slots: d.slots, slotCount: slotNos.length.toString()
        });

        const finalShopId = shop.shopId || newShopId;

        // บังคับอัปเดตซ้ำในฐานข้อมูลให้สถานะและรหัสถูกต้อง 100%
        updateShop(finalShopId, { status: 'active', shopId: finalShopId, slots: d.slots });
        
        slotNos.forEach(no => assignShopToSlot(no, finalShopId, d.shopName));
        writeAuditLog('ADMIN_ADD_SHOP', 'admin', finalShopId, 'shop', `เพิ่มข้อมูลสถานประกอบการโดยตรง: ${d.shopName} (รหัส ${finalShopId}) เข้ารหัสพื้นที่ ${d.slots}`);
        
        return jsonResponse({ success: true, message: `เพิ่มข้อมูลร้านค้า ${d.shopName} (รหัส ${finalShopId}) เข้าสู่ระบบในสถานะเปิดจำหน่ายเรียบร้อยแล้ว` });
      }

      case 'adminApproveApplication': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse(approveApplication(body.appId, body.targetSlots, body.reviewNote, 'admin'));
      }

      case 'adminRejectApplication': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse(rejectApplication(body.appId, body.reviewNote, 'admin'));
      }

      case 'adminApproveLeave': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse(approveLeave(body.leaveId, 'admin'));
      }

      case 'adminRejectLeave': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse(rejectLeave(body.leaveId, 'admin'));
      }

      case 'adminGetPayments': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse({ success: true, payments: getAllPayments(body.shopId || null) });
      }

      case 'adminRecordPayment': {
        if (!verifyAdmin(body.password)) return unauthorized();
        const pay = createPayment({ ...body.data, recordedBy: 'admin' });
        return jsonResponse({ success: true, payId: pay.payId });
      }

      case 'adminGetRenewals': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse({ success: true, renewals: getAllRenewals().reverse() });
      }

      case 'adminSendRenewalBatch': {
        if (!verifyAdmin(body.password)) return unauthorized();
        const result = createRenewalBatch(body.semester, body.deadline);
        setSetting('system.renewalSemester', body.semester, 'admin');
        setSetting('system.renewalDeadline', body.deadline, 'admin');
        setSetting('system.renewalOpen', 'true', 'admin');
        writeAuditLog('SEND_RENEWAL', 'admin', body.semester, 'System', `จัดส่งแบบฟอร์มยืนยันสิทธิ์ จำนวน ${result.created} รายการ`);
        return jsonResponse({ success: true, created: result.created, notified: 0 }); 
      }

      case 'adminFinalizeRenewal': {
        if (!verifyAdmin(body.password)) return unauthorized();
        const renewals = getAllRenewals().filter(r => r.semester === body.semester);
        let cancelledCount = 0;
        renewals.forEach(r => {
          if (r.status === 'declined' || r.status === 'pending') {
            updateShop(r.shopId, { status: 'cancelled' });
            getAllSlots().filter(s => s.shopId === r.shopId).forEach(s => clearSlot(s.slotNo));
            cancelledCount++;
          }
        });
        setSetting('system.renewalOpen', 'false', 'admin'); 
        writeAuditLog('FINALIZE_RENEWAL', 'admin', body.semester, 'System', `ยกเลิกสิทธิ์สถานประกอบการที่สละสิทธิ์และไม่ตอบกลับ จำนวน ${cancelledCount} รายการ`);
        return jsonResponse({ success: true, cancelledCount: cancelledCount });
      }

      case 'adminGetSettings': {
        if (!verifyAdmin(body.password)) return unauthorized();
        return jsonResponse({ success: true, settings: getAllSettings() });
      }

      case 'adminUpdateSetting': {
        if (!verifyAdmin(body.password)) return unauthorized();
        setSetting(body.key, body.value, 'admin');
        return jsonResponse({ success: true, message: 'ปรับปรุงข้อมูลการตั้งค่าระบบเรียบร้อยแล้ว' });
      }

      case 'adminSaveSettings': {
        if (!verifyAdmin(body.password)) return unauthorized();
        setMultipleSettings(body.settings, 'admin');
        return jsonResponse({ success: true, message: 'บันทึกข้อมูลการตั้งค่าระบบทั้งหมดเรียบร้อยแล้ว' });
      }

      case 'adminGetAuditLog': {
        if (!verifyAdmin(body.password)) return unauthorized();
        const sh = getSheet(SHEET.AUDIT_LOG);
        if (!sh) return jsonResponse({ success: true, logs: [] });
        const data = sh.getDataRange().getValues();
        const logs = data.length > 1 ? data.slice(1).map(row => rowToObj(HEADERS.AUDIT_LOG, row)).reverse() : [];
        return jsonResponse({ success: true, logs: logs });
      }

      default:
        return jsonResponse({ success: false, message: 'รูปแบบคำสั่งไม่ถูกต้อง (Unknown action: ' + action + ')' });
    }
  } catch (err) {
    Logger.log('doPost error: ' + err.message + '\n' + err.stack);
    return jsonResponse({ success: false, message: 'ข้อผิดพลาดจากเซิร์ฟเวอร์ (Server error): ' + err.message });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function verifyAdmin(password) {
  return password === ADMIN_PASSWORD;
}

function unauthorized() {
  return jsonResponse({ success: false, message: 'ไม่ได้รับอนุญาตให้เข้าถึงระบบ (Unauthorized)' });
}