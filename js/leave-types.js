// ─────────────────────────────────────────────────────────────
// js/leave-types.js — พฤติกรรมของหน้า leave-types.html
//
// หน้านี้ต้องล็อกอินก่อนเสมอ กฎความปลอดภัยจริงอยู่ที่ firestore.rules
// (เฉพาะ hr เพิ่ม/แก้/ลบได้) หน้านี้แค่เรียกใช้ ไม่ตรวจ role เอง
// ถ้า employee หรือ manager กดเพิ่ม/แก้/ลบ คำสั่งจะถูก Firestore ปฏิเสธ
// แล้ว describeError() จะแปลเป็นข้อความไทยให้เห็นว่าไม่มีสิทธิ์
//
// เรื่องแก้ไขชื่อ: ตั้งใจ "ไม่" ใช้ window.prompt() เพราะกล่องข้อความของเบราว์เซอร์
// เป็น modal ที่หยุดทั้งหน้าเว็บรอผู้ใช้ตอบ ชุดทดสอบอัตโนมัติที่ขับเคลื่อนหน้าเว็บ
// จะส่งคำสั่งต่อไปไม่ได้เลยระหว่างที่กล่องเปิดอยู่ ทำให้หน้านี้เทสไม่ได้จริง
// จึงใช้วิธีเปลี่ยนแถวนั้นให้กลายเป็นช่องกรอกในตารางแทน (inline edit)
// ส่วนการลบยังใช้ window.confirm() ตามเดิม เพราะเป็นการกระทำที่ทำลายข้อมูล
// ควรมีการยืนยันก่อนเสมอ และ confirm() เป็นรูปแบบที่ชุดทดสอบรับมือได้ตรงไปตรงมา
// (สั่งกดตกลงหรือกดยกเลิกได้ ไม่ได้บล็อกการทดสอบเหมือนกรณีต้องพิมพ์ข้อความกลับ)
// ─────────────────────────────────────────────────────────────

import { requireAuth } from "./auth.js";
import {
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType
} from "./data.js";
import { byTestId, showError, clearError, describeError, escapeHtml } from "./util.js";

const ช่องผิดพลาด = byTestId("error-message");
const ช่องชื่อใหม่ = byTestId("type-name-input");
const ปุ่มเพิ่ม = byTestId("type-add-button");
const ฟอร์มเพิ่ม = document.getElementById("add-type-form");
const ป้ายเฉพาะฝ่ายบุคคล = byTestId("hr-required-notice");
const ตารางบอดี้ = document.getElementById("type-list-body");

// เก็บรายการล่าสุดไว้ในตัวแปรนี้ เพื่อวาดตารางใหม่ได้โดยไม่ต้องยิงคำขอซ้ำ
// ทุกครั้งที่แค่จะสลับแถวใดแถวหนึ่งเข้า/ออกจากโหมดแก้ไข
let รายการปัจจุบัน = [];

// id ของแถวที่กำลังอยู่ในโหมดแก้ไขอยู่ตอนนี้ · null = ไม่มีแถวไหนกำลังแก้ไข
// แก้ได้ทีละแถวพอ เพราะหน้าจอเล็ก ไม่มีเหตุผลต้องรองรับแก้พร้อมกันหลายแถว
let idที่กำลังแก้ไข = null;

// เฉพาะฝ่ายบุคคล (role === "hr") เท่านั้นที่แก้ไขหน้านี้ได้ ตามสเปกหัวข้อ 4
// (ซ่อนหน้านี้จากผู้ที่ไม่ใช่ฝ่ายบุคคล — รายการเดิมตกหล่นไปตอนย่อ contract.md)
//
// ตั้งค่าเริ่มต้นเป็น false (มุมมองอ่านอย่างเดียว) โดยตั้งใจ — "fail closed"
// ถ้า role อ่านไม่ได้ (getUser คืน null แล้ว auth.js ให้ role เป็น "") ต้องได้มุมมองอ่านอย่างเดียว
// ไม่ใช่มุมมองแก้ไขเป็นค่าเริ่มต้นเพราะยังไม่รู้ว่าใครเป็นใคร ความปลอดภัยจริงอยู่ที่ firestore.rules
// อยู่แล้ว แต่การซ่อนปุ่มไว้ก่อนกดทำให้ไม่รู้สึกว่าระบบพังเมื่อโดนปฏิเสธ
let เป็นฝ่ายบุคคล = false;

async function เริ่มทำงาน() {
  const ผู้ใช้ = await requireAuth();
  if (!ผู้ใช้) return; // requireAuth กำลังพาไปหน้า login.html อยู่

  เป็นฝ่ายบุคคล = ผู้ใช้.role === "hr";

  if (เป็นฝ่ายบุคคล) {
    ฟอร์มเพิ่ม.hidden = false;
  } else {
    // เอาฟอร์มเพิ่มออกจาก DOM ทั้งก้อน ไม่ใช่แค่ซ่อนด้วย hidden/CSS
    // เพราะต้องแยกให้ชัดเจนระหว่าง "ไม่มีสิทธิ์ทำ" กับ "มีสิทธิ์แต่ปุ่มถูกปิดไว้เฉย ๆ"
    // ชุดทดสอบจึงเช็คได้ตรง ๆ ว่า type-add-button ไม่มีอยู่ใน DOM เลยสำหรับคนที่ไม่ใช่ hr
    ฟอร์มเพิ่ม.remove();
    ป้ายเฉพาะฝ่ายบุคคล.hidden = false;
  }

  await โหลดรายการ();
}

async function โหลดรายการ() {
  clearError(ช่องผิดพลาด);
  try {
    รายการปัจจุบัน = await listLeaveTypes();
    idที่กำลังแก้ไข = null; // โหลดข้อมูลใหม่ทั้งชุด ถือว่าเลิกโหมดแก้ไขที่ค้างอยู่ไปด้วย
    วาดตาราง();
  } catch (err) {
    showError(ช่องผิดพลาด, describeError(err));
  }
}

// วาดตารางใหม่ทั้งก้อนทุกครั้งที่ข้อมูลเปลี่ยนหรือสลับโหมดแก้ไข
// ง่ายและพอสำหรับข้อมูลหลักสิบแถวของงานนี้ ไม่ต้องทำ diff แบบซับซ้อน
function วาดตาราง() {
  if (!รายการปัจจุบัน.length) {
    ตารางบอดี้.innerHTML = `<tr><td colspan="2" class="empty">ยังไม่มีประเภทการลาในระบบ</td></tr>`;
    return;
  }

  ตารางบอดี้.innerHTML = รายการปัจจุบัน.map(วาดแถว).join("");

  // ถ้ามีแถวที่อยู่ในโหมดแก้ไข ให้โฟกัสช่องกรอกให้ทันที ผู้ใช้จะได้พิมพ์ต่อได้เลย
  if (idที่กำลังแก้ไข !== null) {
    const ช่องแก้ไข = byTestId("type-edit-input", ตารางบอดี้);
    if (ช่องแก้ไข) {
      ช่องแก้ไข.focus();
      ช่องแก้ไข.select();
    }
  }
}

function วาดแถว(ประเภท) {
  const idปลอดภัย = escapeHtml(ประเภท.id);

  if (!เป็นฝ่ายบุคคล) {
    // มุมมองอ่านอย่างเดียวสำหรับคนที่ไม่ใช่ฝ่ายบุคคล — ไม่มีปุ่มแก้ไข/ลบให้กดเลย
    // ไม่ใช่ปุ่มที่ปิด (disabled) แต่เป็นการไม่วางปุ่มลงไปใน DOM ตั้งแต่แรก
    return `
      <tr data-testid="type-row" data-id="${idปลอดภัย}">
        <td data-testid="type-row-name">${escapeHtml(ประเภท.name)}</td>
        <td></td>
      </tr>`;
  }

  if (ประเภท.id === idที่กำลังแก้ไข) {
    // โหมดแก้ไข — สลับช่องแสดงชื่อเป็นช่องกรอก พร้อมปุ่มบันทึก/ยกเลิกแทนปุ่มแก้ไข/ลบ
    return `
      <tr data-testid="type-row" data-id="${idปลอดภัย}">
        <td>
          <input
            class="field-input"
            type="text"
            data-testid="type-edit-input"
            value="${escapeHtml(ประเภท.name)}"
            autocomplete="off"
          />
        </td>
        <td>
          <button type="button" class="btn btn-primary" data-testid="type-edit-save">บันทึก</button>
          <button type="button" class="btn btn-ghost" data-testid="type-edit-cancel">ยกเลิก</button>
        </td>
      </tr>`;
  }

  // โหมดปกติ — แสดงชื่อเฉย ๆ พร้อมปุ่มแก้ไขและลบ
  return `
    <tr data-testid="type-row" data-id="${idปลอดภัย}">
      <td data-testid="type-row-name">${escapeHtml(ประเภท.name)}</td>
      <td>
        <button type="button" class="btn btn-ghost" data-testid="type-edit-button">แก้ไข</button>
        <button type="button" class="btn btn-danger" data-testid="type-delete-button">ลบ</button>
      </td>
    </tr>`;
}

// ── เพิ่มประเภทการลาใหม่ ──────────────────────────────────────
ฟอร์มเพิ่ม.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!เป็นฝ่ายบุคคล) return; // กันไว้เผื่อ event นี้ยิงมาได้ทั้งที่ฟอร์มควรถูกลบไปแล้ว
  clearError(ช่องผิดพลาด);

  const ชื่อ = ช่องชื่อใหม่.value.trim();
  if (!ชื่อ) {
    showError(ช่องผิดพลาด, "กรุณากรอกชื่อประเภทการลา");
    return;
  }

  ปุ่มเพิ่ม.disabled = true;
  try {
    await createLeaveType(ชื่อ);
    ช่องชื่อใหม่.value = "";
    await โหลดรายการ(); // โหลดใหม่ทันที ตารางจะเห็นแถวที่เพิ่งเพิ่มโดยไม่ต้องรีเฟรชหน้า
  } catch (err) {
    showError(ช่องผิดพลาด, describeError(err));
  } finally {
    ปุ่มเพิ่ม.disabled = false;
  }
});

// บันทึกชื่อใหม่ของแถวที่กำลังแก้ไขอยู่ แยกเป็นฟังก์ชันเพราะเรียกได้สองทาง
// (กดปุ่มบันทึก หรือกด Enter ในช่องกรอก)
async function บันทึกการแก้ไข(id, ช่องแก้ไข, ปุ่มบันทึก) {
  const ชื่อใหม่ = ช่องแก้ไข.value.trim();
  if (!ชื่อใหม่) {
    showError(ช่องผิดพลาด, "ชื่อประเภทการลาห้ามเป็นค่าว่าง");
    return;
  }

  clearError(ช่องผิดพลาด);
  ปุ่มบันทึก.disabled = true;
  try {
    await updateLeaveType(id, ชื่อใหม่);
    await โหลดรายการ();
  } catch (err) {
    showError(ช่องผิดพลาด, describeError(err));
    ปุ่มบันทึก.disabled = false;
  }
}

// ── แก้ไข / ลบ ────────────────────────────────────────────────
//
// ใช้ event delegation ตัวเดียวจับทั้งตาราง แทนที่จะผูก listener ทีละแถว
// เพราะแถวถูกวาดใหม่ทั้งก้อนทุกครั้งที่ข้อมูลเปลี่ยน (ผูกทีละแถวจะหลุดหายไปพร้อมแถวเก่า)
ตารางบอดี้.addEventListener("click", async (event) => {
  if (!เป็นฝ่ายบุคคล) return; // มุมมองอ่านอย่างเดียวไม่มีปุ่มให้กดอยู่แล้ว กันซ้ำไว้อีกชั้น
  const แถว = event.target.closest("[data-testid='type-row']");
  if (!แถว) return;
  const id = แถว.dataset.id;

  if (event.target.matches("[data-testid='type-edit-button']")) {
    // เข้าโหมดแก้ไขแถวนี้ (แถวอื่นที่อาจกำลังแก้ไขค้างอยู่จะถูกยกเลิกไปโดยธรรมชาติ
    // เพราะวาดตารางใหม่ทั้งก้อน มีได้แค่ id เดียวในตัวแปร idที่กำลังแก้ไข)
    clearError(ช่องผิดพลาด);
    idที่กำลังแก้ไข = id;
    วาดตาราง();
    return;
  }

  if (event.target.matches("[data-testid='type-edit-cancel']")) {
    // ยกเลิก — กลับเป็นค่าดิบจาก รายการปัจจุบัน โดยไม่เรียก updateLeaveType เลย
    idที่กำลังแก้ไข = null;
    clearError(ช่องผิดพลาด);
    วาดตาราง();
    return;
  }

  if (event.target.matches("[data-testid='type-edit-save']")) {
    const ช่องแก้ไข = byTestId("type-edit-input", แถว);
    await บันทึกการแก้ไข(id, ช่องแก้ไข, event.target);
    return;
  }

  if (event.target.matches("[data-testid='type-delete-button']")) {
    const ยืนยันแล้ว = window.confirm("ต้องการลบประเภทการลานี้หรือไม่");
    if (!ยืนยันแล้ว) return;

    try {
      await deleteLeaveType(id);
      await โหลดรายการ();
    } catch (err) {
      showError(ช่องผิดพลาด, describeError(err));
    }
  }
});

// กด Enter ในช่องแก้ไข = บันทึกทันที (สะดวกกว่าต้องเอื้อมไปกดปุ่ม)
// กด Escape = ยกเลิกโหมดแก้ไข
ตารางบอดี้.addEventListener("keydown", async (event) => {
  if (!เป็นฝ่ายบุคคล) return;
  if (!event.target.matches("[data-testid='type-edit-input']")) return;

  const แถว = event.target.closest("[data-testid='type-row']");
  if (!แถว) return;
  const id = แถว.dataset.id;

  if (event.key === "Enter") {
    event.preventDefault();
    const ปุ่มบันทึก = byTestId("type-edit-save", แถว);
    await บันทึกการแก้ไข(id, event.target, ปุ่มบันทึก);
  } else if (event.key === "Escape") {
    event.preventDefault();
    idที่กำลังแก้ไข = null;
    clearError(ช่องผิดพลาด);
    วาดตาราง();
  }
});

เริ่มทำงาน();
