// ─────────────────────────────────────────────────────────────
// tests/rules/rules.test.js — ชุดทดสอบถาวรของ firestore.rules
//
// ไฟล์นี้คือ "หลักฐาน" ของสัปดาห์ที่ 8 ที่ถูกทำให้รันซ้ำได้
//   สัปดาห์ที่ 8 พิสูจน์กฎด้วยสคริปต์ชั่วคราวแล้วลบทิ้ง หลักฐานจึงหายไปจาก repo
//   สัปดาห์ที่ 9 บังคับว่าการทดสอบสวมรอย (impersonation) ต้องรันอัตโนมัติได้ทุกครั้ง
//   ไฟล์นี้จึงไล่ทุกแถวในตาราง ACL.md ทั้งฝั่ง "ได้" และฝั่ง "ไม่ได้"
//
// รันด้วย   npm run test:rules   ซึ่งคือ   node --test "tests/rules/**/*.test.js"
//
// ต่างจากเทส Playwright ตรงที่ไฟล์นี้ไม่เปิดเบราว์เซอร์เลย
//   มันคุยกับ Firestore emulator ตรง ๆ ในนาม "ผู้ใช้ที่ล็อกอินเป็นคนนั้น"
//   จึงวัดได้ว่ากฎปฏิเสธจริงไหม โดยไม่ต้องผ่านหน้าเว็บที่อาจแค่ "ซ่อนปุ่ม" ไว้
//
// ต้องเปิด emulator ไว้ก่อน — npm run emulators
//
// เลือกพอร์ต Firestore ได้ด้วยตัวแปรแวดล้อม RULES_FIRESTORE_PORT
//   ค่าปริยายคือพอร์ตเดียวกับ tests/fixtures/config.js (8080) ตามชุด emulator ปกติ
//   ถ้ามี emulator ตัวอื่นครองพอร์ตนั้นอยู่ (เช่นชุดเทสเบราว์เซอร์กำลังรัน)
//   ให้เปิด emulator เฉพาะ firestore บนพอร์ตว่างแล้วสั่ง
//       RULES_FIRESTORE_PORT=8099 npm run test:rules
//   เหตุผลที่ต้องแยกพอร์ต: initializeTestEnvironment อัปโหลดกฎทับ
//   และ clearFirestore() ล้างข้อมูลทั้งก้อน ถ้าไปใช้ตัวเดียวกับเทสอื่นจะล้มใส่กัน
//
// หมายเหตุเรื่องการ seed
//   ข้อมูลตั้งต้นทุกชิ้นเขียนผ่าน withSecurityRulesDisabled() ซึ่งเป็นสิทธิ์ผู้ดูแล
//   ข้ามกฎโดยการออกแบบ (ACL.md หัวข้อ 10) ไม่ใช่เขียนผ่านกฎที่กำลังทดสอบอยู่
//   ถ้า seed ผ่านกฎ เทสจะกลายเป็นการทดสอบตัวเองว่าเขียนได้ไหม ไม่ใช่การพิสูจน์กฎ
// ─────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require("@firebase/rules-unit-testing");

const {
  PROJECT_ID,
  HOST,
  PORTS,
  TEST_USERS,
  ROLE,
  STATUS,
  LEAVE_TYPES,
  LEAVE_REQUESTS,
  APPROVALS
} = require("../fixtures");

const EMP = TEST_USERS.employee;   // uid-employee-u001 · สมชาย ใจดี
const MGR = TEST_USERS.manager;    // uid-manager-u002  · สมหญิง รักงาน
const HR = TEST_USERS.hr;          // uid-hr-u003       · สมศรี ตั้งใจ

// uid ของ "คนที่เพิ่งกดสมัคร" ยังไม่มีไฟล์โปรไฟล์ในฐาน
// ต้องเป็น uid ใหม่จริง ๆ เพราะ set() ทับไฟล์ที่มีอยู่แล้วนับเป็น update ไม่ใช่ create
const คนสมัครใหม่ = "uid-newcomer-u009";

const ที่อยู่ไฟล์กฎ = path.join(__dirname, "..", "..", "firestore.rules");
const พอร์ตกฎ = Number(process.env.RULES_FIRESTORE_PORT || PORTS.firestore);

// ── ชื่อไฟล์ที่เทสใช้ซ้ำ ─────────────────────────────────────
// lr001 ใบของพนักงาน · รอพิจารณา · มีความเห็น 2 รายการ
// lr002 ใบของพนักงาน · อนุมัติแล้ว (ปลายทาง)
// lr003 ใบของ hr     · รอพิจารณา  → ใช้ทดสอบ hr อนุมัติใบตัวเอง
// lr004 ใบของ hr     · ไม่อนุมัติแล้ว (ปลายทาง)
// lr005 ใบของพนักงาน · รอพิจารณา · ไม่มีความเห็นเลย
const ใบพนักงานรอพิจารณา = "lr001";
const ใบพนักงานอนุมัติแล้ว = "lr002";
const ใบHrรอพิจารณา = "lr003";
const ใบHrไม่อนุมัติแล้ว = "lr004";
const ใบพนักงานไม่มีความเห็น = "lr005";

// ข้อมูลตั้งต้นไม่มีใบลาที่ manager เป็นผู้ยื่น แต่กฎข้อ "แยกหน้าที่" (firestore.rules บรรทัด 159)
// ต้องพิสูจน์กับ manager ด้วย ไม่ใช่กับ hr อย่างเดียว จึงเติมใบนี้เข้าไปเฉพาะในชุดเทสกฎ
const ใบManagerรอพิจารณา = "lr900";

function ใบลาของManager() {
  return {
    title: "ลาพักร้อนของหัวหน้าเอง",
    reason: "หัวหน้าก็ลาได้ และเมื่อลาก็เป็นผู้ขอเหมือนพนักงานคนอื่น",
    status: STATUS.PENDING,
    requesterId: MGR.uid,
    requesterName: MGR.name,
    approverId: "",
    approverName: "",
    leaveTypeId: "lt001",
    leaveTypeName: "ลาพักร้อน",
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    createdAt: new Date("2026-10-25T09:00:00+07:00")
  };
}

let สนามทดสอบ;

// ── เปิดสนามทดสอบครั้งเดียวสำหรับทั้งไฟล์ ────────────────────
//
// initializeTestEnvironment อ่าน firestore.rules ตัวจริงจากดิสก์แล้วอัปโหลดเข้า emulator
// ถ้าไฟล์กฎคอมไพล์ไม่ผ่าน คำสั่งนี้จะโยน error ทันที — นับเป็นการยืนยันข้อแรกไปในตัว
// ว่าไฟล์กฎที่อยู่ใน repo ตอนนี้ยังเป็นไฟล์ที่ Firestore ยอมรับ
before(async () => {
  สนามทดสอบ = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: HOST,
      port: พอร์ตกฎ,
      rules: fs.readFileSync(ที่อยู่ไฟล์กฎ, "utf8")
    }
  });
});

after(async () => {
  if (สนามทดสอบ) await สนามทดสอบ.cleanup();
});

// ล้างแล้ว seed ใหม่ทุกเทส เพราะหลายเทสเขียนจริง (อนุมัติ ลบ เพิ่มความเห็น)
// ถ้าไม่ล้าง ลำดับการรันจะกลายเป็นเงื่อนไขซ่อนของผลเทส
beforeEach(async () => {
  await สนามทดสอบ.clearFirestore();

  await สนามทดสอบ.withSecurityRulesDisabled(async (ผู้ดูแล) => {
    const ฐาน = ผู้ดูแล.firestore();

    for (const คน of Object.values(TEST_USERS)) {
      await ฐาน.doc(`users/${คน.uid}`).set({
        name: คน.name,
        email: คน.email,
        role: คน.role
      });
    }

    for (const ประเภท of LEAVE_TYPES) {
      await ฐาน.doc(`leaveTypes/${ประเภท.id}`).set({ name: ประเภท.name });
    }

    for (const ใบ of LEAVE_REQUESTS) {
      const { id, ...ข้อมูล } = ใบ;
      await ฐาน.doc(`leaveRequests/${id}`).set(ข้อมูล);
    }
    await ฐาน.doc(`leaveRequests/${ใบManagerรอพิจารณา}`).set(ใบลาของManager());

    for (const ความเห็น of APPROVALS) {
      const { id, requestId, ...ข้อมูล } = ความเห็น;
      await ฐาน.doc(`leaveRequests/${requestId}/approvals/${id}`).set(ข้อมูล);
    }
  });
});

// ── ทางลัดเรียกฐานข้อมูลในนามแต่ละบทบาท ─────────────────────
const ในนาม = (uid) => สนามทดสอบ.authenticatedContext(uid).firestore();
const คนแปลกหน้า = () => สนามทดสอบ.unauthenticatedContext().firestore();

// ─────────────────────────────────────────────────────────────
// ACL.md หัวข้อ 3 — ผู้ที่ยังไม่ได้เข้าสู่ระบบ
// ─────────────────────────────────────────────────────────────
describe("ยังไม่ล็อกอิน · อ่านไม่ได้เขียนไม่ได้ทุกที่", () => {
  it("อ่านโปรไฟล์คนอื่นไม่ได้", async () => {
    await assertFails(คนแปลกหน้า().doc(`users/${EMP.uid}`).get());
  });

  it("อ่านประเภทการลาไม่ได้ ทั้งที่ล็อกอินแล้วทุกคนอ่านได้", async () => {
    await assertFails(คนแปลกหน้า().doc("leaveTypes/lt001").get());
  });

  it("ขอทั้งโฟลเดอร์ leaveRequests ไม่ได้", async () => {
    await assertFails(คนแปลกหน้า().collection("leaveRequests").get());
  });

  it("อ่านใบลาทีละใบไม่ได้", async () => {
    await assertFails(คนแปลกหน้า().doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).get());
  });

  it("สร้างใบลาไม่ได้", async () => {
    await assertFails(
      คนแปลกหน้า().collection("leaveRequests").add({
        requesterId: EMP.uid,
        status: STATUS.PENDING
      })
    );
  });

  it("สร้างโปรไฟล์ไม่ได้", async () => {
    await assertFails(
      คนแปลกหน้า().doc(`users/${คนสมัครใหม่}`).set({
        name: "คนนอก",
        email: "outsider@example.com",
        role: ROLE.EMPLOYEE
      })
    );
  });

  it("อ่านความเห็นในใบลาไม่ได้", async () => {
    await assertFails(
      คนแปลกหน้า().doc(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals/ap001`).get()
    );
  });
});

// ─────────────────────────────────────────────────────────────
// ACL.md หัวข้อ 4 — โฟลเดอร์ users
// ─────────────────────────────────────────────────────────────
describe("users · อ่านโปรไฟล์", () => {
  it("พนักงานอ่านโปรไฟล์ของตัวเองได้", async () => {
    await assertSucceeds(ในนาม(EMP.uid).doc(`users/${EMP.uid}`).get());
  });

  it("manager อ่านโปรไฟล์ของพนักงานคนอื่นได้ เพราะต้องแสดงชื่อคนยื่นใบลา", async () => {
    await assertSucceeds(ในนาม(MGR.uid).doc(`users/${EMP.uid}`).get());
  });

  it("hr อ่านโปรไฟล์ของพนักงานคนอื่นได้", async () => {
    await assertSucceeds(ในนาม(HR.uid).doc(`users/${EMP.uid}`).get());
  });

  it("พนักงานอ่านโปรไฟล์ของคนอื่นไม่ได้", async () => {
    await assertFails(ในนาม(EMP.uid).doc(`users/${MGR.uid}`).get());
  });

  it("พนักงานขอทั้งโฟลเดอร์ users ไม่ได้", async () => {
    await assertFails(ในนาม(EMP.uid).collection("users").get());
  });

  it("manager ขอทั้งโฟลเดอร์ users ได้", async () => {
    await assertSucceeds(ในนาม(MGR.uid).collection("users").get());
  });

  it("hr ขอทั้งโฟลเดอร์ users ได้", async () => {
    await assertSucceeds(ในนาม(HR.uid).collection("users").get());
  });
});

describe("users · สมัครสมาชิก (create)", () => {
  it("สมัครในนามตัวเองด้วย role employee ได้", async () => {
    await assertSucceeds(
      ในนาม(คนสมัครใหม่).doc(`users/${คนสมัครใหม่}`).set({
        name: "พนักงานใหม่",
        email: "newcomer@example.com",
        role: ROLE.EMPLOYEE
      })
    );
  });

  it("สมัครโดยตั้งตัวเองเป็น hr ตั้งแต่วินาทีแรกไม่ได้", async () => {
    await assertFails(
      ในนาม(คนสมัครใหม่).doc(`users/${คนสมัครใหม่}`).set({
        name: "พนักงานใหม่",
        email: "newcomer@example.com",
        role: ROLE.HR
      })
    );
  });

  it("สมัครโดยตั้งตัวเองเป็น manager ไม่ได้", async () => {
    await assertFails(
      ในนาม(คนสมัครใหม่).doc(`users/${คนสมัครใหม่}`).set({
        name: "พนักงานใหม่",
        email: "newcomer@example.com",
        role: ROLE.MANAGER
      })
    );
  });

  it("สร้างโปรไฟล์ในชื่อ uid ของคนอื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(คนสมัครใหม่).doc("users/uid-someone-else").set({
        name: "สวมรอย",
        email: "impostor@example.com",
        role: ROLE.EMPLOYEE
      })
    );
  });

  it("สมัครพร้อมแนบช่องแปลกปลอมอย่าง isAdmin ไม่ได้", async () => {
    await assertFails(
      ในนาม(คนสมัครใหม่).doc(`users/${คนสมัครใหม่}`).set({
        name: "พนักงานใหม่",
        email: "newcomer@example.com",
        role: ROLE.EMPLOYEE,
        isAdmin: true
      })
    );
  });
});

describe("users · แก้ไขโปรไฟล์ (update)", () => {
  it("พนักงานแก้ชื่อของตัวเองได้", async () => {
    await assertSucceeds(
      ในนาม(EMP.uid).doc(`users/${EMP.uid}`).update({ name: "สมชาย ใจดีมาก" })
    );
  });

  it("พนักงานเลื่อนตัวเองเป็น hr ไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc(`users/${EMP.uid}`).update({ role: ROLE.HR })
    );
  });

  it("พนักงานเลื่อนตัวเองเป็น manager ไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc(`users/${EMP.uid}`).update({ role: ROLE.MANAGER })
    );
  });

  it("แก้ชื่อพร้อมแอบเลื่อนตำแหน่งไปด้วยไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc(`users/${EMP.uid}`).update({
        name: "สมชาย ใจดีมาก",
        role: ROLE.HR
      })
    );
  });

  it("พนักงานแก้อีเมลของตัวเองไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc(`users/${EMP.uid}`).update({ email: "new@example.com" })
    );
  });

  it("พนักงานแก้โปรไฟล์ของคนอื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc(`users/${MGR.uid}`).update({ name: "แก้ชื่อคนอื่น" })
    );
  });

  it("hr ก็แก้โปรไฟล์ของพนักงานไม่ได้ ต้องเข้า Firebase Console", async () => {
    await assertFails(
      ในนาม(HR.uid).doc(`users/${EMP.uid}`).update({ name: "hr แก้ให้" })
    );
  });

  it("hr เลื่อนตำแหน่งให้พนักงานผ่านแอปไม่ได้", async () => {
    await assertFails(
      ในนาม(HR.uid).doc(`users/${EMP.uid}`).update({ role: ROLE.MANAGER })
    );
  });
});

describe("users · ลบโปรไฟล์ (delete)", () => {
  it("พนักงานลบโปรไฟล์ของตัวเองไม่ได้", async () => {
    await assertFails(ในนาม(EMP.uid).doc(`users/${EMP.uid}`).delete());
  });

  it("manager ลบโปรไฟล์ของพนักงานไม่ได้", async () => {
    await assertFails(ในนาม(MGR.uid).doc(`users/${EMP.uid}`).delete());
  });

  it("hr ลบโปรไฟล์ของพนักงานไม่ได้", async () => {
    await assertFails(ในนาม(HR.uid).doc(`users/${EMP.uid}`).delete());
  });
});

// ─────────────────────────────────────────────────────────────
// ACL.md หัวข้อ 5 — โฟลเดอร์ leaveTypes
// ─────────────────────────────────────────────────────────────
describe("leaveTypes · อ่านได้ทุกบทบาทที่ล็อกอิน", () => {
  it("พนักงานอ่านประเภทการลาทีละไฟล์ได้", async () => {
    await assertSucceeds(ในนาม(EMP.uid).doc("leaveTypes/lt001").get());
  });

  it("พนักงานขอทั้งโฟลเดอร์ leaveTypes ได้ เพราะต้องเอาไปใส่ช่องเลือก", async () => {
    await assertSucceeds(ในนาม(EMP.uid).collection("leaveTypes").get());
  });

  it("manager ขอทั้งโฟลเดอร์ leaveTypes ได้", async () => {
    await assertSucceeds(ในนาม(MGR.uid).collection("leaveTypes").get());
  });

  it("hr ขอทั้งโฟลเดอร์ leaveTypes ได้", async () => {
    await assertSucceeds(ในนาม(HR.uid).collection("leaveTypes").get());
  });
});

describe("leaveTypes · มีแต่ hr ที่แก้ไขได้", () => {
  it("hr เพิ่มประเภทการลาใหม่ได้", async () => {
    await assertSucceeds(
      ในนาม(HR.uid).doc("leaveTypes/lt004").set({ name: "ลาคลอด" })
    );
  });

  it("hr แก้ชื่อประเภทการลาได้", async () => {
    await assertSucceeds(
      ในนาม(HR.uid).doc("leaveTypes/lt001").update({ name: "ลาพักร้อนประจำปี" })
    );
  });

  it("hr ลบประเภทการลาได้", async () => {
    await assertSucceeds(ในนาม(HR.uid).doc("leaveTypes/lt003").delete());
  });

  it("พนักงานเพิ่มประเภทการลาไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc("leaveTypes/lt004").set({ name: "ลาแบบที่คิดเอง" })
    );
  });

  it("พนักงานแก้ชื่อประเภทการลาไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc("leaveTypes/lt001").update({ name: "เปลี่ยนชื่อเล่น" })
    );
  });

  it("พนักงานลบประเภทการลาไม่ได้", async () => {
    await assertFails(ในนาม(EMP.uid).doc("leaveTypes/lt001").delete());
  });

  it("manager เพิ่มประเภทการลาไม่ได้ · เป็นผู้อนุมัติไม่ได้แปลว่าเป็นฝ่ายบุคคล", async () => {
    await assertFails(
      ในนาม(MGR.uid).doc("leaveTypes/lt004").set({ name: "ลาแบบที่หัวหน้าคิดเอง" })
    );
  });

  it("manager แก้ชื่อประเภทการลาไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid).doc("leaveTypes/lt001").update({ name: "หัวหน้าเปลี่ยนชื่อ" })
    );
  });

  it("manager ลบประเภทการลาไม่ได้", async () => {
    await assertFails(ในนาม(MGR.uid).doc("leaveTypes/lt001").delete());
  });
});

// ─────────────────────────────────────────────────────────────
// ACL.md หัวข้อ 6 + หัวข้อ 11 — การทดสอบสวมรอย (impersonation)
//
// นี่คือข้อที่สเปกสัปดาห์ที่ 8 ใช้วัดผล และสัปดาห์ที่ 9 สั่งให้รันซ้ำได้
//   "ล็อกอินเป็นพนักงานคนหนึ่ง แล้วต้องอ่านใบลาของพนักงานอีกคนไม่ได้
//    ถ้าอ่านได้แปลว่ากฎพัง ไม่ว่าหน้าจอจะซ่อนปุ่มไว้เรียบร้อยแค่ไหนก็ตาม"
// ─────────────────────────────────────────────────────────────
describe("leaveRequests · อ่าน · การทดสอบสวมรอย", () => {
  it("เจ้าของอ่านใบลาของตัวเองได้", async () => {
    await assertSucceeds(
      ในนาม(EMP.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).get()
    );
  });

  it("manager อ่านใบลาของพนักงานได้ทุกใบ", async () => {
    await assertSucceeds(
      ในนาม(MGR.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).get()
    );
  });

  it("hr อ่านใบลาของพนักงานได้ทุกใบ", async () => {
    await assertSucceeds(
      ในนาม(HR.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).get()
    );
  });

  it("สวมรอย · พนักงานเปิดใบลาของคนอื่นตรง ๆ ด้วยรหัสไฟล์ = ถูกปฏิเสธ", async () => {
    // ใบ lr003 เป็นของ hr · พนักงานรู้รหัสไฟล์ก็เปิดไม่ได้อยู่ดี
    await assertFails(ในนาม(EMP.uid).doc(`leaveRequests/${ใบHrรอพิจารณา}`).get());
  });

  it("สวมรอย · พนักงานขอทั้งโฟลเดอร์ leaveRequests = ถูกปฏิเสธ", async () => {
    // Firestore ตัดสินทั้งคำสั่ง ไม่ได้กรองผลทีละแถว
    // คำสั่งเปล่า ๆ รับประกันไม่ได้ว่าทุกใบที่ส่งกลับจะผ่านกฎ จึงปฏิเสธตั้งแต่ต้น
    await assertFails(ในนาม(EMP.uid).collection("leaveRequests").get());
  });

  it("สวมรอย · พนักงานค้นหาแบบมี where(requesterId == uid ตัวเอง) = ผ่าน", async () => {
    await assertSucceeds(
      ในนาม(EMP.uid)
        .collection("leaveRequests")
        .where("requesterId", "==", EMP.uid)
        .get()
    );
  });

  it("สวมรอย · พนักงานค้นหาแบบมี where(requesterId == uid คนอื่น) = ถูกปฏิเสธ", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .collection("leaveRequests")
        .where("requesterId", "==", HR.uid)
        .get()
    );
  });

  it("manager ขอทั้งโฟลเดอร์ leaveRequests ได้", async () => {
    await assertSucceeds(ในนาม(MGR.uid).collection("leaveRequests").get());
  });

  it("hr ขอทั้งโฟลเดอร์ leaveRequests ได้", async () => {
    await assertSucceeds(ในนาม(HR.uid).collection("leaveRequests").get());
  });
});

describe("leaveRequests · ยื่นใบลาใหม่ (create)", () => {
  function ใบใหม่(เจ้าของ, สถานะ) {
    return {
      title: "ลาพักร้อนใบใหม่",
      reason: "ทดสอบกฎการสร้างใบลา",
      status: สถานะ,
      requesterId: เจ้าของ.uid,
      requesterName: เจ้าของ.name,
      approverId: "",
      approverName: "",
      leaveTypeId: "lt001",
      leaveTypeName: "ลาพักร้อน",
      startDate: "2026-12-01",
      endDate: "2026-12-02",
      createdAt: new Date("2026-11-20T10:00:00+07:00")
    };
  }

  it("พนักงานยื่นในนามตัวเองด้วยสถานะ รอพิจารณา ได้", async () => {
    await assertSucceeds(
      ในนาม(EMP.uid).collection("leaveRequests").add(ใบใหม่(EMP, STATUS.PENDING))
    );
  });

  it("manager ยื่นใบลาของตัวเองได้ · หัวหน้าก็ลาได้", async () => {
    await assertSucceeds(
      ในนาม(MGR.uid).collection("leaveRequests").add(ใบใหม่(MGR, STATUS.PENDING))
    );
  });

  it("hr ยื่นใบลาของตัวเองได้", async () => {
    await assertSucceeds(
      ในนาม(HR.uid).collection("leaveRequests").add(ใบใหม่(HR, STATUS.PENDING))
    );
  });

  it("ยื่นใบลาที่ อนุมัติ มาแล้วตั้งแต่ต้นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).collection("leaveRequests").add(ใบใหม่(EMP, STATUS.APPROVED))
    );
  });

  it("ยื่นใบลาที่ ไม่อนุมัติ มาแล้วตั้งแต่ต้นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).collection("leaveRequests").add(ใบใหม่(EMP, STATUS.REJECTED))
    );
  });

  it("ยื่นใบลาในนามคนอื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).collection("leaveRequests").add(ใบใหม่(HR, STATUS.PENDING))
    );
  });

  it("manager ยื่นใบลาในนามพนักงานคนอื่นก็ไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid).collection("leaveRequests").add(ใบใหม่(EMP, STATUS.PENDING))
    );
  });
});

describe("leaveRequests · เปลี่ยนสถานะ · เงื่อนไข 4 ชั้น", () => {
  // ชั้นที่ 1 · ต้องเป็นผู้อนุมัติ
  it("manager เปลี่ยนใบของพนักงานเป็น อนุมัติ ได้", async () => {
    await assertSucceeds(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`)
        .update({ status: STATUS.APPROVED })
    );
  });

  it("manager เปลี่ยนใบของพนักงานเป็น ไม่อนุมัติ ได้", async () => {
    await assertSucceeds(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`)
        .update({ status: STATUS.REJECTED })
    );
  });

  it("hr เปลี่ยนใบของพนักงานเป็น อนุมัติ ได้", async () => {
    await assertSucceeds(
      ในนาม(HR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`)
        .update({ status: STATUS.APPROVED })
    );
  });

  it("พนักงานกดอนุมัติใบของตัวเองไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`)
        .update({ status: STATUS.APPROVED })
    );
  });

  it("พนักงานกดอนุมัติใบของคนอื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .doc(`leaveRequests/${ใบHrรอพิจารณา}`)
        .update({ status: STATUS.APPROVED })
    );
  });

  // ชั้นที่ 2 · แยกหน้าที่ผู้ขอกับผู้อนุมัติ (firestore.rules บรรทัด 159)
  it("แยกหน้าที่ · manager อนุมัติใบที่ตัวเองยื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบManagerรอพิจารณา}`)
        .update({ status: STATUS.APPROVED })
    );
  });

  it("แยกหน้าที่ · manager ไม่อนุมัติใบที่ตัวเองยื่นก็ไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบManagerรอพิจารณา}`)
        .update({ status: STATUS.REJECTED })
    );
  });

  it("แยกหน้าที่ · hr อนุมัติใบที่ตัวเองยื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(HR.uid)
        .doc(`leaveRequests/${ใบHrรอพิจารณา}`)
        .update({ status: STATUS.APPROVED })
    );
  });

  it("แยกหน้าที่ · ใบของ manager ให้ hr เป็นคนตัดสินได้ตามปกติ", async () => {
    await assertSucceeds(
      ในนาม(HR.uid)
        .doc(`leaveRequests/${ใบManagerรอพิจารณา}`)
        .update({ status: STATUS.APPROVED })
    );
  });

  // ชั้นที่ 3 · ต้องยังอยู่ที่ รอพิจารณา และไปได้แค่ 2 ปลายทาง
  it("เปลี่ยนสถานะใบที่ อนุมัติ ไปแล้วซ้ำไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานอนุมัติแล้ว}`)
        .update({ status: STATUS.REJECTED })
    );
  });

  it("เปลี่ยนสถานะใบที่ ไม่อนุมัติ ไปแล้วซ้ำไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบHrไม่อนุมัติแล้ว}`)
        .update({ status: STATUS.APPROVED })
    );
  });

  it("ย้อนสถานะกลับมาเป็น รอพิจารณา ไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานอนุมัติแล้ว}`)
        .update({ status: STATUS.PENDING })
    );
  });

  it("ตั้งสถานะเป็นค่านอกสเปกไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`)
        .update({ status: "กำลังตรวจสอบ" })
    );
  });

  // ชั้นที่ 4 · การเขียนต้องแตะแค่ช่อง status ช่องเดียว
  it("แอบแก้ reason แนบไปกับการกดอนุมัติไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).update({
        status: STATUS.APPROVED,
        reason: "เหตุผลที่ถูกแก้ทีหลังโดยผู้อนุมัติ"
      })
    );
  });

  it("แอบแก้ startDate แนบไปกับการกดอนุมัติไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).update({
        status: STATUS.APPROVED,
        startDate: "2026-09-01"
      })
    );
  });

  it("แอบแก้ช่อง approverId แนบไปกับการกดอนุมัติไม่ได้", async () => {
    // ใบ lr001 มี approverId เป็น manager อยู่แล้ว จึงต้องเขียนค่า "คนละค่า" ลงไป
    // ถึงจะนับว่าช่องนั้นเปลี่ยน (ดูเทสถัดไปว่าทำไม)
    await assertFails(
      ในนาม(MGR.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).update({
        status: STATUS.APPROVED,
        approverId: HR.uid,
        approverName: HR.name
      })
    );
  });

  // นิสัยของ diff().affectedKeys() ที่ต้องรู้ไว้ ไม่ใช่บั๊ก
  // มันนับเฉพาะช่องที่ "ค่าต่างจากของเดิม" ไม่ได้นับช่องที่ถูกส่งมาในคำสั่ง
  // การส่งค่าเดิมซ้ำจึงไม่ถือว่าเปลี่ยน และผ่านกฎ changesOnly(['status'])
  // ผลกระทบด้านความปลอดภัยเป็นศูนย์ เพราะค่าที่อยู่ในฐานหลังเขียนก็ยังเป็นค่าเดิม
  it("ส่งค่าเดิมซ้ำในช่องอื่นพร้อมกับ status ผ่านได้ เพราะค่าไม่ได้เปลี่ยนจริง", async () => {
    await assertSucceeds(
      ในนาม(MGR.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).update({
        status: STATUS.APPROVED,
        approverId: MGR.uid,
        approverName: MGR.name
      })
    );
  });

  it("เขียนทับทั้งไฟล์ด้วย set() จนช่องอื่นหายไปไม่ได้", async () => {
    // set() ที่ไม่มีช่องอื่นติดมาด้วย = ช่องเหล่านั้นถูกลบ ซึ่งนับเป็น affectedKeys
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`)
        .set({ status: STATUS.APPROVED })
    );
  });

  it("manager แก้เนื้อหาใบลาโดยไม่แตะสถานะไม่ได้ · สเปกเดือนนี้ไม่มีฟังก์ชันแก้ใบลา", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`)
        .update({ title: "หัวหน้าแก้หัวข้อให้" })
    );
  });

  it("เจ้าของแก้เนื้อหาใบลาของตัวเองไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`)
        .update({ reason: "ขอแก้เหตุผลทีหลัง" })
    );
  });
});

describe("leaveRequests · ลบใบลา (delete)", () => {
  it("เจ้าของลบใบของตัวเองที่ยัง รอพิจารณา ได้", async () => {
    await assertSucceeds(
      ในนาม(EMP.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).delete()
    );
  });

  it("ลบใบของคนอื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc(`leaveRequests/${ใบHrรอพิจารณา}`).delete()
    );
  });

  it("manager ลบใบลาของพนักงานไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).delete()
    );
  });

  it("hr ลบใบลาของพนักงานไม่ได้", async () => {
    await assertFails(
      ในนาม(HR.uid).doc(`leaveRequests/${ใบพนักงานรอพิจารณา}`).delete()
    );
  });

  it("เจ้าของลบใบที่ อนุมัติ ไปแล้วไม่ได้ · เป็นประวัติขององค์กรแล้ว", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc(`leaveRequests/${ใบพนักงานอนุมัติแล้ว}`).delete()
    );
  });

  it("เจ้าของลบใบที่ ไม่อนุมัติ ไปแล้วไม่ได้", async () => {
    await assertFails(
      ในนาม(HR.uid).doc(`leaveRequests/${ใบHrไม่อนุมัติแล้ว}`).delete()
    );
  });

  // กฎ delete ดูที่ "เป็นเจ้าของใบไหม" อย่างเดียว ไม่ได้ดูบทบาท
  //   allow delete: if isOwner() && resource.data.status == 'รอพิจารณา'
  // manager หรือ hr ที่ยื่นใบลาเอง ก็เป็นเจ้าของใบเหมือนพนักงานคนอื่น
  // จึงถอนใบของตัวเองที่ยังไม่มีใครพิจารณาได้ · เจตนาของตาราง ACL หัวข้อ 6
  // คือ "ลบใบของคนอื่นไม่ได้" ซึ่งมีเทสคุมไว้แล้ว 3 ข้อด้านบน
  it("manager ถอนใบที่ตัวเองยื่นและยัง รอพิจารณา ได้ เพราะเป็นเจ้าของใบ", async () => {
    await assertSucceeds(
      ในนาม(MGR.uid).doc(`leaveRequests/${ใบManagerรอพิจารณา}`).delete()
    );
  });
});

// ─────────────────────────────────────────────────────────────
// ACL.md หัวข้อ 7 — โฟลเดอร์ย่อย approvals
// สิทธิ์ของโฟลเดอร์แม่ไม่ได้ไหลลงมาให้อัตโนมัติ กฎที่นี่เขียนแยกต่างหาก
// ─────────────────────────────────────────────────────────────
describe("approvals · อ่านความเห็น", () => {
  it("เจ้าของใบอ่านความเห็นในใบของตัวเองได้", async () => {
    await assertSucceeds(
      ในนาม(EMP.uid)
        .collection(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals`)
        .get()
    );
  });

  it("เจ้าของใบอ่านความเห็นทีละรายการได้", async () => {
    await assertSucceeds(
      ในนาม(EMP.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals/ap001`)
        .get()
    );
  });

  it("manager อ่านความเห็นได้ทุกใบ", async () => {
    await assertSucceeds(
      ในนาม(MGR.uid)
        .collection(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals`)
        .get()
    );
  });

  it("hr อ่านความเห็นได้ทุกใบ", async () => {
    await assertSucceeds(
      ในนาม(HR.uid)
        .collection(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals`)
        .get()
    );
  });

  it("สวมรอย · พนักงานที่ไม่ใช่เจ้าของใบอ่านความเห็นในใบคนอื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .collection(`leaveRequests/${ใบHrไม่อนุมัติแล้ว}/approvals`)
        .get()
    );
  });

  it("สวมรอย · พนักงานเปิดความเห็นในใบคนอื่นตรง ๆ ด้วยรหัสไฟล์ไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .doc(`leaveRequests/${ใบHrไม่อนุมัติแล้ว}/approvals/ap004`)
        .get()
    );
  });
});

describe("approvals · เขียนความเห็นใหม่ (create)", () => {
  function ความเห็นของ(คน) {
    return {
      authorId: คน.uid,
      authorName: คน.name,
      message: "ความเห็นทดสอบ",
      createdAt: new Date("2026-09-21T09:00:00+07:00")
    };
  }

  it("manager เขียนความเห็นโดยลงชื่อตัวเองได้", async () => {
    await assertSucceeds(
      ในนาม(MGR.uid)
        .collection(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals`)
        .add(ความเห็นของ(MGR))
    );
  });

  it("hr เขียนความเห็นโดยลงชื่อตัวเองได้", async () => {
    await assertSucceeds(
      ในนาม(HR.uid)
        .collection(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals`)
        .add(ความเห็นของ(HR))
    );
  });

  it("เจ้าของใบเขียนความเห็นในใบของตัวเองได้ · ต้องตอบคำถามผู้อนุมัติได้", async () => {
    await assertSucceeds(
      ในนาม(EMP.uid)
        .collection(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals`)
        .add(ความเห็นของ(EMP))
    );
  });

  it("ลงชื่อความเห็นเป็นคนอื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .collection(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals`)
        .add(ความเห็นของ(MGR))
    );
  });

  it("manager ลงชื่อความเห็นเป็นพนักงานคนอื่นก็ไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .collection(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals`)
        .add(ความเห็นของ(EMP))
    );
  });

  // ── ด่านที่ 2 ของกฎ create · ต้องเกี่ยวข้องกับใบลาใบนั้นจริง ──
  //
  // ลงชื่อตัวเองถูกต้องอย่างเดียวไม่พอ เพราะการเขียนไม่ต้องอ่านก่อน
  // ถ้ามีแต่ด่าน "authorId ต้องเป็น uid ตัวเอง" พนักงานคนใดก็ได้ที่เดารหัสใบลาถูก
  // จะแปะข้อความลงใบลาของคนแปลกหน้าได้ อ่านกลับไม่ได้ก็จริง แต่ข้อความไปโผล่
  // ต่อหน้าผู้อนุมัติแล้ว · สเปก US-08 ถือว่าการเขียนก็คือการเอื้อมถึงแบบหนึ่ง
  it("พนักงานที่ไม่เกี่ยวข้องเขียนความเห็นลงใบของคนอื่นไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .collection(`leaveRequests/${ใบHrรอพิจารณา}/approvals`)
        .add(ความเห็นของ(EMP))
    );
  });

  it("พนักงานที่ไม่เกี่ยวข้องเขียนความเห็นลงใบที่ตัดสินไปแล้วของคนอื่นก็ไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .collection(`leaveRequests/${ใบHrไม่อนุมัติแล้ว}/approvals`)
        .add(ความเห็นของ(EMP))
    );
  });

  // ขอบของกฎใหม่ · ใบแม่ไม่มีอยู่จริง
  // ownsParentRequest() เช็ค exists() ก่อนเรียก get() เสมอ ผลจึงเป็นการปฏิเสธ
  // ตามปกติ ไม่ใช่กฎล้มกลางทางแล้วได้ error แปลก ๆ ที่ตามหาสาเหตุไม่เจอ
  it("พนักงานเขียนความเห็นลงใบลาที่ไม่มีอยู่จริงไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .collection("leaveRequests/lr-ไม่มีใบนี้/approvals")
        .add(ความเห็นของ(EMP))
    );
  });
});

describe("approvals · ความเห็นที่เขียนแล้วเป็นบันทึกถาวร", () => {
  it("manager แก้ความเห็นที่เขียนไปแล้วไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals/ap001`)
        .update({ message: "ขอแก้ข้อความทีหลัง" })
    );
  });

  it("เจ้าของใบแก้ความเห็นในใบตัวเองไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals/ap001`)
        .update({ message: "เจ้าของใบขอแก้" })
    );
  });

  it("hr แก้ความเห็นไม่ได้ แม้เป็นบทบาทสูงสุดในระบบ", async () => {
    await assertFails(
      ในนาม(HR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals/ap002`)
        .update({ message: "hr ขอแก้" })
    );
  });

  it("manager ลบความเห็นไม่ได้", async () => {
    await assertFails(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals/ap001`)
        .delete()
    );
  });

  it("hr ลบความเห็นไม่ได้", async () => {
    await assertFails(
      ในนาม(HR.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals/ap001`)
        .delete()
    );
  });

  it("เจ้าของใบลบความเห็นในใบตัวเองไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid)
        .doc(`leaveRequests/${ใบพนักงานรอพิจารณา}/approvals/ap001`)
        .delete()
    );
  });
});

// ─────────────────────────────────────────────────────────────
// ACL.md หัวข้อ 8 — โฟลเดอร์ที่ไม่มีกฎรองรับ
// ─────────────────────────────────────────────────────────────
describe("โฟลเดอร์ที่ไม่มีใครเขียนกฎไว้ = ปฏิเสธโดยปริยาย", () => {
  it("hr อ่านโฟลเดอร์ที่ไม่มีในเอกสารไม่ได้", async () => {
    await assertFails(ในนาม(HR.uid).doc("settings/app").get());
  });

  it("hr เขียนโฟลเดอร์ที่ไม่มีในเอกสารไม่ได้", async () => {
    await assertFails(ในนาม(HR.uid).doc("settings/app").set({ theme: "dark" }));
  });

  it("manager ขอทั้งโฟลเดอร์ที่ไม่มีในเอกสารไม่ได้", async () => {
    await assertFails(ในนาม(MGR.uid).collection("auditLogs").get());
  });

  it("พนักงานสร้างโฟลเดอร์ของตัวเองขึ้นมาใหม่ไม่ได้", async () => {
    await assertFails(
      ในนาม(EMP.uid).doc(`myPrivateNotes/${EMP.uid}`).set({ note: "จดไว้เอง" })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// ข้อจำกัดที่รู้อยู่และยอมรับแล้ว — ACL.md หัวข้อ 9
//
// สเปกหัวข้อ 6 กำหนดว่า "ต้องมีความเห็นอย่างน้อย 1 รายการก่อนตั้ง ไม่อนุมัติ"
//
// กฎ Firestore บังคับข้อนี้ไม่ได้เลย ไม่ใช่เพราะเขียนกฎไม่เก่งพอ แต่เพราะตัวภาษา
// เปิดดูเอกสารได้เฉพาะไฟล์ที่ "รู้ชื่อเป๊ะ ๆ" ผ่าน exists() / get() เท่านั้น
// มันสั่งค้นหาทั้งโฟลเดอร์ย่อยไม่ได้ จึงนับจำนวนความเห็นใน approvals ไม่ได้
// และชื่อไฟล์ความเห็นถูกสุ่มตอนสร้าง จะเดาชื่อมาเช็คด้วย exists() ก็ไม่ได้เช่นกัน
//
// ทางอ้อมที่ "ดูเหมือนจะได้" ทุกทางแพงกว่าที่ได้มา เช่น การให้ใบลาเก็บตัวนับ
// approvalCount ไว้ในตัวเอง จะเปิดช่องให้เขียนตัวเลขปลอมแล้วกดไม่อนุมัติทันที
// ซึ่งอันตรายกว่าเดิม · ACL.md หัวข้อ 9 จึงสั่งห้ามหาทางอ้อมไว้ชัดเจน
//
// สรุป: เดือนนี้กฎข้อนั้นบังคับในเบราว์เซอร์อย่างเดียว (leave-request-detail.js
// ตรวจก่อนเรียก updateLeaveStatus) · เทสด้านล่างตรึง "ช่องโหว่ที่ยอมรับแล้ว" นี้ไว้
// ให้เห็นด้วยตา ถ้าวันหนึ่งมีคนทำให้กฎบังคับได้จริง เทสนี้จะแดงและต้องมาอ่านบล็อกนี้
// ─────────────────────────────────────────────────────────────
describe("ข้อจำกัดที่ยอมรับแล้ว · กฎนับความเห็นในโฟลเดอร์ย่อยไม่ได้", () => {
  it("กฎยอมให้ไม่อนุมัติใบที่ยังไม่มีความเห็นสักรายการ · ด่านนี้อยู่ในเบราว์เซอร์เท่านั้น", async () => {
    // lr005 เป็นใบที่ รอพิจารณา และไม่มีความเห็นใน approvals เลย
    // ถ้ากฎบังคับสเปกข้อนี้ได้ บรรทัดนี้ต้องถูกปฏิเสธ — แต่บังคับไม่ได้ จึงผ่าน
    await assertSucceeds(
      ในนาม(MGR.uid)
        .doc(`leaveRequests/${ใบพนักงานไม่มีความเห็น}`)
        .update({ status: STATUS.REJECTED })
    );
  });
});
