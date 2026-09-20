// ─────────────────────────────────────────────────────────────
// tests/fixtures/seed-data.js — ข้อมูลตั้งต้นของทุกเทส
//
// ลอกค่าทุกตัวมาจาก contract.md หัวข้อ 6 (ซึ่งมาจาก spec หัวข้อ 7)
// ชื่อช่องข้อมูลตาม contract.md หัวข้อ 1 เป๊ะทุกตัวอักษร
// ห้ามคิดชื่อช่องใหม่ในไฟล์เทส — status กับ Status คือคนละช่อง
// พิมพ์ผิดทีเดียว เทสจะเขียวทั้งที่ระบบพัง
//
// สำคัญมาก ต่างจากตารางใน contract.md อยู่จุดเดียว: ช่องที่เก็บ "ตัวคน"
//    requesterId / approverId / authorId  →  ใช้ uid จริงของบัญชีทดสอบ
//                                             ไม่ใช่ u001 / u002 / u003
//
//    เหตุผล: contract.md หัวข้อ 6 เขียนไว้เองว่าในแอปจริง users ถูกคีย์ด้วย
//    Firebase Auth uid (ส่วน seed.html เขียน u001 ไว้ให้ดูใน Console เฉย ๆ)
//    และ security rules หัวข้อ 9 เทียบ requesterId == request.auth.uid ตรง ๆ
//    ถ้า seed ด้วย u001 พนักงานที่ล็อกอินจริงจะเห็นใบลาของตัวเอง 0 ใบ
//    แล้วเทสจะล้มโดยที่แอปไม่ได้ผิด
//
//    ส่วนชื่อไฟล์ (lr001..lr005, lt001..lt003, ap001..ap004) คงไว้ตามสเปก
//    เพราะหน้า leave-request-detail.html ใช้ชื่อไฟล์เป็น ?id= ใน URL
// ─────────────────────────────────────────────────────────────

const { TEST_USERS, STATUS } = require("./config");

const EMP = TEST_USERS.employee;    // สมชาย ใจดี   (u001 ในสเปก)
const MGR = TEST_USERS.manager;     // สมหญิง รักงาน (u002 ในสเปก)
const HR = TEST_USERS.hr;           // สมศรี ตั้งใจ  (u003 ในสเปก)

// contract.md หัวข้อ 1 ระบุว่า createdAt เป็น Firestore timestamp ไม่ใช่ข้อความ
// สเปกให้เวลามาเป็น "2026-09-01 09:15" ซึ่งเป็นเวลาไทย จึงต้องผูก +07:00 ให้ชัด
// ถ้าปล่อยให้ new Date() เดาเอง ค่าจะเลื่อนตามเขตเวลาของเครื่องที่รันเทส
function เวลาไทย(ข้อความ) {
  return new Date(`${ข้อความ.replace(" ", "T")}:00+07:00`);
}

// leaveTypes — ประเภทการลา 3 แบบ
const LEAVE_TYPES = [
  { id: "lt001", name: "ลาพักร้อน" },
  { id: "lt002", name: "ลาป่วย" },
  { id: "lt003", name: "ลากิจ" }
];

// leaveRequests — ใบขอลา 5 ใบ · สถานะกระจายครบทั้ง 3 ค่า
const LEAVE_REQUESTS = [
  {
    id: "lr001",
    title: "ลาพักร้อนไปเที่ยวกับครอบครัว",
    reason: "วางแผนเดินทางไปต่างจังหวัดกับครอบครัว จองที่พักไว้ล่วงหน้าแล้ว",
    status: STATUS.PENDING,
    requesterId: EMP.uid, requesterName: EMP.name,
    approverId: MGR.uid, approverName: MGR.name,
    leaveTypeId: "lt001", leaveTypeName: "ลาพักร้อน",
    startDate: "2026-09-07", endDate: "2026-09-09",
    createdAt: เวลาไทย("2026-09-01 09:15")
  },
  {
    id: "lr002",
    title: "ลาป่วยไข้หวัดใหญ่",
    reason: "มีไข้สูงและไอมาก แพทย์แนะนำให้พักอยู่บ้าน 2 วัน",
    status: STATUS.APPROVED,
    requesterId: EMP.uid, requesterName: EMP.name,
    approverId: MGR.uid, approverName: MGR.name,
    leaveTypeId: "lt002", leaveTypeName: "ลาป่วย",
    startDate: "2026-08-24", endDate: "2026-08-25",
    createdAt: เวลาไทย("2026-08-24 08:05")
  },
  {
    id: "lr003",
    title: "ลากิจไปทำบัตรประชาชน",
    reason: "บัตรประชาชนหมดอายุ ต้องไปทำที่สำนักงานเขตในวันทำการ",
    status: STATUS.PENDING,
    requesterId: HR.uid, requesterName: HR.name,
    approverId: "", approverName: "",       // ยังไม่ได้กำหนดผู้อนุมัติ
    leaveTypeId: "lt003", leaveTypeName: "ลากิจ",
    startDate: "2026-09-15", endDate: "2026-09-15",
    createdAt: เวลาไทย("2026-09-10 16:30")
  },
  {
    id: "lr004",
    title: "ลาพักร้อนช่วงวันหยุดยาว",
    reason: "อยากต่อวันหยุดยาวไปพักผ่อนกับครอบครัวอีก 3 วัน",
    status: STATUS.REJECTED,
    requesterId: HR.uid, requesterName: HR.name,
    approverId: MGR.uid, approverName: MGR.name,
    leaveTypeId: "lt001", leaveTypeName: "ลาพักร้อน",
    startDate: "2026-10-12", endDate: "2026-10-16",
    createdAt: เวลาไทย("2026-09-20 11:00")
  },
  {
    id: "lr005",
    title: "ลาป่วยไปพบแพทย์ตามนัด",
    reason: "มีนัดตรวจติดตามอาการกับแพทย์ในช่วงเช้า",
    status: STATUS.PENDING,
    requesterId: EMP.uid, requesterName: EMP.name,
    approverId: MGR.uid, approverName: MGR.name,
    leaveTypeId: "lt002", leaveTypeName: "ลาป่วย",
    startDate: "2026-09-22", endDate: "2026-09-22",
    createdAt: เวลาไทย("2026-09-18 14:45")
  }
];

// approvals — ความเห็น เป็นโฟลเดอร์ย่อยของใบลาแต่ละใบ
//    lr001 มี 2 ความเห็น · lr002 มี 1 · lr004 มี 1 · lr003/lr005 ไม่มี
//    lr004 ต้องมีความเห็นอย่างน้อย 1 อัน เพราะกติกาสถานะ (contract.md หัวข้อ 2)
//    บังคับว่าจะตั้ง "ไม่อนุมัติ" ได้ต้องมีความเห็นก่อน — ข้อมูลตัวอย่างต้องเคารพกฎเดียวกัน
//
//    ช่อง requestId บอกว่าอยู่ใต้ใบไหน และจะไม่ถูกเขียนลง Firestore
//    เพราะเส้นทาง leaveRequests/lr001/approvals/ap001 บอกอยู่แล้ว
const APPROVALS = [
  {
    id: "ap001", requestId: "lr001",
    authorId: MGR.uid, authorName: MGR.name,
    message: "รับเรื่องแล้ว ขอดูตารางงานของทีมช่วงนั้นก่อนนะครับ",
    createdAt: เวลาไทย("2026-09-01 13:40")
  },
  {
    id: "ap002", requestId: "lr001",
    authorId: HR.uid, authorName: HR.name,
    message: "ตรวจแล้ว วันลาพักร้อนคงเหลือครอบคลุมช่วงที่ขอ ไม่ติดขัดฝั่งฝ่ายบุคคล",
    createdAt: เวลาไทย("2026-09-02 10:05")
  },
  {
    id: "ap003", requestId: "lr002",
    authorId: MGR.uid, authorName: MGR.name,
    message: "อนุมัติแล้ว พักผ่อนให้เต็มที่ งานที่ค้างไว้เดี๋ยวทีมช่วยดูให้",
    createdAt: เวลาไทย("2026-08-24 09:20")
  },
  {
    id: "ap004", requestId: "lr004",
    authorId: MGR.uid, authorName: MGR.name,
    message: "ช่วงนั้นทีมมีงานส่งมอบพอดี ขอเลื่อนเป็นสัปดาห์ถัดไปได้ไหมครับ",
    createdAt: เวลาไทย("2026-09-20 15:10")
  }
];

// นับไว้ให้เทสอ้างอิง จะได้ไม่ฮาร์ดโค้ดเลข 5 หรือ 3 กระจายทั่วไฟล์
// ถ้าวันหนึ่งข้อมูลตั้งต้นเปลี่ยน เทสที่ใช้ค่าพวกนี้จะตามมาเองอัตโนมัติ
const COUNTS = {
  users: Object.keys(TEST_USERS).length,
  leaveTypes: LEAVE_TYPES.length,
  leaveRequests: LEAVE_REQUESTS.length,
  approvals: APPROVALS.length,
  pending: LEAVE_REQUESTS.filter((ใบ) => ใบ.status === STATUS.PENDING).length,
  approved: LEAVE_REQUESTS.filter((ใบ) => ใบ.status === STATUS.APPROVED).length,
  rejected: LEAVE_REQUESTS.filter((ใบ) => ใบ.status === STATUS.REJECTED).length,
  // จำนวนใบลาที่แต่ละบทบาท "ควรเห็น" ในหน้ารายการ
  //   employee เห็นเฉพาะของตัวเอง · manager/hr เห็นทุกใบ
  visibleToEmployee: LEAVE_REQUESTS.filter((ใบ) => ใบ.requesterId === EMP.uid).length,
  visibleToManager: LEAVE_REQUESTS.length,
  visibleToHr: LEAVE_REQUESTS.length
};

function findRequest(id) {
  const ใบ = LEAVE_REQUESTS.find((รายการ) => รายการ.id === id);
  if (!ใบ) throw new Error(`ไม่มีใบลา ${id} ในข้อมูลตั้งต้น`);
  return { ...ใบ };
}

function findLeaveType(id) {
  const ประเภท = LEAVE_TYPES.find((รายการ) => รายการ.id === id);
  if (!ประเภท) throw new Error(`ไม่มีประเภทการลา ${id} ในข้อมูลตั้งต้น`);
  return { ...ประเภท };
}

// ความเห็นทั้งหมดของใบลาใบหนึ่ง เรียงเก่าไปใหม่ (ตาม listApprovals ใน contract)
function approvalsOf(requestId) {
  return APPROVALS
    .filter((ความเห็น) => ความเห็น.requestId === requestId)
    .sort((ก, ข) => ก.createdAt - ข.createdAt)
    .map((ความเห็น) => ({ ...ความเห็น }));
}

module.exports = {
  LEAVE_TYPES,
  LEAVE_REQUESTS,
  APPROVALS,
  COUNTS,
  findRequest,
  findLeaveType,
  approvalsOf,
  เวลาไทย
};
