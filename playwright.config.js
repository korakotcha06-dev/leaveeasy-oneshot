// ─────────────────────────────────────────────────────────────
// playwright.config.js — ตั้งค่ากลางของชุดทดสอบ end-to-end
//
// สำคัญมาก baseURL ต้องเป็น http://localhost:5050 เท่านั้น
//    5050 = hosting ของ Firebase emulator · แอปจะต่อ "ฐานจำลอง" ที่พอร์ตนี้
//    3000 = npm run dev · แอปจะต่อ "ฐานข้อมูลจริง" — เทสห้ามแตะเด็ดขาด
//    เพราะ fixtures ล้างฐานข้อมูลทิ้งก่อนทุกเทส ถ้าชี้ผิดพอร์ตคือลบข้อมูลจริง
//
// เขียนเป็น CommonJS เพราะ package.json ไม่มี "type": "module"
// ─────────────────────────────────────────────────────────────

const { defineConfig, devices } = require("@playwright/test");
const { BASE_URL } = require("./tests/fixtures/config");

module.exports = defineConfig({
  testDir: "./tests",

  // ไฟล์ใน fixtures/ เป็นตัวช่วย ไม่ใช่เทส · ส่วน rules/ รันด้วย `npm run test:rules`
  testIgnore: ["fixtures/**", "rules/**", "global-setup.js"],

  // ด่านรอ emulator ให้พร้อมจริง ก่อนเทสไฟล์แรกจะเริ่ม (ดูเหตุผลในไฟล์นั้น)
  globalSetup: require.resolve("./tests/global-setup"),

  // สำคัญมาก ห้ามเพิ่มเป็นหลาย worker
  // emulator มีฐานข้อมูลก้อนเดียว ทุกเทสใช้ร่วมกัน
  // ถ้ารันขนานกัน เทสหนึ่งจะล้างข้อมูลระหว่างที่อีกเทสกำลังอ่านอยู่
  workers: 1,
  fullyParallel: false,

  // ห้าม .only ค้างอยู่ในโค้ดที่ส่งขึ้น CI
  forbidOnly: Boolean(process.env.CI),

  // emulator ในเครื่องพังแบบสุ่มน้อยมาก · ให้ล้มไปเลยจะได้เห็นปัญหาจริง
  retries: process.env.CI ? 1 : 0,

  timeout: 30_000,                      // ต่อหนึ่งเทส
  expect: { timeout: 7_000 },           // ต่อหนึ่ง expect ที่ต้องรอหน้าจอ

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  outputDir: "test-results",

  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // ภาษาและเขตเวลาของไทย — หน้าเว็บทั้งหมดเป็นภาษาไทย
    locale: "th-TH",
    timezoneId: "Asia/Bangkok"
  },

  // เบราว์เซอร์เดียวพอ · ใบงานสัปดาห์ที่ 9 ไม่ได้ขอ cross-browser
  // และยิ่งหลายเบราว์เซอร์ ยิ่งแย่งฐานข้อมูล emulator ก้อนเดียวกัน
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],

  // ── ไม่มี webServer โดยตั้งใจ · emulator ต้องเปิดค้างไว้ก่อน ──
  //
  // สำคัญมาก ข้อนี้ลองจริงแล้วถึงตัดสินใจ ไม่ได้เดา
  //
  // เคยตั้ง webServer ให้ Playwright สั่ง `firebase emulators:start` เอง
  // รอบแรกทำงานได้ แต่ตอนจบเทส Playwright ฆ่าได้แค่ firebase CLI ซึ่งเป็นตัวแม่
  // ส่วน Firestore emulator เป็นโปรเซส Java ลูก — รอดมาและจับพอร์ต 8080 ค้างไว้
  // พอรันรอบถัดไป Playwright เห็นว่ายังไม่พร้อม เลยสั่งเปิดใหม่ แล้วชนพอร์ตกับผีตัวเดิม
  // ล้มด้วยข้อความ  Process from config.webServer was not able to start. Exit code: 1
  // ซึ่งไม่ได้บอกเลยว่าสาเหตุจริงคือมีโปรเซสค้างอยู่ — เสียเวลาหานาน
  //
  // เลือกทางที่คาดเดาได้แทน: ให้คนเปิด emulator เองไว้อีกหน้าต่างหนึ่ง
  //     หน้าต่างที่ 1   npm run emulators
  //     หน้าต่างที่ 2   npm run test:e2e
  // ถ้าลืมเปิด globalSetup จะล้มทันทีพร้อมบอกวิธีแก้เป็นภาษาไทย
  //
  // อยากได้คำสั่งเดียวจบ (เช่นตอนรันบน CI) ใช้
  //     npm run test:ci
  // ซึ่งใช้ `firebase emulators:exec` — เปิด รันเทส แล้วเก็บกวาดโปรเซสให้เองครบ
});
