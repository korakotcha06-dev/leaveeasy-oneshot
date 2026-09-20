// ─────────────────────────────────────────────────────────────
// tests/e2e/03-approval-and-delete.spec.js
//
// เทสส่วนที่ยากที่สุดของระบบ · เครื่องสถานะใบลา (contract.md หัวข้อ 2)
// ความเห็นการอนุมัติ (US-05) และการลบใบลา (US-07)
//
// กฎ 7 ข้อที่ไฟล์นี้พิสูจน์
//   1. สถานะปลายทาง (อนุมัติ / ไม่อนุมัติ) เปลี่ยนต่อไม่ได้อีกตลอดกาล
//   2. เปลี่ยนสถานะได้เฉพาะ manager กับ hr
//   3. แยกหน้าที่ · manager/hr พิจารณา "ใบที่ตัวเองยื่น" ไม่ได้
//   4. จะกดไม่อนุมัติได้ ต้องมีความเห็นอย่างน้อย 1 รายการก่อน
//   5. การเปลี่ยนสถานะเขียนเฉพาะช่อง status ช่องเดียว
//   6. US-05 ความเห็นลงในโฟลเดอร์ย่อย approvals เรียงเก่าไปใหม่
//   7. US-07 ลบได้เฉพาะผู้ยื่น และเฉพาะตอนยังรอพิจารณา ต้องยืนยันก่อน
//
// ── หลักการเขียนของไฟล์นี้ ────────────────────────────────────
//
// ปุ่มที่ถูกปิด (disabled) "ไม่ใช่" หลักฐานว่าระบบปลอดภัย
// ใครก็เปิด DevTools ลบคำว่า disabled ออกได้ใน 3 วินาที
// ทุกเทสในไฟล์นี้จึงตรวจสองชั้นเสมอ
//   ชั้นที่ 1  สภาพของปุ่มบนหน้าจอ (ผู้ใช้ทั่วไปเห็นอะไร)
//   ชั้นที่ 2  อ่านเอกสารกลับจาก Firestore ด้วย readDoc ว่าข้อมูล "ไม่ขยับจริง"
// และในข้อที่ firestore.rules เป็นด่านจริง ยังมีชั้นที่ 3 คือยิงคำสั่งเขียน
// ผ่าน js/data.js ตรง ๆ โดยข้ามหน้าจอทั้งหมด เพื่อพิสูจน์ว่ากฎฝั่งเซิร์ฟเวอร์กันได้เอง
//
// ── เรื่อง emulator ที่ใช้ร่วมกับไฟล์เทสอื่น ──────────────────
//
// emulator มีฐานข้อมูลก้อนเดียว และไฟล์เทสอื่นก็ล้างฐานเหมือนกัน
// ไฟล์นี้จึง seed ใน beforeEach เสมอ (ไม่ใช่ beforeAll) และ
// สร้างเอกสารของตัวเองด้วยชื่อไฟล์ที่ขึ้นต้นด้วย t4- ทุกใบ
// จะได้ไม่ชนกับ lr001..lr005 หรือกับเอกสารของไฟล์เทสอื่น
// ถ้าเทสล้มแบบอธิบายไม่ได้ ให้รันซ้ำก่อนสรุปว่าแอปพัง
// ─────────────────────────────────────────────────────────────

const { test, expect } = require("@playwright/test");
const {
  TEST_USERS,
  STATUS,
  PAGES,
  TESTID,
  detailUrl,
  seedEmptyEmulator,
  signInAs,
  byTestId,
  createLeaveRequest,
  createApproval,
  readDoc,
  listDocs
} = require("../fixtures");

// ── ตัวช่วยของไฟล์นี้ ─────────────────────────────────────────

// เส้นทางเอกสารใบลาและโฟลเดอร์ความเห็น เขียนที่เดียวจะได้ไม่พิมพ์ผิดกระจาย
const เส้นทางใบลา = (id) => `leaveRequests/${id}`;
const เส้นทางความเห็น = (id) => `leaveRequests/${id}/approvals`;

/**
 * กดปุ่มโดยแกล้งเป็นคนที่เปิด DevTools ลบ disabled ออกก่อน
 *
 * จุดประสงค์คือพิสูจน์ว่า "ปุ่มที่ถูกปิด แต่ยังเขียนฐานข้อมูลได้" ไม่เกิดขึ้น
 * ซึ่งเป็นรูปแบบความพังที่อันตรายที่สุดของหน้านี้
 */
async function กดปุ่มแบบข้ามการปิดปุ่ม(page, testId) {
  const ปุ่ม = byTestId(page, testId);
  await ปุ่ม.evaluate((el) => el.removeAttribute("disabled"));
  await ปุ่ม.click();
}

/**
 * ยิงคำสั่งเขียนผ่าน js/data.js ตรง ๆ โดยข้ามหน้าจอทั้งหมด
 *
 * import แบบไดนามิกจาก URL เดียวกับที่หน้าเว็บโหลดไว้แล้ว จึงได้อินสแตนซ์เดิม
 * แปลว่าใช้การล็อกอินเดิมของผู้ใช้คนนั้นจริง ๆ ด่านที่เหลืออยู่จึงมีแต่ firestore.rules
 */
async function เรียกชั้นข้อมูลตรง(page, ชื่อฟังก์ชัน, อาร์กิวเมนต์) {
  return page.evaluate(
    async ({ ชื่อฟังก์ชัน, อาร์กิวเมนต์ }) => {
      try {
        const ชั้นข้อมูล = await import("/js/data.js");
        await ชั้นข้อมูล[ชื่อฟังก์ชัน](...อาร์กิวเมนต์);
        return { สำเร็จ: true, code: "" };
      } catch (err) {
        return { สำเร็จ: false, code: String((err && err.code) || err) };
      }
    },
    { ชื่อฟังก์ชัน, อาร์กิวเมนต์ }
  );
}

// รอจนแอปขึ้นข้อความเตือน แล้วคืนตัวกล่องนั้นมาให้ตรวจข้อความต่อ
// รอ "เงื่อนไขจริง" แทนการหน่วงเวลา จะได้ไม่มี waitForTimeout ในไฟล์นี้เลย
async function รอคำเตือน(page) {
  const กล่อง = byTestId(page, TESTID.errorMessage);
  await expect(กล่อง).toBeVisible();
  return กล่อง;
}

// ═════════════════════════════════════════════════════════════

test.describe("เครื่องสถานะใบลา ความเห็น และการลบ", () => {
  // ล้างฐานแล้วเหลือแค่บัญชีกับประเภทการลา · ใบลาทุกใบเทสสร้างเองด้วยชื่อ t4-
  // ทำใน beforeEach ไม่ใช่ beforeAll เพราะไฟล์เทสอื่นอาจล้างฐานคั่นกลางได้ทุกเมื่อ
  test.beforeEach(async () => {
    await seedEmptyEmulator();
  });

  // ══════════════════════════════════════════════════════════
  // กฎข้อ 1 · สถานะปลายทางเปลี่ยนต่อไม่ได้
  // ══════════════════════════════════════════════════════════

  test("กฎ1 ใบที่อนุมัติแล้ว ปุ่มพิจารณาถูกปิดทั้งคู่และสถานะในฐานข้อมูลไม่ขยับ", async ({ page }) => {
    const ใบ = await createLeaveRequest({ status: STATUS.APPROVED }, "t4-terminal-approved");

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.APPROVED);

    await expect(byTestId(page, TESTID.approveButton)).toBeDisabled();
    await expect(byTestId(page, TESTID.rejectButton)).toBeDisabled();

    // ชั้นที่ 2 · ปุ่มปิดแล้วยังต้องพิสูจน์ว่าไม่มีคำสั่งเขียนหลุดออกไป
    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.APPROVED);
  });

  test("กฎ1 ใบที่ไม่อนุมัติแล้ว กดข้ามปุ่มที่ถูกปิดก็ยังเปลี่ยนสถานะไม่ได้", async ({ page }) => {
    const ใบ = await createLeaveRequest({ status: STATUS.REJECTED }, "t4-terminal-rejected");

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.approveButton)).toBeDisabled();

    await กดปุ่มแบบข้ามการปิดปุ่ม(page, TESTID.approveButton);
    await expect(await รอคำเตือน(page)).toHaveText(/สถานะสุดท้าย/);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.REJECTED);
  });

  test("กฎ1 สถานะปลายทางยังล็อกอยู่เหมือนเดิมหลังรีโหลดหน้า", async ({ page }) => {
    const ใบ = await createLeaveRequest({ status: STATUS.APPROVED }, "t4-terminal-reload");

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.APPROVED);

    // รีโหลดคือจุดที่เคยพลาดกันบ่อย เพราะหน้าจอวาดใหม่จากศูนย์
    // ถ้าโค้ดเผลอเปิดปุ่มไว้ก่อนแล้วค่อยปิด จะมีช่องว่างเสี้ยววินาทีให้กดทันพอดี
    await page.reload();
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.APPROVED);

    await expect(byTestId(page, TESTID.approveButton)).toBeDisabled();
    await expect(byTestId(page, TESTID.rejectButton)).toBeDisabled();

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.APPROVED);
  });

  test("กฎ1 ข้ามหน้าจอยิงคำสั่งเปลี่ยนสถานะใบที่ตัดสินไปแล้ว ถูก firestore.rules ปฏิเสธ", async ({ page }) => {
    const ใบ = await createLeaveRequest({ status: STATUS.APPROVED }, "t4-terminal-bypass");

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.APPROVED);

    // ด่านจริงอยู่ที่ firestore.rules ไม่ใช่ที่ปุ่ม · ข้ามหน้าจอไปเลยแล้วต้องยังถูกปฏิเสธ
    const ผล = await เรียกชั้นข้อมูลตรง(page, "updateLeaveStatus", [ใบ.id, STATUS.REJECTED]);
    expect(ผล.สำเร็จ).toBe(false);
    expect(ผล.code).toContain("permission-denied");

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.APPROVED);
  });

  // ══════════════════════════════════════════════════════════
  // กฎข้อ 2 · เปลี่ยนสถานะได้เฉพาะ manager กับ hr
  // ══════════════════════════════════════════════════════════

  test("กฎ2 พนักงานเปิดใบที่รอพิจารณา ไม่มีปุ่มพิจารณาที่กดได้ และกดข้ามก็ขึ้นคำเตือนไทย", async ({ page }) => {
    const ใบ = await createLeaveRequest(
      { requesterId: TEST_USERS.employee.uid, requesterName: TEST_USERS.employee.name },
      "t4-employee-pending"
    );

    await signInAs(page, "employee", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    await expect(byTestId(page, TESTID.approveButton)).toBeDisabled();
    await expect(byTestId(page, TESTID.rejectButton)).toBeDisabled();

    await กดปุ่มแบบข้ามการปิดปุ่ม(page, TESTID.approveButton);
    await expect(await รอคำเตือน(page)).toHaveText(/เฉพาะหัวหน้างานและฝ่ายบุคคล/);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.PENDING);
  });

  test("กฎ2 พนักงานยิงคำสั่งเปลี่ยนสถานะตรง ๆ ข้ามหน้าจอ ถูก firestore.rules ปฏิเสธ", async ({ page }) => {
    const ใบ = await createLeaveRequest(
      { requesterId: TEST_USERS.employee.uid, requesterName: TEST_USERS.employee.name },
      "t4-employee-bypass"
    );

    await signInAs(page, "employee", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    const ผล = await เรียกชั้นข้อมูลตรง(page, "updateLeaveStatus", [ใบ.id, STATUS.APPROVED]);
    expect(ผล.สำเร็จ).toBe(false);
    expect(ผล.code).toContain("permission-denied");

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.PENDING);
  });

  // ══════════════════════════════════════════════════════════
  // กฎข้อ 3 · แยกหน้าที่ · พิจารณาใบที่ตัวเองยื่นไม่ได้
  // ══════════════════════════════════════════════════════════

  test("กฎ3 หัวหน้างานเปิดใบที่ตัวเองยื่น ปุ่มพิจารณาถูกปิดพร้อมคำอธิบายภาษาไทยบนหน้าจอ", async ({ page }) => {
    const ใบ = await createLeaveRequest(
      {
        requesterId: TEST_USERS.manager.uid,
        requesterName: TEST_USERS.manager.name,
        approverId: "",
        approverName: ""
      },
      "t4-manager-own"
    );

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    // ถ้าดูแค่บทบาท หัวหน้างานควรกดได้ · ที่กดไม่ได้เพราะเป็นใบของตัวเอง
    await expect(byTestId(page, TESTID.approveButton)).toBeDisabled();
    await expect(byTestId(page, TESTID.rejectButton)).toBeDisabled();

    // ปุ่มที่กดไม่ได้โดยไม่บอกเหตุผล ทำให้ผู้ใช้คิดว่าระบบพัง จึงต้องมีข้อความไทยกำกับ
    await expect(page.getByText(/ใบลานี้เป็นใบที่คุณยื่นเอง/)).toBeVisible();

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.PENDING);
  });

  test("กฎ3 ฝ่ายบุคคลกดข้ามปุ่มที่ถูกปิดบนใบของตัวเอง ยังเปลี่ยนสถานะไม่ได้", async ({ page }) => {
    const ใบ = await createLeaveRequest(
      {
        requesterId: TEST_USERS.hr.uid,
        requesterName: TEST_USERS.hr.name,
        approverId: "",
        approverName: ""
      },
      "t4-hr-own"
    );

    await signInAs(page, "hr", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    await กดปุ่มแบบข้ามการปิดปุ่ม(page, TESTID.approveButton);
    await expect(await รอคำเตือน(page)).toHaveText(/พิจารณาใบลาของตัวเองไม่ได้/);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.PENDING);
  });

  test("กฎ3 ข้ามหน้าจอยิงคำสั่งอนุมัติใบของตัวเอง ถูก firestore.rules ปฏิเสธ", async ({ page }) => {
    // กฎเดียวกันนี้เขียนไว้สองที่ · หน้าจอ (leave-request-detail.js ด่านที่ 3)
    // และ firestore.rules บรรทัด 159 · เทสนี้พิสูจน์เฉพาะด่านฝั่งเซิร์ฟเวอร์
    const ใบ = await createLeaveRequest(
      {
        requesterId: TEST_USERS.manager.uid,
        requesterName: TEST_USERS.manager.name,
        approverId: "",
        approverName: ""
      },
      "t4-manager-own-bypass"
    );

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    const ผล = await เรียกชั้นข้อมูลตรง(page, "updateLeaveStatus", [ใบ.id, STATUS.APPROVED]);
    expect(ผล.สำเร็จ).toBe(false);
    expect(ผล.code).toContain("permission-denied");

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.PENDING);
  });

  // ══════════════════════════════════════════════════════════
  // กฎข้อ 4 · ไม่อนุมัติได้ต่อเมื่อมีความเห็นแล้วอย่างน้อย 1 รายการ
  //
  // สำคัญมาก กฎข้อนี้บังคับได้ "ในเบราว์เซอร์อย่างเดียว"
  //    ภาษาเขียนกฎของ Firestore นับจำนวนเอกสารในโฟลเดอร์ย่อยไม่ได้
  //    (ทำได้แค่ get()/exists() ทีละเอกสารที่รู้ชื่อไฟล์แน่นอนอยู่แล้ว)
  //    firestore.rules จึงตรวจข้อนี้ไม่ได้เลย · เทสสองตัวข้างล่างนี้
  //    คือด่านตรวจ "ด่านเดียวที่มีอยู่จริง" ของกฎข้อนี้ทั้งระบบ
  //    ถ้าลบเทสนี้ทิ้ง จะไม่เหลืออะไรคอยจับว่ากฎนี้พังเลย
  // ══════════════════════════════════════════════════════════

  test("กฎ4 ใบที่ยังไม่มีความเห็น กดไม่อนุมัติถูกปฏิเสธพร้อมคำเตือนไทย สถานะยังรอพิจารณา", async ({ page }) => {
    const ใบ = await createLeaveRequest({}, "t4-reject-no-comment");

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    // ปุ่มเปิดให้กดได้ เพราะบทบาทและสถานะผ่านหมด · ด่านความเห็นอยู่ตอนกด
    await byTestId(page, TESTID.rejectButton).click();
    await expect(await รอคำเตือน(page)).toHaveText(/ต้องเขียนความเห็นอย่างน้อย 1 รายการ/);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.PENDING);
  });

  test("กฎ4 เมื่อมีความเห็นแล้ว หัวหน้างานที่ไม่ใช่ผู้ยื่นกดไม่อนุมัติได้สำเร็จ", async ({ page }) => {
    const ใบ = await createLeaveRequest({}, "t4-reject-with-comment");
    await createApproval(
      ใบ.id,
      {
        authorId: TEST_USERS.manager.uid,
        authorName: TEST_USERS.manager.name,
        message: "ช่วงนั้นทีมมีงานส่งมอบพอดี ขอปฏิเสธไว้ก่อนนะครับ",
        createdAt: new Date("2026-09-01T10:00:00+07:00")
      },
      "t4-ap-reject"
    );

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    await byTestId(page, TESTID.rejectButton).click();
    // รอ "เงื่อนไขจริง" คือป้ายสถานะบนหน้าจอเปลี่ยน แล้วค่อยอ่านฐานข้อมูล
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.REJECTED);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.REJECTED);
  });

  // ══════════════════════════════════════════════════════════
  // กฎข้อ 5 · เปลี่ยนสถานะแล้วต้องเขียนเฉพาะช่อง status ช่องเดียว
  // ══════════════════════════════════════════════════════════

  test("กฎ5 อนุมัติแล้วเขียนเฉพาะช่อง status ช่องอื่นต้องอยู่ครบเหมือนเดิม", async ({ page }) => {
    // การเขียนทับทั้งเอกสารเป็นบั๊กที่ไม่มีใครเห็นตอนเกิด
    // หน้าจอยังดูปกติทุกอย่าง แต่เหตุผลกับวันที่ลาหายไปแล้วจริง ๆ ในฐานข้อมูล
    const ใบ = await createLeaveRequest({}, "t4-only-status");

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    await byTestId(page, TESTID.approveButton).click();
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.APPROVED);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน.status).toBe(STATUS.APPROVED);
    expect(ในฐาน.title).toBe(ใบ.title);
    expect(ในฐาน.reason).toBe(ใบ.reason);
    expect(ในฐาน.approverName).toBe(ใบ.approverName);
    expect(ในฐาน.startDate).toBe(ใบ.startDate);
    expect(ในฐาน.leaveTypeName).toBe(ใบ.leaveTypeName);
    expect(ในฐาน.requesterId).toBe(ใบ.requesterId);
  });

  // ══════════════════════════════════════════════════════════
  // กฎข้อ 6 · US-05 ความเห็นการอนุมัติ
  // ══════════════════════════════════════════════════════════

  test("กฎ6 ส่งความเห็นแล้วได้เอกสารใหม่ในโฟลเดอร์ย่อย approvals พร้อมชื่อ ข้อความ และเวลา", async ({ page }) => {
    const ใบ = await createLeaveRequest({}, "t4-comment-add");
    const ข้อความ = "ขอดูตารางงานของทีมช่วงนั้นก่อนนะครับ แล้วจะแจ้งผลอีกที";

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    await byTestId(page, TESTID.commentInput).fill(ข้อความ);
    await byTestId(page, TESTID.commentSubmit).click();

    // ชั้นที่ 1 · หน้าจอต้องขึ้นความเห็นใหม่ครบทั้งชื่อ ข้อความ และเวลา
    await expect(byTestId(page, TESTID.approvalItem)).toHaveCount(1);
    await expect(byTestId(page, TESTID.approvalAuthor)).toHaveText(TEST_USERS.manager.name);
    await expect(byTestId(page, TESTID.approvalMessage)).toHaveText(ข้อความ);
    await expect(byTestId(page, TESTID.approvalTime)).toHaveText(/\d{1,2}:\d{2}/);

    // ชั้นที่ 2 · ของจริงอยู่ในฐานข้อมูล ไม่ใช่ที่หน้าจอ
    const ความเห็นในฐาน = await listDocs(เส้นทางความเห็น(ใบ.id));
    expect(ความเห็นในฐาน).toHaveLength(1);
    expect(ความเห็นในฐาน[0].message).toBe(ข้อความ);
    expect(ความเห็นในฐาน[0].authorId).toBe(TEST_USERS.manager.uid);
    expect(ความเห็นในฐาน[0].authorName).toBe(TEST_USERS.manager.name);
  });

  test("กฎ6 ความเห็นเรียงจากเก่าไปใหม่ ความเห็นที่เพิ่งส่งอยู่ล่างสุด", async ({ page }) => {
    const ใบ = await createLeaveRequest({}, "t4-comment-order");
    await createApproval(
      ใบ.id,
      {
        authorId: TEST_USERS.manager.uid,
        authorName: TEST_USERS.manager.name,
        message: "ความเห็นแรกสุด เขียนไว้เมื่อต้นเดือน",
        createdAt: new Date("2026-09-01T09:00:00+07:00")
      },
      "t4-ap-order-1"
    );
    await createApproval(
      ใบ.id,
      {
        authorId: TEST_USERS.hr.uid,
        authorName: TEST_USERS.hr.name,
        message: "ความเห็นที่สอง เขียนตามมาอีกวัน",
        createdAt: new Date("2026-09-02T09:00:00+07:00")
      },
      "t4-ap-order-2"
    );

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.approvalItem)).toHaveCount(2);

    await byTestId(page, TESTID.commentInput).fill("ความเห็นที่สาม เพิ่งพิมพ์เดี๋ยวนี้");
    await byTestId(page, TESTID.commentSubmit).click();
    await expect(byTestId(page, TESTID.approvalItem)).toHaveCount(3);

    // เรียงเก่าไปใหม่เหมือนอ่านแชท · ของที่เพิ่งพิมพ์ต้องต่อท้าย ไม่ใช่แทรกขึ้นหัว
    await expect(byTestId(page, TESTID.approvalMessage)).toHaveText([
      "ความเห็นแรกสุด เขียนไว้เมื่อต้นเดือน",
      "ความเห็นที่สอง เขียนตามมาอีกวัน",
      "ความเห็นที่สาม เพิ่งพิมพ์เดี๋ยวนี้"
    ]);
  });

  test("กฎ6 ความเห็นว่างเปล่าถูกปฏิเสธพร้อมคำเตือนไทย และไม่เขียนอะไรลงฐานข้อมูล", async ({ page }) => {
    const ใบ = await createLeaveRequest({}, "t4-comment-empty");

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    // มีแต่ช่องว่างกับการขึ้นบรรทัดใหม่ ต้องถือว่าว่างเปล่าเหมือนกัน
    await byTestId(page, TESTID.commentInput).fill("   \n  ");
    await byTestId(page, TESTID.commentSubmit).click();

    await expect(await รอคำเตือน(page)).toHaveText(/กรุณาพิมพ์ความเห็นก่อนกดส่ง/);

    const ความเห็นในฐาน = await listDocs(เส้นทางความเห็น(ใบ.id));
    expect(ความเห็นในฐาน).toHaveLength(0);
  });

  // ══════════════════════════════════════════════════════════
  // กฎข้อ 7 · US-07 ลบใบลา
  // ══════════════════════════════════════════════════════════

  test("กฎ7 กดลบแล้วยกเลิกกล่องยืนยัน ใบลายังอยู่ในฐานข้อมูลและยังอยู่หน้าเดิม", async ({ page }) => {
    const ใบ = await createLeaveRequest(
      { requesterId: TEST_USERS.employee.uid, requesterName: TEST_USERS.employee.name },
      "t4-delete-dismiss"
    );

    await signInAs(page, "employee", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.deleteButton)).toBeEnabled();

    // ต้องถามยืนยันก่อนเสมอ เพราะการลบกู้คืนไม่ได้
    let ข้อความในกล่อง = "";
    const กล่องยืนยันโผล่ = new Promise((พร้อม) => {
      page.once("dialog", async (กล่อง) => {
        ข้อความในกล่อง = กล่อง.message();
        await กล่อง.dismiss();
        พร้อม();
      });
    });

    const การกด = byTestId(page, TESTID.deleteButton).click();
    await กล่องยืนยันโผล่;
    await การกด;

    expect(ข้อความในกล่อง).toContain(ใบ.title);

    // ยกเลิกแล้วต้องไม่เกิดอะไรขึ้นเลย ทั้งบนหน้าจอและในฐานข้อมูล
    await expect(byTestId(page, TESTID.detailTitle)).toHaveText(ใบ.title);
    expect(page.url()).toContain(PAGES.leaveRequestDetail);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน).not.toBeNull();
    expect(ในฐาน.status).toBe(STATUS.PENDING);
  });

  test("กฎ7 กดลบแล้วยืนยัน ใบลาหายจากฐานข้อมูลและเบราว์เซอร์กลับไปหน้ารายการ", async ({ page }) => {
    const ใบ = await createLeaveRequest(
      { requesterId: TEST_USERS.employee.uid, requesterName: TEST_USERS.employee.name },
      "t4-delete-accept"
    );

    await signInAs(page, "employee", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.deleteButton)).toBeEnabled();

    const กล่องยืนยันโผล่ = new Promise((พร้อม) => {
      page.once("dialog", async (กล่อง) => {
        await กล่อง.accept();
        พร้อม();
      });
    });

    const การกด = byTestId(page, TESTID.deleteButton).click();
    await กล่องยืนยันโผล่;
    await การกด;

    await page.waitForURL(`**${PAGES.leaveRequests}`);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน).toBeNull();
  });

  test("กฎ7 ใบที่ตัดสินไปแล้วลบไม่ได้ ปุ่มถูกปิดและกดข้ามก็ขึ้นคำเตือนไทย", async ({ page }) => {
    const ใบ = await createLeaveRequest(
      {
        status: STATUS.APPROVED,
        requesterId: TEST_USERS.employee.uid,
        requesterName: TEST_USERS.employee.name
      },
      "t4-delete-approved"
    );

    await signInAs(page, "employee", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.APPROVED);
    await expect(byTestId(page, TESTID.deleteButton)).toBeDisabled();

    // ใบที่ตัดสินแล้วคือประวัติขององค์กร ไม่ใช่ของส่วนตัวอีกต่อไป
    await กดปุ่มแบบข้ามการปิดปุ่ม(page, TESTID.deleteButton);
    await expect(await รอคำเตือน(page)).toHaveText(/ลบได้เฉพาะใบลาที่สถานะยังเป็น/);

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน).not.toBeNull();
    expect(ในฐาน.status).toBe(STATUS.APPROVED);
  });

  test("กฎ7 คนที่ไม่ใช่ผู้ยื่นลบไม่ได้ แม้จะเป็นหัวหน้างาน", async ({ page }) => {
    const ใบ = await createLeaveRequest(
      { requesterId: TEST_USERS.employee.uid, requesterName: TEST_USERS.employee.name },
      "t4-delete-not-owner"
    );

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);
    await expect(byTestId(page, TESTID.deleteButton)).toBeDisabled();

    // ข้ามหน้าจอไปเลย · ด่านจริงคือ firestore.rules ต้องปฏิเสธเองได้
    const ผล = await เรียกชั้นข้อมูลตรง(page, "deleteLeaveRequest", [ใบ.id]);
    expect(ผล.สำเร็จ).toBe(false);
    expect(ผล.code).toContain("permission-denied");

    const ในฐาน = await readDoc(เส้นทางใบลา(ใบ.id));
    expect(ในฐาน).not.toBeNull();
  });

  // ══════════════════════════════════════════════════════════
  // กันสคริปต์แปลกปลอม (XSS) · หัวข้อกับเหตุผลเป็นข้อความอิสระที่ผู้ใช้พิมพ์เอง
  // ══════════════════════════════════════════════════════════

  test("XSS หัวข้อและเหตุผลที่มีแท็ก HTML ต้องแสดงเป็นตัวอักษรธรรมดา ไม่ถูกรันเป็นโค้ด", async ({ page }) => {
    const ของอันตราย = '<img src=x onerror="window.__pwned=1">';
    const ใบ = await createLeaveRequest({ title: ของอันตราย, reason: ของอันตราย }, "t4-xss");

    await signInAs(page, "manager", { goto: detailUrl(ใบ.id) });
    await expect(byTestId(page, TESTID.detailStatus)).toHaveText(STATUS.PENDING);

    // 1. ต้องเห็นเป็นตัวอักษรตามที่พิมพ์มาเป๊ะ ๆ ไม่ใช่หายไปเพราะกลายเป็นแท็ก
    await expect(byTestId(page, TESTID.detailTitle)).toHaveText(ของอันตราย);
    await expect(byTestId(page, TESTID.detailReason)).toHaveText(ของอันตราย);

    // 2. ต้องไม่มี element ถูกฉีดเข้ามาจริงในช่องเหล่านั้น
    await expect(byTestId(page, TESTID.detailTitle).locator("img")).toHaveCount(0);
    await expect(byTestId(page, TESTID.detailReason).locator("img")).toHaveCount(0);

    // 3. และโค้ดใน onerror ต้องไม่เคยถูกรันเลย
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});
