// ─────────────────────────────────────────────────────────────
// js/leave-request-detail.js — หน้าที่ 3 รายละเอียดใบลา
// สัปดาห์ที่ 7: อ่านจาก Firestore · เปลี่ยนสถานะจริง · เขียนความเห็นลงโฟลเดอร์ย่อย approvals
// สัปดาห์ที่ 8: ปุ่มตามบทบาท (ACL.md) · ผู้ช่วย AI สรุปใบลาให้หัวหน้าอ่าน (AI ระดับ 2)
// ─────────────────────────────────────────────────────────────

import {
  db, hasConfig, doc, getDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc
} from "./firebase.js";
import { requireLogin, เป็นผู้พิจารณา } from "./auth.js";
import { ถามAI, รุ่นโมเดล } from "./ai.js";

const รหัสใบลา = ค่าจากURL("id");
const กล่องใบลา = document.getElementById("กล่องใบลา");
const กล่องความเห็น = document.getElementById("กล่องความเห็น");
const กล่องสรุปAI = document.getElementById("กล่องสรุปAI");

// ผู้ที่กำลังใช้งาน = คนที่ล็อกอินอยู่จริง (เติมค่าตอนเริ่มทำงาน)
let ผู้ใช้ปัจจุบัน = null;

let ใบ = null;          // ข้อมูลใบลาใบนี้
let ความเห็น = [];      // รายการในโฟลเดอร์ย่อย approvals

เริ่มทำงาน();

async function เริ่มทำงาน() {
  if (!hasConfig) {
    showConfigWarning("จึงยังเปิดดูรายละเอียดใบลาจากฐานข้อมูลไม่ได้");
    กล่องใบลา.innerHTML = "";
    return;
  }
  // ต้องรอให้รู้สถานะล็อกอินก่อน แล้วค่อยอ่านข้อมูลจากฐานข้อมูล
  ผู้ใช้ปัจจุบัน = await requireLogin();
  if (!ผู้ใช้ปัจจุบัน) return;

  if (!รหัสใบลา) {
    แสดงว่าเปิดไม่ได้("ไม่ได้ระบุว่าจะเปิดใบไหน", "ลิงก์นี้ไม่มีรหัสใบลาต่อท้าย");
    return;
  }
  await โหลดใบลา();
}

// ── สิทธิ์ของคนที่กำลังดู (ตรงกับ ACL.md และ firestore.rules) ──
function เป็นเจ้าของ() {
  return ใบ.requesterId === ผู้ใช้ปัจจุบัน.uid;
}
function พิจารณาได้() {
  // ผู้อนุมัติ/ฝ่ายบุคคล พิจารณาใบของคนอื่นได้ · ใบของตัวเองห้ามอนุมัติเอง
  return เป็นผู้พิจารณา(ผู้ใช้ปัจจุบัน) && !เป็นเจ้าของ();
}

// ── อ่านใบลาและความเห็นทั้งหมดของใบนี้ ──
async function โหลดใบลา() {
  try {
    const ไฟล์ = await getDoc(doc(db, "leaveRequests", รหัสใบลา));
    if (!ไฟล์.exists()) {
      แสดงว่าเปิดไม่ได้("ไม่พบใบขอลาที่ต้องการ", "ใบนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง");
      return;
    }
    ใบ = { id: ไฟล์.id, ...ไฟล์.data() };

    // โฟลเดอร์ย่อย approvals ซ้อนอยู่ในไฟล์ใบลาใบนี้
    const ผล = await getDocs(collection(db, "leaveRequests", รหัสใบลา, "approvals"));
    ความเห็น = ผล.docs.map((f) => ({ id: f.id, ...f.data() }));

    วาดหัวเรื่อง();
    วาดใบลา();
    วาดความเห็น();
    กล่องความเห็น.classList.remove("hidden");
    document.getElementById("ปุ่มส่งความเห็น").addEventListener("click", ส่งความเห็น);

    if (เป็นผู้พิจารณา(ผู้ใช้ปัจจุบัน)) {
      วาดสรุปAI();
      กล่องสรุปAI.classList.remove("hidden");
      document.getElementById("ปุ่มAIสรุป").addEventListener("click", ให้AIสรุปใบลา);
    }
  } catch (e) {
    if (String(e && e.code).includes("permission-denied")) {
      // กฎฝั่งฐานข้อมูลปฏิเสธ = ใบนี้ไม่ใช่ของเรา และเราไม่ใช่ผู้พิจารณา
      แสดงว่าเปิดไม่ได้("คุณไม่มีสิทธิ์เปิดใบลานี้", "ผู้ขอลาเปิดดูได้เฉพาะใบลาของตัวเอง");
      return;
    }
    กล่องใบลา.innerHTML = "";
    const กล่อง = document.createElement("div");
    กล่อง.className = "alert alert-error";
    เตือนพร้อมไอคอน(กล่อง, "error", "อ่านข้อมูลไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
    กล่องใบลา.appendChild(กล่อง);
  }
}

function แสดงว่าเปิดไม่ได้(หัวข้อ, คำอธิบาย) {
  document.getElementById("หัวเรื่อง").textContent = หัวข้อ;
  document.getElementById("คำโปรย").textContent = คำอธิบาย;
  กล่องใบลา.innerHTML =
    '<div class="empty-state">' +
    '<div class="mark">' + ไอคอน("inbox") + "</div>" +
    "<h2>เปิดใบลานี้ไม่ได้</h2>" +
    "<p>ลองกลับไปเลือกใบลาจากหน้ารายการอีกครั้ง</p>" +
    '<div class="btn-row">' +
    '<a class="btn" href="leave-requests.html">ไปหน้ารายการใบลา</a>' +
    "</div></div>";
}

// ── หัวเรื่องของหน้า ──
// เอาหัวข้อใบลาขึ้นเป็นหัวเรื่อง เพื่อให้รู้ทันทีว่ากำลังเปิดใบไหนอยู่
// ทั้งบนหน้าจอ บนแท็บเบราว์เซอร์ และในประวัติการเข้าชม
function วาดหัวเรื่อง() {
  document.getElementById("หัวเรื่อง").textContent = ใบ.title;
  document.getElementById("คำโปรย").textContent =
    ใบ.leaveTypeName + " · ยื่นเมื่อ " + ใบ.createdAt;
  document.title = ใบ.title + " · LeaveEasy";
}

// ── วาดข้อมูลใบลาลงหน้าจอ ──
function วาดใบลา() {
  // ไม่ต้องมีแถว "หัวข้อ" เพราะยกขึ้นไปเป็นหัวเรื่องของหน้าแทน
  const แถว = [
    ["เหตุผลการลา", esc(ใบ.reason)],
    ["ประเภทการลา", esc(ใบ.leaveTypeName)],
    ["วันที่ลา", esc(ใบ.startDate) + " ถึง " + esc(ใบ.endDate)],
    ["ผู้ขอลา", esc(ใบ.requesterName)],
    ["ผู้อนุมัติ", ใบ.approverName ? esc(ใบ.approverName) : "ยังไม่ได้กำหนดผู้อนุมัติ"],
    ["สถานะ", ป้ายสถานะ(ใบ.status)],
    ["วันที่ยื่น", esc(ใบ.createdAt)]
  ];

  let html = แถว.map((r) =>
    '<div class="field-row"><span class="k">' + r[0] + "</span><span>" + r[1] + "</span></div>"
  ).join("");

  const ยังรอพิจารณา = ใบ.status === "รอพิจารณา";

  // ปุ่มอนุมัติ / ไม่อนุมัติ — เฉพาะผู้พิจารณา และเฉพาะใบที่ยังรอพิจารณา
  // แยกเป็นโซนของตัวเอง เพราะกดแล้วเปลี่ยนกลับไม่ได้ ไม่ควรวางปนกับปุ่มธรรมดาจนกดพลาด
  if (ยังรอพิจารณา && พิจารณาได้()) {
    html +=
      '<div class="btn-row danger-zone">' +
      '<p class="hint">การพิจารณาทำได้ครั้งเดียว กดแล้วเปลี่ยนสถานะต่อไม่ได้</p>' +
      '<button type="button" class="btn-ok" id="ปุ่มอนุมัติ">อนุมัติ</button>' +
      '<button type="button" class="btn-danger" id="ปุ่มไม่อนุมัติ">ไม่อนุมัติ</button>' +
      "</div>";
  } else if (ยังรอพิจารณา && เป็นผู้พิจารณา(ผู้ใช้ปัจจุบัน)) {
    html += '<p class="hint">ใบนี้เป็นใบของคุณเอง จึงอนุมัติเองไม่ได้ ต้องให้ผู้อนุมัติคนอื่นพิจารณา</p>';
  }

  // ปุ่มลบ — เฉพาะเจ้าของใบ และเฉพาะใบที่ยังรอพิจารณา
  if (ยังรอพิจารณา && เป็นเจ้าของ()) {
    html +=
      '<div class="btn-row">' +
      '<button type="button" class="btn-ghost" id="ปุ่มลบ">ลบใบลานี้</button>' +
      "</div>";
  }

  if (!ยังรอพิจารณา) {
    html += '<p class="hint">ใบนี้พิจารณาแล้ว จึงเปลี่ยนสถานะต่อไม่ได้ และลบไม่ได้</p>';
  }
  html += '<div id="เตือนสถานะ" class="alert alert-error hidden"></div>';

  กล่องใบลา.innerHTML = html;

  const ปุ่มอนุมัติ = document.getElementById("ปุ่มอนุมัติ");
  if (ปุ่มอนุมัติ) {
    ปุ่มอนุมัติ.addEventListener("click", () => เปลี่ยนสถานะ("อนุมัติ"));
    document.getElementById("ปุ่มไม่อนุมัติ")
      .addEventListener("click", () => เปลี่ยนสถานะ("ไม่อนุมัติ"));
  }
  const ปุ่มลบ = document.getElementById("ปุ่มลบ");
  if (ปุ่มลบ) ปุ่มลบ.addEventListener("click", ลบใบลา);
}

function เตือนสถานะ(ข้อความ) {
  const เตือน = document.getElementById("เตือนสถานะ");
  เตือนพร้อมไอคอน(เตือน, "error", ข้อความ);
  เตือน.classList.remove("hidden");
}

// ── ลบใบลา (ตัว D ของ CRUD) ──
// ลบได้เฉพาะเจ้าของใบ ที่สถานะยังเป็น รอพิจารณา และต้องถามยืนยันก่อนเสมอ
async function ลบใบลา() {
  if (ใบ.status !== "รอพิจารณา") {
    เตือนสถานะ("ใบที่พิจารณาแล้ว ลบไม่ได้");
    return;
  }
  if (!confirm('ยืนยันการลบใบลา "' + ใบ.title + '" หรือไม่ · ลบแล้วกู้กลับไม่ได้')) return;

  try {
    await deleteDoc(doc(db, "leaveRequests", ใบ.id));
    location.href = "leave-requests.html";
  } catch (e) {
    เตือนสถานะ("ลบไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
  }
}

// ── เปลี่ยนสถานะจริงในฐานข้อมูล ──
async function เปลี่ยนสถานะ(สถานะใหม่) {
  // กฎ: จะไม่อนุมัติได้ ต้องมีความเห็นอย่างน้อย 1 รายการก่อน
  if (สถานะใหม่ === "ไม่อนุมัติ" && ความเห็น.length === 0) {
    เตือนสถานะ("ต้องเขียนความเห็นอย่างน้อย 1 รายการก่อน จึงจะกดไม่อนุมัติได้");
    return;
  }

  try {
    // แก้เฉพาะช่อง status เท่านั้น ห้ามเขียนทับช่องอื่นในไฟล์เดิม
    await updateDoc(doc(db, "leaveRequests", ใบ.id), { status: สถานะใหม่ });
    ใบ.status = สถานะใหม่;
    วาดใบลา();
    ประกาศ("เปลี่ยนสถานะเป็น " + สถานะใหม่ + " แล้ว");
  } catch (e) {
    เตือนสถานะ("เปลี่ยนสถานะไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
  }
}

// ── รายการความเห็น เรียงจากเก่าไปใหม่ ──
function วาดความเห็น() {
  const ที่วาง = document.getElementById("รายการความเห็น");
  if (ความเห็น.length === 0) {
    ที่วาง.innerHTML = "<p>ยังไม่มีความเห็นในใบนี้</p>";
    return;
  }
  ที่วาง.innerHTML = ความเห็น
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((c) =>
      '<div class="comment"><div class="meta">' + esc(c.authorName) + " · " + esc(c.createdAt) +
      "</div><div>" + esc(c.message) + "</div></div>"
    ).join("");
}

// ── ส่งความเห็นใหม่ลงโฟลเดอร์ย่อย approvals ──
async function ส่งความเห็น() {
  const ช่อง = document.getElementById("ข้อความความเห็น");
  const เตือน = document.getElementById("เตือนความเห็น");
  const ปุ่ม = document.getElementById("ปุ่มส่งความเห็น");
  const ข้อความ = ช่อง.value.trim();

  if (!ข้อความ) {
    เตือนพร้อมไอคอน(เตือน, "error", "พิมพ์ข้อความก่อน จึงจะส่งความเห็นได้");
    เตือน.classList.remove("hidden");
    return;
  }
  เตือน.classList.add("hidden");

  const ความเห็นใหม่ = {
    authorId: ผู้ใช้ปัจจุบัน.uid,
    authorName: ผู้ใช้ปัจจุบัน.name,     // จดชื่อซ้ำไว้ จะได้ไม่ต้องเปิดโฟลเดอร์ users
    message: ข้อความ,
    createdAt: เวลาตอนนี้()
  };

  ปุ่ม.disabled = true;
  ปุ่ม.textContent = "กำลังส่ง…";
  try {
    const ไฟล์ใหม่ = await addDoc(
      collection(db, "leaveRequests", ใบ.id, "approvals"), ความเห็นใหม่
    );
    ความเห็น.push({ id: ไฟล์ใหม่.id, ...ความเห็นใหม่ });
    ช่อง.value = "";
    วาดความเห็น();
  } catch (e) {
    เตือนพร้อมไอคอน(เตือน, "error", "ส่งความเห็นไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
    เตือน.classList.remove("hidden");
  } finally {
    ปุ่ม.disabled = false;
    ปุ่ม.textContent = "ส่งความเห็น";
  }
}

// ─────────────────────────────────────────────────────────────
// ผู้ช่วย AI ระดับ 2 — อ่านหลายที่ → สรุปให้คนอ่าน → เขียนผลกลับลงฐาน → จดว่าทำอะไรไป
//
//   ขั้นที่ 1  อ่านใบลาใบนี้ + ความเห็นทั้งหมดในโฟลเดอร์ย่อย approvals (อ่านใหม่จากฐาน ไม่ใช้ของเก่าบนจอ)
//   ขั้นที่ 2  ให้ AI เขียนสรุปสั้น ๆ
//   ขั้นที่ 3  เขียนสรุปลงช่อง aiSuggestion ของใบลา + จดบันทึกลงโฟลเดอร์ย่อย aiLog
//
// AI สรุปให้อ่านเท่านั้น ไม่ได้ตัดสินแทน — โค้ดส่วนนี้ไม่แตะช่อง status เด็ดขาด
//    และกฎใน firestore.rules ก็ไม่ยอมให้เปลี่ยน status พร้อมกับ aiSuggestion
// ─────────────────────────────────────────────────────────────
function วาดสรุปAI() {
  const ที่วาง = document.getElementById("ผลสรุปAI");
  if (!ใบ.aiSuggestion) {
    ที่วาง.innerHTML = "<p>ยังไม่มีสรุปจาก AI สำหรับใบนี้</p>";
    return;
  }
  ที่วาง.innerHTML = "";
  const กล่อง = document.createElement("div");
  กล่อง.className = "alert alert-ai";
  กล่อง.innerHTML = ไอคอน("sparkles");
  const เนื้อ = document.createElement("div");
  const ป้าย = document.createElement("strong");
  ป้าย.textContent = "ข้อเสนอจาก AI — โปรดตรวจสอบก่อนยืนยัน";
  const ข้อความ = document.createElement("div");
  ข้อความ.style.whiteSpace = "pre-line";
  ข้อความ.textContent = ใบ.aiSuggestion;
  เนื้อ.append(ป้าย, ข้อความ);
  กล่อง.appendChild(เนื้อ);
  ที่วาง.appendChild(กล่อง);
}

function บอกขั้นตอน(ลำดับ, ข้อความ) {
  const รายการ = document.getElementById("ขั้นตอนAI");
  รายการ.classList.remove("hidden");
  let บรรทัด = รายการ.children[ลำดับ - 1];
  if (!บรรทัด) {
    บรรทัด = document.createElement("li");
    รายการ.appendChild(บรรทัด);
  }
  บรรทัด.textContent = ข้อความ;
}

async function ให้AIสรุปใบลา() {
  const ปุ่ม = document.getElementById("ปุ่มAIสรุป");
  const ข้อความเดิมของปุ่ม = ปุ่ม.innerHTML;
  ปุ่ม.disabled = true;
  ปุ่ม.textContent = "AI กำลังทำงาน…";
  document.getElementById("ขั้นตอนAI").innerHTML = "";

  let ข้อมูลที่ส่ง = "";
  let ผลลัพธ์ = "";
  let ผิดพลาด = "";

  try {
    // ── ขั้นที่ 1: อ่าน ──
    บอกขั้นตอน(1, "อ่านใบลาและความเห็นจากฐานข้อมูล…");
    const ไฟล์ = await getDoc(doc(db, "leaveRequests", ใบ.id));
    const ล่าสุด = ไฟล์.data();
    const ผลความเห็น = await getDocs(collection(db, "leaveRequests", ใบ.id, "approvals"));
    const รายการความเห็น = ผลความเห็น.docs
      .map((f) => f.data())
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    บอกขั้นตอน(1, "อ่านใบลาแล้ว · ความเห็น " + รายการความเห็น.length + " รายการ");

    // ส่งเฉพาะสิ่งที่ต้องใช้สรุป ไม่ส่ง uid หรืออีเมลของใครไปให้ AI ภายนอก
    ข้อมูลที่ส่ง =
      "หัวข้อ: " + ล่าสุด.title + "\n" +
      "ประเภทการลา: " + ล่าสุด.leaveTypeName + "\n" +
      "วันที่ลา: " + ล่าสุด.startDate + " ถึง " + ล่าสุด.endDate + "\n" +
      "สถานะปัจจุบัน: " + ล่าสุด.status + "\n" +
      "เหตุผล: " + ล่าสุด.reason + "\n" +
      "ความเห็นที่มีอยู่:\n" +
      (รายการความเห็น.length
        ? รายการความเห็น.map((c) => "- " + c.message).join("\n")
        : "- (ยังไม่มี)");

    // ── ขั้นที่ 2: สรุป ──
    บอกขั้นตอน(2, "ให้ AI เขียนสรุป… (รอได้ไม่เกิน 15 วินาที)");
    ผลลัพธ์ = await ถามAI(
      "คุณช่วยหัวหน้างานอ่านใบลาให้เร็วขึ้น สรุปเป็นภาษาไทย 2-4 บรรทัด ขึ้นต้นแต่ละบรรทัดด้วย - " +
      "บอกว่าลาเรื่องอะไร กี่วัน ช่วงไหน และประเด็นจากความเห็นที่หัวหน้าควรรู้ " +
      "ห้ามแนะนำว่าควรอนุมัติหรือไม่อนุมัติ ห้ามเดาข้อมูลที่ไม่มีในใบลา",
      ข้อมูลที่ส่ง
    );
    บอกขั้นตอน(2, "AI สรุปเสร็จแล้ว");

    // ── ขั้นที่ 3: เขียนกลับลงฐาน (เฉพาะช่อง aiSuggestion · ไม่แตะ status) ──
    บอกขั้นตอน(3, "บันทึกสรุปลงใบลา…");
    await updateDoc(doc(db, "leaveRequests", ใบ.id), { aiSuggestion: ผลลัพธ์ });
    ใบ.aiSuggestion = ผลลัพธ์;
    วาดสรุปAI();
    บอกขั้นตอน(3, "บันทึกสรุปลงช่อง aiSuggestion แล้ว · สถานะใบลาไม่ถูกเปลี่ยน");
  } catch (e) {
    ผิดพลาด = e.message || String(e);
    const ที่วาง = document.getElementById("ผลสรุปAI");
    const กล่อง = document.createElement("div");
    กล่อง.className = "alert alert-warn";
    เตือนพร้อมไอคอน(กล่อง, "warn", "AI สรุปไม่สำเร็จ — " + ผิดพลาด + " · อ่านใบลาแล้วพิจารณาเองได้ตามปกติ");
    ที่วาง.prepend(กล่อง);
  } finally {
    // จดบันทึกทุกครั้งที่เรียก ทั้งสำเร็จและไม่สำเร็จ — ย้อนดูได้ว่า AI ได้อะไรไป ตอบอะไรกลับมา
    if (ข้อมูลที่ส่ง) {
      try {
        await addDoc(collection(db, "leaveRequests", ใบ.id, "aiLog"), {
          input: ข้อมูลที่ส่ง,
          output: ผลลัพธ์ || "(ผิดพลาด) " + ผิดพลาด,
          createdAt: เวลาตอนนี้(),
          createdBy: ผู้ใช้ปัจจุบัน.uid,
          model: รุ่นโมเดล
        });
      } catch (e) {
        console.warn("จดบันทึก aiLog ไม่สำเร็จ", e);
      }
    }
    ปุ่ม.disabled = false;
    ปุ่ม.innerHTML = ข้อความเดิมของปุ่ม;
  }
}

// ── บอกผลลัพธ์ให้คนที่ใช้โปรแกรมอ่านหน้าจอรู้ด้วย ──
// การกดปุ่มแล้วหน้าจอเปลี่ยน คนที่มองเห็นรู้ทันที แต่คนที่ฟังต้องมีคนบอก
function ประกาศ(ข้อความ) {
  let ที่วาง = document.getElementById("ประกาศผล");
  if (!ที่วาง) {
    ที่วาง = document.createElement("div");
    ที่วาง.id = "ประกาศผล";
    ที่วาง.className = "alert alert-ok";
    ที่วาง.setAttribute("role", "status");
    กล่องใบลา.parentNode.insertBefore(ที่วาง, กล่องใบลา);
  }
  ที่วาง.textContent = ข้อความ;
}

function แปลข้อผิดพลาด(e) {
  if (String(e && e.code).includes("permission-denied")) {
    return "ฐานข้อมูลปฏิเสธ · บทบาทของคุณทำสิ่งนี้ไม่ได้";
  }
  return (e && e.message) || String(e);
}
