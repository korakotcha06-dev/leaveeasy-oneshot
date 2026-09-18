// ─────────────────────────────────────────────────────────────
// js/leave-types.js — หน้าที่ 4 จัดการประเภทการลา
// สัปดาห์ที่ 7: เพิ่ม แก้ ลบ ลงโฟลเดอร์ leaveTypes บน Firestore จริง
// สัปดาห์ที่ 8: จัดการได้เฉพาะฝ่ายบุคคล (hr) · บทบาทอื่นเห็นตารางอย่างเดียว (ACL.md)
// ─────────────────────────────────────────────────────────────

import {
  db, hasConfig, collection, getDocs, addDoc, doc, updateDoc, deleteDoc
} from "./firebase.js";
import { requireLogin } from "./auth.js";

const ที่วางตาราง = document.getElementById("ตารางประเภท");
const ช่องชื่อใหม่ = document.getElementById("ชื่อประเภทใหม่");
const กล่องเตือน = document.getElementById("เตือนประเภท");
const ปุ่มเพิ่ม = document.getElementById("ปุ่มเพิ่ม");

let รายการ = [];
let แก้ได้ = false;      // เฉพาะฝ่ายบุคคล

เริ่มทำงาน();

async function เริ่มทำงาน() {
  if (!hasConfig) {
    showConfigWarning("จึงยังจัดการประเภทการลาไม่ได้");
    ปุ่มเพิ่ม.disabled = true;
    ที่วางตาราง.innerHTML = "";
    return;
  }
  // ⏳ ต้องรอให้รู้สถานะล็อกอินก่อน แล้วค่อยอ่านข้อมูลจากฐานข้อมูล
  const ผู้ใช้ = await requireLogin();
  if (!ผู้ใช้) return;

  แก้ได้ = ผู้ใช้.role === "hr";
  if (แก้ได้) {
    ปุ่มเพิ่ม.addEventListener("click", เพิ่มประเภท);
  } else {
    // ซ่อนเฉพาะกล่องเพิ่มกับปุ่มในตาราง ไม่ซ่อนทั้งหน้า — ทุกคนยังดูได้ว่ามีประเภทอะไรบ้าง
    ช่องชื่อใหม่.closest(".card").classList.add("hidden");
    document.querySelector(".subtitle").textContent =
      "ประเภทการลาที่ใช้ได้ในระบบ · เพิ่ม แก้ ลบ ได้เฉพาะฝ่ายบุคคล";
  }
  await โหลดรายการ();
}

async function โหลดรายการ() {
  ที่วางตาราง.innerHTML = "<p>กำลังโหลดข้อมูล…</p>";
  try {
    const ผล = await getDocs(collection(db, "leaveTypes"));
    รายการ = ผล.docs.map((f) => ({ id: f.id, ...f.data() }));
    วาดตาราง();
  } catch (e) {
    ที่วางตาราง.innerHTML = "";
    const กล่อง = document.createElement("div");
    กล่อง.className = "alert alert-error";
    เตือนพร้อมไอคอน(กล่อง, "error", "อ่านข้อมูลไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
    ที่วางตาราง.appendChild(กล่อง);
  }
}

function วาดตาราง() {
  if (รายการ.length === 0) {
    ที่วางตาราง.innerHTML = "<p>ยังไม่มีประเภทการลาในระบบ</p>";
    return;
  }

  let html = "<table><thead><tr><th>ชื่อประเภทการลา</th>" +
    (แก้ได้ ? "<th>จัดการ</th>" : "") + "</tr></thead><tbody>";
  รายการ.forEach((ประเภท) => {
    html += "<tr><td>" + esc(ประเภท.name) + "</td>";
    if (แก้ได้) {
      html += "<td>" +
        '<button type="button" class="btn-ghost" data-edit="' + esc(ประเภท.id) + '">แก้ไข</button> ' +
        '<button type="button" class="btn-danger" data-del="' + esc(ประเภท.id) + '">ลบ</button>' +
        "</td>";
    }
    html += "</tr>";
  });
  html += "</tbody></table>";
  ที่วางตาราง.innerHTML = html;

  ที่วางตาราง.querySelectorAll("[data-edit]").forEach((ปุ่ม) => {
    ปุ่ม.addEventListener("click", () => แก้ประเภท(ปุ่ม.dataset.edit));
  });
  ที่วางตาราง.querySelectorAll("[data-del]").forEach((ปุ่ม) => {
    ปุ่ม.addEventListener("click", () => ลบประเภท(ปุ่ม.dataset.del));
  });
}

async function เพิ่มประเภท() {
  const ชื่อ = ช่องชื่อใหม่.value.trim();
  if (!ชื่อ) {
    เตือน("พิมพ์ชื่อประเภทการลาก่อน จึงจะเพิ่มได้");
    return;
  }
  กล่องเตือน.classList.add("hidden");

  ปุ่มเพิ่ม.disabled = true;
  ปุ่มเพิ่ม.textContent = "กำลังเพิ่ม…";
  try {
    await addDoc(collection(db, "leaveTypes"), { name: ชื่อ });
    ช่องชื่อใหม่.value = "";
    await โหลดรายการ();
  } catch (e) {
    เตือน("เพิ่มไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
  } finally {
    ปุ่มเพิ่ม.disabled = false;
    ปุ่มเพิ่ม.textContent = "เพิ่มประเภทการลา";
  }
}

async function แก้ประเภท(id) {
  const ประเภท = รายการ.find((t) => t.id === id);
  const ชื่อใหม่ = prompt("แก้ชื่อประเภทการลา", ประเภท.name);
  if (ชื่อใหม่ === null) return;                       // กดยกเลิก
  if (!ชื่อใหม่.trim()) { เตือน("ชื่อประเภทการลาว่างเปล่าไม่ได้"); return; }

  try {
    await updateDoc(doc(db, "leaveTypes", id), { name: ชื่อใหม่.trim() });
    await โหลดรายการ();
  } catch (e) {
    เตือน("แก้ไขไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
  }
}

async function ลบประเภท(id) {
  const ประเภท = รายการ.find((t) => t.id === id);
  if (!confirm('ยืนยันการลบประเภท "' + ประเภท.name + '" หรือไม่')) return;

  try {
    await deleteDoc(doc(db, "leaveTypes", id));
    await โหลดรายการ();
  } catch (e) {
    เตือน("ลบไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
  }
}

function เตือน(ข้อความ) {
  เตือนพร้อมไอคอน(กล่องเตือน, "error", ข้อความ);
  กล่องเตือน.classList.remove("hidden");
}

function แปลข้อผิดพลาด(e) {
  if (String(e && e.code).includes("permission-denied")) {
    return "ฐานข้อมูลปฏิเสธ · ประเภทการลาแก้ได้เฉพาะฝ่ายบุคคล";
  }
  return (e && e.message) || String(e);
}
