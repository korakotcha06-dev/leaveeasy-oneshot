// ─────────────────────────────────────────────────────────────
// js/firebase.js — จุดเชื่อมต่อ Firebase จุดเดียวของทั้งแอป
//
// ทำไมต้องมีไฟล์นี้ไฟล์เดียว
//   Firebase รุ่นโมดูล (modular) ถือว่า "ไฟล์ CDN หนึ่ง URL = ไลบรารีหนึ่งชุด"
//   ถ้าแต่ละหน้าไป import คนละ URL หรือคนละเวอร์ชัน เบราว์เซอร์จะโหลดไลบรารี
//   ขึ้นมาหลายชุดแยกกัน แต่ละชุดมองไม่เห็นแอปของอีกชุด
//   ผลคือหน้าหนึ่งล็อกอินสำเร็จ แต่อีกหน้าบอกว่ายังไม่ได้ล็อกอิน โดยไม่มี error
//   ให้เห็นเลย ดีบักยากมาก
//
//   ไฟล์นี้จึงเป็นที่เดียวที่รู้จัก URL ของ CDN และเป็นที่เดียวที่เรียก initializeApp
//   โมดูลอื่นห้าม import จาก gstatic.com ตรง ๆ ให้ import ผ่านไฟล์นี้เท่านั้น
//   (ยกเว้น js/auth.js ที่ต้องใช้ firebase-auth.js ซึ่งไฟล์นี้ไม่ได้ห่อไว้
//    แต่ auth.js ก็รับ app ที่สร้างแล้วจากไฟล์นี้ไปใช้ ไม่ได้สร้างแอปใหม่)
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// เวอร์ชันที่ตรึงไว้ เขียนเป็นค่าคงที่เพื่อให้ไฟล์อื่น (เช่น auth.js) อ้างอิงได้ว่า
// ต้องใช้เลขเดียวกัน ถ้าจะอัปเวอร์ชันต้องแก้ทุกบรรทัด import ในโปรเจกต์พร้อมกัน
export const FIREBASE_VERSION = "12.18.0";

// ค่าตั้งต้นของโปรเจกต์ Firebase ตัวจริง
// คีย์ชุดนี้เป็นคีย์ฝั่งเบราว์เซอร์ ไม่ใช่ความลับ ตัวที่กันข้อมูลจริง ๆ คือ firestore.rules
export const firebaseConfig = {
  apiKey: "AIzaSyBvKUwm7PknQijCSRFPFwx2fLrFJw-iAZA",
  authDomain: "leaveeasy-korakot.firebaseapp.com",
  projectId: "leaveeasy-korakot",
  storageBucket: "leaveeasy-korakot.firebasestorage.app",
  messagingSenderId: "285037616930",
  appId: "1:285037616930:web:d13afde266eb385a320f7b"
};

// hasConfig บอกว่า "กรอกค่าตั้งต้นครบหรือยัง"
// มีไว้ให้หน้าจอขึ้นข้อความอธิบายแทนที่จะพังเป็น error ดิบ ๆ ถ้าลืมกรอก
function ดูว่ากรอกค่าครบไหม(cfg) {
  const ต้องมี = ["apiKey", "authDomain", "projectId", "appId"];
  return ต้องมี.every((ช่อง) => {
    const ค่า = cfg[ช่อง];
    if (typeof ค่า !== "string" || ค่า.trim() === "") return false;
    // กันค่าตัวอย่างที่คัดลอกมาแล้วลืมแทนที่
    return !/^(YOUR|XXX|TODO)/i.test(ค่า);
  });
}

export const hasConfig = ดูว่ากรอกค่าครบไหม(firebaseConfig);

// useEmulator — สวิตช์เดียวที่ตัดสินว่าแอปจะคุยกับ "ฐานจำลอง" หรือ "ฐานจริง"
//
// เงื่อนไขต้องเป๊ะแบบนี้ เพราะพอร์ต 5050 คือ hosting ของ emulator
// ส่วน `npm run dev` เปิดที่พอร์ต 3000 ซึ่งคุยกับฐานข้อมูลจริง
// ถ้าเงื่อนไขนี้เพี้ยน ชุดทดสอบอัตโนมัติจะไปล้างและเขียนทับข้อมูลจริง
export const useEmulator =
  typeof location !== "undefined" &&
  location.hostname === "localhost" &&
  location.port === "5050";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ต้องต่อ emulator ให้เสร็จ "ก่อน" มีการอ่าน-เขียนครั้งแรก
// ถ้าเรียกทีหลัง Firebase จะโยน error ว่าต่อไม่ได้แล้ว
// ไฟล์นี้ถูก import เป็นไฟล์แรกเสมอ จึงเป็นที่ที่ปลอดภัยที่สุดในการเรียก
if (useEmulator) {
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
  } catch (err) {
    // เกิดได้กรณีเดียวคือมีคนต่อไปแล้ว (เช่นโหลดโมดูลซ้ำ) ไม่ใช่เรื่องร้ายแรง
    console.warn("ต่อ Firestore emulator ซ้ำ", err);
  }
}

// ส่งต่อคำสั่ง Firestore ที่โมดูลอื่นต้องใช้ ออกไปจาก "ประตูเดียว" นี้
// js/data.js จะ import จากที่นี่ ไม่ใช่จาก CDN โดยตรง
export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
};
