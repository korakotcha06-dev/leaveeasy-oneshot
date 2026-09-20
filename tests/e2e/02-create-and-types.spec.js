// ─────────────────────────────────────────────────────────────
// tests/e2e/02-create-and-types.spec.js
//
// เทสหน้ายื่นใบลาใหม่ (new-leave-request.html) US-02
// เทสหน้าจัดการประเภทการลา (leave-types.html) US-06
// เทสปุ่ม AI ช่วยจัดประเภท (US-09) — เน้นเส้นทาง "ไม่มี js/ai-config.js"
// เพราะเครื่องที่รันชุดทดสอบอัตโนมัติไม่มีไฟล์นั้นอยู่จริง (contract.md หัวข้อ 8)
//
// คำเตือนเรื่อง emulator ใช้ร่วมกัน — ไฟล์นี้รันขนานกับเทสของเพื่อนอีกสองไฟล์
// บนฐานข้อมูลก้อนเดียวกัน จึง
//   1. เรียก seedEmulator() ใน beforeEach ของทุก describe เสมอ ไม่มี beforeAll
//   2. สร้างเอกสารเฉพาะที่เทสต้องใช้ด้วย id ขึ้นต้น "t3-" กันชนกับของเพื่อน
//   3. ยืนยันผลลัพธ์ด้วยการอ่าน Firestore ตรง ๆ (readDoc/listDocs) ไม่ใช่เดาจากหน้าจอ
// ─────────────────────────────────────────────────────────────

const { test, expect } = require("@playwright/test");
const {
  seedEmulator,
  signInAs,
  byTestId,
  createLeaveType,
  TESTID,
  STATUS,
  PAGES,
  TEST_USERS,
  LEAVE_TYPES,
  findLeaveType,
  readDoc,
  listDocs
} = require("../fixtures");

// หาใบลาที่เพิ่งสร้างจากหน้าจอ โดยไล่หาจากหัวข้อที่ไม่ซ้ำใคร (ตั้งชื่อเฉพาะทุกเทส)
// ต้องทำแบบนี้เพราะ createLeaveRequest ในหน้าจอใช้ addDoc ให้ Firestore สุ่มรหัสเอกสารเอง
// ไม่มีทางรู้ id ล่วงหน้าเหมือนตอน seed ด้วย fixtures
async function หาใบลาจากหัวข้อ(หัวข้อ) {
  const ทั้งหมด = await listDocs("leaveRequests");
  return ทั้งหมด.find((ใบ) => ใบ.title === หัวข้อ) || null;
}

// ═════════════════════════════════════════════════════════════
// US-02 · ฟอร์มยื่นใบลาใหม่
// ═════════════════════════════════════════════════════════════

test.describe("US-02 ฟอร์มยื่นใบลาใหม่", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  test("มีครบทั้งห้าช่องตามสเปก", async ({ page }) => {
    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    await expect(byTestId(page, TESTID.fieldTitle)).toBeVisible();
    await expect(byTestId(page, TESTID.fieldReason)).toBeVisible();
    await expect(byTestId(page, TESTID.fieldReason)).toHaveJSProperty("tagName", "TEXTAREA");
    await expect(byTestId(page, TESTID.fieldLeaveType)).toBeVisible();
    await expect(byTestId(page, TESTID.fieldLeaveType)).toHaveJSProperty("tagName", "SELECT");
    await expect(byTestId(page, TESTID.fieldStartDate)).toBeVisible();
    await expect(byTestId(page, TESTID.fieldEndDate)).toBeVisible();
  });

  test("ตัวเลือกประเภทการลามาจากฐานข้อมูลจริง ไม่ใช่ค่าตายตัวในโค้ด", async ({ page }) => {
    // เพิ่มประเภทการลาใหม่ที่ไม่มีทางถูกฮาร์ดโค้ดไว้ในหน้าจอได้ แล้วดูว่า select เห็นมันไหม
    await createLeaveType("t3-lt-พิเศษ", "ลาบวช (ทดสอบ)");

    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    const ตัวเลือก = byTestId(page, TESTID.fieldLeaveType).locator("option");
    // ต้องมีครบ 3 ประเภทตั้งต้น บวกประเภทใหม่ที่เพิ่งสร้าง = 4
    await expect(ตัวเลือก).toHaveCount(LEAVE_TYPES.length + 1);
    await expect(byTestId(page, TESTID.fieldLeaveType)).toContainText("ลาบวช (ทดสอบ)");
  });

  test("บันทึกสำเร็จแล้วพากลับหน้ารายการ และสร้างเอกสารจริงในฐานข้อมูล", async ({ page }) => {
    const หัวข้อทดสอบ = "หัวข้อทดสอบ US-02 บันทึกสำเร็จ";

    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    await byTestId(page, TESTID.fieldTitle).fill(หัวข้อทดสอบ);
    await byTestId(page, TESTID.fieldReason).fill("เหตุผลของเทสนี้โดยเฉพาะ ไม่ซ้ำกับใบไหน");
    await byTestId(page, TESTID.fieldLeaveType).selectOption("lt001");
    await byTestId(page, TESTID.fieldStartDate).fill("2026-11-10");
    await byTestId(page, TESTID.fieldEndDate).fill("2026-11-11");
    await byTestId(page, TESTID.saveButton).click();

    await expect(page).toHaveURL(/leave-requests\.html$/);

    const ใบที่สร้าง = await หาใบลาจากหัวข้อ(หัวข้อทดสอบ);
    expect(ใบที่สร้าง, "ต้องเจอเอกสารที่บันทึกจากฟอร์มใน Firestore").not.toBeNull();

    // สถานะต้องเป็นรอพิจารณาเสมอ ไม่ว่าฟอร์มจะพยายามส่งอะไรมา
    expect(ใบที่สร้าง.status).toBe(STATUS.PENDING);
    // createdAt ต้องมีค่า (Firestore เขียนด้วย serverTimestamp())
    expect(ใบที่สร้าง.createdAt).toBeTruthy();
    // requesterId ต้องตรงกับ uid ของคนที่ล็อกอินอยู่ตอนบันทึก
    expect(ใบที่สร้าง.requesterId).toBe(TEST_USERS.employee.uid);
    // ชื่อจดซ้ำ (denormalised) ต้องไม่ว่าง เพราะหน้ารายการอ่านค่านี้ไปแสดงตรง ๆ โดยไม่เปิดโฟลเดอร์ users ซ้ำ
    expect(ใบที่สร้าง.requesterName).toBe(TEST_USERS.employee.name);
    expect(ใบที่สร้าง.leaveTypeName).toBe(findLeaveType("lt001").name);
  });

  test("เว้นช่องหัวข้อไว้แล้วกดบันทึก ต้องไม่บันทึกและต้องขึ้นข้อความบอก", async ({ page }) => {
    const จำนวนก่อนกด = (await listDocs("leaveRequests")).length;

    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    // กรอกครบทุกช่อง ยกเว้นหัวข้อที่เว้นว่างไว้
    await byTestId(page, TESTID.fieldReason).fill("เหตุผลครบถ้วน แต่ตั้งใจไม่กรอกหัวข้อ");
    await byTestId(page, TESTID.fieldLeaveType).selectOption("lt001");
    await byTestId(page, TESTID.fieldStartDate).fill("2026-11-20");
    await byTestId(page, TESTID.fieldEndDate).fill("2026-11-21");
    await byTestId(page, TESTID.saveButton).click();

    // ต้องขึ้นข้อความเตือนให้ผู้ใช้เห็น ไม่ใช่เงียบไปเฉย ๆ
    await expect(byTestId(page, TESTID.errorMessage)).toBeVisible();
    await expect(byTestId(page, TESTID.errorMessage)).not.toBeEmpty();

    // ต้องอยู่หน้าเดิม ไม่พากลับหน้ารายการเหมือนตอนบันทึกสำเร็จ
    await expect(page).toHaveURL(/new-leave-request\.html$/);

    // และต้องไม่มีเอกสารงอกในฐานข้อมูล ข้อนี้สำคัญที่สุด
    // เพราะข้อความเตือนขึ้นแต่ยังเขียนลงฐานได้ คือสิ่งที่แย่ที่สุดของทั้งสองอย่าง
    const จำนวนหลังกด = (await listDocs("leaveRequests")).length;
    expect(จำนวนหลังกด).toBe(จำนวนก่อนกด);
  });

  test("กรอกหัวข้อเป็นช่องว่างล้วนแล้วกดบันทึก ต้องถูกปฏิเสธเหมือนเว้นว่าง", async ({ page }) => {
    // js/new-leave-request.js เรียก .trim() ก่อนตรวจ เทสนี้ตรึงพฤติกรรมนั้นไว้
    // ถ้าวันหนึ่งมีคนถอด .trim() ออก ใบลาที่มีหัวข้อเป็นช่องว่างจะหลุดลงฐานได้เงียบ ๆ
    const จำนวนก่อนกด = (await listDocs("leaveRequests")).length;

    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    await byTestId(page, TESTID.fieldTitle).fill("     ");
    await byTestId(page, TESTID.fieldReason).fill("เหตุผลครบถ้วน แต่หัวข้อเป็นช่องว่างล้วน");
    await byTestId(page, TESTID.fieldLeaveType).selectOption("lt001");
    await byTestId(page, TESTID.fieldStartDate).fill("2026-11-20");
    await byTestId(page, TESTID.fieldEndDate).fill("2026-11-21");
    await byTestId(page, TESTID.saveButton).click();

    await expect(byTestId(page, TESTID.errorMessage)).toBeVisible();
    await expect(page).toHaveURL(/new-leave-request\.html$/);

    const จำนวนหลังกด = (await listDocs("leaveRequests")).length;
    expect(จำนวนหลังกด).toBe(จำนวนก่อนกด);
  });

  test("กดยกเลิกกลับไปหน้ารายการ โดยไม่สร้างเอกสารใหม่เลย", async ({ page }) => {
    const จำนวนก่อนกด = (await listDocs("leaveRequests")).length;

    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    await byTestId(page, TESTID.fieldTitle).fill("ใบลาที่ควรถูกยกเลิก ไม่ควรถูกบันทึก");
    await byTestId(page, TESTID.fieldReason).fill("เหตุผลที่ไม่ควรถูกบันทึกลงฐานข้อมูล");
    await byTestId(page, TESTID.cancelButton).click();

    await expect(page).toHaveURL(/leave-requests\.html$/);

    const จำนวนหลังกด = (await listDocs("leaveRequests")).length;
    expect(จำนวนหลังกด).toBe(จำนวนก่อนกด);
  });
});

// ═════════════════════════════════════════════════════════════
// US-06 · จัดการประเภทการลา
// ═════════════════════════════════════════════════════════════

test.describe("US-06 จัดการประเภทการลา", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  test("ตารางแสดงประเภทการลาที่มีอยู่ครบทุกแถว", async ({ page }) => {
    await signInAs(page, "hr", { goto: PAGES.leaveTypes });

    await expect(byTestId(page, TESTID.typeRow)).toHaveCount(LEAVE_TYPES.length);
    for (const ประเภท of LEAVE_TYPES) {
      await expect(byTestId(page, TESTID.typeList)).toContainText(ประเภท.name);
    }
  });

  test("เพิ่มประเภทใหม่แล้วปรากฏในตารางทันทีโดยไม่ต้องรีเฟรชหน้า", async ({ page }) => {
    await signInAs(page, "hr", { goto: PAGES.leaveTypes });

    await byTestId(page, TESTID.typeNameInput).fill("ลาคลอด (ทดสอบ)");
    await byTestId(page, TESTID.typeAddButton).click();

    await expect(byTestId(page, TESTID.typeRow)).toHaveCount(LEAVE_TYPES.length + 1);
    await expect(byTestId(page, TESTID.typeList)).toContainText("ลาคลอด (ทดสอบ)");

    const ทั้งหมด = await listDocs("leaveTypes");
    expect(ทั้งหมด.some((ประเภท) => ประเภท.name === "ลาคลอด (ทดสอบ)")).toBe(true);
  });

  test("แก้ไขชื่อผ่านช่องแก้ไขแบบ inline แล้วบันทึกสำเร็จ", async ({ page }) => {
    await signInAs(page, "hr", { goto: PAGES.leaveTypes });

    // อ้างอิงแถวด้วย data-id ไม่ใช่ hasText เพราะพอเข้าโหมดแก้ไข ชื่อเดิมจะกลายเป็น
    // ค่า value ของ <input> ซึ่งไม่นับเป็น textContent อีกต่อไป — filter ด้วย hasText
    // จะหาแถวไม่เจอทันทีที่สลับโหมด (เจอบั๊กนี้จริงตอนรันเทสรอบแรก)
    const แถวลากิจ = page.locator(`[data-testid="${TESTID.typeRow}"][data-id="lt003"]`);
    await แถวลากิจ.locator(`[data-testid="${TESTID.typeEditButton}"]`).click();

    const ช่องแก้ไข = แถวลากิจ.locator(`[data-testid="type-edit-input"]`);
    await expect(ช่องแก้ไข).toBeVisible();
    await ช่องแก้ไข.fill("ลากิจส่วนตัว (แก้แล้ว)");
    await แถวลากิจ.locator(`[data-testid="type-edit-save"]`).click();

    await expect(byTestId(page, TESTID.typeList)).toContainText("ลากิจส่วนตัว (แก้แล้ว)");
    await expect(byTestId(page, TESTID.typeList)).not.toContainText("ลากิจ (ทดสอบ)");

    const ประเภทหลังแก้ = await readDoc("leaveTypes/lt003");
    expect(ประเภทหลังแก้.name).toBe("ลากิจส่วนตัว (แก้แล้ว)");
  });

  test("กดยกเลิกระหว่างแก้ไข ชื่อเดิมไม่ถูกแตะต้องเลย", async ({ page }) => {
    await signInAs(page, "hr", { goto: PAGES.leaveTypes });

    const แถวลาป่วย = page.locator(`[data-testid="${TESTID.typeRow}"][data-id="lt002"]`);
    await แถวลาป่วย.locator(`[data-testid="${TESTID.typeEditButton}"]`).click();

    const ช่องแก้ไข = แถวลาป่วย.locator(`[data-testid="type-edit-input"]`);
    await ช่องแก้ไข.fill("ชื่อที่ไม่ควรถูกบันทึก");
    await แถวลาป่วย.locator(`[data-testid="type-edit-cancel"]`).click();

    await expect(byTestId(page, TESTID.typeList)).toContainText("ลาป่วย");
    await expect(byTestId(page, TESTID.typeList)).not.toContainText("ชื่อที่ไม่ควรถูกบันทึก");

    const ประเภทเดิม = await readDoc("leaveTypes/lt002");
    expect(ประเภทเดิม.name).toBe(findLeaveType("lt002").name);
  });

  test("บันทึกชื่อว่างถูกปฏิเสธ พร้อมข้อความภาษาไทย และไม่เขียนลงฐานข้อมูล", async ({ page }) => {
    await signInAs(page, "hr", { goto: PAGES.leaveTypes });

    const แถวลาพักร้อน = page.locator(`[data-testid="${TESTID.typeRow}"][data-id="lt001"]`);
    await แถวลาพักร้อน.locator(`[data-testid="${TESTID.typeEditButton}"]`).click();

    const ช่องแก้ไข = แถวลาพักร้อน.locator(`[data-testid="type-edit-input"]`);
    await ช่องแก้ไข.fill("   "); // ช่องว่างล้วน ๆ ต้องถูกปฏิเสธเหมือนไม่กรอกอะไรเลย
    await แถวลาพักร้อน.locator(`[data-testid="type-edit-save"]`).click();

    const ข้อความผิดพลาด = byTestId(page, TESTID.errorMessage);
    await expect(ข้อความผิดพลาด).toBeVisible();
    await expect(ข้อความผิดพลาด).toHaveText(/./); // ต้องมีข้อความจริง ไม่ใช่ว่างเปล่า

    const ประเภทเดิม = await readDoc("leaveTypes/lt001");
    expect(ประเภทเดิม.name).toBe(findLeaveType("lt001").name);
  });

  test("ลบแล้วกดยกเลิกกล่องยืนยัน — เอกสารต้องยังอยู่", async ({ page }) => {
    await createLeaveType("t3-type-ลบทดสอบ1", "ประเภทสำหรับทดสอบลบ (ยกเลิก)");

    await signInAs(page, "hr", { goto: PAGES.leaveTypes });

    page.once("dialog", (dialog) => dialog.dismiss());
    const แถวที่จะลบ = byTestId(page, TESTID.typeRow).filter({
      hasText: "ประเภทสำหรับทดสอบลบ (ยกเลิก)"
    });
    await แถวที่จะลบ.locator(`[data-testid="${TESTID.typeDeleteButton}"]`).click();

    // ให้เวลากล่อง confirm ปิดและอ่านสถานะจริงจากฐานข้อมูล ไม่ใช่เดาจากหน้าจอ
    await expect(byTestId(page, TESTID.typeList)).toContainText("ประเภทสำหรับทดสอบลบ (ยกเลิก)");
    const ยังอยู่ไหม = await readDoc("leaveTypes/t3-type-ลบทดสอบ1");
    expect(ยังอยู่ไหม, "กด Cancel ที่กล่องยืนยันแล้ว เอกสารต้องไม่ถูกลบ").not.toBeNull();
  });

  test("ลบแล้วกดยืนยันตกลง — เอกสารถูกลบจริง และหายจากตาราง", async ({ page }) => {
    await createLeaveType("t3-type-ลบทดสอบ2", "ประเภทสำหรับทดสอบลบ (ยืนยัน)");

    await signInAs(page, "hr", { goto: PAGES.leaveTypes });

    page.once("dialog", (dialog) => dialog.accept());
    const แถวที่จะลบ = byTestId(page, TESTID.typeRow).filter({
      hasText: "ประเภทสำหรับทดสอบลบ (ยืนยัน)"
    });
    await แถวที่จะลบ.locator(`[data-testid="${TESTID.typeDeleteButton}"]`).click();

    await expect(byTestId(page, TESTID.typeList)).not.toContainText("ประเภทสำหรับทดสอบลบ (ยืนยัน)");
    const หลังลบ = await readDoc("leaveTypes/t3-type-ลบทดสอบ2");
    expect(หลังลบ, "กด OK ที่กล่องยืนยันแล้ว เอกสารต้องถูกลบจริงจากฐานข้อมูล").toBeNull();
  });

  test("ประเภทที่เพิ่มในหน้านี้ต้องไปโผล่ในดรอปดาวน์ของหน้ายื่นใบลาใหม่ตอนโหลดครั้งถัดไป", async ({ page }) => {
    await signInAs(page, "hr", { goto: PAGES.leaveTypes });

    await byTestId(page, TESTID.typeNameInput).fill("ลากรณีพิเศษข้ามหน้า (ทดสอบ)");
    await byTestId(page, TESTID.typeAddButton).click();
    await expect(byTestId(page, TESTID.typeList)).toContainText("ลากรณีพิเศษข้ามหน้า (ทดสอบ)");

    // ไปหน้ายื่นใบลาใหม่ต่อ (โหลดหน้าใหม่จริง ๆ ไม่ใช่แค่ SPA เปลี่ยน state)
    await page.goto(PAGES.newLeaveRequest);
    await expect(byTestId(page, TESTID.fieldLeaveType)).toContainText("ลากรณีพิเศษข้ามหน้า (ทดสอบ)");
  });
});

// ═════════════════════════════════════════════════════════════
// US-09 · ปุ่ม AI ช่วยจัดประเภท — เทสเส้นทาง "ไม่มี ai-config.js"
//
// เครื่องที่รันชุดทดสอบนี้ไม่มีไฟล์ js/ai-config.js อยู่จริง (ถูก .gitignore ไว้)
// นี่คือสภาพแวดล้อมจริงของ CI และของเครื่องเพื่อนร่วมทีมที่เพิ่ง clone repo มา
// จึงเทส "เส้นทางเสื่อมสภาพอย่างสุภาพ" ไม่ใช่เส้นทางที่ AI ตอบสำเร็จ
// ห้ามเรียก API จริงและห้ามเติมคีย์ใด ๆ ลงในเครื่องนี้
// ═════════════════════════════════════════════════════════════

test.describe("US-09 ปุ่ม AI ช่วยจัดประเภท (ไม่มี ai-config.js)", () => {
  test.beforeEach(async () => {
    await seedEmulator();
  });

  test("หน้าโหลดสำเร็จครบทุกฟีเจอร์ที่ไม่ใช่ AI แม้ไม่มีไฟล์ตั้งค่า", async ({ page }) => {
    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    // ทุกช่องของฟอร์มต้องใช้งานได้ตามปกติ ไม่มีอะไรพังเพราะขาดไฟล์ AI
    await expect(byTestId(page, TESTID.fieldTitle)).toBeEditable();
    await expect(byTestId(page, TESTID.fieldReason)).toBeEditable();
    await expect(byTestId(page, TESTID.fieldLeaveType).locator("option")).toHaveCount(
      LEAVE_TYPES.length
    );
    await expect(byTestId(page, TESTID.saveButton)).toBeEnabled();
    await expect(byTestId(page, TESTID.cancelButton)).toBeEnabled();
    await expect(byTestId(page, TESTID.aiClassifyButton)).toBeEnabled();
  });

  test("กดปุ่ม AI แล้วขึ้นข้อความภาษาไทยว่าใช้งานไม่ได้ ไม่ค้างและไม่มี error หลุดขึ้นหน้าจอ", async ({
    page
  }) => {
    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    await byTestId(page, TESTID.fieldReason).fill("ปวดหัวมากตั้งแต่เมื่อคืน อยากลาหยุดพักผ่อน");
    await byTestId(page, TESTID.aiClassifyButton).click();

    const ข้อความผิดพลาด = byTestId(page, TESTID.errorMessage);
    await expect(ข้อความผิดพลาด).toBeVisible();
    const ข้อความจริง = (await ข้อความผิดพลาด.textContent()) || "";
    expect(ข้อความจริง.trim().length).toBeGreaterThan(0);
    // ต้องเป็นภาษาไทย ไม่ใช่ error ดิบของ JavaScript หลุดออกมา
    expect(ข้อความจริง).toMatch(/[฀-๿]/);
  });

  test("ปุ่ม AI กลับมากดได้ตามปกติหลังเรียกไม่สำเร็จ ไม่ค้างอยู่ในสถานะกำลังทำงาน", async ({ page }) => {
    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    await byTestId(page, TESTID.fieldReason).fill("เหตุผลสำหรับทดสอบปุ่ม AI");
    const ปุ่มAI = byTestId(page, TESTID.aiClassifyButton);
    const ข้อความปุ่มเดิม = await ปุ่มAI.textContent();

    await ปุ่มAI.click();

    // ต้องกลับมากดได้อีกครั้ง (ไม่ใช่ disabled ค้าง) และข้อความปุ่มกลับเป็นข้อความเดิม
    await expect(ปุ่มAI).toBeEnabled();
    await expect(ปุ่มAI).toHaveText(ข้อความปุ่มเดิม);

    // กดซ้ำรอบสองต้องไม่พัง — ยืนยันว่าไม่ได้แค่ "ดูเหมือน" กดได้แต่จริง ๆ ค้างอยู่ข้างใน
    await ปุ่มAI.click();
    await expect(ปุ่มAI).toBeEnabled();
  });

  test("ป้ายข้อเสนอจาก AI ต้องไม่แสดง เมื่อไม่มีการเสนอค่าใด ๆ ให้", async ({ page }) => {
    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    // ป้ายต้องซ่อนอยู่ตั้งแต่แรกโหลดหน้า
    await expect(byTestId(page, TESTID.aiNotice)).toBeHidden();

    await byTestId(page, TESTID.fieldReason).fill("เหตุผลสำหรับทดสอบป้าย AI");
    await byTestId(page, TESTID.aiClassifyButton).click();

    // เรียกไม่สำเร็จ (ไม่มี config) แปลว่าไม่มีการเสนอค่าใด ๆ ป้ายจึงต้องยังคงซ่อนอยู่
    await expect(byTestId(page, TESTID.errorMessage)).toBeVisible();
    await expect(byTestId(page, TESTID.aiNotice)).toBeHidden();
  });

  test("บันทึกใบลาได้ตามปกติ แม้เพิ่งกดปุ่ม AI แล้วไม่สำเร็จมาก่อนหน้านี้", async ({ page }) => {
    const หัวข้อทดสอบ = "หัวข้อทดสอบ AI ล้มเหลวแล้วยังบันทึกได้";

    await signInAs(page, "employee", { goto: PAGES.newLeaveRequest });

    await byTestId(page, TESTID.fieldTitle).fill(หัวข้อทดสอบ);
    await byTestId(page, TESTID.fieldReason).fill("เหตุผลของเทสนี้ เชื่อมกับปุ่ม AI ที่ล้มเหลวก่อนหน้า");

    // กดปุ่ม AI ก่อน ให้มันล้มเหลวตามที่คาด แล้วค่อยกรอกฟอร์มต่อจนครบและบันทึก
    await byTestId(page, TESTID.aiClassifyButton).click();
    await expect(byTestId(page, TESTID.errorMessage)).toBeVisible();

    await byTestId(page, TESTID.fieldLeaveType).selectOption("lt002");
    await byTestId(page, TESTID.fieldStartDate).fill("2026-12-01");
    await byTestId(page, TESTID.fieldEndDate).fill("2026-12-01");
    await byTestId(page, TESTID.saveButton).click();

    await expect(page).toHaveURL(/leave-requests\.html$/);

    const ใบที่สร้าง = await หาใบลาจากหัวข้อ(หัวข้อทดสอบ);
    expect(ใบที่สร้าง, "การบันทึกต้องสำเร็จแม้ปุ่ม AI ล้มเหลวไปก่อนหน้านี้").not.toBeNull();
    expect(ใบที่สร้าง.status).toBe(STATUS.PENDING);
  });
});
