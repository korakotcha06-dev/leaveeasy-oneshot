// ─────────────────────────────────────────────────────────────
// tests/e2e/04-persistence-and-access.spec.js
//
// ปิดช่องโหว่ 4 เรื่องที่ชุดทดสอบเดิม (64 เทส) ยังไม่มีใครดูแล
//
//   ช่องที่ 1 · ข้อมูลอยู่รอดข้ามเซสชันจริงไหม (leaveeasy-spec.md บรรทัด 484)
//              "กรอก → ปิดเบราว์เซอร์ → เปิดใหม่ → ข้อมูลยังอยู่"
//   ช่องที่ 2 · คนที่ยังไม่ล็อกอิน เปิดหน้าที่ต้องล็อกอินแล้วต้องถูกเด้ง (ระดับหน้าจอ)
//   ช่องที่ 3 · US-08 สมัครสมาชิกใหม่ต้องได้ role = "employee" เป๊ะ ๆ
//   ช่องที่ 4 · หน้าประเภทการลาสำหรับคนที่ไม่ใช่ฝ่ายบุคคล (เพิ่งแก้ ยังไม่มีเทสคุม)
//
// ── ทำไมต้องเปิด "บริบทเบราว์เซอร์ใหม่" ไม่ใช่ page.reload() ───
//
// เทสเดิมพิสูจน์ได้แค่ว่า "คำสั่งเขียนไปถึงฐานข้อมูล" ด้วยการอ่านเอกสารกลับมา
// แต่สเปกบรรทัด 484 ถามคนละคำถาม — ถามในมุมของผู้ใช้ว่า
// ปิดเบราว์เซอร์ทิ้งแล้วเปิดใหม่ ข้อมูลยังอยู่ไหม
//
// page.reload() ตอบคำถามนั้นไม่ได้ เพราะ cookie / localStorage / เซสชันของ
// Firebase Auth ยังอยู่ครบเหมือนเดิมทุกอย่าง เท่ากับ "เบราว์เซอร์ตัวเดิม"
// ไฟล์นี้จึงใช้ browser.newContext() ซึ่งได้ที่เก็บข้อมูลใหม่ทั้งก้อน
// แล้ว ctx.close() ทิ้งของเก่า = ปิดเบราว์เซอร์จริง เปิดใหม่จริง ล็อกอินใหม่จริง
// (มีเทสหนึ่งตัวในไฟล์นี้ที่คอยพิสูจน์ว่าวิธีนี้ทิ้งเซสชันได้จริง ไม่ใช่เชื่อเอาเอง)
//
// ── เรื่อง emulator ที่ใช้ร่วมกับไฟล์เทสอื่น ──────────────────
//
// emulator มีฐานข้อมูลก้อนเดียว ไฟล์เทสอื่นก็ล้างฐานเหมือนกัน
// ไฟล์นี้จึง seed ใน beforeEach เสมอ และตั้งชื่อเอกสารของตัวเองขึ้นต้นด้วย t8-
// ถ้าเทสล้มแบบอธิบายไม่ได้ ให้รันซ้ำอีกรอบก่อนสรุปว่าแอปพัง
// ─────────────────────────────────────────────────────────────

const { test, expect } = require("@playwright/test");
const {
  BASE_URL,
  ROLE,
  STATUS,
  PAGES,
  TESTID,
  TEST_USERS,
  TEST_PASSWORD,
  LEAVE_TYPES,
  detailUrl,
  findRequest,
  seedEmulator,
  signInAs,
  byTestId,
  createLeaveRequest,
  expectRedirectedToLogin,
  readDoc,
  listDocs
} = require("../fixtures");

// ── data-testid สองตัวที่ยังไม่มีใน fixtures/config.js ────────
//
// หน้า leave-types.html มี hr-required-notice กับ type-row-name อยู่จริง
// แต่ contract ที่ถอดลง TESTID ตกสองตัวนี้ไป และไฟล์ fixtures ไม่ใช่ของงานนี้
// จึงประกาศไว้ตรงนี้ที่เดียว (ไม่พิมพ์สตริงกระจายในเทส) รอให้ย้ายไป config.js ทีหลัง
const TESTID_เพิ่มเติม = {
  hrRequiredNotice: "hr-required-notice",
  typeRowName: "type-row-name"
};

// ═════════════════════════════════════════════════════════════
// ตัวช่วยของไฟล์นี้
// ═════════════════════════════════════════════════════════════

/**
 * เปิด "เบราว์เซอร์ตัวใหม่" — บริบทที่ไม่มี cookie / localStorage / เซสชันเดิมติดมาเลย
 *
 * ต้องส่ง baseURL / locale / timezoneId เองเพราะบริบทที่สร้างมือแบบนี้
 * ไม่ได้รับค่าจากหัวข้อ use ใน playwright.config.js มาให้อัตโนมัติ
 * baseURL ต้องเป็น 5050 เท่านั้น (ดูเหตุผลใน tests/README.md) และ signInAs
 * ยังตรวจพอร์ตซ้ำให้อีกชั้นหนึ่งอยู่แล้ว
 */
async function เปิดเบราว์เซอร์ใหม่(browser) {
  const บริบท = await browser.newContext({
    baseURL: BASE_URL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok"
  });
  const หน้า = await บริบท.newPage();
  return { บริบท, หน้า };
}

// หาแถวใบลาในตารางจากหัวข้อ · ใช้ filter แทนการนับลำดับแถว
// เพราะลำดับขึ้นกับการเรียงตามเวลา ซึ่งไม่ใช่เรื่องที่เทสกลุ่มนี้กำลังพิสูจน์
function แถวของหัวข้อ(page, หัวข้อ) {
  return byTestId(page, TESTID.requestRow).filter({ hasText: หัวข้อ });
}

// หยิบช่องย่อยในแถว เช่น request-row-type ของแถวนั้น
function ช่องในแถว(แถว, testid) {
  return แถว.locator(`[data-testid="${testid}"]`);
}

// ยื่นใบลาใหม่ผ่านหน้าจอจริงทุกขั้นตอน (ไม่ลัดผ่าน fixtures)
// เพราะช่องที่ 1 ข้อ ก. ต้องพิสูจน์เส้นทาง "ผู้ใช้กรอกเอง" ตามสเปกบรรทัด 484
async function ยื่นใบลาผ่านหน้าจอ(page, { หัวข้อ, leaveTypeId }) {
  await byTestId(page, TESTID.fieldTitle).fill(หัวข้อ);
  await byTestId(page, TESTID.fieldReason).fill("เหตุผลของเทสข้ามเซสชัน ไม่ซ้ำกับใบอื่น");
  await byTestId(page, TESTID.fieldLeaveType).selectOption(leaveTypeId);
  await byTestId(page, TESTID.fieldStartDate).fill("2026-12-01");
  await byTestId(page, TESTID.fieldEndDate).fill("2026-12-03");
  await byTestId(page, TESTID.saveButton).click();
  // บันทึกสำเร็จแล้วแอปพากลับหน้ารายการเอง — รอเงื่อนไขจริงข้อนี้แทนการหน่วงเวลา
  await page.waitForURL(`**${PAGES.leaveRequests}`);
}

// ═════════════════════════════════════════════════════════════
// ช่องที่ 1 · ข้อมูลอยู่รอดข้ามเซสชันจริง (leaveeasy-spec.md บรรทัด 484)
// ═════════════════════════════════════════════════════════════

test.describe("ช่องที่ 1 ปิดเบราว์เซอร์แล้วเปิดใหม่ ข้อมูลยังอยู่", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  // เทสตัวนี้ไม่ได้ตรวจแอป แต่ตรวจ "วิธีทดสอบ" ของทั้ง describe นี้
  // ถ้าบริบทใหม่ยังจำการล็อกอินเดิมได้ เทสที่เหลือจะกลายเป็นแค่ page.reload() แบบอ้อม ๆ
  // แล้วผ่านทั้งที่ไม่ได้พิสูจน์อะไรตามสเปกเลย
  test("เปิดบริบทเบราว์เซอร์ใหม่แล้วเซสชันเดิมหายจริง ต้องล็อกอินใหม่เสมอ", async ({ browser }) => {
    const รอบแรก = await เปิดเบราว์เซอร์ใหม่(browser);
    await signInAs(รอบแรก.หน้า, "employee");
    await รอบแรก.บริบท.close();

    const รอบสอง = await เปิดเบราว์เซอร์ใหม่(browser);
    try {
      // ถ้าเซสชันยังติดมา หน้านี้จะเปิดได้เลยโดยไม่เด้ง — ซึ่งแปลว่าวิธีทดสอบใช้ไม่ได้
      await expectRedirectedToLogin(รอบสอง.หน้า, PAGES.leaveRequests);
    } finally {
      await รอบสอง.บริบท.close();
    }
  });

  test("ก. ยื่นใบลาใหม่ ปิดเบราว์เซอร์ เปิดใหม่ ล็อกอินใหม่ ยังเห็นใบนั้นครบหัวข้อ ประเภท และสถานะ", async ({ browser }) => {
    const หัวข้อ = "ใบลาข้ามเซสชัน t8 ยื่นเอง";
    const ประเภทที่เลือก = LEAVE_TYPES[0];       // lt001 ลาพักร้อน

    const รอบแรก = await เปิดเบราว์เซอร์ใหม่(browser);
    await signInAs(รอบแรก.หน้า, "employee", { goto: PAGES.newLeaveRequest });
    await ยื่นใบลาผ่านหน้าจอ(รอบแรก.หน้า, {
      หัวข้อ,
      leaveTypeId: ประเภทที่เลือก.id
    });
    await รอบแรก.บริบท.close();          // ← ปิดเบราว์เซอร์ทิ้งทั้งก้อน ไม่ใช่รีโหลดหน้า

    const รอบสอง = await เปิดเบราว์เซอร์ใหม่(browser);
    try {
      await signInAs(รอบสอง.หน้า, "employee");
      const แถว = แถวของหัวข้อ(รอบสอง.หน้า, หัวข้อ);
      await expect(แถว).toHaveCount(1);
      await expect(ช่องในแถว(แถว, TESTID.requestRowTitle)).toHaveText(หัวข้อ);
      await expect(ช่องในแถว(แถว, TESTID.requestRowType)).toHaveText(ประเภทที่เลือก.name);
      await expect(ช่องในแถว(แถว, TESTID.requestRowStatus)).toHaveText(STATUS.PENDING);
    } finally {
      await รอบสอง.บริบท.close();
    }
  });

  test("ข. หัวหน้างานส่งความเห็น ปิดเบราว์เซอร์ เปิดใหม่ ความเห็นยังอยู่บนใบลาใบเดิม", async ({ browser }) => {
    const ใบ = await createLeaveRequest({}, "t8-comment-survives");
    const ข้อความ = "ความเห็นข้ามเซสชัน t8 ต้องยังอยู่หลังเปิดเบราว์เซอร์ใหม่";

    const รอบแรก = await เปิดเบราว์เซอร์ใหม่(browser);
    await signInAs(รอบแรก.หน้า, "manager", { goto: detailUrl(ใบ.id) });
    await byTestId(รอบแรก.หน้า, TESTID.commentInput).fill(ข้อความ);
    await byTestId(รอบแรก.หน้า, TESTID.commentSubmit).click();
    // รอจนความเห็นขึ้นบนหน้าจอรอบแรกก่อน จะได้แน่ใจว่าปิดเบราว์เซอร์หลังส่งเสร็จจริง
    await expect(
      byTestId(รอบแรก.หน้า, TESTID.approvalItem).filter({ hasText: ข้อความ })
    ).toHaveCount(1);
    await รอบแรก.บริบท.close();

    const รอบสอง = await เปิดเบราว์เซอร์ใหม่(browser);
    try {
      await signInAs(รอบสอง.หน้า, "manager", { goto: detailUrl(ใบ.id) });
      await expect(
        byTestId(รอบสอง.หน้า, TESTID.approvalItem).filter({ hasText: ข้อความ })
      ).toHaveCount(1);
    } finally {
      await รอบสอง.บริบท.close();
    }
  });

  test("ค. หัวหน้างานกดอนุมัติ ปิดเบราว์เซอร์ เปิดใหม่ สถานะยังเป็นอนุมัติ", async ({ browser }) => {
    const ใบ = await createLeaveRequest({}, "t8-approve-survives");

    const รอบแรก = await เปิดเบราว์เซอร์ใหม่(browser);
    await signInAs(รอบแรก.หน้า, "manager", { goto: detailUrl(ใบ.id) });
    await byTestId(รอบแรก.หน้า, TESTID.approveButton).click();
    await expect(byTestId(รอบแรก.หน้า, TESTID.detailStatus)).toHaveText(STATUS.APPROVED);
    await รอบแรก.บริบท.close();

    const รอบสอง = await เปิดเบราว์เซอร์ใหม่(browser);
    try {
      await signInAs(รอบสอง.หน้า, "manager", { goto: detailUrl(ใบ.id) });
      await expect(byTestId(รอบสอง.หน้า, TESTID.detailStatus)).toHaveText(STATUS.APPROVED);
    } finally {
      await รอบสอง.บริบท.close();
    }
  });

  test("ง. ฝ่ายบุคคลเพิ่มประเภทการลา ปิดเบราว์เซอร์ เปิดใหม่ ยังเห็นทั้งในตารางและในตัวเลือกของฟอร์มยื่นใบลา", async ({ browser }) => {
    const ชื่อประเภทใหม่ = "ลาดูแลบุตร (t8)";

    const รอบแรก = await เปิดเบราว์เซอร์ใหม่(browser);
    await signInAs(รอบแรก.หน้า, "hr", { goto: PAGES.leaveTypes });
    await byTestId(รอบแรก.หน้า, TESTID.typeNameInput).fill(ชื่อประเภทใหม่);
    await byTestId(รอบแรก.หน้า, TESTID.typeAddButton).click();
    await expect(
      byTestId(รอบแรก.หน้า, TESTID.typeRow).filter({ hasText: ชื่อประเภทใหม่ })
    ).toHaveCount(1);
    await รอบแรก.บริบท.close();

    const รอบสอง = await เปิดเบราว์เซอร์ใหม่(browser);
    try {
      await signInAs(รอบสอง.หน้า, "hr", { goto: PAGES.leaveTypes });
      await expect(
        byTestId(รอบสอง.หน้า, TESTID.typeRow).filter({ hasText: ชื่อประเภทใหม่ })
      ).toHaveCount(1);

      // ประเภทการลาที่อยู่รอดต้องใช้งานได้จริงด้วย ไม่ใช่แค่โผล่ในตารางจัดการ
      await รอบสอง.หน้า.goto(PAGES.newLeaveRequest);
      await expect(byTestId(รอบสอง.หน้า, TESTID.fieldLeaveType)).toContainText(ชื่อประเภทใหม่);
    } finally {
      await รอบสอง.บริบท.close();
    }
  });

  test("จ. พนักงานลบใบลาของตัวเองที่ยังรอพิจารณา ปิดเบราว์เซอร์ เปิดใหม่ ใบนั้นหายไปจริงจากฐานข้อมูล", async ({ browser }) => {
    const หัวข้อ = "ใบลาข้ามเซสชัน t8 ที่ถูกลบ";
    const ใบ = await createLeaveRequest(
      {
        title: หัวข้อ,
        status: STATUS.PENDING,
        requesterId: TEST_USERS.employee.uid,
        requesterName: TEST_USERS.employee.name
      },
      "t8-delete-survives"
    );

    const รอบแรก = await เปิดเบราว์เซอร์ใหม่(browser);
    await signInAs(รอบแรก.หน้า, "employee", { goto: detailUrl(ใบ.id) });
    // หน้าจอถามยืนยันก่อนลบเสมอ (US-07) — ตอบตกลงให้ครั้งเดียวสำหรับการกดครั้งนี้
    รอบแรก.หน้า.once("dialog", (กล่องยืนยัน) => กล่องยืนยัน.accept());
    await byTestId(รอบแรก.หน้า, TESTID.deleteButton).click();
    await รอบแรก.หน้า.waitForURL(`**${PAGES.leaveRequests}`);
    await รอบแรก.บริบท.close();

    const รอบสอง = await เปิดเบราว์เซอร์ใหม่(browser);
    try {
      await signInAs(รอบสอง.หน้า, "employee");
      await expect(แถวของหัวข้อ(รอบสอง.หน้า, หัวข้อ)).toHaveCount(0);
      // "หายจากหน้าจอ" ยังไม่พอ ต้องหายจากฐานข้อมูลจริง ไม่ใช่แค่ถูกกรองไม่ให้เห็น
      expect(await readDoc(`leaveRequests/${ใบ.id}`)).toBeNull();
    } finally {
      await รอบสอง.บริบท.close();
    }
  });
});

// ═════════════════════════════════════════════════════════════
// ช่องที่ 2 · ยังไม่ล็อกอินแล้วเปิดหน้าที่ต้องล็อกอิน (ระดับหน้าจอ)
//
// เทส security rules คุมชั้นฐานข้อมูลไว้แล้ว แต่ไม่มีเทสไหนพิสูจน์ว่า
// "คนเดินเข้ามาที่ URL ตรง ๆ" จะโดนเด้งและไม่เห็นข้อมูลใบลาบนหน้าจอ
// page ของแต่ละเทสคือบริบทใหม่เอี่ยมอยู่แล้ว จึงเป็นคนที่ยังไม่ล็อกอินโดยธรรมชาติ
// ═════════════════════════════════════════════════════════════

test.describe("ช่องที่ 2 ยังไม่ล็อกอินต้องถูกเด้งไปหน้า login", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  const หน้าที่ต้องล็อกอิน = [
    { ชื่อ: "รายการใบลา", path: PAGES.leaveRequests },
    { ชื่อ: "ยื่นใบลาใหม่", path: PAGES.newLeaveRequest },
    { ชื่อ: "รายละเอียดใบลา", path: detailUrl("lr001") },
    { ชื่อ: "ประเภทการลา", path: PAGES.leaveTypes },
    { ชื่อ: "แดชบอร์ด", path: PAGES.dashboard }
  ];

  for (const หน้า of หน้าที่ต้องล็อกอิน) {
    test(`เปิดหน้า${หน้า.ชื่อ}ทั้งที่ยังไม่ล็อกอิน ถูกเด้งกลับหน้า login และไม่เห็นข้อมูลใบลา`, async ({ page }) => {
      await expectRedirectedToLogin(page, หน้า.path);

      // เด้งแล้วยังต้องไม่มีข้อมูลใบลาค้างอยู่บนหน้าจอให้คนแปลกหน้าอ่าน
      await expect(byTestId(page, TESTID.requestRow)).toHaveCount(0);
      await expect(byTestId(page, TESTID.recentItem)).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("ลาพักร้อนไปเที่ยวกับครอบครัว");
    });
  }

  // ─────────────────────────────────────────────────────────
  // สวมรอย · ล็อกอินด้วยบัญชีหนึ่ง แล้วเปิดใบลาของอีกบัญชีด้วย URL ตรง ๆ
  // นี่คือการทดสอบที่สเปกสัปดาห์ที่ 8 ใช้วัด (หัวข้อ 8 ช่อง "ผ่านสัปดาห์นี้เมื่อ")
  // ชุดกฎ tests/rules ตรวจข้อนี้ที่ระดับฐานข้อมูลแล้ว ตรงนี้ตรวจที่ระดับหน้าจอ
  // ว่าผู้ใช้จริงเปิดดูไม่ได้ และไม่มีเนื้อหารั่วออกมาบนหน้า
  // ─────────────────────────────────────────────────────────

  test("สวมรอย พนักงานเปิดใบลาของคนอื่นด้วย URL ตรง ต้องเปิดไม่ได้และไม่เห็นเนื้อหาใบนั้น", async ({ page }) => {
    const ใบของคนอื่น = findRequest("lr003");
    // lr003 เป็นใบของสมศรี (hr) ไม่ใช่ของสมชาย (employee) ที่จะล็อกอินเข้าไป
    expect(ใบของคนอื่น.requesterId).not.toBe(TEST_USERS.employee.uid);

    await signInAs(page, "employee");
    await page.goto(detailUrl("lr003"));

    // ต้องมีข้อความบอกผู้ใช้ ไม่ใช่หน้าขาวหรือค้างอยู่เฉย ๆ
    await expect(byTestId(page, TESTID.errorMessage)).toBeVisible();

    // และห้ามมีเนื้อหาของใบนั้นรั่วออกมาบนหน้าจอแม้แต่ช่องเดียว
    // เหตุผลการลาคือข้อมูลส่วนตัวที่สเปก US-08 บอกว่าต้องไม่ให้เพื่อนร่วมงานอ่าน
    await expect(page.locator("body")).not.toContainText(ใบของคนอื่น.title);
    await expect(page.locator("body")).not.toContainText(ใบของคนอื่น.reason);
  });

  test("ใบลาของตัวเองยังเปิดดูได้ตามปกติ ยืนยันว่าเทสสวมรอยไม่ได้ผ่านเพราะหน้าพัง", async ({ page }) => {
    // ถ้าหน้ารายละเอียดพังจนไม่แสดงอะไรเลย เทสสวมรอยด้านบนก็จะเขียวแบบหลอก ๆ
    // เทสนี้คือตัวคุม ยืนยันว่าหน้าทำงานได้จริงกับใบที่มีสิทธิ์
    const ใบของตัวเอง = findRequest("lr001");
    expect(ใบของตัวเอง.requesterId).toBe(TEST_USERS.employee.uid);

    await signInAs(page, "employee");
    await page.goto(detailUrl("lr001"));

    await expect(byTestId(page, TESTID.detailTitle)).toContainText(ใบของตัวเอง.title);
    await expect(byTestId(page, TESTID.detailReason)).toContainText(ใบของตัวเอง.reason);
  });

  test("สวมรอย พนักงานยิงคำสั่งอ่านใบของคนอื่นตรงเข้าชั้นข้อมูล ถูก firestore.rules ปฏิเสธ", async ({ page }) => {
    // ซ่อนปุ่มหรือดักที่หน้าจอไม่ใช่ความปลอดภัย คนที่เปิด DevTools ข้ามหน้าเว็บได้ทั้งหมด
    // เทสนี้เรียก data.js ที่หน้าใช้อยู่จริง (auth token เดียวกัน) โดยไม่ผ่าน UI เลย
    await signInAs(page, "employee");

    const ผล = await page.evaluate(async () => {
      try {
        const data = await import("/js/data.js");
        const ใบ = await data.getLeaveRequest("lr003");
        return { สำเร็จ: true, ได้ข้อมูล: ใบ !== null };
      } catch (err) {
        return { สำเร็จ: false, code: err.code || String(err) };
      }
    });

    expect(ผล.สำเร็จ, "ชั้นข้อมูลต้องปฏิเสธ ไม่ใช่คืนข้อมูลใบของคนอื่นมาให้").toBe(false);
    expect(String(ผล.code)).toContain("permission-denied");
  });
});

// ═════════════════════════════════════════════════════════════
// ช่องที่ 3 · US-08 สมัครสมาชิกใหม่ได้บทบาท employee เท่านั้น
// ═════════════════════════════════════════════════════════════

test.describe("ช่องที่ 3 US-08 สมัครสมาชิกใหม่", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  // อีเมลไม่ซ้ำทุกรอบที่รัน เผื่อบัญชีเก่ายังค้างใน Auth emulator จากรอบก่อน
  // (จะได้ไม่ล้มด้วย auth/email-already-in-use ซึ่งไม่ใช่สิ่งที่เทสนี้ต้องการพิสูจน์)
  function อีเมลใหม่ไม่ซ้ำ() {
    return `t8-signup-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
  }

  // สมัครสมาชิกผ่านฟอร์มจริงบนหน้า login.html แล้วรอจนแอปพาออกจากหน้านั้น
  async function สมัครผ่านหน้าจอ(page, { ชื่อ, อีเมล }) {
    await page.goto(PAGES.login);
    await byTestId(page, TESTID.signupName).fill(ชื่อ);
    await byTestId(page, TESTID.signupEmail).fill(อีเมล);
    await byTestId(page, TESTID.signupPassword).fill(TEST_PASSWORD);
    await byTestId(page, TESTID.signupSubmit).click();
    await page.waitForURL(`**${PAGES.home}`);
  }

  // หาเอกสารโปรไฟล์ของคนที่เพิ่งสมัคร · หาจากอีเมลเพราะ uid เป็นค่าที่ Firebase แจกเอง
  async function โปรไฟล์ของอีเมล(อีเมล) {
    const ทั้งหมด = await listDocs("users");
    return ทั้งหมด.find((คน) => คน.email === อีเมล) || null;
  }

  test("สมัครผ่านฟอร์มแล้วได้เอกสาร users/{uid} ที่ role เป็น employee เป๊ะ ๆ", async ({ page }) => {
    const อีเมล = อีเมลใหม่ไม่ซ้ำ();
    await สมัครผ่านหน้าจอ(page, { ชื่อ: "ผู้สมัครใหม่ t8", อีเมล });

    const โปรไฟล์ = await โปรไฟล์ของอีเมล(อีเมล);
    expect(โปรไฟล์, `ไม่พบเอกสาร users ของอีเมล ${อีเมล} หลังสมัครสมาชิก`).not.toBeNull();
    expect(โปรไฟล์.role).toBe(ROLE.EMPLOYEE);
  });

  test("ผู้สมัครใหม่เห็นรายการใบลาว่างเปล่า ไม่ใช่ใบลาของคนอื่นทั้งระบบ", async ({ page }) => {
    const อีเมล = อีเมลใหม่ไม่ซ้ำ();
    await สมัครผ่านหน้าจอ(page, { ชื่อ: "ผู้สมัครใหม่ t8 รายการว่าง", อีเมล });

    await page.goto(PAGES.leaveRequests);
    // ฐานข้อมูลมีใบลาของคนอื่นอยู่ 5 ใบจาก seed · คนใหม่ต้องเห็น 0 ใบ
    await expect(byTestId(page, TESTID.emptyState)).toBeVisible();
    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(0);
  });

  test("ผู้สมัครใหม่ไม่มีลิงก์ประเภทการลาในแถบเมนู เพราะไม่ใช่ฝ่ายบุคคล", async ({ page }) => {
    const อีเมล = อีเมลใหม่ไม่ซ้ำ();
    await สมัครผ่านหน้าจอ(page, { ชื่อ: "ผู้สมัครใหม่ t8 เมนู", อีเมล });

    await page.goto(PAGES.leaveRequests);
    // รอให้แถบเมนูรู้ตัวตนก่อน แล้วค่อยตัดสินว่าลิงก์ "ไม่มี" จริง ไม่ใช่แค่ยังวาดไม่เสร็จ
    await expect(byTestId(page, TESTID.navRequests)).toBeVisible();
    await expect(byTestId(page, TESTID.navTypes)).toHaveCount(0);
  });
});

// ═════════════════════════════════════════════════════════════
// ช่องที่ 4 · หน้าประเภทการลาสำหรับคนที่ไม่ใช่ฝ่ายบุคคล
//
// ต้องตรวจสองทางเสมอ — ถ้าตรวจแต่ฝั่ง employee เทสจะเขียวต่อไปเรื่อย ๆ
// แม้วันหนึ่งฝ่ายบุคคลจะแก้ไขอะไรไม่ได้เลย ซึ่งคือระบบพังอีกแบบหนึ่ง
//
// และต้องเป็น "ไม่มีอยู่ใน DOM" ไม่ใช่ disabled หรือซ่อนด้วย CSS
// ปุ่มที่ถูกปิดไว้เฉย ๆ ใครก็เปิด DevTools ลบ disabled ทิ้งได้ใน 3 วินาที
// ═════════════════════════════════════════════════════════════

test.describe("ช่องที่ 4 หน้าประเภทการลาแยกตามบทบาท", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  // ปุ่มและช่องกรอกทุกตัวที่ "แก้ไขข้อมูลได้" บนหน้านี้ · ต้องหายไปทั้งหมดสำหรับคนที่ไม่ใช่ hr
  const ปุ่มแก้ไขทั้งหมด = [
    TESTID.typeAddButton,
    TESTID.typeNameInput,
    TESTID.typeEditButton,
    TESTID.typeDeleteButton
  ];

  // รอจนหน้า leave-types.html ตัดสินบทบาทเสร็จแล้วจริง ๆ
  // ป้าย hr-required-notice ถูกเปิดในจังหวะเดียวกับที่ฟอร์มเพิ่มถูกถอดออกจาก DOM
  // รอเงื่อนไขนี้จึงเท่ากับรอให้การตัดสินใจเรื่องสิทธิ์เสร็จสมบูรณ์ ไม่ต้องหน่วงเวลาเอง
  async function รอมุมมองอ่านอย่างเดียว(page) {
    await expect(byTestId(page, TESTID_เพิ่มเติม.hrRequiredNotice)).toBeVisible();
  }

  for (const บทบาท of ["employee", "manager"]) {
    test(`${บทบาท} ไม่มีลิงก์ประเภทการลาในแถบเมนูเลย`, async ({ page }) => {
      await signInAs(page, บทบาท);
      await expect(byTestId(page, TESTID.navRequests)).toBeVisible();
      await expect(byTestId(page, TESTID.navTypes)).toHaveCount(0);
    });

    test(`${บทบาท} เปิดหน้าประเภทการลาแล้วไม่มีปุ่มแก้ไขสักตัวอยู่ใน DOM`, async ({ page }) => {
      await signInAs(page, บทบาท, { goto: PAGES.leaveTypes });
      await รอมุมมองอ่านอย่างเดียว(page);

      for (const testid of ปุ่มแก้ไขทั้งหมด) {
        await expect(
          byTestId(page, testid),
          `${บทบาท} ไม่ควรมี ${testid} อยู่ใน DOM ของหน้าประเภทการลา`
        ).toHaveCount(0);
      }
    });

    test(`${บทบาท} ยังเห็นตารางประเภทการลาแบบอ่านอย่างเดียวครบทุกแถว`, async ({ page }) => {
      await signInAs(page, บทบาท, { goto: PAGES.leaveTypes });
      await รอมุมมองอ่านอย่างเดียว(page);

      await expect(byTestId(page, TESTID.typeList)).toBeVisible();
      await expect(byTestId(page, TESTID.typeRow)).toHaveCount(LEAVE_TYPES.length);
      await expect(byTestId(page, TESTID_เพิ่มเติม.typeRowName)).toHaveCount(LEAVE_TYPES.length);
    });
  }

  test("hr มีลิงก์ประเภทการลาในแถบเมนู", async ({ page }) => {
    await signInAs(page, "hr");
    await expect(byTestId(page, TESTID.navTypes)).toBeVisible();
  });

  test("hr ยังมีปุ่มเพิ่ม แก้ไข และลบครบทุกตัวบนหน้าประเภทการลา", async ({ page }) => {
    await signInAs(page, "hr", { goto: PAGES.leaveTypes });
    await expect(byTestId(page, TESTID.typeRow)).toHaveCount(LEAVE_TYPES.length);

    await expect(byTestId(page, TESTID.typeNameInput)).toBeVisible();
    await expect(byTestId(page, TESTID.typeAddButton)).toBeVisible();
    await expect(byTestId(page, TESTID.typeEditButton)).toHaveCount(LEAVE_TYPES.length);
    await expect(byTestId(page, TESTID.typeDeleteButton)).toHaveCount(LEAVE_TYPES.length);
  });

  test("hr ไม่เห็นป้ายเฉพาะฝ่ายบุคคล เพราะป้ายนั้นมีไว้บอกคนที่แก้ไขไม่ได้", async ({ page }) => {
    await signInAs(page, "hr", { goto: PAGES.leaveTypes });
    await expect(byTestId(page, TESTID.typeAddButton)).toBeVisible();
    await expect(byTestId(page, TESTID_เพิ่มเติม.hrRequiredNotice)).toBeHidden();
  });
});
