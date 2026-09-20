// ─────────────────────────────────────────────────────────────
// tests/smoke.spec.js — เทสพิสูจน์ว่า "เครื่องมือทดสอบ" ใช้งานได้จริง
//
// ไม่ได้ทดสอบฟีเจอร์ของแอป และจงใจไม่แตะเนื้อหาในหน้าเว็บ
// เพราะหน้าเว็บกำลังถูกเขียนใหม่ · เทสชุดนี้ต้องไม่พังตามไปด้วย
//
// สิ่งที่พิสูจน์
//   1. Playwright เปิดเบราว์เซอร์และเข้าถึง hosting ที่พอร์ต 5050 ได้
//   2. เรายิงคำสั่งล้างและเขียน Firestore ของ emulator ได้
//   3. เราสร้างบัญชีใน Auth emulator ได้ และ uid ออกมาตามที่กำหนด
//
// ถ้าเทสไฟล์นี้เขียว แปลว่าฐานของชุดทดสอบพร้อม
// เทสฟีเจอร์ที่เขียนทีหลังล้ม = ปัญหาอยู่ที่แอป ไม่ใช่ที่เครื่องมือ
// ─────────────────────────────────────────────────────────────

const { test, expect } = require("@playwright/test");
const {
  PORTS, PROJECT_ID, TEST_USERS,
  resetEmulator, writeDoc, readDoc, listDocs, createTestAuthUsers, assertEmulatorRunning
} = require("./fixtures");

test.describe("ฐานของชุดทดสอบ", () => {

  test("ต่อ Firebase emulator ได้ทั้ง Firestore และ Auth", async () => {
    await expect(assertEmulatorRunning()).resolves.toBe(true);
  });

  test("เปิดหน้าเว็บจาก hosting พอร์ต 5050 ได้", async ({ page, baseURL }) => {
    // กันพลาดเรื่องพอร์ตตั้งแต่ก่อนเปิดหน้า
    expect(new URL(baseURL).port).toBe(String(PORTS.hosting));

    const ผล = await page.goto("/");

    // จงใจไม่เช็คว่าเป็น 200 และไม่เช็คเนื้อหาในหน้า
    // เทสไฟล์นี้พิสูจน์ "เครื่องมือ" ไม่ใช่ "แอป" · หน้าเว็บยังถูกเขียนใหม่อยู่
    // ขอแค่เซิร์ฟเวอร์ตอบกลับมา ไม่ใช่ต่อไม่ติดหรือพังฝั่งเซิร์ฟเวอร์
    expect(ผล.status()).toBeLessThan(500);

    // ยืนยันว่าเบราว์เซอร์อยู่ที่พอร์ต 5050 จริง ไม่ใช่ 3000
    // ข้อนี้สำคัญกว่าเนื้อหาในหน้า เพราะพอร์ตคือตัวตัดสินว่าแอปคุยกับฐานไหน
    expect(new URL(page.url()).port).toBe(String(PORTS.hosting));

    // มีเอกสาร HTML จริง ไม่ใช่การต่อไม่ติด
    await expect(page.locator("html")).toHaveCount(1);
  });

  test("ล้างแล้วเขียนเอกสารลง Firestore emulator ได้", async () => {
    await resetEmulator();

    // ล้างแล้วต้องไม่เหลืออะไร
    expect(await listDocs("smokeCheck")).toEqual([]);

    await writeDoc("smokeCheck/doc1", {
      ข้อความ: "สวัสดี",
      จำนวน: 42,
      ใช้งาน: true,
      ว่าง: null
    });

    const อ่านกลับ = await readDoc("smokeCheck/doc1");
    expect(อ่านกลับ).toMatchObject({
      id: "doc1",
      ข้อความ: "สวัสดี",
      จำนวน: 42,
      ใช้งาน: true,
      ว่าง: null
    });

    expect(await listDocs("smokeCheck")).toHaveLength(1);

    // เขียนซ้ำที่เดิมต้องทับได้ ไม่ใช่ error ว่ามีอยู่แล้ว
    await writeDoc("smokeCheck/doc1", { ข้อความ: "เขียนทับ" });
    expect((await readDoc("smokeCheck/doc1")).ข้อความ).toBe("เขียนทับ");

    // เอกสารในโฟลเดอร์ย่อยก็เขียนได้ (ใช้กับ approvals ภายหลัง)
    await writeDoc("smokeCheck/doc1/ย่อย/a1", { note: "ok" });
    expect(await listDocs("smokeCheck/doc1/ย่อย")).toHaveLength(1);

    await resetEmulator();
    expect(await readDoc("smokeCheck/doc1")).toBeNull();
  });

  test("สร้างบัญชีทดสอบ 3 บทบาทใน Auth emulator ได้ และ uid คงที่", async () => {
    await resetEmulator();
    const บัญชี = await createTestAuthUsers();

    expect(Object.keys(บัญชี).sort()).toEqual(["employee", "hr", "manager"]);

    // uid ต้องเป็นค่าที่เรากำหนดเอง ไม่ใช่ค่าสุ่ม
    // ข้อนี้คือสิ่งที่ทำให้ seed ข้อมูลที่อ้างถึงตัวคนล่วงหน้าได้
    expect(บัญชี.employee.uid).toBe("uid-employee-u001");
    expect(บัญชี.manager.uid).toBe("uid-manager-u002");
    expect(บัญชี.hr.uid).toBe("uid-hr-u003");

    // ล็อกอินด้วยรหัสผ่านที่ตั้งไว้ได้จริง (ยิงตรงเข้า Auth emulator ไม่ผ่านหน้าเว็บ)
    const ผล = await fetch(
      `http://127.0.0.1:${PORTS.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: บัญชี.manager.email,
          password: บัญชี.manager.password,
          returnSecureToken: true
        })
      }
    );
    expect(ผล.ok).toBe(true);
    const ก้อน = await ผล.json();
    expect(ก้อน.localId).toBe(บัญชี.manager.uid);

    await resetEmulator();
  });

  test("ใช้ projectId เดียวกับ .firebaserc (emulator เปิด singleProjectMode)", () => {
    expect(PROJECT_ID).toBe("leaveeasy-korakot");
    expect(TEST_USERS.employee.role).toBe("employee");
  });
});
