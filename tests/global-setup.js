// ─────────────────────────────────────────────────────────────
// tests/global-setup.js — ด่านแรกก่อนเทสทุกไฟล์จะเริ่มวิ่ง
//
// หน้าที่เดียว: รอจน Firebase emulator พร้อมจริงทั้ง 3 ตัว
//
// ทำไมต้องมี ทั้งที่ playwright.config.js มี webServer แล้ว
//   webServer เช็คความพร้อมจาก Emulator Hub (พอร์ต 4400)
//   ซึ่งขึ้นก่อน Firestore / Auth / hosting อยู่หลายวินาที
//   ถ้าไม่มีด่านนี้ เทสจะเริ่มวิ่งตอนที่ Firestore ยังไม่ฟังพอร์ต
//   แล้วล้มด้วย ECONNREFUSED เฉพาะตอนเปิด emulator ใหม่ ๆ — บั๊กแบบจับยาก
//
// ล้มที่นี่ = ข้อความบอกวิธีแก้ชัด ๆ ดีกว่าปล่อยให้ล้มลึก ๆ ในเทส
// ─────────────────────────────────────────────────────────────

const { waitForEmulator } = require("./fixtures");

module.exports = async () => {
  await waitForEmulator();
};
