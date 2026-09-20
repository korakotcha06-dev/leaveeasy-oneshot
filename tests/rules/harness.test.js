// ─────────────────────────────────────────────────────────────
// tests/rules/harness.test.js — ด่านแรกของเทส Security Rules
//
// ไฟล์นี้ไม่ได้ทดสอบกฎรายข้อ (นั่นเป็นงานของไฟล์อื่นในโฟลเดอร์นี้)
// หน้าที่เดียวคือพิสูจน์ว่า "เครื่องมือทดสอบกฎ" ต่อกับ emulator ได้จริง
//
// รันด้วย   npm run test:rules
// ซึ่งใช้ตัวรันเทสที่ติดมากับ Node (`node --test`) ไม่ต้องลง jest หรือ vitest เพิ่ม
//
// สำคัญมาก ต่างจากเทส Playwright ตรงที่ไฟล์นี้ไม่เปิดเบราว์เซอร์เลย
//    มันคุยกับ Firestore emulator ตรง ๆ ในนาม "ผู้ใช้ที่ล็อกอินเป็นคนนั้น"
//    จึงทดสอบได้ว่ากฎปฏิเสธจริงไหม โดยไม่ต้องผ่านหน้าเว็บ
//
// ระวัง ต้องเปิด emulator ไว้ก่อน — npm run emulators
// ─────────────────────────────────────────────────────────────

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const {
  initializeTestEnvironment, assertFails
} = require("@firebase/rules-unit-testing");

const { PROJECT_ID, HOST, PORTS } = require("../fixtures");

const ที่อยู่ไฟล์กฎ = path.join(__dirname, "..", "..", "firestore.rules");

// ยังไม่มีไฟล์กฎ = ยังเขียนไม่เสร็จ · ข้ามไปก่อน อย่าทำให้ชุดเทสแดงทั้งชุด
const มีไฟล์กฎ = fs.existsSync(ที่อยู่ไฟล์กฎ);

test("เครื่องมือทดสอบ Security Rules ต่อกับ emulator ได้", { skip: !มีไฟล์กฎ && "ยังไม่มีไฟล์ firestore.rules" }, async () => {
  const สนามทดสอบ = await initializeTestEnvironment({
    projectId: PROJECT_ID,          // ต้องเป็นตัวเดียวกับ .firebaserc เพราะ emulator เปิด singleProjectMode
    firestore: {
      host: HOST,
      port: PORTS.firestore,
      rules: fs.readFileSync(ที่อยู่ไฟล์กฎ, "utf8")
    }
  });

  try {
    // กฎข้อแรกสุดของ contract.md หัวข้อ 9
    // "ยังไม่ล็อกอิน = อ่านไม่ได้ เขียนไม่ได้ ทุกที่"
    const คนแปลกหน้า = สนามทดสอบ.unauthenticatedContext();
    await assertFails(
      คนแปลกหน้า.firestore().collection("leaveRequests").get()
    );
  } finally {
    await สนามทดสอบ.cleanup();
  }

  assert.ok(true);
});
