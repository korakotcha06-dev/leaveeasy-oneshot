// ─────────────────────────────────────────────────────────────
// js/home.js — หน้าแรก
//
// หน้าแรกเป็นหน้าเดียวที่เปิดดูได้โดยไม่ต้องล็อกอิน จึงไม่เรียก requireLogin
// หน้าที่ของไฟล์นี้คือบอกให้ชัดว่า "ตอนนี้ล็อกอินอยู่หรือยัง" และทางเข้าอยู่ตรงไหน
// ─────────────────────────────────────────────────────────────

import { hasConfig } from "./firebase.js";
import { รอสถานะล็อกอิน, ออกจากระบบ } from "./auth.js";

const กล่อง = document.getElementById("กล่องเข้าสู่ระบบ");

เริ่มทำงาน();

async function เริ่มทำงาน() {
  if (!hasConfig || !กล่อง) return;

  const ผู้ใช้ = await รอสถานะล็อกอิน();
  if (!ผู้ใช้) return;          // ยังไม่ล็อกอิน — คงปุ่ม "เข้าสู่ระบบ / สมัครสมาชิก" ไว้ตามเดิม

  // ล็อกอินอยู่แล้ว ไม่ต้องชวนล็อกอินซ้ำ · พาไปหน้าที่ใช้งานจริงเลย
  กล่อง.innerHTML =
    '<a class="btn" href="leave-requests.html">ไปที่รายการใบลา</a>' +
    '<button type="button" class="btn-ghost" id="ปุ่มออกจากระบบหน้าแรก">ออกจากระบบ</button>';
  document.getElementById("ปุ่มออกจากระบบหน้าแรก").addEventListener("click", ออกจากระบบ);

  const คำอธิบาย = กล่อง.nextElementSibling;
  if (คำอธิบาย && คำอธิบาย.classList.contains("hint")) {
    คำอธิบาย.textContent = "เข้าสู่ระบบอยู่ในชื่อ " + ผู้ใช้.email;
  }

  // แถบเมนูมุมขวาบน: เปลี่ยนจากปุ่มเข้าสู่ระบบ เป็นชื่อผู้ใช้กับปุ่มออกจากระบบ
  const มุมขวา = document.getElementById("navUser");
  if (มุมขวา) {
    มุมขวา.innerHTML = "";
    const ชื่อ = document.createElement("span");
    ชื่อ.textContent = ผู้ใช้.email;
    const ปุ่ม = document.createElement("button");
    ปุ่ม.type = "button";
    ปุ่ม.className = "btn-ghost";
    ปุ่ม.textContent = "ออกจากระบบ";
    ปุ่ม.addEventListener("click", ออกจากระบบ);
    มุมขวา.append(ชื่อ, ปุ่ม);
  }
}
