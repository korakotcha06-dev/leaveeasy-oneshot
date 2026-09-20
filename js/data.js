// ─────────────────────────────────────────────────────────────
// js/data.js — ไฟล์เดียวในระบบที่แตะโฟลเดอร์ (collection) บน Firestore
//
// ทำไมต้องรวมไว้ที่เดียว
//   ชื่อช่องข้อมูลบน Firestore เป็นตัวพิมพ์เล็ก-ใหญ่สำคัญ พิมพ์ status เป็น Status
//   จะกลายเป็นคนละช่อง ไม่มี error ขึ้น แต่ข้อมูลหายไปเฉย ๆ
//   ถ้าปล่อยให้ทุกหน้าจอเขียนคำสั่งเองกระจัดกระจาย เราจะพิมพ์ชื่อช่องซ้ำ 6-7 ที่
//   และโอกาสพิมพ์ผิดก็เพิ่มตามไปด้วย ไฟล์นี้จึงเป็นที่เดียวที่มีชื่อช่องอยู่จริง
//
//   หน้าจอทุกหน้าเรียกฟังก์ชันจากไฟล์นี้ และไม่ import จาก firebase.js เอง
// ─────────────────────────────────────────────────────────────

import {
  db,
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
  serverTimestamp
} from "./firebase.js";

import { STATUS, ALL_STATUS, timeValue } from "./util.js";

// ชื่อโฟลเดอร์บน Firestore เขียนติดกันไม่มีขีดล่าง ตามสเปกหัวข้อ 5.2
const LEAVE_REQUESTS = "leaveRequests";
const LEAVE_TYPES = "leaveTypes";
const USERS = "users";
const APPROVALS = "approvals";

// แปลงเอกสารหนึ่งใบให้เป็นก้อนข้อมูลธรรมดาที่มี id ติดมาด้วย
// Firestore เก็บชื่อไฟล์ (document id) แยกจากเนื้อข้อมูล แต่หน้าจอต้องใช้ทั้งคู่
function แปลงเอกสาร(snap) {
  return { id: snap.id, ...snap.data() };
}

// ── ใบขอลา ───────────────────────────────────────────────────

/**
 * อ่านรายการใบขอลา เรียงใหม่ไปเก่า
 *
 * ส่ง requesterId มาด้วยเมื่อผู้ใช้เป็น employee · ไม่ต้องส่งเมื่อเป็น manager หรือ hr
 *
 * ทำไมต้องแยก: กฎความปลอดภัยของ Firestore ตัดสินทั้ง "คำสั่งค้นหา" ไม่ใช่ตัดทีละแถว
 * employee ที่ขอทั้งโฟลเดอร์จะถูกปฏิเสธทั้งคำสั่ง ได้ permission error กลับมา
 * ไม่ใช่ได้รายการสั้น ๆ ของตัวเอง จึงต้องใส่ where("requesterId","==",uid) ไปตั้งแต่ต้น
 */
export async function listLeaveRequests({ requesterId } = {}) {
  const โฟลเดอร์ = collection(db, LEAVE_REQUESTS);
  const คำสั่ง = requesterId
    ? query(โฟลเดอร์, where("requesterId", "==", requesterId))
    : query(โฟลเดอร์);

  const ผล = await getDocs(คำสั่ง);
  const รายการ = ผล.docs.map(แปลงเอกสาร);

  // เรียงลำดับฝั่งเบราว์เซอร์ ไม่ใช่สั่ง orderBy ให้ Firestore
  //
  // เหตุผล: where + orderBy คนละช่องกัน Firestore ต้องการ "composite index"
  // ที่ต้องไปกดสร้างใน Console ก่อน ถ้าไม่มี คำสั่งจะล้มทันทีบนฐานจริง
  // (ฐานจำลองใจดีกว่า ยอมให้ผ่าน จึงเป็นกับดักที่เจอตอนขึ้นของจริงเท่านั้น)
  // ใบลาของงานนี้มีหลักสิบใบ เรียงในเบราว์เซอร์จึงเร็วพอและไม่ต้องพึ่ง index
  รายการ.sort((ก, ข) => timeValue(ข.createdAt) - timeValue(ก.createdAt));
  return รายการ;
}

/** อ่านใบขอลาใบเดียว คืน null เมื่อไม่พบ */
export async function getLeaveRequest(id) {
  const snap = await getDoc(doc(db, LEAVE_REQUESTS, id));
  return snap.exists() ? แปลงเอกสาร(snap) : null;
}

/**
 * สร้างใบขอลาใหม่ คืนรหัสของใบที่สร้าง
 *
 * status และ createdAt ถูกตั้งโดยไฟล์นี้เสมอ ไม่รับจากหน้าจอ
 *   - status เริ่มที่ "รอพิจารณา" ตามสเปกหัวข้อ 6 ผู้ใช้เลือกเองไม่ได้
 *   - createdAt ใช้ serverTimestamp() คือให้เซิร์ฟเวอร์ Firestore เป็นคนจดเวลา
 *     ไม่ใช้นาฬิกาของเครื่องผู้ใช้ เพราะเครื่องผู้ใช้ตั้งเวลาผิดได้
 *
 * ช่องที่เขียนลงไปถูกกำหนดไว้ชัดเจนที่นี่ ไม่ใช่ ...fields ทั้งก้อน
 * เพื่อกันช่องแปลกปลอมหลุดลงฐานข้อมูล และกันหน้าจอแอบตั้ง status เอง
 */
export async function createLeaveRequest(fields = {}) {
  const ข้อมูล = {
    title: fields.title || "",
    reason: fields.reason || "",
    status: STATUS.PENDING,
    requesterId: fields.requesterId || "",
    requesterName: fields.requesterName || "",
    approverId: fields.approverId || "",
    approverName: fields.approverName || "",
    leaveTypeId: fields.leaveTypeId || "",
    leaveTypeName: fields.leaveTypeName || "",
    startDate: fields.startDate || "",
    endDate: fields.endDate || "",
    createdAt: serverTimestamp()
  };

  const อ้างอิง = await addDoc(collection(db, LEAVE_REQUESTS), ข้อมูล);
  return อ้างอิง.id;
}

/**
 * เปลี่ยนสถานะใบขอลา — เขียนเฉพาะช่อง status ช่องเดียวเท่านั้น
 *
 * ห้ามใช้ setDoc ที่นี่เด็ดขาด เพราะ setDoc เขียนทับทั้งไฟล์
 * ช่องอื่นที่ไม่ได้ส่งไปจะหายหมด · updateDoc แก้เฉพาะช่องที่ระบุ
 * และกฎความปลอดภัยก็ตรวจว่าการเขียนครั้งนี้แตะแค่ช่อง status จริงหรือเปล่า
 */
export async function updateLeaveStatus(id, status) {
  if (!ALL_STATUS.includes(status)) {
    // กันพิมพ์ผิดตั้งแต่ต้นทาง ดีกว่าปล่อยค่าเพี้ยนลงฐานข้อมูลแล้วตามแก้ทีหลัง
    throw new Error(`สถานะไม่ถูกต้อง: ${status}`);
  }
  await updateDoc(doc(db, LEAVE_REQUESTS, id), { status });
}

/** ลบใบขอลา (กฎความปลอดภัยอนุญาตเฉพาะเจ้าของใบ และเฉพาะตอนยังรอพิจารณา) */
export async function deleteLeaveRequest(id) {
  await deleteDoc(doc(db, LEAVE_REQUESTS, id));
}

// ── ความเห็นการอนุมัติ (โฟลเดอร์ย่อย approvals) ──────────────

/**
 * อ่านความเห็นทั้งหมดของใบลาหนึ่งใบ เรียงเก่าไปใหม่
 * เรียงแบบนี้เพราะอ่านเป็นบทสนทนาตามลำดับเวลา เหมือนอ่านแชท
 *
 * ใช้ orderBy ตรง ๆ ได้ เพราะไม่มี where คู่มาด้วย จึงไม่ต้องใช้ composite index
 */
export async function listApprovals(requestId) {
  const โฟลเดอร์ย่อย = collection(db, LEAVE_REQUESTS, requestId, APPROVALS);
  const ผล = await getDocs(query(โฟลเดอร์ย่อย, orderBy("createdAt", "asc")));
  return ผล.docs.map(แปลงเอกสาร);
}

/**
 * เพิ่มความเห็นหนึ่งรายการ คืนรหัสของความเห็นที่สร้าง
 * authorName จดซ้ำไว้ในความเห็นเลย เพื่อให้แสดงชื่อคนเขียนได้โดยไม่ต้องเปิดโฟลเดอร์ users
 */
export async function addApproval(requestId, { authorId, authorName, message }) {
  const อ้างอิง = await addDoc(
    collection(db, LEAVE_REQUESTS, requestId, APPROVALS),
    {
      authorId: authorId || "",
      authorName: authorName || "",
      message: message || "",
      createdAt: serverTimestamp()
    }
  );
  return อ้างอิง.id;
}

// ── ประเภทการลา ──────────────────────────────────────────────

/**
 * อ่านประเภทการลาทั้งหมด
 * ไม่ใส่ orderBy เพราะ Firestore เรียงตามชื่อไฟล์ให้อยู่แล้ว (lt001, lt002, lt003)
 * ซึ่งตรงกับลำดับในสเปกพอดี ส่วนการเรียงตามชื่อภาษาไทยจะได้ลำดับแปลก ๆ
 * เพราะ Firestore เทียบตามรหัสตัวอักษร ไม่ได้เทียบตามพจนานุกรมไทย
 */
export async function listLeaveTypes() {
  const ผล = await getDocs(collection(db, LEAVE_TYPES));
  return ผล.docs.map(แปลงเอกสาร);
}

/** เพิ่มประเภทการลา คืนรหัสที่สร้าง (เฉพาะ hr ตามกฎความปลอดภัย) */
export async function createLeaveType(name) {
  const อ้างอิง = await addDoc(collection(db, LEAVE_TYPES), {
    name: (name || "").trim()
  });
  return อ้างอิง.id;
}

/** แก้ชื่อประเภทการลา — แก้เฉพาะช่อง name */
export async function updateLeaveType(id, name) {
  await updateDoc(doc(db, LEAVE_TYPES, id), { name: (name || "").trim() });
}

/**
 * ลบประเภทการลา
 * หมายเหตุ: ใบลาเก่าจดชื่อประเภทไว้ในตัวเองแล้ว (leaveTypeName) จึงยังแสดงผลได้
 * ถึงประเภทต้นทางจะถูกลบไป เป็นผลพลอยได้ของการจดซ้ำตามสเปกหัวข้อ 5.3
 */
export async function deleteLeaveType(id) {
  await deleteDoc(doc(db, LEAVE_TYPES, id));
}

// ── ผู้ใช้ ────────────────────────────────────────────────────

/** อ่านโปรไฟล์ผู้ใช้หนึ่งคน คืน null เมื่อไม่พบ */
export async function getUser(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? แปลงเอกสาร(snap) : null;
}

/**
 * สร้างไฟล์โปรไฟล์ให้ผู้ใช้ที่เพิ่งสมัคร
 *
 * ใช้ setDoc ไม่ใช่ addDoc เพราะชื่อไฟล์ต้องเป็น uid จาก Firebase Auth เป๊ะ ๆ
 * กฎความปลอดภัยเทียบ users/{uid} กับ request.auth.uid ตรง ๆ
 * ถ้าปล่อยให้ Firestore สุ่มชื่อไฟล์ให้ จะหาโปรไฟล์ของคนที่ล็อกอินอยู่ไม่เจอเลย
 *
 * role ถูกบังคับเป็น "employee" ที่นี่ ไม่รับค่าจากหน้าจอ
 * การเลื่อนเป็น manager หรือ hr ทำใน Firebase Console เท่านั้น
 * (กฎความปลอดภัยก็ปฏิเสธการสมัครที่ขอ role อื่นอยู่แล้ว ตรงนี้คือด่านแรก)
 */
export async function createUserProfile(uid, { name, email }) {
  await setDoc(doc(db, USERS, uid), {
    name: (name || "").trim(),
    email: (email || "").trim(),
    role: "employee"
  });
}
