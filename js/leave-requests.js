// ─────────────────────────────────────────────────────────────
// js/leave-requests.js — หน้าที่ 1 รายการใบลา
// อ่านจากโฟลเดอร์ leaveRequests บน Firestore
//
// สัปดาห์ที่ 8: ผู้ขอลาเห็นเฉพาะใบของตัวเอง · ผู้อนุมัติและฝ่ายบุคคลเห็นทุกใบ (ACL.md)
// ─────────────────────────────────────────────────────────────

import {
  db, ตั้งค่าครบแล้ว, collection, getDocs, query, where, orderBy, limit
} from "./firebase.js";
import { requireLogin, เป็นผู้พิจารณา } from "./auth.js";

// ดึงมาไม่เกินเท่านี้ต่อการเปิดหนึ่งครั้ง
// spec ข้อ 9 ห้ามทำระบบแบ่งหน้า (pagination) ให้จำกัดจำนวนแทน
var จำนวนสูงสุดที่ดึง = 50;

(async function () {
  var กล่อง = document.getElementById("ผลลัพธ์");

  if (!ตั้งค่าครบแล้ว) {
    showConfigWarning("ยังไม่ได้ใส่ค่าตั้งค่าใน js/firebase.js");
    กล่อง.innerHTML = "<p>ยังอ่านข้อมูลจากฐานข้อมูลจริงไม่ได้</p>";
    return;
  }

  // ต้องรอให้รู้ก่อนว่าใครล็อกอินอยู่ แล้วค่อยอ่านข้อมูล ไม่งั้นโดนกฎปฏิเสธทั้งที่ล็อกอินแล้ว
  var ผู้ใช้ = await requireLogin();
  if (!ผู้ใช้) return;

  if (!เป็นผู้พิจารณา(ผู้ใช้)) {
    document.querySelector(".subtitle").textContent =
      "ใบขอลาของคุณ กดที่แถวเพื่อดูรายละเอียด";
  }

  var ใบลาทั้งหมด;
  try {
    ใบลาทั้งหมด = await ดึงใบลาจากฐานข้อมูล(ผู้ใช้);
  } catch (err) {
    แสดงข้อผิดพลาด(err, กล่อง);
    return;
  }

  // ถ้ามีสถานะติดมาท้าย URL ให้กรองเฉพาะสถานะนั้น
  // จงใจกรองตรงนี้ ไม่กรองที่ Firestore — เพราะกรองพร้อมเรียงลำดับ
  // Firestore จะบังคับให้ไปสร้าง index ก่อน ซึ่งไม่คุ้มกับข้อมูลไม่กี่ใบ
  var สถานะที่กรอง = ค่าจากURL("status");
  var รายการที่จะแสดง = ใบลาทั้งหมด;

  if (สถานะที่กรอง) {
    รายการที่จะแสดง = ใบลาทั้งหมด.filter(function (ใบ) {
      return ใบ.status === สถานะที่กรอง;
    });
    document.querySelector(".subtitle").textContent =
      "กำลังแสดงเฉพาะใบลาที่สถานะ " + สถานะที่กรอง;
  }

  วาดผลลัพธ์(รายการที่จะแสดง, {
    กล่อง: กล่อง,
    สถานะที่กรอง: สถานะที่กรอง,
    มีข้อมูลในระบบทั้งหมด: ใบลาทั้งหมด.length > 0
  });
})();

// ── อ่านจาก Firestore ────────────────────────────────────────
async function ดึงใบลาจากฐานข้อมูล(ผู้ใช้) {
  // createdAt เก็บเป็นข้อความรูปแบบ "2026-09-01 09:15"
  // รูปแบบนี้เรียงตามตัวอักษรแล้วได้ลำดับเวลาที่ถูกต้องพอดี จึงเรียงตรง ๆ ได้เลย
  var คำสั่ง;
  if (เป็นผู้พิจารณา(ผู้ใช้)) {
    คำสั่ง = query(
      collection(db, "leaveRequests"),
      orderBy("createdAt", "desc"),
      limit(จำนวนสูงสุดที่ดึง)
    );
  } else {
    // ผู้ขอลาต้องขอเฉพาะใบของตัวเองตั้งแต่ในคำสั่ง — กฎฝั่งฐานข้อมูลตรวจที่คำสั่ง
    // ถ้าขอทั้งโฟลเดอร์แล้วมากรองทีหลัง จะโดนปฏิเสธทั้งก้อน
    // ไม่ใส่ orderBy คู่กับ where เพราะ Firestore จะบังคับให้สร้าง index ก่อน เรียงเองข้างล่างแทน
    คำสั่ง = query(
      collection(db, "leaveRequests"),
      where("requesterId", "==", ผู้ใช้.uid),
      limit(จำนวนสูงสุดที่ดึง)
    );
  }

  var ผล = await getDocs(คำสั่ง);

  return ผล.docs
    .map(function (ไฟล์) {
      // บน Firestore ชื่อไฟล์ (lr001) ไม่ได้อยู่ในช่องข้อมูล ต้องประกอบกลับเข้าไปเอง
      // ถ้าลืมข้อนี้ ตารางจะขึ้นครบสวยงาม แต่กดแถวแล้วจะไปหน้า "ไม่พบใบขอลาที่ต้องการ" ทุกแถว
      return Object.assign({ id: ไฟล์.id }, ไฟล์.data());
    })
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });   // ใหม่ไปเก่า
}

// ── เลือกว่าจะวาดตาราง หรือวาดสถานะว่างเปล่าแบบไหน ───────────
function วาดผลลัพธ์(รายการ, บริบท) {
  if (รายการ.length > 0) {
    แสดงตาราง(รายการ, บริบท);
    return;
  }

  // แยกให้ชัดระหว่าง "ยังไม่มีข้อมูลเลย" กับ "กรองแล้วไม่เจอ"
  // สองอย่างนี้ผู้ใช้ต้องทำคนละอย่างกัน ถ้าขึ้นข้อความเดียวกันจะกลายเป็นทางตัน
  if (บริบท.สถานะที่กรอง && บริบท.มีข้อมูลในระบบทั้งหมด) {
    บริบท.กล่อง.innerHTML =
      '<div class="empty-state">' +
      '<div class="mark">' + ไอคอน("inbox") + "</div>" +
      "<h2>ไม่มีใบลาที่สถานะ " + esc(บริบท.สถานะที่กรอง) + "</h2>" +
      "<p>ในระบบมีใบลาอยู่ แต่ไม่มีใบไหนอยู่ในสถานะนี้</p>" +
      '<div class="btn-row">' +
      '<a class="btn" href="leave-requests.html">ดูใบลาทั้งหมด</a>' +
      "</div></div>";
    return;
  }

  บริบท.กล่อง.innerHTML =
    '<div class="empty-state">' +
    '<div class="mark">' + ไอคอน("inbox") + "</div>" +
    "<h2>ยังไม่มีใบขอลาในระบบ</h2>" +
    "<p>ใบลาที่ยื่นเข้ามาจะมาแสดงที่นี่ พร้อมสถานะว่าอยู่ระหว่างพิจารณาหรือพิจารณาเสร็จแล้ว</p>" +
    '<div class="btn-row">' +
    '<a class="btn" href="new-leave-request.html">ยื่นใบลาใบแรก</a>' +
    "</div></div>";
}

// ── วาดตาราง ─────────────────────────────────────────────────
function แสดงตาราง(รายการ, บริบท) {
  var กล่อง = บริบท.กล่อง;

  // บอกจำนวนที่เจอเสมอ ให้รู้ว่าระบบทำงานแล้ว ไม่ใช่ค้างอยู่
  var html =
    '<div class="result-bar">' +
    '<span class="count">พบ ' + รายการ.length + " ใบ</span>" +
    (บริบท.สถานะที่กรอง
      ? '<a class="reset" href="leave-requests.html">ล้างตัวกรอง ดูทั้งหมด</a>'
      : "") +
    "</div>";

  html +=
    "<table><thead><tr>" +
    "<th>หัวข้อ</th>" +
    "<th>ประเภทการลา</th>" +
    "<th>สถานะ</th>" +
    '<th class="hide-mobile">ผู้ขอลา</th>' +
    '<th class="hide-mobile">วันที่ลา</th>' +
    "</tr></thead><tbody>";

  รายการ.forEach(function (ใบ) {
    var ที่อยู่ = "leave-request-detail.html?id=" + encodeURIComponent(ใบ.id);
    html +=
      '<tr class="clickable" data-href="' + esc(ที่อยู่) + '">' +
      // หัวข้อเป็นลิงก์จริง เพื่อให้กด Tab ถึงได้ คลิกขวาเปิดแท็บใหม่ได้
      // และโปรแกรมอ่านหน้าจอรู้ว่าแถวนี้กดไปไหนได้
      '<td><a class="row-link" href="' + esc(ที่อยู่) + '">' + esc(ใบ.title) + "</a></td>" +
      "<td>" + esc(ใบ.leaveTypeName) + "</td>" +
      "<td>" + ป้ายสถานะ(ใบ.status) + "</td>" +
      '<td class="hide-mobile">' + esc(ใบ.requesterName) + "</td>" +
      '<td class="hide-mobile">' + esc(ใบ.startDate) + " ถึง " + esc(ใบ.endDate) + "</td>" +
      "</tr>";
  });

  html += "</tbody></table>";
  กล่อง.innerHTML = html;

  // กดที่ไหนก็ได้ในแถว ไปหน้ารายละเอียด — เป็นความสะดวกของเมาส์เท่านั้น
  // ถ้ากดโดนลิงก์อยู่แล้ว ปล่อยให้ลิงก์ทำงานเอง จะได้ไม่สั่งซ้ำสองครั้ง
  กล่อง.querySelectorAll("tr.clickable").forEach(function (แถว) {
    แถว.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      location.href = แถว.dataset.href;
    });
  });
}

// ── บอกให้ชัดว่าพังเพราะอะไร ไม่ปล่อยหน้าว่างเปล่า ───────────
function แสดงข้อผิดพลาด(err, กล่อง) {
  var รหัส = err && err.code ? err.code : "ไม่ทราบสาเหตุ";
  var คำแนะนำ = {
    "permission-denied": "Security Rules ไม่ยอมให้อ่าน — ตรวจว่าล็อกอินแล้ว และ deploy ไฟล์ firestore.rules ขึ้นไปแล้ว",
    "failed-precondition": "Firestore ขอให้สร้าง index ก่อน — เปิดลิงก์ในข้อความข้างล่างแล้วกดสร้างได้เลย",
    "unavailable": "ต่อ Firestore ไม่ได้ — ตรวจอินเทอร์เน็ต หรือยังไม่ได้สร้างฐานข้อมูลใน Console",
    "not-found": "ยังไม่ได้สร้างฐานข้อมูล Firestore ในโปรเจกต์นี้"
  }[รหัส];

  var กล่องเตือน = document.createElement("div");
  กล่องเตือน.className = "alert alert-error";
  กล่องเตือน.setAttribute("role", "alert");
  กล่องเตือน.textContent =
    "อ่านข้อมูลจาก Firestore ไม่สำเร็จ · รหัส " + รหัส +
    (คำแนะนำ ? " — " + คำแนะนำ : "");

  var รายละเอียด = document.createElement("div");
  รายละเอียด.className = "hint";
  รายละเอียด.textContent = err && err.message ? err.message : String(err);

  กล่อง.innerHTML = "";
  กล่อง.appendChild(กล่องเตือน);
  กล่อง.appendChild(รายละเอียด);
}
