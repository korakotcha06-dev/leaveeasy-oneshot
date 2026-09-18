// ─────────────────────────────────────────────────────────────
// js/new-leave-request.js — หน้าที่ 2 ยื่นใบลาใหม่
// สัปดาห์ที่ 7: บันทึกลง Firestore จริง (ตัว C ของ CRUD)
// สัปดาห์ที่ 8: ปุ่มให้ AI ช่วยจัดประเภทการลา (spec US-09 · AI ระดับ 1)
// ─────────────────────────────────────────────────────────────

import { db, hasConfig, collection, getDocs, addDoc } from "./firebase.js";
import { requireLogin } from "./auth.js";
import { ถามAI, แกะJSON } from "./ai.js";

const ฟอร์ม = document.getElementById("ฟอร์มใบลา");
const ช่องประเภท = document.getElementById("leaveTypeId");
const ช่องเหตุผล = document.getElementById("reason");
const กล่องเตือน = document.getElementById("ข้อความเตือน");
const ปุ่มบันทึก = document.getElementById("ปุ่มบันทึก");
const ปุ่มAI = document.getElementById("ปุ่มAIจัดประเภท");
const กล่องผลAI = document.getElementById("ผลAIจัดประเภท");

// ผู้ยื่นใบลา = คนที่ล็อกอินอยู่จริง (เติมค่าตอนเริ่มทำงาน)
let ผู้ใช้ปัจจุบัน = null;

let ประเภททั้งหมด = [];

เริ่มทำงาน();

async function เริ่มทำงาน() {
  if (!hasConfig) {
    showConfigWarning("จึงยังบันทึกใบลาลงฐานข้อมูลไม่ได้");
    ปุ่มบันทึก.disabled = true;
    ปุ่มAI.disabled = true;
    return;
  }
  // ต้องรอให้รู้สถานะล็อกอินก่อน แล้วค่อยอ่านข้อมูลจากฐานข้อมูล
  ผู้ใช้ปัจจุบัน = await requireLogin();
  if (!ผู้ใช้ปัจจุบัน) return;

  await โหลดประเภทการลา();
  ฟอร์ม.addEventListener("submit", บันทึกใบลา);
  ปุ่มAI.addEventListener("click", ให้AIจัดประเภท);

  // คนเลือกประเภทเองทีหลัง = ค่านั้นไม่ใช่ข้อเสนอของ AI แล้ว เอาป้ายออก จะได้ไม่เข้าใจผิด
  ช่องประเภท.addEventListener("change", () => กล่องผลAI.classList.add("hidden"));
}

// ── อ่านประเภทการลาจากโฟลเดอร์ leaveTypes มาใส่รายการเลื่อนลง ──
async function โหลดประเภทการลา() {
  try {
    const ผล = await getDocs(collection(db, "leaveTypes"));
    ประเภททั้งหมด = ผล.docs.map((ไฟล์) => ({ id: ไฟล์.id, ...ไฟล์.data() }));

    ประเภททั้งหมด.forEach((ประเภท) => {
      const ตัวเลือก = document.createElement("option");
      ตัวเลือก.value = ประเภท.id;
      ตัวเลือก.textContent = ประเภท.name;
      ช่องประเภท.appendChild(ตัวเลือก);
    });

    if (ประเภททั้งหมด.length === 0) {
      เตือน("ยังไม่มีประเภทการลาในระบบ — ไปเพิ่มที่หน้าจัดการประเภทการลาก่อน");
      ปุ่มAI.disabled = true;
    }
  } catch (e) {
    เตือน("อ่านประเภทการลาไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
  }
}

// ── AI ระดับ 1: อ่านเหตุผล → เลือกประเภทจากรายชื่อที่มีจริง ─────
// กติกา 5 ข้อของใบงาน
//   ① ระหว่างรอ ปุ่มขึ้นว่ากำลังทำงาน และกดซ้ำไม่ได้
//   ② มีป้าย "ข้อเสนอจาก AI — โปรดตรวจสอบก่อนยืนยัน"
//   ③ คนแก้ประเภทได้เสมอ (ไม่ล็อกช่อง · คนเป็นคนกดบันทึก)
//   ④ พังหรือเกิน 15 วินาที ขึ้นข้อความ และปุ่มบันทึกยังกดได้ (ไม่แตะปุ่มบันทึกเลย)
//   ⑤ ผลต้องเป็นประเภทที่มีจริงเท่านั้น ไม่ตรงให้บอกว่าจัดไม่ได้ และไม่เปลี่ยนค่าเดิม
async function ให้AIจัดประเภท() {
  const เหตุผล = ช่องเหตุผล.value.trim();
  if (!เหตุผล) {
    แสดงผลAI("warn", "พิมพ์เหตุผลการลาก่อน AI จึงจะช่วยจัดประเภทได้");
    return;
  }

  const ข้อความเดิมของปุ่ม = ปุ่มAI.innerHTML;
  ปุ่มAI.disabled = true;                                   // ①
  ปุ่มAI.textContent = "AI กำลังอ่านเหตุผล…";
  แสดงผลAI("ai", "กำลังให้ AI จัดประเภท — ระหว่างนี้กรอกช่องอื่นหรือกดบันทึกต่อได้ตามปกติ");

  const รายชื่อ = ประเภททั้งหมด.map((t) => t.id + " = " + t.name).join("\n");
  const คำสั่งระบบ =
    "คุณช่วยจัดประเภทการลาของพนักงาน โดยเลือกจากรายการที่ให้มาเท่านั้น\n" +
    "ตอบเป็น JSON บรรทัดเดียวรูปแบบนี้เท่านั้น ห้ามมีข้อความอื่น\n" +
    '{"leaveTypeId": "<รหัสจากรายการ>"}\n' +
    'ถ้าเหตุผลไม่เข้ากับประเภทใดเลย ให้ตอบ {"leaveTypeId": null}';
  const ข้อความ = "ประเภทการลาที่มีในระบบ:\n" + รายชื่อ + "\n\nเหตุผลการลา:\n" + เหตุผล;

  try {
    const คำตอบ = await ถามAI(คำสั่งระบบ, ข้อความ);
    const ผล = แกะJSON(คำตอบ);
    const รหัส = ผล && typeof ผล.leaveTypeId === "string" ? ผล.leaveTypeId.trim() : "";
    const ประเภท = ประเภททั้งหมด.find((t) => t.id === รหัส);   // ⑤ ต้องมีอยู่จริงในระบบ

    if (!ประเภท) {
      แสดงผลAI("warn", "AI จัดประเภทให้ไม่ได้ — กรุณาเลือกประเภทการลาเอง");   // ⑤ ไม่แตะค่าเดิม
      return;
    }

    ช่องประเภท.value = ประเภท.id;
    แสดงผลAI("ai", "ข้อเสนอจาก AI — โปรดตรวจสอบก่อนยืนยัน · AI เลือก \"" + ประเภท.name +
      "\" ถ้าไม่ตรงให้เปลี่ยนในช่องประเภทการลาได้เลย");                              // ② ③
  } catch (e) {
    แสดงผลAI("warn", e.message + " · เลือกประเภทการลาเองแล้วกดบันทึกได้ตามปกติ");   // ④
  } finally {
    ปุ่มAI.disabled = false;
    ปุ่มAI.innerHTML = ข้อความเดิมของปุ่ม;
  }
}

function แสดงผลAI(ชนิด, ข้อความ) {
  กล่องผลAI.className = "alert " + (ชนิด === "ai" ? "alert-ai" : "alert-warn");
  กล่องผลAI.innerHTML = ไอคอน(ชนิด === "ai" ? "sparkles" : "alert-triangle");
  กล่องผลAI.appendChild(document.createTextNode(ข้อความ));
}

// ── บันทึกใบลาใหม่ลง Firestore ──
async function บันทึกใบลา(e) {
  e.preventDefault();

  const ค่า = {
    title: document.getElementById("title").value.trim(),
    reason: ช่องเหตุผล.value.trim(),
    leaveTypeId: ช่องประเภท.value,
    startDate: document.getElementById("startDate").value,
    endDate: document.getElementById("endDate").value
  };

  // ตรวจว่ากรอกครบก่อนบันทึก
  if (!ค่า.title || !ค่า.reason || !ค่า.leaveTypeId || !ค่า.startDate || !ค่า.endDate) {
    เตือน("กรอกไม่ครบ — ต้องกรอกทุกช่องก่อนกดบันทึก");
    return;
  }
  if (ค่า.endDate < ค่า.startDate) {
    เตือน("วันที่สิ้นสุดต้องไม่มาก่อนวันที่เริ่มลา");
    return;
  }

  const ประเภท = ประเภททั้งหมด.find((t) => t.id === ค่า.leaveTypeId);

  ปุ่มบันทึก.disabled = true;
  ปุ่มบันทึก.textContent = "กำลังบันทึก…";

  try {
    await addDoc(collection(db, "leaveRequests"), {
      title: ค่า.title,
      reason: ค่า.reason,
      status: "รอพิจารณา",                    // ใบใหม่เริ่มที่ รอพิจารณา เสมอ
      requesterId: ผู้ใช้ปัจจุบัน.uid,
      requesterName: ผู้ใช้ปัจจุบัน.name,      // จดชื่อซ้ำไว้ เพราะ Firestore ไม่มี JOIN
      approverId: "",                          // ยังไม่ได้กำหนดผู้อนุมัติ
      approverName: "",
      leaveTypeId: ประเภท.id,
      leaveTypeName: ประเภท.name,              // จดชื่อซ้ำไว้เช่นกัน
      startDate: ค่า.startDate,
      endDate: ค่า.endDate,
      createdAt: เวลาตอนนี้()
    });
    location.href = "leave-requests.html";
  } catch (err) {
    เตือน("บันทึกไม่สำเร็จ — " + แปลข้อผิดพลาด(err));
    ปุ่มบันทึก.disabled = false;
    ปุ่มบันทึก.textContent = "บันทึก";
  }
}

function เตือน(ข้อความ) {
  เตือนพร้อมไอคอน(กล่องเตือน, "error", ข้อความ);
  กล่องเตือน.classList.remove("hidden");
}

function แปลข้อผิดพลาด(e) {
  if (String(e && e.code).includes("permission-denied")) {
    return "ฐานข้อมูลปฏิเสธ · ตรวจว่าล็อกอินแล้วหรือยัง และกฎใน firestore.rules deploy ขึ้นไปแล้วหรือยัง";
  }
  return (e && e.message) || String(e);
}
