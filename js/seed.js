// ─────────────────────────────────────────────────────────────
// js/seed.js — เขียนข้อมูลตัวอย่างตามสเปกหัวข้อ 7 ลงฐานข้อมูล
//
// หน้านี้เป็น "เครื่องมือ" ไม่ใช่หน้าจอของผู้ใช้จริง จึงเป็นที่เดียวนอกจาก data.js
// ที่เรียกคำสั่ง Firestore ตรง ๆ เหตุผลคือ data.js ตั้งใจไม่เปิดช่องให้ตั้งชื่อไฟล์เอง
// (ใบลาจริงต้องให้ Firestore สุ่มรหัสให้) แต่ข้อมูลตัวอย่างต้องใช้รหัสคงที่
// lr001-lr005 เพื่อให้เปิดดูใน Firebase Console แล้วเทียบกับสเปกได้ทีละบรรทัด
//
// ใช้ setDoc ทุกที่ ไม่ใช่ addDoc
//   setDoc = "เขียนลงไฟล์ชื่อนี้" ถ้ามีอยู่แล้วก็ทับ · กดซ้ำกี่ครั้งผลก็เหมือนเดิม
//   addDoc = "สร้างไฟล์ใหม่ สุ่มชื่อให้" · กด 3 ครั้งจะได้ข้อมูลซ้ำ 3 ชุด
// ─────────────────────────────────────────────────────────────

import { db, doc, setDoc, useEmulator } from "./firebase.js";
import { onUser } from "./auth.js";
import { byTestId, showError, clearError, describeError } from "./util.js";

// เวลาในสเปกเขียนไว้แบบ "2026-09-01 09:15" โดยไม่ได้บอกเขตเวลา
// เราตีความว่าเป็นเวลาประเทศไทย (+07:00) และเขียนให้ชัดตอนแปลง
// ถ้าไม่ระบุ เบราว์เซอร์จะใช้เขตเวลาของเครื่อง ผลที่ได้จะต่างกันไปในแต่ละเครื่อง
// และใบลาจะเรียงลำดับไม่เหมือนกันระหว่างเครื่องทัชกับเครื่องที่รันเทส
function เวลาไทย(ข้อความ) {
  const [วัน, เวลา] = ข้อความ.split(" ");
  return new Date(`${วัน}T${เวลา}:00+07:00`);
}

// ── ข้อมูลตัวอย่าง ชุดเดียวกับสเปกหัวข้อ 7 เป๊ะ ๆ ─────────────
// ชื่อทุกชื่อเป็นชื่อสมมติ และอีเมลทุกตัวเป็นอีเมลตัวอย่าง

const ผู้ใช้ = [
  { id: "u001", name: "สมชาย ใจดี", email: "somchai@example.com", role: "employee" },
  { id: "u002", name: "สมหญิง รักงาน", email: "somying@example.com", role: "manager" },
  { id: "u003", name: "สมศรี ตั้งใจ", email: "somsri@example.com", role: "hr" }
];

const ประเภทการลา = [
  { id: "lt001", name: "ลาพักร้อน" },
  { id: "lt002", name: "ลาป่วย" },
  { id: "lt003", name: "ลากิจ" }
];

const ใบขอลา = [
  {
    id: "lr001",
    title: "ลาพักร้อนไปเที่ยวกับครอบครัว",
    reason: "วางแผนเดินทางไปต่างจังหวัดกับครอบครัว จองที่พักไว้ล่วงหน้าแล้ว",
    status: "รอพิจารณา",
    requesterId: "u001",
    requesterName: "สมชาย ใจดี",
    approverId: "u002",
    approverName: "สมหญิง รักงาน",
    leaveTypeId: "lt001",
    leaveTypeName: "ลาพักร้อน",
    startDate: "2026-09-07",
    endDate: "2026-09-09",
    createdAt: "2026-09-01 09:15"
  },
  {
    id: "lr002",
    title: "ลาป่วยไข้หวัดใหญ่",
    reason: "มีไข้สูงและไอมาก แพทย์แนะนำให้พักอยู่บ้าน 2 วัน",
    status: "อนุมัติ",
    requesterId: "u001",
    requesterName: "สมชาย ใจดี",
    approverId: "u002",
    approverName: "สมหญิง รักงาน",
    leaveTypeId: "lt002",
    leaveTypeName: "ลาป่วย",
    startDate: "2026-08-24",
    endDate: "2026-08-25",
    createdAt: "2026-08-24 08:05"
  },
  {
    id: "lr003",
    title: "ลากิจไปทำบัตรประชาชน",
    reason: "บัตรประชาชนหมดอายุ ต้องไปทำที่สำนักงานเขตในวันทำการ",
    status: "รอพิจารณา",
    requesterId: "u003",
    requesterName: "สมศรี ตั้งใจ",
    // ใบนี้ยังไม่มีผู้อนุมัติ เก็บเป็นข้อความว่าง ไม่ใช่ null
    // เพื่อให้ทุกใบมีช่องครบเท่ากัน หน้าจอจะได้ไม่ต้องเช็คว่าช่องมีอยู่จริงไหม
    approverId: "",
    approverName: "",
    leaveTypeId: "lt003",
    leaveTypeName: "ลากิจ",
    startDate: "2026-09-15",
    endDate: "2026-09-15",
    createdAt: "2026-09-10 16:30"
  },
  {
    id: "lr004",
    title: "ลาพักร้อนช่วงวันหยุดยาว",
    reason: "อยากต่อวันหยุดยาวไปพักผ่อนกับครอบครัวอีก 3 วัน",
    status: "ไม่อนุมัติ",
    requesterId: "u003",
    requesterName: "สมศรี ตั้งใจ",
    approverId: "u002",
    approverName: "สมหญิง รักงาน",
    leaveTypeId: "lt001",
    leaveTypeName: "ลาพักร้อน",
    startDate: "2026-10-12",
    endDate: "2026-10-16",
    createdAt: "2026-09-20 11:00"
  },
  {
    id: "lr005",
    title: "ลาป่วยไปพบแพทย์ตามนัด",
    reason: "มีนัดตรวจติดตามอาการกับแพทย์ในช่วงเช้า",
    status: "รอพิจารณา",
    requesterId: "u001",
    requesterName: "สมชาย ใจดี",
    approverId: "u002",
    approverName: "สมหญิง รักงาน",
    leaveTypeId: "lt002",
    leaveTypeName: "ลาป่วย",
    startDate: "2026-09-22",
    endDate: "2026-09-22",
    createdAt: "2026-09-18 14:45"
  }
];

// ความเห็นการอนุมัติ อยู่ในโฟลเดอร์ย่อย approvals ของใบลาแต่ละใบ
// lr003 กับ lr005 ตั้งใจไม่มีความเห็นเลย เพื่อให้ทดสอบหน้าจอ "ยังไม่มีความเห็น" ได้
// ส่วน lr004 ต้องมีความเห็น เพราะกฎในสเปกหัวข้อ 6 บอกว่าจะไม่อนุมัติได้
// ต้องเขียนความเห็นอย่างน้อยหนึ่งรายการก่อน ข้อมูลตัวอย่างจึงต้องเคารพกฎเดียวกัน
const ความเห็น = [
  {
    requestId: "lr001",
    id: "ap001",
    authorId: "u002",
    authorName: "สมหญิง รักงาน",
    message: "รับเรื่องแล้ว ขอดูตารางงานของทีมช่วงนั้นก่อนนะครับ",
    createdAt: "2026-09-01 13:40"
  },
  {
    requestId: "lr001",
    id: "ap002",
    authorId: "u003",
    authorName: "สมศรี ตั้งใจ",
    message: "ตรวจแล้ว วันลาพักร้อนคงเหลือครอบคลุมช่วงที่ขอ ไม่ติดขัดฝั่งฝ่ายบุคคล",
    createdAt: "2026-09-02 10:05"
  },
  {
    requestId: "lr002",
    id: "ap003",
    authorId: "u002",
    authorName: "สมหญิง รักงาน",
    message: "อนุมัติแล้ว พักผ่อนให้เต็มที่ งานที่ค้างไว้เดี๋ยวทีมช่วยดูให้",
    createdAt: "2026-08-24 09:20"
  },
  {
    requestId: "lr004",
    id: "ap004",
    authorId: "u002",
    authorName: "สมหญิง รักงาน",
    message: "ช่วงนั้นทีมมีงานส่งมอบพอดี ขอเลื่อนเป็นสัปดาห์ถัดไปได้ไหมครับ",
    createdAt: "2026-09-20 15:10"
  }
];

// ── ส่วนหน้าจอ ───────────────────────────────────────────────

const ปุ่ม = byTestId("seed-button");
const ช่องสถานะ = byTestId("seed-status");
const ช่องผิดพลาด = byTestId("error-message");
const ช่องบันทึก = byTestId("seed-log");
const ป้ายเป้าหมาย = byTestId("seed-target");
const ป้ายผู้ใช้ = byTestId("auth-state");

// บอกให้ชัดว่ากำลังจะเขียนลงฐานไหน เพราะเผลอกดบนฐานจริงแล้วแก้คืนยาก
if (ป้ายเป้าหมาย) {
  ป้ายเป้าหมาย.textContent = useEmulator
    ? "กำลังเชื่อมต่อฐานจำลอง (emulator) ที่พอร์ต 8080"
    : "กำลังเชื่อมต่อฐานข้อมูลจริงบน Firebase";
}

onUser((ผู้ใช้ที่ล็อกอิน) => {
  if (ป้ายผู้ใช้) ป้ายผู้ใช้.textContent = ผู้ใช้ที่ล็อกอิน ? ผู้ใช้ที่ล็อกอิน.name : "";
  if (!ผู้ใช้ที่ล็อกอิน && ช่องสถานะ) {
    ช่องสถานะ.textContent = "ยังไม่ได้เข้าสู่ระบบ — กฎความปลอดภัยจะปฏิเสธการเขียนทั้งหมด";
  }
});

function จดบันทึก(ข้อความ) {
  if (!ช่องบันทึก) return;
  const แถว = document.createElement("li");
  // ใช้ textContent จึงไม่ต้อง escape แต่ข้อความชุดนี้มาจากโค้ดเราเอง ไม่ใช่จากผู้ใช้
  แถว.textContent = ข้อความ;
  ช่องบันทึก.appendChild(แถว);
}

async function ใส่ข้อมูลตัวอย่าง() {
  clearError(ช่องผิดพลาด);
  if (ช่องบันทึก) ช่องบันทึก.innerHTML = "";
  ช่องสถานะ.textContent = "กำลังเขียนข้อมูล...";

  for (const คน of ผู้ใช้) {
    await setDoc(doc(db, "users", คน.id), {
      name: คน.name,
      email: คน.email,
      role: คน.role
    });
  }
  จดบันทึก(`เขียนผู้ใช้ ${ผู้ใช้.length} คน`);

  for (const ประเภท of ประเภทการลา) {
    await setDoc(doc(db, "leaveTypes", ประเภท.id), { name: ประเภท.name });
  }
  จดบันทึก(`เขียนประเภทการลา ${ประเภทการลา.length} แบบ`);

  for (const ใบ of ใบขอลา) {
    await setDoc(doc(db, "leaveRequests", ใบ.id), {
      title: ใบ.title,
      reason: ใบ.reason,
      status: ใบ.status,
      requesterId: ใบ.requesterId,
      requesterName: ใบ.requesterName,
      approverId: ใบ.approverId,
      approverName: ใบ.approverName,
      leaveTypeId: ใบ.leaveTypeId,
      leaveTypeName: ใบ.leaveTypeName,
      startDate: ใบ.startDate,
      endDate: ใบ.endDate,
      // ส่ง Date เข้าไปตรง ๆ Firestore จะแปลงเป็นชนิด timestamp ให้เอง
      // ที่นี่ใช้เวลาจริงตามสเปก ไม่ใช้ serverTimestamp() เพราะต้องการวันเวลาย้อนหลัง
      // ให้ตรงกับที่สเปกกำหนด ส่วนใบลาที่ผู้ใช้สร้างเองใน data.js ใช้ serverTimestamp()
      createdAt: เวลาไทย(ใบ.createdAt)
    });
  }
  จดบันทึก(`เขียนใบขอลา ${ใบขอลา.length} ใบ`);

  for (const ค of ความเห็น) {
    await setDoc(doc(db, "leaveRequests", ค.requestId, "approvals", ค.id), {
      authorId: ค.authorId,
      authorName: ค.authorName,
      message: ค.message,
      createdAt: เวลาไทย(ค.createdAt)
    });
  }
  จดบันทึก(`เขียนความเห็นการอนุมัติ ${ความเห็น.length} รายการ`);

  ช่องสถานะ.textContent = "ใส่ข้อมูลตัวอย่างเรียบร้อยแล้ว";
}

ปุ่ม.addEventListener("click", async () => {
  const ข้อความเดิม = ปุ่ม.textContent;
  ปุ่ม.disabled = true;
  ปุ่ม.textContent = "กำลังทำงาน...";
  try {
    await ใส่ข้อมูลตัวอย่าง();
  } catch (err) {
    // เขียนไม่สำเร็จต้องบอกให้ชัดว่าค้างอยู่ตรงไหน
    // สาเหตุที่พบบ่อยที่สุดคือกฎความปลอดภัยปฏิเสธ เพราะผู้ใช้ที่ล็อกอินอยู่ไม่ใช่ hr
    ช่องสถานะ.textContent = "เขียนข้อมูลไม่สำเร็จ";
    showError(ช่องผิดพลาด, describeError(err));
    console.error("ใส่ข้อมูลตัวอย่างไม่สำเร็จ", err);
  } finally {
    ปุ่ม.disabled = false;
    ปุ่ม.textContent = ข้อความเดิม;
  }
});
