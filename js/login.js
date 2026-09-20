// ─────────────────────────────────────────────────────────────
// js/login.js — พฤติกรรมของหน้า login.html
//
// หน้านี้เป็นหน้าเดียวที่ "ไม่" เรียก requireAuth เพราะคนที่ยังไม่ได้ล็อกอิน
// ต้องเข้ามาได้ ถ้าใส่ด่านกั้นที่นี่ด้วยจะเด้งวนหาตัวเองไม่รู้จบ
// ─────────────────────────────────────────────────────────────

import { onUser, signIn, signUp } from "./auth.js";
import { hasConfig } from "./firebase.js";
import { byTestId, showError, clearError, describeError } from "./util.js";

// ไปหน้าไหนต่อเมื่อล็อกอินสำเร็จ · เขียนไว้ที่เดียวจะได้แก้ที่เดียว
const หน้าถัดไป = "index.html";

const ช่องผิดพลาด = byTestId("error-message");
const ป้ายผู้ใช้ = byTestId("auth-state");

// แสดงชื่อคนที่ล็อกอินอยู่ ถ้ามี
// ใช้ textContent ไม่ใช่ innerHTML เพราะชื่อเป็นข้อความที่ผู้ใช้พิมพ์เองตอนสมัคร
onUser((ผู้ใช้) => {
  if (ป้ายผู้ใช้) ป้ายผู้ใช้.textContent = ผู้ใช้ ? ผู้ใช้.name : "";
});

if (!hasConfig) {
  showError(ช่องผิดพลาด, "ยังไม่ได้ตั้งค่าเชื่อมต่อ Firebase กรุณาตรวจสอบไฟล์ js/firebase.js");
}

/**
 * ตัวช่วยกันกดซ้ำ
 *
 * ทำไมต้องมี: การล็อกอินใช้เวลาเดินทางไปเซิร์ฟเวอร์ ถ้าผู้ใช้กดรัว ๆ
 * เราจะยิงคำขอซ้อนกันหลายรอบ และ Firebase จะเริ่มปฏิเสธด้วย too-many-requests
 * ปิดปุ่มระหว่างรอจึงทั้งกันพลาดและบอกผู้ใช้ว่าระบบกำลังทำงานอยู่
 */
async function ระหว่างรอ(ปุ่ม, ข้อความรอ, งาน) {
  const ข้อความเดิม = ปุ่ม.textContent;
  ปุ่ม.disabled = true;
  ปุ่ม.textContent = ข้อความรอ;
  try {
    await งาน();
  } finally {
    ปุ่ม.disabled = false;
    ปุ่ม.textContent = ข้อความเดิม;
  }
}

// ── ฟอร์มเข้าสู่ระบบ ─────────────────────────────────────────

const ฟอร์มเข้าระบบ = document.getElementById("form-signin");
const ปุ่มเข้าระบบ = byTestId("signin-submit");

ฟอร์มเข้าระบบ.addEventListener("submit", async (event) => {
  // กัน submit แบบเดิมของเบราว์เซอร์ที่จะโหลดหน้าใหม่ทั้งหน้า
  // เราจัดการเองด้วย JavaScript เพราะไม่มีเซิร์ฟเวอร์ของตัวเองให้ส่งฟอร์มไปหา
  event.preventDefault();
  clearError(ช่องผิดพลาด);

  const อีเมล = byTestId("signin-email").value.trim();
  const รหัสผ่าน = byTestId("signin-password").value;

  if (!อีเมล || !รหัสผ่าน) {
    showError(ช่องผิดพลาด, "กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  await ระหว่างรอ(ปุ่มเข้าระบบ, "กำลังเข้าสู่ระบบ...", async () => {
    try {
      await signIn(อีเมล, รหัสผ่าน);
      location.href = หน้าถัดไป;
    } catch (err) {
      showError(ช่องผิดพลาด, describeError(err));
    }
  });
});

// ── ฟอร์มสมัครสมาชิก ─────────────────────────────────────────

const ฟอร์มสมัคร = document.getElementById("form-signup");
const ปุ่มสมัคร = byTestId("signup-submit");

ฟอร์มสมัคร.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError(ช่องผิดพลาด);

  const ชื่อ = byTestId("signup-name").value.trim();
  const อีเมล = byTestId("signup-email").value.trim();
  const รหัสผ่าน = byTestId("signup-password").value;

  if (!ชื่อ || !อีเมล || !รหัสผ่าน) {
    showError(ช่องผิดพลาด, "กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบ");
    return;
  }

  // เช็คความยาวตั้งแต่ที่นี่ เพื่อให้ผู้ใช้รู้ผลทันทีโดยไม่ต้องรอเซิร์ฟเวอร์ตอบ
  // (Firebase ก็บังคับ 6 ตัวอักษรอยู่แล้ว แต่ข้อความที่มันส่งกลับมาเป็นภาษาอังกฤษ)
  if (รหัสผ่าน.length < 6) {
    showError(ช่องผิดพลาด, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    return;
  }

  await ระหว่างรอ(ปุ่มสมัคร, "กำลังสมัครสมาชิก...", async () => {
    try {
      await signUp({ name: ชื่อ, email: อีเมล, password: รหัสผ่าน });
      // สมัครเสร็จ Firebase ถือว่าล็อกอินให้เลย ไม่ต้องให้ผู้ใช้กรอกซ้ำ
      location.href = หน้าถัดไป;
    } catch (err) {
      showError(ช่องผิดพลาด, describeError(err));
    }
  });
});
