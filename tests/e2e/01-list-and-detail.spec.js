// ─────────────────────────────────────────────────────────────
// tests/e2e/01-list-and-detail.spec.js
//
// เทสหน้ารายการใบลา (leave-requests.html) และหน้ารายละเอียด (leave-request-detail.html)
// ครอบคลุม US-01 (รายการ) · US-08 (สิทธิ์เห็นใบลาตามบทบาท) · US-10 (ค้นหา/กรอง/เรียง)
// US-11 (แดชบอร์ด) · US-03 (รายละเอียดใบลา)
//
// ทุกเทสเริ่มจาก seedEmulator() หรือ seedEmptyEmulator() ใน beforeEach เสมอ
// เพื่อไม่ให้ผลเทสก่อนหน้าไปปนกับเทสถัดไป (ดูกฎในทีมี tests/README.md)
// ─────────────────────────────────────────────────────────────

const { test, expect } = require("@playwright/test");
const {
  seedEmulator,
  seedEmptyEmulator,
  signInAs,
  byTestId,
  TESTID,
  STATUS,
  PAGES,
  detailUrl,
  COUNTS,
  LEAVE_TYPES,
  findRequest,
  approvalsOf
} = require("../fixtures");

// ── US-01 · หน้ารายการใบลา ────────────────────────────────────

test.describe("US-01 หน้ารายการใบลา", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  test("ตารางมีครบ 5 หัวคอลัมน์ตามสเปก", async ({ page }) => {
    await signInAs(page, "manager");

    const หัวตาราง = byTestId(page, TESTID.requestList).locator("thead th");
    await expect(หัวตาราง).toHaveText([
      "หัวข้อ",
      "ประเภทการลา",
      "สถานะ",
      "ผู้ขอลา",
      "วันที่ลา"
    ]);
  });

  test("แสดงชื่อคนไทยของผู้ขอลา ไม่ใช่รหัส uid ดิบ", async ({ page }) => {
    await signInAs(page, "manager");

    const lr001 = findRequest("lr001");
    const แถว = byTestId(page, TESTID.requestRow).filter({ hasText: lr001.title });

    // สมชาย ใจดี เป็นผู้ขอลาของ lr001, lr002, lr005 — ต้องเจอชื่อไทยครบทุกใบของเขา
    await expect(byTestId(page, TESTID.requestRowRequester).filter({ hasText: lr001.requesterName }))
      .toHaveCount(COUNTS.visibleToEmployee);
    // ต้องไม่มีรหัส uid ดิบหลุดไปโผล่ในแถวของ lr001 โดยเฉพาะ
    await expect(แถว.locator(`[data-testid="${TESTID.requestRowRequester}"]`))
      .not.toHaveText(/uid-|u00\d/);
  });

  test("สถานะแสดงเป็นป้ายมีสี ไม่ใช่ข้อความเปล่า", async ({ page }) => {
    await signInAs(page, "manager");

    const lr001 = findRequest("lr001"); // สถานะ รอพิจารณา
    const แถว = byTestId(page, TESTID.requestRow).filter({ hasText: lr001.title });
    const ป้ายสถานะ = แถว.locator(`[data-testid="${TESTID.requestRowStatus}"] .badge`);

    await expect(ป้ายสถานะ).toHaveCount(1);
    await expect(ป้ายสถานะ).toHaveClass(/badge-pending/);
    await expect(ป้ายสถานะ).toHaveText(STATUS.PENDING);
  });

  test("คลิกที่แถวแล้วไปหน้ารายละเอียดของใบลานั้น", async ({ page }) => {
    await signInAs(page, "manager");

    const lr002 = findRequest("lr002");
    const แถว = byTestId(page, TESTID.requestRow).filter({ hasText: lr002.title });
    await แถว.click();

    await expect(page).toHaveURL(new RegExp(`leave-request-detail\\.html\\?id=lr002$`));
    await expect(byTestId(page, TESTID.detailTitle)).toHaveText(lr002.title);
  });

  test("ไม่มีใบลาเลยในระบบ ต้องขึ้นข้อความว่างเปล่าตัวเดียวเท่านั้น ไม่ใช่ตารางว่าง", async ({ page }) => {
    await seedEmptyEmulator();
    await signInAs(page, "manager");

    await expect(byTestId(page, TESTID.emptyState)).toHaveText("ยังไม่มีใบขอลาในระบบ");
    await expect(byTestId(page, TESTID.emptyState)).toBeVisible();
    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(0);
  });
});

// ── US-08 · สิทธิ์เห็นใบลาตามบทบาท ────────────────────────────

test.describe("US-08 สิทธิ์เห็นใบลาตามบทบาท", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  test("พนักงานเห็นเฉพาะใบลาของตัวเอง", async ({ page }) => {
    await signInAs(page, "employee");
    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(COUNTS.visibleToEmployee);
  });

  test("หัวหน้างานเห็นใบลาทุกใบในระบบ", async ({ page }) => {
    await signInAs(page, "manager");
    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(COUNTS.visibleToManager);
  });

  test("ฝ่ายบุคคลเห็นใบลาทุกใบในระบบ", async ({ page }) => {
    await signInAs(page, "hr");
    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(COUNTS.visibleToHr);
  });
});

// ── US-10 · ค้นหา กรอง เรียงลำดับ ─────────────────────────────

test.describe("US-10 ค้นหา กรอง และเรียงลำดับ", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  test("ค้นหาคำที่อยู่ในหัวข้อ กรองแถวให้เหลือเฉพาะที่ตรงคำค้น", async ({ page }) => {
    await signInAs(page, "manager");

    // "ไข้หวัดใหญ่" ปรากฏเฉพาะในหัวข้อของ lr002 ใบเดียว
    await page.locator("#search-input").fill("ไข้หวัดใหญ่");

    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(1);
    await expect(byTestId(page, TESTID.requestRowTitle)).toHaveText(findRequest("lr002").title);
  });

  test("กรองตามสถานะ แสดงเฉพาะใบลาที่มีสถานะนั้น", async ({ page }) => {
    await signInAs(page, "manager");

    await page.locator("#status-filter").selectOption(STATUS.REJECTED);

    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(COUNTS.rejected);
    const ป้ายทั้งหมด = byTestId(page, TESTID.requestRowStatus);
    const จำนวน = await ป้ายทั้งหมด.count();
    for (let i = 0; i < จำนวน; i += 1) {
      await expect(ป้ายทั้งหมด.nth(i)).toHaveText(STATUS.REJECTED);
    }
  });

  test("กรองตามประเภทการลา แสดงเฉพาะใบลาประเภทนั้น", async ({ page }) => {
    await signInAs(page, "manager");

    const ลากิจ = LEAVE_TYPES.find((t) => t.id === "lt003");
    await page.locator("#type-filter").selectOption(ลากิจ.id);

    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(1);
    await expect(byTestId(page, TESTID.requestRowType)).toHaveText(ลากิจ.name);
  });

  test("เรียงลำดับเริ่มต้นคือใหม่ไปเก่า และสลับได้เป็นเก่าไปใหม่", async ({ page }) => {
    await signInAs(page, "manager");

    // lr004 สร้างล่าสุด (2026-09-20 11:00) ต้องอยู่แถวบนสุดตอนเริ่มต้น
    const แถวแรกก่อนสลับ = byTestId(page, TESTID.requestRow).first();
    await expect(แถวแรกก่อนสลับ.locator(`[data-testid="${TESTID.requestRowTitle}"]`))
      .toHaveText(findRequest("lr004").title);

    await page.locator("#sort-toggle").click();
    await expect(page.locator("#sort-toggle")).toHaveText("เรียง: เก่าไปใหม่");

    // lr002 สร้างเก่าสุด (2026-08-24 08:05) ต้องขึ้นมาอยู่แถวบนสุดหลังสลับ
    const แถวแรกหลังสลับ = byTestId(page, TESTID.requestRow).first();
    await expect(แถวแรกหลังสลับ.locator(`[data-testid="${TESTID.requestRowTitle}"]`))
      .toHaveText(findRequest("lr002").title);
  });

  test("ค้นหาแล้วไม่พบใบลาไหนตรงเลย ต้องขึ้นข้อความไม่พบผลค้นหา คนละข้อความกับฐานข้อมูลว่างเปล่า", async ({ page }) => {
    await signInAs(page, "manager");

    await page.locator("#search-input").fill("ไม่มีคำนี้อยู่ในหัวข้อไหนเลยแน่นอน");

    await expect(byTestId(page, TESTID.emptyState)).toHaveText("ไม่พบใบขอลาที่ตรงกับคำค้น");
    await expect(byTestId(page, TESTID.emptyState)).toBeVisible();
    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(0);
  });
});

// ── US-11 · แดชบอร์ด ──────────────────────────────────────────
//
// สเปกหัวข้อ 3 (US-11) เขียนไว้ว่าแดชบอร์ดเป็นงาน Module 3 ("Module 2 ไม่ทำ
// แดชบอร์ด") และหัวข้อ 4 (หน้าที่ 5) ย้ำว่าหน้านี้เป็น "โครงหน้าจาก prototype
// ตลอด Module 2" — เจ้าของโปรเจกต์ตัดสินแล้วว่าอะไรที่สเปกเลื่อนไป Module 3
// ให้ตัดออกจากหน้านี้ ดังนั้นเทสชุดนี้จึงไม่เช็คว่าตัวเลข/รายการมาจากฐานข้อมูลจริง
// อีกต่อไป (นั่นคือสิ่งที่ทำให้เทสเดิมพังหลังปรับหน้า) แต่เช็คว่า:
//   1) กล่องตัวเลข 3 กล่องและรายการล่าสุดยังแสดงผลอยู่ (โครงหน้าไม่หาย)
//   2) มีป้ายเตือนว่าเป็น prototype ให้เห็นชัด กันคนเข้าใจผิดว่าเป็นตัวเลขจริง
//   3) กดกล่องตัวเลขยังพาไปหน้ารายการพร้อมตัวกรองสถานะที่ตรงกัน (ข้อนี้ไม่ได้เลื่อน)

test.describe("US-11 แดชบอร์ด", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  test("แสดงกล่องตัวเลข 3 กล่องและรายการล่าสุด 5 รายการ (โครงหน้า prototype)", async ({ page }) => {
    await signInAs(page, "manager", { goto: PAGES.dashboard });

    // สามกล่องต้องแสดงอยู่ พร้อมเนื้อหาที่เป็นตัวเลข — ไม่เช็คว่าตรงกับข้อมูลจริง
    // ในฐานข้อมูลหรือไม่ เพราะ US-11 เลื่อนไป Module 3 แล้วตัวเลขเป็นของตัวอย่างคงที่
    for (const testId of [TESTID.countPending, TESTID.countApproved, TESTID.countRejected]) {
      const กล่อง = byTestId(page, testId);
      await expect(กล่อง).toBeVisible();
      await expect(กล่อง).toHaveText(/^\d+$/);
    }

    await expect(byTestId(page, TESTID.recentItem)).toHaveCount(5);
  });

  test("มีป้ายบอกว่าเป็นโครงหน้า prototype ให้เห็นชัดเจน", async ({ page }) => {
    await signInAs(page, "manager", { goto: PAGES.dashboard });

    const ป้ายเตือน = page.locator('[data-testid="prototype-notice"]');
    await expect(ป้ายเตือน).toBeVisible();
    // เนื้อหาต้องสื่อว่าเป็นของตัวอย่าง/ยังไม่ใช่ของจริง กันคนเข้าใจผิดว่า
    // ตัวเลขที่เห็นเป็นตัวเลขใบลาจริงของตัวเอง (ความเสี่ยงจริงของการโชว์แดชบอร์ดปลอม)
    await expect(ป้ายเตือน).toContainText("prototype");
    await expect(ป้ายเตือน).toContainText("Module 3");
  });

  test("คลิกกล่องจำนวนแล้วไปหน้ารายการพร้อมตัวกรองสถานะที่ตรงกัน", async ({ page }) => {
    await signInAs(page, "manager", { goto: PAGES.dashboard });

    await page.locator(`[data-testid="${TESTID.countRejected}"]`)
      .locator("xpath=ancestor::a[1]")
      .click();

    await expect(page).toHaveURL(/leave-requests\.html\?status=/);
    await expect(page.locator("#status-filter")).toHaveValue(STATUS.REJECTED);
    await expect(byTestId(page, TESTID.requestRow)).toHaveCount(COUNTS.rejected);

    const ป้ายทั้งหมด = byTestId(page, TESTID.requestRowStatus);
    const จำนวน = await ป้ายทั้งหมด.count();
    for (let i = 0; i < จำนวน; i += 1) {
      await expect(ป้ายทั้งหมด.nth(i)).toHaveText(STATUS.REJECTED);
    }
  });
});

// ── US-03 · หน้ารายละเอียดใบลา ────────────────────────────────

test.describe("US-03 หน้ารายละเอียดใบลา", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  test("แสดงครบทุกช่องตามสเปก", async ({ page }) => {
    const lr001 = findRequest("lr001");
    await signInAs(page, "hr", { goto: detailUrl("lr001") });

    await expect(byTestId(page, TESTID.detailTitle)).toHaveText(lr001.title);
    await expect(byTestId(page, TESTID.detailReason)).toHaveText(lr001.reason);
    await expect(byTestId(page, TESTID.detailType)).toHaveText(lr001.leaveTypeName);
    await expect(byTestId(page, TESTID.detailDates)).toHaveText("2026-09-07 ถึง 2026-09-09");
    await expect(byTestId(page, TESTID.detailRequester)).toHaveText(lr001.requesterName);
    await expect(byTestId(page, TESTID.detailApprover)).toHaveText(lr001.approverName);
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(lr001.status);
    // วันที่ยื่นต้องมีข้อความปรากฏ (รูปแบบวันที่ไทยตรวจแยกไม่คุ้ม แค่ต้องไม่ว่าง)
    await expect(byTestId(page, TESTID.detailCreated)).not.toHaveText("");
  });

  test("ใบลาที่ยังไม่มีผู้อนุมัติ ต้องขึ้นข้อความ ยังไม่ได้กำหนดผู้อนุมัติ", async ({ page }) => {
    const lr003 = findRequest("lr003");
    expect(lr003.approverName).toBe("");

    await signInAs(page, "hr", { goto: detailUrl("lr003") });

    await expect(byTestId(page, TESTID.detailApprover)).toHaveText("ยังไม่ได้กำหนดผู้อนุมัติ");
  });

  test("รายการความเห็นเรียงจากเก่าไปใหม่ พร้อมชื่อผู้เขียน ข้อความ และเวลา", async ({ page }) => {
    const ความเห็นlr001 = approvalsOf("lr001"); // เรียงเก่าไปใหม่แล้วจาก fixtures
    expect(ความเห็นlr001).toHaveLength(2);

    await signInAs(page, "hr", { goto: detailUrl("lr001") });

    const รายการ = byTestId(page, TESTID.approvalItem);
    await expect(รายการ).toHaveCount(2);

    // ตัวแรกในหน้าจอต้องเป็นความเห็นที่เก่าที่สุด (ap001 ของสมหญิง)
    await expect(รายการ.nth(0).locator(`[data-testid="${TESTID.approvalAuthor}"]`))
      .toHaveText(ความเห็นlr001[0].authorName);
    await expect(รายการ.nth(0).locator(`[data-testid="${TESTID.approvalMessage}"]`))
      .toHaveText(ความเห็นlr001[0].message);
    await expect(รายการ.nth(0).locator(`[data-testid="${TESTID.approvalTime}"]`))
      .not.toHaveText("");

    // ตัวที่สองต้องเป็นความเห็นที่ใหม่กว่า (ap002 ของสมศรี)
    await expect(รายการ.nth(1).locator(`[data-testid="${TESTID.approvalAuthor}"]`))
      .toHaveText(ความเห็นlr001[1].authorName);
    await expect(รายการ.nth(1).locator(`[data-testid="${TESTID.approvalMessage}"]`))
      .toHaveText(ความเห็นlr001[1].message);
  });

  test("lr001 มีสองความเห็นตามข้อมูลตั้งต้น", async ({ page }) => {
    await signInAs(page, "hr", { goto: detailUrl("lr001") });
    await expect(byTestId(page, TESTID.approvalItem)).toHaveCount(2);
  });

  test("lr003 ยังไม่มีความเห็นเลย", async ({ page }) => {
    await signInAs(page, "hr", { goto: detailUrl("lr003") });
    await expect(byTestId(page, TESTID.approvalItem)).toHaveCount(0);
  });

  test("ปุ่มย้อนกลับพากลับไปหน้ารายการใบลา", async ({ page }) => {
    await signInAs(page, "hr", { goto: detailUrl("lr001") });

    await byTestId(page, TESTID.backButton).click();

    await expect(page).toHaveURL(/leave-requests\.html$/);
    await expect(byTestId(page, TESTID.requestList)).toBeVisible();
  });
});
