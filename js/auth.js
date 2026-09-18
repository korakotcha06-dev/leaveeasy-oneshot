// ─────────────────────────────────────────────────────────────
// js/auth.js — ล็อกอิน สมัครสมาชิก และออกจากระบบ
//
// กติกาสำคัญ: ทุกหน้าต้อง **รอให้รู้สถานะล็อกอินก่อน** แล้วค่อยอ่านข้อมูลจาก Firestore
//    ถ้าอ่านก่อน จะโดนปฏิเสธ (permission denied) ทั้งที่ล็อกอินอยู่จริง
// ─────────────────────────────────────────────────────────────

import { app, db, hasConfig, ใช้ฐานจำลอง, doc, getDoc, setDoc } from "./firebase.js";
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

export const auth = hasConfig ? getAuth(app) : null;
if (auth && ใช้ฐานจำลอง) connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });

// รอจนกว่า Firebase จะบอกได้ว่าตอนนี้ใครล็อกอินอยู่ (หรือไม่มีใครล็อกอิน)
export function รอสถานะล็อกอิน() {
  return new Promise((resolve) => {
    const หยุดฟัง = onAuthStateChanged(auth, (ผู้ใช้) => {
      หยุดฟัง();
      resolve(ผู้ใช้);
    });
  });
}

// ใช้ในทุกหน้าที่ต้องล็อกอินก่อน — ถ้ายังไม่ล็อกอิน จะส่งกลับไปหน้า login
// คืนค่าเป็นข้อมูลของคนที่ล็อกอินอยู่ { uid, name, email, role }
export async function requireLogin() {
  const ผู้ใช้ = await รอสถานะล็อกอิน();
  if (!ผู้ใช้) {
    location.href = "login.html";
    return null;
  }
  const โปรไฟล์ = await โหลดโปรไฟล์(ผู้ใช้);
  const ข้อมูล = {
    uid: ผู้ใช้.uid,
    name: โปรไฟล์.name,
    email: ผู้ใช้.email,
    role: โปรไฟล์.role
  };
  แสดงบนแถบเมนู(ข้อมูล);
  return ข้อมูล;
}

// อ่านไฟล์ของผู้ใช้คนนี้ในโฟลเดอร์ users · ถ้ายังไม่มี ให้สร้างให้
async function โหลดโปรไฟล์(ผู้ใช้) {
  const ที่อยู่ = doc(db, "users", ผู้ใช้.uid);
  const ไฟล์ = await getDoc(ที่อยู่);
  if (ไฟล์.exists()) return ไฟล์.data();

  const โปรไฟล์ใหม่ = {
    name: ผู้ใช้.email.split("@")[0],
    email: ผู้ใช้.email,
    role: "employee"          // บทบาทเริ่มต้นของทุกคนคือผู้ขอลา
  };
  await setDoc(ที่อยู่, โปรไฟล์ใหม่);
  return โปรไฟล์ใหม่;
}

// สมัครสมาชิกใหม่ แล้วสร้างไฟล์ใน users/ โดยใช้ uid เป็นชื่อไฟล์
export async function สมัครสมาชิก(อีเมล, รหัสผ่าน, ชื่อ) {
  const ผล = await createUserWithEmailAndPassword(auth, อีเมล, รหัสผ่าน);
  await setDoc(doc(db, "users", ผล.user.uid), {
    name: ชื่อ,
    email: อีเมล,
    role: "employee"
  });
  return ผล.user;
}

export async function เข้าสู่ระบบ(อีเมล, รหัสผ่าน) {
  const ผล = await signInWithEmailAndPassword(auth, อีเมล, รหัสผ่าน);
  return ผล.user;
}

export async function ออกจากระบบ() {
  await signOut(auth);
  location.href = "login.html";
}

// แสดงชื่อคนที่ล็อกอินอยู่ พร้อมปุ่มออกจากระบบ บนแถบเมนู
function แสดงบนแถบเมนู(ข้อมูล) {
  const ที่วาง = document.getElementById("navUser");
  if (!ที่วาง) return;

  const ชื่อบทบาท = { employee: "ผู้ขอลา", manager: "ผู้อนุมัติ", hr: "ฝ่ายบุคคล" };
  ที่วาง.innerHTML =
    "<span>" + ไอคอน("user") + esc(ข้อมูล.name) + " · " + esc(ชื่อบทบาท[ข้อมูล.role] || ข้อมูล.role) + "</span>" +
    '<button type="button" class="btn-ghost" id="ปุ่มออกจากระบบ">ออกจากระบบ</button>';

  document.getElementById("ปุ่มออกจากระบบ").addEventListener("click", ออกจากระบบ);
}

// ผู้อนุมัติและฝ่ายบุคคล = คนที่ดูใบลาได้ทุกใบ และอนุมัติได้ (ตาม ACL.md)
export function เป็นผู้พิจารณา(ผู้ใช้) {
  return Boolean(ผู้ใช้) && (ผู้ใช้.role === "manager" || ผู้ใช้.role === "hr");
}

// แปลรหัสข้อผิดพลาดของ Firebase เป็นภาษาไทยที่บอกว่าควรทำอะไรต่อ
export function แปลข้อผิดพลาดล็อกอิน(e) {
  const รหัส = String((e && e.code) || "");
  if (รหัส.includes("invalid-email")) return "รูปแบบอีเมลไม่ถูกต้อง ตรวจว่าพิมพ์ครบหรือยัง";
  if (รหัส.includes("email-already-in-use")) return "อีเมลนี้สมัครไว้แล้ว ให้ใช้ช่องเข้าสู่ระบบแทน";
  if (รหัส.includes("weak-password")) return "รหัสผ่านสั้นเกินไป ต้องยาวอย่างน้อย 6 ตัวอักษร";
  if (รหัส.includes("invalid-credential") || รหัส.includes("wrong-password") || รหัส.includes("user-not-found"))
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง ลองพิมพ์ใหม่อีกครั้ง";
  if (รหัส.includes("too-many-requests")) return "ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่";
  if (รหัส.includes("operation-not-allowed"))
    return "ยังไม่ได้เปิดวิธีล็อกอินแบบอีเมล/รหัสผ่านใน Firebase Console (ดู SETUP.md ขั้นที่ 3)";
  return (e && e.message) || String(e);
}
