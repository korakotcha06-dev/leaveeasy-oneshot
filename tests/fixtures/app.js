// ─────────────────────────────────────────────────────────────
// tests/fixtures/app.js — ชั้นที่รู้จักตัวแอป
//
// เขียนตาม contract.md ไม่ได้เขียนตามซอร์สของแอป
//   - โครงข้อมูลและชื่อช่อง       contract.md หัวข้อ 1
//   - ข้อมูลตัวอย่าง               contract.md หัวข้อ 6
//   - data-testid                  contract.md หัวข้อ 5 (contract ตรึงไว้ให้แล้ว)
//
// ถ้าวันหนึ่งหน้าจอเปลี่ยน แต่ contract ยังเหมือนเดิม ไฟล์นี้ไม่ต้องแก้
// ถ้า contract เปลี่ยน ให้แก้ที่นี่ที่เดียว เทสทุกไฟล์จะตามมาเอง
// ─────────────────────────────────────────────────────────────

const { TEST_USERS, STATUS, PAGES, TESTID, PORTS } = require("./config");
const { resetEmulator, writeDoc, createTestAuthUsers } = require("./emulator");
const { LEAVE_TYPES, LEAVE_REQUESTS, APPROVALS, COUNTS } = require("./seed-data");

// ═════════════════════════════════════════════════════════════
// ใส่ข้อมูลตั้งต้นลง emulator
// ═════════════════════════════════════════════════════════════

// เขียนโปรไฟล์ผู้ใช้ users/{uid} ให้ครบ 3 บทบาท
//
// เขียนผ่านสิทธิ์ owner ของ emulator จึงตั้ง role เป็น manager / hr ได้เลย
// ถ้าสมัครผ่านหน้าเว็บ security rules จะบังคับให้ทุกคนเริ่มที่ employee เสมอ
// (contract.md หัวข้อ 9) ซึ่งจัดฉากเทสบทบาทอื่นไม่ได้
async function seedUserProfiles() {
  for (const บทบาท of Object.keys(TEST_USERS)) {
    const คน = TEST_USERS[บทบาท];
    await writeDoc(`users/${คน.uid}`, {
      name: คน.name,
      email: คน.email,
      role: คน.role
    });
  }
}

async function seedLeaveTypes() {
  for (const ประเภท of LEAVE_TYPES) {
    const { id, ...ช่องข้อมูล } = ประเภท;      // id เป็นชื่อไฟล์ ไม่ใช่ช่องข้อมูล
    await writeDoc(`leaveTypes/${id}`, ช่องข้อมูล);
  }
}

async function seedLeaveRequests() {
  for (const ใบ of LEAVE_REQUESTS) {
    const { id, ...ช่องข้อมูล } = ใบ;
    await writeDoc(`leaveRequests/${id}`, ช่องข้อมูล);
  }
}

async function seedApprovals() {
  for (const ความเห็น of APPROVALS) {
    const { id, requestId, ...ช่องข้อมูล } = ความเห็น;   // requestId อยู่ในเส้นทางแล้ว
    await writeDoc(`leaveRequests/${requestId}/approvals/${id}`, ช่องข้อมูล);
  }
}

// ═════════════════════════════════════════════════════════════
// seedEmulator — ตัวหลักที่เทสเรียกก่อนเริ่มทุกครั้ง
// ล้างทุกอย่าง แล้วใส่ข้อมูลตั้งต้นใหม่หมด เพื่อให้ทุกเทสเริ่มจากจุดเดียวกันเป๊ะ
// ═════════════════════════════════════════════════════════════
async function seedEmulator() {
  await resetEmulator();
  await createTestAuthUsers();     // บัญชี Auth 3 บทบาท (uid คงที่)
  await seedUserProfiles();        // users/{uid} พร้อม role
  await seedLeaveTypes();
  await seedLeaveRequests();
  await seedApprovals();
  return { users: TEST_USERS, counts: COUNTS };
}

// ล้างข้อมูลใบลาทิ้ง เหลือแค่บัญชีกับประเภทการลา
// ใช้กับเทสหน้าจอว่างเปล่า (empty state) ที่ contract.md หัวข้อ 4 บังคับให้มี
async function seedEmptyEmulator() {
  await resetEmulator();
  await createTestAuthUsers();
  await seedUserProfiles();
  await seedLeaveTypes();
  return { users: TEST_USERS };
}

// ═════════════════════════════════════════════════════════════
// ตัวช่วยจัดฉาก — สร้างข้อมูลเพิ่มเองในเทส
// ═════════════════════════════════════════════════════════════

let ตัวนับ = 0;

// สร้าง "ก้อนข้อมูลใบลา" ที่มีช่องครบตาม contract.md หัวข้อ 1
// ยังไม่เขียนลงฐานข้อมูล · ส่ง overrides มาทับช่องไหนก็ได้
//
//   makeLeaveRequest({ status: STATUS.APPROVED, requesterId: TEST_USERS.hr.uid })
function makeLeaveRequest(overrides = {}) {
  ตัวนับ += 1;
  const ผู้ขอ = TEST_USERS.employee;
  const ผู้อนุมัติ = TEST_USERS.manager;

  return {
    title: `ใบลาสำหรับทดสอบ ${ตัวนับ}`,
    reason: `เหตุผลสำหรับทดสอบ ${ตัวนับ}`,
    status: STATUS.PENDING,                 // ใบใหม่เริ่มที่ รอพิจารณา เสมอ
    requesterId: ผู้ขอ.uid,
    requesterName: ผู้ขอ.name,              // จดชื่อซ้ำไว้ เพราะ Firestore ไม่มี JOIN
    approverId: ผู้อนุมัติ.uid,
    approverName: ผู้อนุมัติ.name,
    leaveTypeId: "lt001",
    leaveTypeName: "ลาพักร้อน",
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    createdAt: new Date("2026-11-01T08:00:00+07:00"),
    ...overrides
  };
}

// สร้างใบลาแล้วเขียนลง emulator เลย
// ไม่ส่ง id มา จะตั้งให้เป็น lrtest001, lrtest002, … (ไม่ชนกับ lr001..lr005)
// คืนค่าพร้อมช่อง id เพื่อเอาไปต่อ URL ?id= ได้ทันที
async function createLeaveRequest(overrides = {}, id) {
  const ก้อน = makeLeaveRequest(overrides);
  const ชื่อไฟล์ = id || `lrtest${String(ตัวนับ).padStart(3, "0")}`;
  await writeDoc(`leaveRequests/${ชื่อไฟล์}`, ก้อน);
  return { id: ชื่อไฟล์, ...ก้อน };
}

function makeApproval(overrides = {}) {
  ตัวนับ += 1;
  const ผู้เขียน = TEST_USERS.manager;
  return {
    authorId: ผู้เขียน.uid,
    authorName: ผู้เขียน.name,
    message: `ความเห็นสำหรับทดสอบ ${ตัวนับ}`,
    createdAt: new Date("2026-11-01T09:00:00+07:00"),
    ...overrides
  };
}

async function createApproval(requestId, overrides = {}, id) {
  const ก้อน = makeApproval(overrides);
  const ชื่อไฟล์ = id || `aptest${String(ตัวนับ).padStart(3, "0")}`;
  await writeDoc(`leaveRequests/${requestId}/approvals/${ชื่อไฟล์}`, ก้อน);
  return { id: ชื่อไฟล์, requestId, ...ก้อน };
}

async function createLeaveType(id, name) {
  await writeDoc(`leaveTypes/${id}`, { name });
  return { id, name };
}

// ═════════════════════════════════════════════════════════════
// ล็อกอิน
// ═════════════════════════════════════════════════════════════

// ตัวช่วยหา element จาก data-testid — เทสไม่ต้องพิมพ์ CSS selector เอง
function byTestId(page, testid) {
  return page.locator(`[data-testid="${testid}"]`);
}

// กันพลาดเรื่องพอร์ต — ถ้าเทสไปเปิดพอร์ตอื่น ให้ล้มทันทีพร้อมบอกสาเหตุ
// ดีกว่าปล่อยให้เทสไปล้างข้อมูลจริงแล้วค่อยรู้ทีหลัง
function ตรวจพอร์ต(page) {
  const url = new URL(page.url());
  if (url.port !== String(PORTS.hosting)) {
    throw new Error(
      `เทสเปิดเว็บจาก ${url.origin} ซึ่งไม่ใช่ hosting ของ emulator\n` +
      `ต้องเป็น http://localhost:${PORTS.hosting} เท่านั้น เพราะแอปต่อฐานจำลอง` +
      `เมื่อ port === "${PORTS.hosting}" เท่านั้น\n` +
      "พอร์ต 3000 (npm run dev) คุยกับฐานข้อมูลจริง ห้ามใช้ในเทสเด็ดขาด"
    );
  }
}

// ═════════════════════════════════════════════════════════════
// signInAs — เข้าสู่ระบบด้วยบัญชีทดสอบตามบทบาท
//
//   await signInAs(page, "employee")                       → จบที่หน้ารายการใบลา
//   await signInAs(page, "manager", { goto: PAGES.dashboard })
//   await signInAs(page, "hr", { goto: detailUrl("lr001") })
//
// เมื่อคืนค่าแล้ว รับประกันว่า
//   - เบราว์เซอร์ล็อกอินอยู่จริง (แถบเมนูขึ้นชื่อคนนั้นแล้ว)
//   - อยู่ที่หน้าปลายทางที่ขอ และหน้านั้นโหลดข้อมูลเสร็จแล้ว
//
// คืนค่าเป็นข้อมูลบัญชี { uid, email, name, role, ... }
// ═════════════════════════════════════════════════════════════
async function signInAs(page, role, options = {}) {
  const คน = TEST_USERS[role];
  if (!คน) {
    throw new Error(
      `ไม่รู้จักบทบาท "${role}" — ใช้ได้เฉพาะ ${Object.keys(TEST_USERS).join(" / ")}`
    );
  }

  const ปลายทาง = options.goto || PAGES.leaveRequests;

  await page.goto(PAGES.login);
  ตรวจพอร์ต(page);

  await byTestId(page, TESTID.signinEmail).fill(คน.email);
  await byTestId(page, TESTID.signinPassword).fill(คน.password);

  // โค้ดล็อกอินมักผูกปุ่มหลังจากรู้สถานะ auth แล้วเท่านั้น
  // ถ้าเทสกดเร็วกว่านั้น จะไม่มีอะไรเกิดขึ้น และไม่มี error ให้เห็นด้วย
  // จึงกดซ้ำได้สูงสุด 3 ครั้ง จนกว่าจะหลุดจากหน้า login
  let พลาดล่าสุด = null;
  for (let ครั้งที่ = 1; ครั้งที่ <= 3; ครั้งที่ += 1) {
    await byTestId(page, TESTID.signinSubmit).click();
    try {
      await page.waitForFunction(
        () => !location.pathname.endsWith("/login.html"),
        undefined,
        { timeout: 5000 }
      );
      พลาดล่าสุด = null;
      break;
    } catch (e) {
      พลาดล่าสุด = e;

      // ถ้าแอปขึ้นข้อความผิดพลาด แปลว่ากดติดแล้วแต่ล็อกอินไม่ผ่านจริง — กดซ้ำไม่ช่วย
      const กล่องเตือน = byTestId(page, TESTID.errorMessage);
      if (await กล่องเตือน.isVisible().catch(() => false)) {
        const ข้อความ = ((await กล่องเตือน.textContent()) || "").trim();
        if (ข้อความ) {
          throw new Error(
            `ล็อกอินเป็น ${role} (${คน.email}) ไม่สำเร็จ · แอปขึ้นว่า: ${ข้อความ}\n` +
            "สาเหตุที่พบบ่อยคือยังไม่ได้ seed บัญชีทดสอบ — เรียก seedEmulator() ก่อน"
          );
        }
      }
    }
  }

  if (พลาดล่าสุด) {
    throw new Error(
      `ล็อกอินเป็น ${role} (${คน.email}) แล้วยังติดอยู่ที่หน้า login\n` +
      `ตอนนี้อยู่ที่ ${page.url()}\n` +
      "ตรวจว่า emulator เปิดอยู่ และเรียก seedEmulator() ก่อนเทสแล้วหรือยัง"
    );
  }

  // ไปหน้าปลายทางที่ขอ แล้วรอจนแถบเมนูขึ้นชื่อคนที่ล็อกอิน
  // จุดนี้คือหลักประกันว่า "ล็อกอินติดจริง และหน้าโหลดข้อมูลเสร็จแล้ว"
  // ถ้าข้ามขั้นนี้ เทสจะไปเช็คตารางตอนที่ยังว่างอยู่ แล้วล้มแบบสุ่ม ๆ
  await page.goto(ปลายทาง);
  ตรวจพอร์ต(page);
  await byTestId(page, TESTID.authState).filter({ hasText: คน.name }).waitFor({
    state: "visible",
    timeout: 15000
  });

  return คน;
}

// ออกจากระบบผ่านปุ่มบนแถบเมนู · ใช้กับเทสที่ต้องสลับบทบาทในหน้าเดียวกัน
async function signOutFrom(page) {
  await byTestId(page, TESTID.navSignout).click();
  await page.waitForURL(`**${PAGES.login}`, { timeout: 15000 });
}

// เปิดหน้าที่ต้องล็อกอิน ทั้งที่ยังไม่ล็อกอิน แล้วยืนยันว่าถูกส่งกลับไปหน้า login
// ใช้กับเทสด้านสิทธิ์ (contract.md หัวข้อ 9 ข้อแรก)
async function expectRedirectedToLogin(page, path) {
  await page.goto(path);
  ตรวจพอร์ต(page);
  await page.waitForURL(`**${PAGES.login}`, { timeout: 15000 });
}

module.exports = {
  // seed
  seedEmulator,
  seedEmptyEmulator,
  seedUserProfiles,
  seedLeaveTypes,
  seedLeaveRequests,
  seedApprovals,
  // จัดฉาก
  makeLeaveRequest,
  createLeaveRequest,
  makeApproval,
  createApproval,
  createLeaveType,
  // ล็อกอิน
  signInAs,
  signOutFrom,
  expectRedirectedToLogin,
  // ตัวช่วยหา element
  byTestId
};
