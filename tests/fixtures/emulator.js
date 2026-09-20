// ─────────────────────────────────────────────────────────────
// tests/fixtures/emulator.js — คุยกับ Firebase emulator ตรง ๆ ผ่าน REST
//
// ทำไมไม่ใช้ firebase-admin: admin SDK ต้องมีไฟล์ service account
// ซึ่งเป็นความลับ เอาขึ้น GitHub ไม่ได้ และใบงานนี้ห้ามมีขั้นตอน build
// emulator เปิดช่อง REST ให้อยู่แล้ว และรับ header "Authorization: Bearer owner"
// เป็นสิทธิ์ผู้ดูแล — ข้าม firestore.rules ได้ จึงจัดฉากข้อมูลได้ทุกแบบ
//
// สำคัญมาก สิทธิ์ owner นี้ใช้ได้กับ emulator เท่านั้น ยิงใส่ของจริงไม่ได้ผล
//    และทุก URL ในไฟล์นี้ชี้ไป 127.0.0.1 เสมอ จึงแตะฐานข้อมูลจริงไม่ได้เลย
// ─────────────────────────────────────────────────────────────

const {
  PROJECT_ID, FIRESTORE_ORIGIN, AUTH_ORIGIN, TEST_USERS, HOST, PORTS
} = require("./config");

const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };

const FIRESTORE_DOCS = `${FIRESTORE_ORIGIN}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── ตัวช่วยยิง HTTP ที่โยน error พร้อมเนื้อความจริง ─────────────
// ถ้าปล่อยให้ fetch เงียบ ๆ เทสจะล้มแบบอ่านไม่ออกว่าพังตรงไหน
async function ยิง(method, url, body) {
  let ผล;
  try {
    ผล = await fetch(url, {
      method,
      headers: OWNER,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (e) {
    throw new Error(
      `ต่อ Firebase emulator ไม่ได้ที่ ${url}\n` +
      "ตรวจว่ารัน `npm run emulators` ไว้อีกหน้าต่างหนึ่งแล้วหรือยัง\n" +
      `สาเหตุเดิม: ${e.message}`
    );
  }

  if (!ผล.ok && ผล.status !== 404) {
    const ข้อความ = await ผล.text();
    throw new Error(`${method} ${url} ล้มเหลว (${ผล.status})\n${ข้อความ}`);
  }
  return ผล;
}

// ── แปลงค่า JavaScript เป็นรูปแบบค่าของ Firestore REST ────────
function toValue(ค่า) {
  if (ค่า === null || ค่า === undefined) return { nullValue: null };
  if (typeof ค่า === "string") return { stringValue: ค่า };
  if (typeof ค่า === "boolean") return { booleanValue: ค่า };
  if (typeof ค่า === "number") {
    return Number.isInteger(ค่า) ? { integerValue: String(ค่า) } : { doubleValue: ค่า };
  }
  if (ค่า instanceof Date) return { timestampValue: ค่า.toISOString() };
  if (Array.isArray(ค่า)) return { arrayValue: { values: ค่า.map(toValue) } };
  if (typeof ค่า === "object") return { mapValue: { fields: toFields(ค่า) } };
  throw new Error(`แปลงค่าชนิด ${typeof ค่า} เป็นค่าของ Firestore ไม่ได้`);
}

function toFields(ก้อน) {
  const fields = {};
  for (const ชื่อช่อง of Object.keys(ก้อน)) fields[ชื่อช่อง] = toValue(ก้อน[ชื่อช่อง]);
  return fields;
}

// ── แปลงกลับจากรูปแบบของ Firestore เป็นค่า JavaScript ─────────
function fromValue(ค่า) {
  if (!ค่า || typeof ค่า !== "object") return ค่า;
  if ("nullValue" in ค่า) return null;
  if ("stringValue" in ค่า) return ค่า.stringValue;
  if ("booleanValue" in ค่า) return ค่า.booleanValue;
  if ("integerValue" in ค่า) return Number(ค่า.integerValue);
  if ("doubleValue" in ค่า) return ค่า.doubleValue;
  if ("timestampValue" in ค่า) return new Date(ค่า.timestampValue);
  if ("arrayValue" in ค่า) return (ค่า.arrayValue.values || []).map(fromValue);
  if ("mapValue" in ค่า) return fromFields(ค่า.mapValue.fields || {});
  return ค่า;
}

function fromFields(fields) {
  const ก้อน = {};
  for (const ชื่อช่อง of Object.keys(fields)) ก้อน[ชื่อช่อง] = fromValue(fields[ชื่อช่อง]);
  return ก้อน;
}

// ═════════════════════════════════════════════════════════════
// ล้างข้อมูล
// ═════════════════════════════════════════════════════════════

// ลบทุกเอกสารใน Firestore ของ emulator (ไม่แตะบัญชีผู้ใช้)
async function clearFirestore() {
  await ยิง("DELETE", `${FIRESTORE_ORIGIN}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
}

// ลบทุกบัญชีใน Auth emulator
async function clearAuth() {
  await ยิง("DELETE", `${AUTH_ORIGIN}/emulator/v1/projects/${PROJECT_ID}/accounts`);
}

// ล้างทั้งสองฝั่งให้กลับไปเป็นกระดาษเปล่า
async function resetEmulator() {
  await clearFirestore();
  await clearAuth();
}

// ═════════════════════════════════════════════════════════════
// เอกสารใน Firestore
// ═════════════════════════════════════════════════════════════

// path = "users/uid-employee-u001" หรือ "leaveRequests/lr001/approvals/ap001"
// เขียนทับทั้งเอกสาร (ช่องที่ไม่ได้ส่งมาจะหายไป) · ไม่มีอยู่ก็สร้างให้
async function writeDoc(path, ข้อมูล) {
  await ยิง("PATCH", `${FIRESTORE_DOCS}/${path}`, { fields: toFields(ข้อมูล) });
  return { id: path.split("/").pop(), path, ...ข้อมูล };
}

// คืนค่าเป็น object ธรรมดา หรือ null ถ้าไม่มีเอกสารนั้น
async function readDoc(path) {
  const ผล = await ยิง("GET", `${FIRESTORE_DOCS}/${path}`);
  if (ผล.status === 404) return null;
  const ก้อน = await ผล.json();
  return { id: path.split("/").pop(), ...fromFields(ก้อน.fields || {}) };
}

async function deleteDoc(path) {
  await ยิง("DELETE", `${FIRESTORE_DOCS}/${path}`);
}

// อ่านทั้งโฟลเดอร์ · collectionPath = "leaveRequests" หรือ "leaveRequests/lr001/approvals"
async function listDocs(collectionPath) {
  const ผล = await ยิง("GET", `${FIRESTORE_DOCS}/${collectionPath}?pageSize=300`);
  if (ผล.status === 404) return [];
  const ก้อน = await ผล.json();
  return (ก้อน.documents || []).map((เอกสาร) => ({
    id: เอกสาร.name.split("/").pop(),
    ...fromFields(เอกสาร.fields || {})
  }));
}

// ═════════════════════════════════════════════════════════════
// บัญชีผู้ใช้ใน Auth emulator
// ═════════════════════════════════════════════════════════════

// สร้างบัญชีหนึ่งบัญชีโดยกำหนด uid เองได้ (ช่องทางผู้ดูแลของ emulator)
// uid คงที่ทำให้ seed ใบลาล่วงหน้าได้ โดยไม่ต้องรอผลจากการสมัคร
async function createAuthUser({ uid, email, password, name }) {
  await ยิง("POST", `${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`, {
    localId: uid,
    email,
    password,
    displayName: name,
    emailVerified: true
  });
  return { uid, email, password, name };
}

// สร้างบัญชีทดสอบครบ 3 บทบาทใน Auth emulator
//
// ระวัง ทำแค่ฝั่ง Auth เท่านั้น ไม่ได้เขียนเอกสารโปรไฟล์ users/{uid} ให้ด้วย
//    เพราะไฟล์นี้จงใจไม่รู้จักโครงข้อมูลของแอป จะได้ไม่พังตามเวลา schema เปลี่ยน
//    ส่วนที่เขียน users/{uid} พร้อม role อยู่ที่ seedUserProfiles() ใน app.js
async function createTestAuthUsers() {
  for (const บทบาท of Object.keys(TEST_USERS)) {
    await createAuthUser(TEST_USERS[บทบาท]);
  }
  return TEST_USERS;
}

// ── ตรวจว่า emulator เปิดอยู่จริงไหม ─────────────────────────
// ใช้ตอนเริ่มชุดเทส เพื่อให้ล้มพร้อมคำอธิบาย แทนที่จะล้มแบบ timeout ลึก ๆ
async function assertEmulatorRunning() {
  await ยิง("GET", `${FIRESTORE_DOCS}/pingCheck/pingCheck`);   // 404 ก็ถือว่าติดต่อได้
  await ยิง("GET", `${AUTH_ORIGIN}/emulator/v1/projects/${PROJECT_ID}/config`);
  return true;
}

// ── รอจน emulator ทั้งสามตัวพร้อมจริง ────────────────────────
//
// สำคัญมาก ทำไมต้องมีตัวนี้ ทั้งที่ Playwright มี webServer ให้แล้ว
//    Emulator Hub (พอร์ต 4400) ขึ้นก่อนเพื่อน แล้ว Firestore / Auth / hosting
//    ค่อยทยอยขึ้นตามทีหลังอีกหลายวินาที
//    ถ้าเชื่อ Hub อย่างเดียว เทสจะเริ่มวิ่งตอนที่ Firestore ยังไม่ฟังพอร์ต
//    แล้วล้มด้วย ECONNREFUSED แบบงง ๆ ตอนเปิดเครื่องใหม่ ๆ
//
// เช็คทีละตัวว่า "มีคนรับสายที่พอร์ตนั้น" พอ — ตอบ 404 ก็ถือว่าพร้อม
// สำคัญสำหรับ hosting เพราะหน้าแรกอาจยังไม่มีไฟล์ แต่เซิร์ฟเวอร์ทำงานแล้ว
async function waitForEmulator({ timeoutMs = 90_000, intervalMs = 500 } = {}) {
  const จุดตรวจ = [
    { ชื่อ: "Firestore", url: `${FIRESTORE_ORIGIN}/` },
    { ชื่อ: "Authentication", url: `${AUTH_ORIGIN}/emulator/v1/projects/${PROJECT_ID}/config` },
    { ชื่อ: "Hosting", url: `http://${HOST}:${PORTS.hosting}/` }
  ];

  const หมดเวลาเมื่อ = Date.now() + timeoutMs;
  let ยังไม่พร้อม = จุดตรวจ.map((จุด) => จุด.ชื่อ);
  let รอบแรก = true;

  while (Date.now() < หมดเวลาเมื่อ) {
    const ผลตรวจ = await Promise.all(
      จุดตรวจ.map(async (จุด) => {
        try {
          await fetch(จุด.url);      // ได้ response อะไรก็ได้ = พอร์ตนั้นมีคนรับสาย
          return null;
        } catch {
          return จุด.ชื่อ;
        }
      })
    );

    ยังไม่พร้อม = ผลตรวจ.filter(Boolean);
    if (ยังไม่พร้อม.length === 0) return true;

    // ถ้ารอบแรกไม่มีใครรับสายเลยสักพอร์ต แปลว่ายังไม่ได้เปิด emulator
    // กรณีนี้ไม่ต้องรอให้ครบเวลา — บอกวิธีแก้ทันทีดีกว่าปล่อยให้ค้างนาน ๆ
    // (ถ้ามีบางตัวตอบแล้ว แปลว่ากำลังทยอยเปิดอยู่ ให้รอต่อจนครบ)
    if (รอบแรก && ยังไม่พร้อม.length === จุดตรวจ.length) break;
    รอบแรก = false;

    await new Promise((ปล่อย) => setTimeout(ปล่อย, intervalMs));
  }

  throw new Error(
    `Firebase emulator ยังไม่พร้อม: ${ยังไม่พร้อม.join(", ")}\n` +
    "\n" +
    "วิธีแก้ที่พบบ่อยที่สุด — เปิด emulator ค้างไว้อีกหน้าต่างหนึ่งก่อนรันเทส\n" +
    "    npm run emulators\n" +
    "หรือใช้คำสั่งเดียวจบ ที่เปิด-รัน-ปิดให้เอง\n" +
    "    npm run test:ci\n" +
    "\n" +
    "สิ่งที่ต้องตรวจ\n" +
    "  1. เปิด emulator ไว้หรือยัง — `npm run emulators`\n" +
    "  2. Firestore emulator ต้องใช้ Java · brew ติดตั้งแบบ keg-only\n" +
    "     ทุกคำสั่งที่เปิด emulator ต้องนำหน้าด้วย\n" +
    '     PATH="/opt/homebrew/opt/openjdk/bin:$PATH"\n' +
    "  3. มีของเก่าค้างพอร์ตอยู่ไหม — `lsof -nP -iTCP:5050 -iTCP:8080 -iTCP:9099 -sTCP:LISTEN`"
  );
}

module.exports = {
  FIRESTORE_DOCS,
  toFields,
  fromFields,
  clearFirestore,
  clearAuth,
  resetEmulator,
  writeDoc,
  readDoc,
  deleteDoc,
  listDocs,
  createAuthUser,
  createTestAuthUsers,
  assertEmulatorRunning,
  waitForEmulator
};
