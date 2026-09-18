// ─────────────────────────────────────────────────────────────
// js/login.js — หน้าเข้าสู่ระบบและสมัครสมาชิก
// ─────────────────────────────────────────────────────────────

import { hasConfig } from "./firebase.js";
import { รอสถานะล็อกอิน, เข้าสู่ระบบ, สมัครสมาชิก, แปลข้อผิดพลาดล็อกอิน } from "./auth.js";

const กล่องเตือน = document.getElementById("ข้อความเตือน");
const ปุ่มเข้า = document.getElementById("ปุ่มเข้าสู่ระบบ");
const ปุ่มสมัคร = document.getElementById("ปุ่มสมัคร");

เริ่มทำงาน();

async function เริ่มทำงาน() {
  if (!hasConfig) {
    showConfigWarning("จึงยังล็อกอินไม่ได้");
    ปุ่มเข้า.disabled = true;
    ปุ่มสมัคร.disabled = true;
    return;
  }

  // ถ้าล็อกอินค้างไว้อยู่แล้ว ให้พาไปหน้ารายการเลย
  const ผู้ใช้ = await รอสถานะล็อกอิน();
  if (ผู้ใช้) {
    location.href = "leave-requests.html";
    return;
  }

  ปุ่มเข้า.addEventListener("click", ทำการเข้าสู่ระบบ);
  ปุ่มสมัคร.addEventListener("click", ทำการสมัคร);
}

async function ทำการเข้าสู่ระบบ() {
  const อีเมล = document.getElementById("อีเมลเข้า").value.trim();
  const รหัสผ่าน = document.getElementById("รหัสผ่านเข้า").value;

  if (!อีเมล || !รหัสผ่าน) {
    เตือน("กรอกอีเมลและรหัสผ่านให้ครบก่อน");
    return;
  }

  ปุ่มเข้า.disabled = true;
  ปุ่มเข้า.textContent = "กำลังเข้าสู่ระบบ…";
  try {
    await เข้าสู่ระบบ(อีเมล, รหัสผ่าน);
    location.href = "leave-requests.html";
  } catch (e) {
    เตือน(แปลข้อผิดพลาดล็อกอิน(e));
    ปุ่มเข้า.disabled = false;
    ปุ่มเข้า.textContent = "เข้าสู่ระบบ";
  }
}

async function ทำการสมัคร() {
  const ชื่อ = document.getElementById("ชื่อสมัคร").value.trim();
  const อีเมล = document.getElementById("อีเมลสมัคร").value.trim();
  const รหัสผ่าน = document.getElementById("รหัสผ่านสมัคร").value;

  if (!ชื่อ || !อีเมล || !รหัสผ่าน) {
    เตือน("กรอกชื่อ อีเมล และรหัสผ่านให้ครบก่อน");
    return;
  }

  ปุ่มสมัคร.disabled = true;
  ปุ่มสมัคร.textContent = "กำลังสมัคร…";
  try {
    await สมัครสมาชิก(อีเมล, รหัสผ่าน, ชื่อ);
    location.href = "leave-requests.html";
  } catch (e) {
    เตือน(แปลข้อผิดพลาดล็อกอิน(e));
    ปุ่มสมัคร.disabled = false;
    ปุ่มสมัคร.textContent = "สมัครสมาชิก";
  }
}

function เตือน(ข้อความ) {
  เตือนพร้อมไอคอน(กล่องเตือน, "error", ข้อความ);
  กล่องเตือน.classList.remove("hidden");
}
