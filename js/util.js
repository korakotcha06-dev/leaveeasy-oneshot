// ─────────────────────────────────────────────────────────────
// js/util.js — ตัวช่วยเล็ก ๆ ที่ทุกหน้าจอใช้ร่วมกัน
//
// ไฟล์นี้ตั้งใจให้ "ไม่รู้จัก Firebase เลย" จะได้เอาไปเทสหรือเอาไปใช้ซ้ำได้ง่าย
// มีแค่ 4 เรื่อง คือ กันข้อความอันตราย · จัดรูปแบบวันที่ · ป้ายสถานะ · แสดง error
// ─────────────────────────────────────────────────────────────

// ── สถานะ 3 ค่าตามสเปกหัวข้อ 6 ───────────────────────────────
// เขียนไว้ที่เดียว เพราะสะกดผิดตัวเดียว Firestore จะถือเป็นคนละค่าและพังแบบเงียบ ๆ
export const STATUS = {
  PENDING: "รอพิจารณา",
  APPROVED: "อนุมัติ",
  REJECTED: "ไม่อนุมัติ"
};

export const ALL_STATUS = [STATUS.PENDING, STATUS.APPROVED, STATUS.REJECTED];

// ── 1. กันข้อความอันตรายก่อนยัดเข้า innerHTML ────────────────
//
// ทำไมต้องมี: เหตุผลการลาและความเห็นเป็นข้อความที่ผู้ใช้พิมพ์เอง
// ถ้าใครพิมพ์ <script> ลงไปแล้วเราเอาไปต่อสตริงใส่ innerHTML ตรง ๆ
// เบราว์เซอร์จะรันโค้ดนั้นจริง (ช่องโหว่ XSS)
// กฎของโปรเจกต์นี้คือ ข้อความของผู้ใช้ทุกตัวต้องผ่าน escapeHtml ก่อนเสมอ
// ถ้าไม่ต้องการ HTML เลย ใช้ element.textContent จะปลอดภัยกว่าและเร็วกว่า
export function escapeHtml(ค่า) {
  if (ค่า === null || ค่า === undefined) return "";
  return String(ค่า)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── 2. วันที่ ────────────────────────────────────────────────

const เดือนย่อไทย = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

// รับสตริงรูปแบบ YYYY-MM-DD แล้วคืนค่าเดิม (กันค่าว่าง/ค่าพัง)
// ใช้เวลาที่ต้องการให้หน้าจอแสดงเลขวันที่ตรงกับที่เก็บใน Firestore เป๊ะ ๆ
// เช่นตารางในหน้ารายการ ซึ่งชุดทดสอบอัตโนมัติอ่านค่าจากตรงนั้น
export function formatDate(iso) {
  if (typeof iso !== "string") return "";
  const ตรงรูปแบบ = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim());
  return ตรงรูปแบบ ? iso.trim() : "";
}

// แปลง YYYY-MM-DD เป็นวันที่แบบไทย เช่น "7 ก.ย. 2569"
// ปีบวก 543 เพราะข้อมูลเก็บเป็น ค.ศ. แต่คนอ่านหน้าจอเป็นคนไทย
// ใช้กับที่ที่ต้องการความอ่านง่ายมากกว่าความตรงตัวอักษร
export function formatThaiDate(iso) {
  const ตรง = formatDate(iso);
  if (!ตรง) return "";
  const [ปี, เดือน, วัน] = ตรง.split("-").map(Number);
  return `${วัน} ${เดือนย่อไทย[เดือน - 1]} ${ปี + 543}`;
}

// ช่วงวันลา เช่น "2026-09-07 ถึง 2026-09-09"
// ถ้าลาวันเดียว (เริ่ม = สิ้นสุด) แสดงวันเดียวพอ ไม่ต้องเขียนซ้ำ
export function formatDateRange(เริ่ม, สิ้นสุด) {
  const ก = formatDate(เริ่ม);
  const ข = formatDate(สิ้นสุด);
  if (!ก && !ข) return "";
  if (!ข || ก === ข) return ก;
  if (!ก) return ข;
  return `${ก} ถึง ${ข}`;
}

// แปลงค่า createdAt ที่อ่านกลับมาจาก Firestore ให้เป็นข้อความอ่านได้
//
// ค่าที่รับได้มี 3 แบบ เพราะ Firestore คืนค่าไม่เหมือนกันตามจังหวะ
//   1. Timestamp ของ Firestore (มีเมท็อด toDate)
//   2. Date ธรรมดา
//   3. null — เกิดตอนที่เพิ่งเขียนด้วย serverTimestamp() แล้วอ่านกลับทันที
//      เพราะเวลาจริงถูกเติมที่ฝั่งเซิร์ฟเวอร์ ยังเดินทางกลับมาไม่ถึง
//      กรณีนี้ต้องไม่พัง ให้คืนค่าว่างไปก่อน เดี๋ยวโหลดรอบหน้าก็มีค่า
export function toDate(ค่า) {
  if (!ค่า) return null;
  if (typeof ค่า.toDate === "function") return ค่า.toDate();
  if (ค่า instanceof Date) return ค่า;
  if (typeof ค่า === "string" || typeof ค่า === "number") {
    const d = new Date(ค่า);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// "1 ก.ย. 2569 09:15" — ใช้กับวันที่ยื่นใบลาและเวลาที่เขียนความเห็น
export function formatTimestamp(ค่า) {
  const d = toDate(ค่า);
  if (!d) return "";
  const วัน = d.getDate();
  const เดือน = เดือนย่อไทย[d.getMonth()];
  const ปี = d.getFullYear() + 543;
  const ชม = String(d.getHours()).padStart(2, "0");
  const นาที = String(d.getMinutes()).padStart(2, "0");
  return `${วัน} ${เดือน} ${ปี} ${ชม}:${นาที}`;
}

// ใช้เรียงลำดับ "ใหม่ไปเก่า" โดยไม่พังเมื่อ createdAt ยังเป็น null
// ค่า null ถือว่าใหม่ที่สุด เพราะแปลว่าเพิ่งเขียนเมื่อกี้นี้เอง
export function timeValue(ค่า) {
  const d = toDate(ค่า);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}

// ── 3. ป้ายสถานะ ─────────────────────────────────────────────

// เลือกชื่อคลาสของป้ายตามสถานะ (สีกำหนดไว้ใน css/style.css)
// รอพิจารณา = เหลือง · อนุมัติ = เขียว · ไม่อนุมัติ = แดง
export function statusClass(status) {
  if (status === STATUS.APPROVED) return "badge badge-approved";
  if (status === STATUS.REJECTED) return "badge badge-rejected";
  return "badge badge-pending";
}

// คืน HTML ของป้ายสถานะ พร้อมใส่ data-testid ให้ถ้าส่งมา
// ข้อความสถานะผ่าน escapeHtml ไว้ด้วย แม้ค่าจะมาจากระบบเอง
// เพราะวันหนึ่งอาจมีข้อมูลเพี้ยนหลุดเข้ามาจากฐานข้อมูล
export function statusBadgeHtml(status, testId = "") {
  const ป้ายทดสอบ = testId ? ` data-testid="${escapeHtml(testId)}"` : "";
  return `<span class="${statusClass(status)}"${ป้ายทดสอบ}>${escapeHtml(status)}</span>`;
}

// ── 4. ข้อความผิดพลาด ────────────────────────────────────────

// แปลง error ของ Firebase เป็นภาษาไทยที่คนอ่านรู้เรื่อง
// รหัสดิบอย่าง auth/invalid-credential ไม่ช่วยให้ผู้ใช้รู้ว่าต้องทำอะไรต่อ
export function describeError(err) {
  const รหัส = err && err.code ? String(err.code) : "";
  const ตาราง = {
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/missing-password": "กรุณากรอกรหัสผ่าน",
    "auth/weak-password": "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร",
    "auth/email-already-in-use": "อีเมลนี้มีผู้ใช้แล้ว กรุณาเข้าสู่ระบบแทน",
    "auth/user-not-found": "ไม่พบผู้ใช้นี้ในระบบ",
    "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/too-many-requests": "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
    "auth/network-request-failed": "เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต",
    "permission-denied": "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
    "unavailable": "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    "not-found": "ไม่พบข้อมูลที่ต้องการ"
  };
  if (ตาราง[รหัส]) return ตาราง[รหัส];
  if (err && err.message) return String(err.message);
  return "เกิดข้อผิดพลาดที่ไม่คาดคิด";
}

// หา element ด้วย data-testid — เขียนสั้น ๆ ไว้เพราะทุกหน้าต้องใช้
export function byTestId(testId, root = document) {
  return root.querySelector(`[data-testid="${testId}"]`);
}

// แสดงข้อความผิดพลาดในช่อง error-message ของหน้านั้น
// รับได้ทั้ง element และสตริง (ถือเป็น data-testid)
// ใช้ textContent ไม่ใช่ innerHTML เพราะข้อความอาจมาจากสิ่งที่ผู้ใช้พิมพ์
export function showError(เป้าหมาย, ข้อความ) {
  const el = typeof เป้าหมาย === "string" ? byTestId(เป้าหมาย) : เป้าหมาย;
  if (!el) {
    // หน้าจอไม่มีที่แสดง ก็อย่างน้อยให้เห็นใน console ไม่ใช่เงียบหาย
    console.error("ไม่พบที่แสดงข้อความผิดพลาด:", ข้อความ);
    return;
  }
  el.textContent = ข้อความ || "";
  el.hidden = !ข้อความ;
}

export function clearError(เป้าหมาย) {
  showError(เป้าหมาย, "");
}
