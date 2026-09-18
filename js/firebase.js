// ─────────────────────────────────────────────────────────────
// js/firebase.js — จุดเชื่อมต่อ Firebase ของทั้งเว็บ
//
// ไฟล์นี้ที่เดียวที่รู้ค่าตั้งค่าของโปรเจกต์ หน้าอื่นแค่ขอ db ไปใช้
// ถ้าย้ายโปรเจกต์ Firebase แก้ที่นี่ไฟล์เดียว ทุกหน้าเปลี่ยนตาม
//
// เรียก Firebase จาก CDN ของ Google ตรง ๆ เพราะใบงานนี้ห้ามมีขั้นตอน build
//    ตรึงเลขเวอร์ชันไว้ (12.18.0) เพื่อไม่ให้เว็บพังเองตอน Google ออกรุ่นใหม่
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore, connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ค่าชุดนี้ไม่ใช่ความลับ — ใครเปิดเว็บก็เห็นได้ และเอาขึ้น GitHub ได้
//    ตัวที่กันคนแปลกหน้าจริง ๆ คือ Security Rules ในไฟล์ firestore.rules
const firebaseConfig = {
  apiKey: "AIzaSyBvKUwm7PknQijCSRFPFwx2fLrFJw-iAZA",
  authDomain: "leaveeasy-korakot.firebaseapp.com",
  projectId: "leaveeasy-korakot",
  storageBucket: "leaveeasy-korakot.firebasestorage.app",
  messagingSenderId: "285037616930",
  appId: "1:285037616930:web:d13afde266eb385a320f7b",
  measurementId: "G-SQV03R2K4D"
};

// ตรวจว่ามีการใส่ค่าตั้งค่าจริงหรือยัง (เผื่อมีคนก๊อป repo ไปแล้วยังไม่ได้ใส่ของตัวเอง)
export const ตั้งค่าครบแล้ว =
  typeof firebaseConfig.apiKey === "string" &&
  firebaseConfig.apiKey.startsWith("AIza") &&
  Boolean(firebaseConfig.projectId);

// ชื่อเดียวกับที่โค้ดตัวอย่างของผู้สอน (week7-end) ใช้ จะได้ไม่ต้องแก้ทุกหน้า
export const hasConfig = ตั้งค่าครบแล้ว;

export const app = initializeApp(firebaseConfig);

// db = ประตูเข้าคลังเก็บข้อมูล Firestore · หน้าอื่นเขียน import { db } from "./firebase.js"
export const db = getFirestore(app);

// โหมดทดสอบในเครื่อง: เปิดผ่าน `firebase emulators:start` (http://localhost:5050)
// จะคุยกับฐานข้อมูลจำลองในเครื่องแทนของจริง — ลองกฎ ลองสวมรอยได้โดยไม่แตะข้อมูลจริง
// ส่วน `npm run dev` (พอร์ตอื่น) และเว็บออนไลน์ ยังใช้ฐานข้อมูลจริงเหมือนเดิม
export const ใช้ฐานจำลอง = location.hostname === "localhost" && location.port === "5050";
if (ใช้ฐานจำลอง) connectFirestoreEmulator(db, "localhost", 8080);

// ส่งต่อคำสั่งของ Firestore ที่หน้าอื่นต้องใช้ จากเวอร์ชันเดียวกับข้างบน
// ถ้าแต่ละหน้าไป import คนละเวอร์ชันเอง Firebase จะมองว่าเป็นคนละแอป แล้วล็อกอินหายเงียบ ๆ
export {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
