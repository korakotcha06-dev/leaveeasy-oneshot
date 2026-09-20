// ─────────────────────────────────────────────────────────────
// js/auth.js — ล็อกอิน สมัครสมาชิก และ "ตอนนี้ใครใช้งานอยู่"
//
// ไฟล์นี้รับ app ที่สร้างไว้แล้วจาก firebase.js มาใช้ ไม่ได้เรียก initializeApp เอง
// ถ้าสร้างแอปซ้ำ Firebase จะถือเป็นคนละแอป แล้วสถานะล็อกอินจะหายไปเฉย ๆ
//
// เรื่องที่ต้องเข้าใจก่อนอ่านโค้ดข้างล่าง
//   "ล็อกอินอยู่หรือเปล่า" ไม่ใช่ค่าที่ถามได้ทันทีตอนหน้าเว็บเพิ่งโหลด
//   Firebase ต้องไปกู้สถานะจากที่เก็บในเบราว์เซอร์ก่อน ซึ่งใช้เวลาเสี้ยววินาที
//   ช่วงนั้น auth.currentUser จะเป็น null ทั้งที่ผู้ใช้ล็อกอินอยู่
//   โค้ดที่เช็ค auth.currentUser ทันทีจึงเด้งคนที่ล็อกอินอยู่ออกไปหน้าล็อกอิน
//   ไฟล์นี้แก้ด้วยการรอ onAuthStateChanged ครั้งแรกให้เสร็จก่อนเสมอ
// ─────────────────────────────────────────────────────────────

import { app, useEmulator } from "./firebase.js";
import { getUser, createUserProfile } from "./data.js";

import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

export const auth = getAuth(app);

// ต่อ Auth emulator ให้เสร็จก่อนใช้งานครั้งแรก เช่นเดียวกับฝั่ง Firestore
// ที่อยู่ต้องมี http:// นำหน้า ต่างจาก Firestore ที่รับ host กับ port แยกกัน
if (useEmulator) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  } catch (err) {
    console.warn("ต่อ Auth emulator ซ้ำ", err);
  }
}

// ── สถานะที่จำไว้ในหน่วยความจำ ────────────────────────────────

// undefined = ยังไม่รู้ (กำลังกู้สถานะอยู่) · null = ไม่ได้ล็อกอิน · object = ล็อกอินอยู่
let ผู้ใช้ปัจจุบัน;
let รู้แล้ว = false;
let บอกว่ารู้แล้ว;

// สัญญาที่จะ resolve เมื่อรู้สถานะล็อกอินครั้งแรก
// ทุกฟังก์ชันที่ต้องใช้ตัวตนผู้ใช้จะ await ตัวนี้ก่อน
const พร้อมแล้ว = new Promise((resolve) => {
  บอกว่ารู้แล้ว = resolve;
});

const ผู้ติดตาม = new Set();

// นับรอบไว้กัน "ผลเก่ามาทีหลัง"
// การอ่านโปรไฟล์จาก Firestore ใช้เวลา ถ้าผู้ใช้กดออกจากระบบระหว่างรอ
// ผลของรอบเก่าอาจกลับมาทับสถานะใหม่ เลขรอบช่วยให้ทิ้งผลที่ล้าสมัยได้
let รอบ = 0;

function ประกาศ(ผู้ใช้) {
  ผู้ใช้ปัจจุบัน = ผู้ใช้;
  if (!รู้แล้ว) {
    รู้แล้ว = true;
    บอกว่ารู้แล้ว(ผู้ใช้);
  }

  // ปักธงไว้ที่ <body> ว่า "สถานะล็อกอินรู้ผลแล้ว"
  //
  // มีไว้ให้ชุดทดสอบอัตโนมัติรอได้ว่าหน้าพร้อมจริง ไม่ใช่กดปุ่มตั้งแต่ตอนที่
  // ตัวจับเหตุการณ์ยังไม่ถูกผูก ซึ่งจะกดแล้วไม่เกิดอะไรขึ้นและไม่มี error ให้เห็น
  if (typeof document !== "undefined" && document.body) {
    document.body.dataset.authReady = "1";
    document.body.dataset.authUser = ผู้ใช้ ? ผู้ใช้.uid : "";
    document.body.dataset.authRole = ผู้ใช้ && ผู้ใช้.role ? ผู้ใช้.role : "";
  }

  ผู้ติดตาม.forEach((cb) => {
    try {
      cb(ผู้ใช้);
    } catch (err) {
      // ผู้ติดตามคนหนึ่งพัง ต้องไม่ทำให้คนที่เหลือไม่ได้รับแจ้ง
      console.error("ตัวรับสถานะผู้ใช้ทำงานผิดพลาด", err);
    }
  });
}

// อ่านโปรไฟล์จากโฟลเดอร์ users แล้วรวมกับข้อมูลจาก Firebase Auth
// ทำไมต้องอ่านเพิ่ม: Firebase Auth รู้แค่ uid กับอีเมล ไม่รู้ว่าใครเป็น manager หรือ hr
// บทบาทเก็บไว้ที่ users/{uid}.role ซึ่งเป็นค่าที่กฎความปลอดภัยใช้ตัดสินสิทธิ์
async function ประกอบร่างผู้ใช้(fbUser) {
  let โปรไฟล์ = null;
  try {
    โปรไฟล์ = await getUser(fbUser.uid);
  } catch (err) {
    // อ่านไม่ได้ (เช่นกฎปฏิเสธ หรือเน็ตหลุด) ต้องไม่ทำให้ทั้งหน้าพัง
    // ให้ถือว่าล็อกอินอยู่แต่ยังไม่รู้บทบาท หน้าจอจะปฏิบัติกับเขาแบบสิทธิ์ต่ำสุด
    console.warn("อ่านโปรไฟล์ผู้ใช้ไม่สำเร็จ", err);
  }

  return {
    uid: fbUser.uid,
    email: โปรไฟล์ && โปรไฟล์.email ? โปรไฟล์.email : fbUser.email || "",
    name:
      (โปรไฟล์ && โปรไฟล์.name) ||
      fbUser.displayName ||
      fbUser.email ||
      "",
    role: โปรไฟล์ && โปรไฟล์.role ? โปรไฟล์.role : ""
  };
}

onAuthStateChanged(auth, async (fbUser) => {
  const รอบนี้ = ++รอบ;

  if (!fbUser) {
    ประกาศ(null);
    return;
  }

  const ผู้ใช้ = await ประกอบร่างผู้ใช้(fbUser);
  if (รอบนี้ !== รอบ) return; // มีเหตุการณ์ใหม่แซงไปแล้ว ผลรอบนี้ล้าสมัย
  ประกาศ(ผู้ใช้);
});

// ── ส่วนที่หน้าจอเรียกใช้ ─────────────────────────────────────

/**
 * ติดตามสถานะผู้ใช้ · callback ได้รับ {uid, name, email, role} หรือ null
 * คืนฟังก์ชันสำหรับเลิกติดตาม
 *
 * ถ้าตอนเรียกรู้สถานะอยู่แล้ว จะยิง callback ให้ทันที
 * หน้าจอจึงไม่ต้องเขียนโค้ดแยกระหว่าง "เพิ่งโหลด" กับ "เปลี่ยนสถานะทีหลัง"
 */
export function onUser(callback) {
  if (typeof callback !== "function") return () => {};
  ผู้ติดตาม.add(callback);
  if (รู้แล้ว) {
    try {
      callback(ผู้ใช้ปัจจุบัน);
    } catch (err) {
      console.error("ตัวรับสถานะผู้ใช้ทำงานผิดพลาด", err);
    }
  }
  return () => ผู้ติดตาม.delete(callback);
}

/** รอจนรู้สถานะล็อกอินแล้วคืนผู้ใช้ปัจจุบัน หรือ null ถ้าไม่ได้ล็อกอิน */
export async function currentUser() {
  await พร้อมแล้ว;
  return ผู้ใช้ปัจจุบัน || null;
}

/**
 * สมัครสมาชิกใหม่
 *
 * ทำ 3 อย่างตามลำดับ และลำดับสำคัญ
 *   1. สร้างบัญชีใน Firebase Auth — ได้ uid มา และผู้ใช้ถือว่าล็อกอินทันที
 *   2. จดชื่อไว้ใน Auth (displayName) เผื่อกรณีอ่านโปรไฟล์ไม่ได้
 *   3. สร้างไฟล์ users/{uid} ที่มี role เป็น "employee"
 *
 * ขั้นที่ 3 ต้องทำ "หลัง" สร้างบัญชี เพราะกฎความปลอดภัยยอมให้เขียนไฟล์โปรไฟล์
 * ได้เฉพาะเมื่อชื่อไฟล์ตรงกับ uid ของคนที่ล็อกอินอยู่ ถ้าเขียนก่อนจะถูกปฏิเสธ
 */
export async function signUp({ name, email, password }) {
  const ผล = await createUserWithEmailAndPassword(
    auth,
    (email || "").trim(),
    password
  );
  const fbUser = ผล.user;
  const ชื่อ = (name || "").trim();

  if (ชื่อ) {
    try {
      await updateProfile(fbUser, { displayName: ชื่อ });
    } catch (err) {
      // ชื่อใน Auth เป็นแค่ข้อมูลสำรอง ตัวจริงอยู่ใน users/{uid} ล้มตรงนี้ไม่ร้ายแรง
      console.warn("บันทึกชื่อลง Firebase Auth ไม่สำเร็จ", err);
    }
  }

  await createUserProfile(fbUser.uid, { name: ชื่อ, email: fbUser.email });

  // อ่านโปรไฟล์ที่เพิ่งเขียนกลับมาแล้วประกาศใหม่
  // เพราะ onAuthStateChanged ยิงไปตั้งแต่ตอนที่ไฟล์โปรไฟล์ยังไม่มี role จะยังว่างอยู่
  const ผู้ใช้ = await ประกอบร่างผู้ใช้(fbUser);
  ประกาศ(ผู้ใช้);
  return ผู้ใช้;
}

/** เข้าสู่ระบบ คืนข้อมูลผู้ใช้พร้อมบทบาท */
export async function signIn(email, password) {
  const ผล = await signInWithEmailAndPassword(auth, (email || "").trim(), password);
  // รอให้ตัวจับเหตุการณ์อ่านโปรไฟล์เสร็จ แล้วค่อยคืนค่า
  // ถ้าคืนทันทีหน้าจออาจพาไปหน้าถัดไปก่อนที่บทบาทจะพร้อม แล้วรายการจะว่างเปล่า
  const ผู้ใช้ = await ประกอบร่างผู้ใช้(ผล.user);
  ประกาศ(ผู้ใช้);
  return ผู้ใช้;
}

/**
 * ออกจากระบบ
 * ไฟล์นี้ไม่พาไปหน้าไหนต่อ ปล่อยให้หน้าที่เรียกเป็นคนตัดสินใจ
 * เพราะแต่ละหน้าอยากไปคนละที่ (บางหน้าอยู่ต่อได้ บางหน้าต้องเด้งออก)
 */
export async function signOutUser() {
  await signOut(auth);
}

/**
 * ด่านกั้นหน้าที่ต้องล็อกอินก่อน
 *
 * ใช้แบบนี้ในทุกหน้าที่ต้องมีตัวตน
 *   const ผู้ใช้ = await requireAuth();
 *   if (!ผู้ใช้) return;          // กำลังถูกพาไปหน้าล็อกอิน อย่าทำงานต่อ
 *
 * ใช้ location.replace ไม่ใช่ location.href เพราะไม่อยากให้หน้าที่เข้าไม่ได้
 * ค้างอยู่ในประวัติการเข้าชม กดย้อนกลับแล้วจะวนกลับมาโดนเด้งซ้ำอีก
 *
 * ย้ำว่าการซ่อนหน้าแบบนี้เป็นแค่ความสะดวกของผู้ใช้ ไม่ใช่ความปลอดภัย
 * ตัวที่กันข้อมูลจริงคือ firestore.rules ฝั่งเซิร์ฟเวอร์
 */
export async function requireAuth() {
  const ผู้ใช้ = await currentUser();
  if (!ผู้ใช้) {
    location.replace("login.html");
    return null;
  }
  return ผู้ใช้;
}
