// ─────────────────────────────────────────────────────────────
// js/leave-requests.js — พฤติกรรมของหน้า leave-requests.html
//
// หน้านี้ต้อง "ล็อกอินก่อน" และต้องรู้ก่อนว่าใครเป็นคนดู
//   - employee เห็นเฉพาะใบของตัวเอง (ต้องส่ง requesterId ไปกรองตั้งแต่ต้นทาง)
//   - manager / hr เห็นใบลาทุกใบ
// ถ้าส่งค่าผิด (เช่น employee ขอทั้งโฟลเดอร์) กฎความปลอดภัยของ Firestore
// จะปฏิเสธทั้งคำสั่งค้นหา ไม่ใช่กรองให้เหลือแค่ของตัวเอง หน้าจะพังเป็น error ทันที
// (ดูคำอธิบายเดียวกันนี้ใน js/data.js บนฟังก์ชัน listLeaveRequests)
//
// ส่วนค้นหา/กรอง/เรียงลำดับ (US-10) ทำฝั่งเบราว์เซอร์ล้วน ๆ
// เพราะข้อมูลอ่านมาครั้งเดียวตอนโหลดหน้าอยู่แล้ว ไม่ต้องยิงคำสั่งใหม่ทุกครั้งที่พิมพ์
// ─────────────────────────────────────────────────────────────

import { requireAuth } from "./auth.js";
import { listLeaveRequests, listLeaveTypes } from "./data.js";
import {
  ALL_STATUS,
  escapeHtml,
  formatDateRange,
  statusBadgeHtml,
  timeValue,
  describeError,
  showError,
  clearError,
  byTestId
} from "./util.js";

// ชื่อพารามิเตอร์ใน URL ที่รับสถานะมาจากหน้าแดชบอร์ด (js/dashboard.js ใช้ชื่อเดียวกันนี้)
// เขียนไว้ตรงนี้เพื่อให้เห็นชัดว่าสองไฟล์ต้องตกลงชื่อกันไว้ล่วงหน้า
const STATUS_PARAM = "status";

let คำขอทั้งหมด = []; // ข้อมูลดิบที่อ่านมาจาก Firestore ครั้งเดียว ไม่แก้ไขระหว่างกรอง/ค้นหา
let เรียงใหม่ก่อน = true; // ค่าเริ่มต้นตาม US-10: ใหม่ไปเก่าก่อนเสมอ

const els = {};

function cacheEls() {
  els.search = document.getElementById("search-input");
  els.statusFilter = document.getElementById("status-filter");
  els.typeFilter = document.getElementById("type-filter");
  els.sortToggle = document.getElementById("sort-toggle");
  els.tbody = document.getElementById("request-tbody");
  els.tableWrapper = document.getElementById("table-wrapper");
}

// อ่านพารามิเตอร์ ?status=... จาก URL แล้วตั้งค่าตัวกรองสถานะไว้ล่วงหน้า
// ใช้ตอนกดกล่องตัวเลขในหน้าแดชบอร์ดแล้วโดนพามาที่นี่พร้อมสถานะที่เลือกไว้แล้ว
function ตั้งค่าตัวกรองจากลิงก์() {
  const พารามิเตอร์ = new URLSearchParams(location.search);
  const สถานะจากลิงก์ = พารามิเตอร์.get(STATUS_PARAM);
  if (สถานะจากลิงก์ && ALL_STATUS.includes(สถานะจากลิงก์)) {
    els.statusFilter.value = สถานะจากลิงก์;
  }
}

// เติมตัวเลือกประเภทการลาในตัวกรอง จากข้อมูลจริงที่มีอยู่ ไม่ใช่ค่าตายตัว
// เพราะฝ่ายบุคคลเพิ่ม/ลบประเภทการลาได้เองในหน้า leave-types.html
function เติมตัวเลือกประเภทการลา(ประเภททั้งหมด) {
  const ตัวเลือก = ประเภททั้งหมด
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`)
    .join("");
  els.typeFilter.insertAdjacentHTML("beforeend", ตัวเลือก);
}

// กรอง + ค้นหา + เรียงลำดับ คืนอาร์เรย์ใหม่เสมอ ไม่แก้ของเดิม
// เพราะ คำขอทั้งหมด ต้องคงสภาพเดิมไว้ให้เช็คได้ว่า "ฐานข้อมูลว่างจริงไหม"
// แยกจาก "ผลลัพธ์หลังกรองว่างไหม" ซึ่งเป็นสองข้อความที่ต่างกัน
function กรองและเรียง() {
  const คำค้น = (els.search.value || "").trim().toLowerCase();
  const สถานะที่เลือก = els.statusFilter.value;
  const ประเภทที่เลือก = els.typeFilter.value;

  const ผ่านตัวกรอง = คำขอทั้งหมด.filter((r) => {
    if (สถานะที่เลือก && r.status !== สถานะที่เลือก) return false;
    if (ประเภทที่เลือก && r.leaveTypeId !== ประเภทที่เลือก) return false;
    if (คำค้น && !String(r.title || "").toLowerCase().includes(คำค้น)) return false;
    return true;
  });

  // sort() แก้ array เดิม จึงต้อง slice() ก่อน กัน bug แปลก ๆ ถ้าใครเอาไปใช้ต่อ
  return ผ่านตัวกรอง.slice().sort((a, b) => {
    const ผลต่างใหม่ไปเก่า = timeValue(b.createdAt) - timeValue(a.createdAt);
    return เรียงใหม่ก่อน ? ผลต่างใหม่ไปเก่า : -ผลต่างใหม่ไปเก่า;
  });
}

function แถวHtml(r) {
  return (
    `<tr data-testid="request-row" data-id="${escapeHtml(r.id)}">` +
    `<td data-testid="request-row-title">${escapeHtml(r.title)}</td>` +
    `<td data-testid="request-row-type">${escapeHtml(r.leaveTypeName)}</td>` +
    `<td data-testid="request-row-status">${statusBadgeHtml(r.status)}</td>` +
    `<td data-testid="request-row-requester">${escapeHtml(r.requesterName)}</td>` +
    `<td data-testid="request-row-dates">${escapeHtml(formatDateRange(r.startDate, r.endDate))}</td>` +
    `</tr>`
  );
}

function วาดหน้าจอ() {
  const รายการที่จะแสดง = กรองและเรียง();
  els.tbody.innerHTML = รายการที่จะแสดง.map(แถวHtml).join("");

  const empty = byTestId("empty-state");

  if (คำขอทั้งหมด.length === 0) {
    // กรณีที่ 1: ฐานข้อมูลไม่มีใบลาเลยสักใบ (ไม่เกี่ยวกับตัวกรอง)
    empty.textContent = "ยังไม่มีใบขอลาในระบบ";
    empty.hidden = false;
    els.tableWrapper.hidden = true;
  } else if (รายการที่จะแสดง.length === 0) {
    // กรณีที่ 2: มีข้อมูลอยู่ แต่คำค้น/ตัวกรองที่เลือกไม่ตรงกับใบไหนเลย
    empty.textContent = "ไม่พบใบขอลาที่ตรงกับคำค้น";
    empty.hidden = false;
    els.tableWrapper.hidden = true;
  } else {
    empty.hidden = true;
    empty.textContent = "";
    els.tableWrapper.hidden = false;
  }
}

// คลิกทั้งแถวแล้วไปหน้ารายละเอียด ผูก listener ไว้ที่ tbody ครั้งเดียว (event delegation)
// ไม่ผูกทีละแถว เพราะแถวถูกสร้างใหม่ทุกครั้งที่วาดหน้าจอใหม่ (ค้นหา/กรอง/เรียง)
function ผูกคลิกแถว() {
  els.tbody.addEventListener("click", (e) => {
    const แถว = e.target.closest('[data-testid="request-row"]');
    if (!แถว) return;
    location.href = `leave-request-detail.html?id=${encodeURIComponent(แถว.dataset.id)}`;
  });
}

function ผูกตัวควบคุม() {
  els.search.addEventListener("input", วาดหน้าจอ);
  els.statusFilter.addEventListener("change", วาดหน้าจอ);
  els.typeFilter.addEventListener("change", วาดหน้าจอ);
  els.sortToggle.addEventListener("click", () => {
    เรียงใหม่ก่อน = !เรียงใหม่ก่อน;
    els.sortToggle.textContent = เรียงใหม่ก่อน ? "เรียง: ใหม่ไปเก่า" : "เรียง: เก่าไปใหม่";
    วาดหน้าจอ();
  });
  ผูกคลิกแถว();
}

async function init() {
  const ผู้ใช้ = await requireAuth();
  if (!ผู้ใช้) return; // requireAuth() เด้งไปหน้า login.html ให้แล้ว ไม่ต้องทำอะไรต่อ

  cacheEls();
  ตั้งค่าตัวกรองจากลิงก์();
  ผูกตัวควบคุม();
  clearError("error-message");

  try {
    // ต้องเช็คแบบ "fail closed": อนุญาตให้ขอทั้งโฟลเดอร์เฉพาะ manager/hr ที่รู้ชัดเจนเท่านั้น
    // role ว่าง ("") เกิดได้จริงตอนอ่านโปรไฟล์ผู้ใช้ไม่สำเร็จ (ดู js/auth.js)
    // ถ้าเช็คกลับด้าน (เช่น === "employee" ถึงจะกรอง) role ว่างจะหลุดไปขอทั้งโฟลเดอร์
    // ซึ่งกฎความปลอดภัยปฏิเสธทั้งคำสั่งทันที หน้าเลยพังทั้งที่ปัญหาจริงคือหาโปรไฟล์ไม่เจอ
    const เป็นผู้พิจารณา = ผู้ใช้.role === "manager" || ผู้ใช้.role === "hr";
    const [รายการใบลา, ประเภททั้งหมด] = await Promise.all([
      เป็นผู้พิจารณา
        ? listLeaveRequests()
        : listLeaveRequests({ requesterId: ผู้ใช้.uid }),
      listLeaveTypes()
    ]);

    คำขอทั้งหมด = รายการใบลา;
    เติมตัวเลือกประเภทการลา(ประเภททั้งหมด);
    วาดหน้าจอ();
  } catch (err) {
    showError("error-message", describeError(err));
  }
}

init();
