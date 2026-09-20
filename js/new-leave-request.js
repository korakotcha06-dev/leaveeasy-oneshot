// ─────────────────────────────────────────────────────────────
// js/new-leave-request.js — พฤติกรรมของหน้า new-leave-request.html
//
// หน้านี้ต้องล็อกอินก่อนเสมอ (สเปกทุกหน้ายกเว้น login.html และ index.html)
// ─────────────────────────────────────────────────────────────

import { requireAuth } from "./auth.js";
import { listLeaveTypes, createLeaveRequest } from "./data.js";
import { byTestId, showError, clearError, describeError, escapeHtml } from "./util.js";
import { classifyLeaveType } from "./ai.js";

// ไปหน้าไหนต่อหลังบันทึกสำเร็จหรือกดยกเลิก · เขียนไว้ที่เดียวจะได้แก้ที่เดียว
const หน้ารายการ = "leave-requests.html";

const ช่องผิดพลาด = byTestId("error-message");
const ช่องหัวข้อ = byTestId("field-title");
const ช่องเหตุผล = byTestId("field-reason");
const ช่องประเภท = byTestId("field-leave-type");
const ช่องวันเริ่ม = byTestId("field-start-date");
const ช่องวันสิ้นสุด = byTestId("field-end-date");
const ปุ่มบันทึก = byTestId("save-button");
const ปุ่มยกเลิก = byTestId("cancel-button");
const ปุ่มAI = byTestId("ai-classify-button");
const ป้ายAI = byTestId("ai-notice");
const ฟอร์ม = document.getElementById("new-request-form");

let ผู้ใช้ปัจจุบัน = null;
// เก็บรายการประเภทการลาที่โหลดมาไว้ในตัวแปรนี้ ทั้ง AI และตอนบันทึกใช้ชุดเดียวกัน
// กันปัญหาโหลดสองรอบแล้วได้คนละชุดถ้าระหว่างนั้นมีคนแก้ไขประเภทที่หน้าอื่น
let ประเภทที่มีอยู่ = [];

async function เริ่มทำงาน() {
  ผู้ใช้ปัจจุบัน = await requireAuth();
  if (!ผู้ใช้ปัจจุบัน) return; // requireAuth กำลังพาไปหน้า login.html อยู่ ทำงานต่อไม่มีประโยชน์

  await โหลดประเภทการลา();
}

async function โหลดประเภทการลา() {
  clearError(ช่องผิดพลาด);
  try {
    ประเภทที่มีอยู่ = await listLeaveTypes();
    วาดตัวเลือกประเภท();
  } catch (err) {
    showError(ช่องผิดพลาด, describeError(err));
  }
}

function วาดตัวเลือกประเภท() {
  if (!ประเภทที่มีอยู่.length) {
    // ยังไม่มีประเภทการลาในระบบเลย — เกิดขึ้นได้ถ้ายังไม่ได้ seed หรือ hr ลบหมด
    // ใส่ตัวเลือกว่างไว้กันฟอร์มพังดีกว่าไม่ใส่อะไรเลย
    ช่องประเภท.innerHTML = `<option value="">ยังไม่มีประเภทการลาในระบบ</option>`;
    return;
  }
  ช่องประเภท.innerHTML = ประเภทที่มีอยู่
    .map(
      (ประเภท) =>
        `<option value="${escapeHtml(ประเภท.id)}">${escapeHtml(ประเภท.name)}</option>`
    )
    .join("");
}

// ── ปุ่ม AI ช่วยจัดประเภทการลา (สเปกข้อ 8 / US-09) ────────────
ปุ่มAI.addEventListener("click", async () => {
  clearError(ช่องผิดพลาด);
  ป้ายAI.hidden = true; // ซ่อนป้ายเดิมไว้ก่อน จนกว่าจะรู้ผลรอบใหม่

  const ข้อความเดิมของปุ่ม = ปุ่มAI.textContent;
  ปุ่มAI.disabled = true; // กันกดซ้ำระหว่างรอ ตามสเปก "ปุ่มกดซ้ำไม่ได้ระหว่างรอ"
  ปุ่มAI.textContent = "กำลังให้ AI ช่วยจัดประเภท...";

  try {
    const ผล = await classifyLeaveType(ช่องเหตุผล.value, ประเภทที่มีอยู่);
    if (ผล.ok) {
      ช่องประเภท.value = ผล.leaveType.id;
      ป้ายAI.hidden = false;
    } else {
      // ไม่ตรงกับประเภทที่มีอยู่จริง หรือเรียกไม่สำเร็จ/timeout — แจ้งเตือนแล้วไม่แตะค่าเดิมในช่องประเภท
      showError(ช่องผิดพลาด, ผล.message);
    }
  } finally {
    // finally การันตีว่าปุ่มกลับมากดได้เสมอ ไม่ว่าจะสำเร็จ ล้มเหลว หรือ timeout
    // (ถ้าลืมส่วนนี้ ปุ่มจะค้างเป็น disabled ตลอดไปเมื่อเกิด error ที่ไม่คาดคิด)
    ปุ่มAI.disabled = false;
    ปุ่มAI.textContent = ข้อความเดิมของปุ่ม;
  }
});

// ── ปุ่มยกเลิก ────────────────────────────────────────────────
ปุ่มยกเลิก.addEventListener("click", () => {
  location.href = หน้ารายการ;
});

// ── บันทึกใบลาใหม่ ────────────────────────────────────────────
ฟอร์ม.addEventListener("submit", async (event) => {
  // กัน submit แบบเดิมของเบราว์เซอร์ที่จะโหลดหน้าใหม่ทั้งหน้า
  event.preventDefault();
  clearError(ช่องผิดพลาด);

  const หัวข้อ = ช่องหัวข้อ.value.trim();
  const เหตุผล = ช่องเหตุผล.value.trim();
  const leaveTypeId = ช่องประเภท.value;
  const วันเริ่ม = ช่องวันเริ่ม.value;
  const วันสิ้นสุด = ช่องวันสิ้นสุด.value;

  if (!หัวข้อ || !เหตุผล || !leaveTypeId || !วันเริ่ม || !วันสิ้นสุด) {
    showError(ช่องผิดพลาด, "กรุณากรอกข้อมูลให้ครบทุกช่อง");
    return;
  }
  if (วันสิ้นสุด < วันเริ่ม) {
    showError(ช่องผิดพลาด, "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา");
    return;
  }

  // หา leaveTypeName จาก id ที่เลือก เพื่อจดสำเนาชื่อลงในใบลาตามสเปกหัวข้อ 1
  // (Firestore ไม่มี JOIN หน้ารายการต้องอ่านชื่อได้โดยไม่เปิดโฟลเดอร์ leaveTypes ซ้ำ)
  const ประเภทที่เลือก = ประเภทที่มีอยู่.find((ประเภท) => ประเภท.id === leaveTypeId);

  ปุ่มบันทึก.disabled = true;
  try {
    await createLeaveRequest({
      title: หัวข้อ,
      reason: เหตุผล,
      requesterId: ผู้ใช้ปัจจุบัน.uid,
      requesterName: ผู้ใช้ปัจจุบัน.name,
      leaveTypeId,
      leaveTypeName: ประเภทที่เลือก ? ประเภทที่เลือก.name : "",
      startDate: วันเริ่ม,
      endDate: วันสิ้นสุด
      // ไม่ส่ง status หรือ createdAt — createLeaveRequest ในไฟล์ data.js เป็นคนตั้งเองเสมอ
    });
    location.href = หน้ารายการ;
  } catch (err) {
    showError(ช่องผิดพลาด, describeError(err));
    ปุ่มบันทึก.disabled = false;
  }
});

เริ่มทำงาน();
