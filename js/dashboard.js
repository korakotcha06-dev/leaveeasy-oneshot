// ─────────────────────────────────────────────────────────────
// js/dashboard.js — หน้าที่ 5 แดชบอร์ดสรุป
// นับจากข้อมูลจริงใน Firestore · ห้ามพิมพ์ตัวเลขค้างไว้ในโค้ด
//
// สัปดาห์ที่ 8: นับเฉพาะใบที่ผู้ใช้คนนั้นมีสิทธิ์เห็น (spec หน้าที่ 5)
//    ผู้ขอลา = ใบของตัวเอง · ผู้อนุมัติและฝ่ายบุคคล = ทุกใบ
// ─────────────────────────────────────────────────────────────

import { db, hasConfig, collection, getDocs, query, where } from "./firebase.js";
import { requireLogin, เป็นผู้พิจารณา } from "./auth.js";

const สถานะทั้งหมด = ["รอพิจารณา", "อนุมัติ", "ไม่อนุมัติ"];
const กล่องตัวเลข = document.getElementById("กล่องตัวเลข");
const ที่วางรายการ = document.getElementById("ใบลาล่าสุด");

เริ่มทำงาน();

async function เริ่มทำงาน() {
  if (!hasConfig) {
    showConfigWarning("จึงยังนับตัวเลขจากฐานข้อมูลไม่ได้");
    return;
  }
  // ต้องรอให้รู้สถานะล็อกอินก่อน แล้วค่อยอ่านข้อมูลจากฐานข้อมูล
  const ผู้ใช้ = await requireLogin();
  if (!ผู้ใช้) return;

  if (!เป็นผู้พิจารณา(ผู้ใช้)) {
    document.querySelector(".subtitle").textContent =
      "ภาพรวมใบลาของคุณ กดที่กล่องตัวเลขเพื่อดูเฉพาะสถานะนั้น";
  }

  try {
    // ผู้ขอลาต้องขอเฉพาะใบของตัวเองตั้งแต่ในคำสั่ง ไม่งั้นกฎปฏิเสธทั้งก้อน
    const คำสั่ง = เป็นผู้พิจารณา(ผู้ใช้)
      ? collection(db, "leaveRequests")
      : query(collection(db, "leaveRequests"), where("requesterId", "==", ผู้ใช้.uid));
    const ผล = await getDocs(คำสั่ง);
    const ใบลาทั้งหมด = ผล.docs.map((f) => ({ id: f.id, ...f.data() }));
    วาดตัวเลข(ใบลาทั้งหมด);
    วาดรายการล่าสุด(ใบลาทั้งหมด);
  } catch (e) {
    ที่วางรายการ.innerHTML = "";
    const กล่อง = document.createElement("div");
    เตือนพร้อมไอคอน(กล่อง, "error", "อ่านข้อมูลไม่สำเร็จ — " + แปลข้อผิดพลาด(e));
    กล่อง.className = "alert alert-error";
    กล่อง.setAttribute("role", "alert");
    ที่วางรายการ.appendChild(กล่อง);
  }
}

function วาดตัวเลข(รายการ) {
  กล่องตัวเลข.innerHTML = สถานะทั้งหมด.map((สถานะ) => {
    const จำนวน = รายการ.filter((ใบ) => ใบ.status === สถานะ).length;
    // กดกล่องตัวเลข แล้วไปหน้ารายการที่กรองสถานะนั้นไว้
    return '<a class="stat" href="leave-requests.html?status=' + encodeURIComponent(สถานะ) + '">' +
           '<div class="number">' + จำนวน + "</div>" +
           "<div>" + ป้ายสถานะ(สถานะ) + "</div></a>";
  }).join("");
}

function วาดรายการล่าสุด(รายการ) {
  const ล่าสุด = รายการ
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))   // ใหม่ไปเก่า
    .slice(0, 5);

  if (ล่าสุด.length === 0) {
    ที่วางรายการ.innerHTML =
      '<div class="empty-state">' +
      '<div class="mark">' + ไอคอน("inbox") + "</div>" +
      "<h2>ยังไม่มีใบขอลา</h2>" +
      '<div class="btn-row"><a class="btn" href="new-leave-request.html">ยื่นใบลาใบแรก</a></div>' +
      "</div>";
    return;
  }

  ที่วางรายการ.innerHTML =
    "<table><thead><tr><th>หัวข้อ</th><th>ผู้ขอลา</th><th>สถานะ</th></tr></thead><tbody>" +
    ล่าสุด.map((ใบ) => {
      const ที่อยู่ = "leave-request-detail.html?id=" + encodeURIComponent(ใบ.id);
      return '<tr class="clickable" data-href="' + esc(ที่อยู่) + '">' +
        '<td><a class="row-link" href="' + esc(ที่อยู่) + '">' + esc(ใบ.title) + "</a></td>" +
        "<td>" + esc(ใบ.requesterName) + "</td><td>" + ป้ายสถานะ(ใบ.status) + "</td></tr>";
    }).join("") +
    "</tbody></table>";

  ที่วางรายการ.querySelectorAll("tr.clickable").forEach((แถว) => {
    แถว.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      location.href = แถว.dataset.href;
    });
  });
}

function แปลข้อผิดพลาด(e) {
  if (String(e && e.code).includes("permission-denied")) {
    return "ฐานข้อมูลปฏิเสธการอ่าน · ตรวจว่าล็อกอินแล้วหรือยัง";
  }
  return (e && e.message) || String(e);
}
