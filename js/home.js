// js/home.js
// พฤติกรรมเฉพาะของหน้าแรก มีน้อยมากตามเจตนา — ตัวหน้าแรกส่วนใหญ่เป็น static link
// สิ่งเดียวที่ต้องทำเอง (นอกเหนือจาก nav.js) คือ ซ่อนปุ่ม "เข้าสู่ระบบ" ตอนที่ล็อกอินอยู่แล้ว
// เพราะถ้าล็อกอินอยู่แล้วปุ่มนี้ไม่มีประโยชน์ และอาจทำให้สับสนว่าต้องล็อกอินซ้ำหรือไม่

import { onUser } from "./auth.js";

function toggleLoginLink(user) {
  const loginLink = document.getElementById("home-login-link");
  if (!loginLink) return;
  // มี user แปลว่าล็อกอินอยู่แล้ว จึงซ่อนปุ่มเข้าสู่ระบบ
  loginLink.hidden = Boolean(user);
}

try {
  onUser((user) => toggleLoginLink(user));
} catch (err) {
  // auth.js อาจยังไม่พร้อมระหว่างพัฒนา ไม่ควรทำให้หน้าแรกใช้งานไม่ได้ทั้งหน้า
  console.error("home.js: onUser ใช้งานไม่ได้", err);
}
