// ─────────────────────────────────────────────────────────────
// js/dashboard.js — พฤติกรรมของหน้า dashboard.html
//
// สเปกหัวข้อ 3 (US-11) เขียนไว้ชัดว่าแดชบอร์ดเป็นงาน Module 3
// ("Module 2 ไม่ทำแดชบอร์ด") และหัวข้อ 4 (หน้าที่ 5) ย้ำอีกครั้งว่าหน้านี้เป็น
// "โครงหน้าจาก prototype ตลอด Module 2 — การต่อตัวเลขจริงและกราฟเป็นเนื้อหา Module 3"
// (ช่อง "เพิ่มทีหลัง" ในตารางเดียวกันที่เคยเขียนว่านับจากข้อมูลจริงสัปดาห์ที่ 7
// จึงถือว่าตกไป — สองข้อความข้างต้นชนะ)
//
// ดังนั้นหน้านี้ **ห้ามเรียก listLeaveRequests() หรือแยกบทบาทผู้ใช้เพื่อกรองข้อมูล
// เหมือนหน้ารายการใบลา** อีกต่อไป ตัวเลขและรายการล่าสุดเป็นข้อมูลตัวอย่างคงที่
// (ตรงกับสเปกหัวข้อ 7.3) ที่ยังทำให้โครงหน้าดูมีเนื้อหาจริง แทนที่จะว่างเปล่า
//
// สิ่งที่ยังทำอยู่ตามสเปก (หน้าที่ 5 · "กดอะไรได้"):
//   - กดกล่องตัวเลข → ไปหน้ารายการใบลาพร้อมกรองสถานะนั้นไว้แล้ว
//   - ต้องล็อกอินก่อนถึงเข้าหน้านี้ได้ (requireAuth)
// ─────────────────────────────────────────────────────────────

import { requireAuth } from "./auth.js";
import { STATUS, escapeHtml, formatDateRange, statusBadgeHtml } from "./util.js";

// ชื่อพารามิเตอร์ใน URL ที่ใช้ส่งสถานะไปให้หน้า leave-requests.html กรองให้ล่วงหน้า
// ต้องเป็นชื่อเดียวกับที่ js/leave-requests.js อ่าน (ดูค่า STATUS_PARAM ในไฟล์นั้น)
// ไม่งั้นกดกล่องตัวเลขแล้วจะไปถึงหน้ารายการแบบไม่กรองอะไรเลย
const STATUS_PARAM = "status";

// นิยามกล่องตัวเลข 3 กล่องไว้ที่เดียว วนสร้าง HTML จากอาร์เรย์นี้
// กันการเขียนซ้ำ 3 ก้อนที่หน้าตาเกือบเหมือนกันแต่ต่างแค่สถานะ/ป้าย/testid
const กล่องสถานะ = [
  { status: STATUS.PENDING, label: "รอพิจารณา", testId: "count-pending" },
  { status: STATUS.APPROVED, label: "อนุมัติ", testId: "count-approved" },
  { status: STATUS.REJECTED, label: "ไม่อนุมัติ", testId: "count-rejected" }
];

// ข้อมูลตัวอย่างคงที่ — คัดลอกมาจากสเปกหัวข้อ 7.3 (ใบขอลา 5 ใบ) ตรงตัว
// เรียงใหม่ไปเก่าตาม createdAt เหมือนพฤติกรรมที่ listLeaveRequests() เคยทำ
// (ดู js/data.js เดิม) เพื่อให้โครงหน้ายังดูสมจริง แม้จะไม่ได้อ่าน Firestore แล้ว
//
// นี่คือ "ตัวเลขที่พิมพ์ค้างไว้" ตามความหมายในสเปกโดยตั้งใจ — เพราะ US-11
// เลื่อนไป Module 3 ห้ามแก้ให้กลับไปอ่านข้อมูลจริงจนกว่าจะถึง Module นั้น
const ตัวอย่างใบลา = [
  {
    id: "lr004",
    title: "ลาพักร้อนช่วงวันหยุดยาว",
    requesterName: "สมศรี ตั้งใจ",
    startDate: "2026-10-12",
    endDate: "2026-10-16",
    status: STATUS.REJECTED
  },
  {
    id: "lr005",
    title: "ลาป่วยไปพบแพทย์ตามนัด",
    requesterName: "สมชาย ใจดี",
    startDate: "2026-09-22",
    endDate: "2026-09-22",
    status: STATUS.PENDING
  },
  {
    id: "lr003",
    title: "ลากิจไปทำบัตรประชาชน",
    requesterName: "สมศรี ตั้งใจ",
    startDate: "2026-09-15",
    endDate: "2026-09-15",
    status: STATUS.PENDING
  },
  {
    id: "lr001",
    title: "ลาพักร้อนไปเที่ยวกับครอบครัว",
    requesterName: "สมชาย ใจดี",
    startDate: "2026-09-07",
    endDate: "2026-09-09",
    status: STATUS.PENDING
  },
  {
    id: "lr002",
    title: "ลาป่วยไข้หวัดใหญ่",
    requesterName: "สมชาย ใจดี",
    startDate: "2026-08-24",
    endDate: "2026-08-25",
    status: STATUS.APPROVED
  }
];

// วาดกล่องตัวเลข 3 กล่อง นับจากข้อมูลตัวอย่างคงที่ด้านบน (ไม่ใช่ Firestore)
// แต่ละกล่องเป็นลิงก์ไปหน้ารายการ พร้อม ?status=... ให้หน้านั้นกรองให้เลย
// ใช้ href ธรรมดา ไม่ต้องผูก click event เอง เพราะเป็นแค่การเปลี่ยนหน้า
function วาดกล่องตัวเลข() {
  const container = document.getElementById("count-boxes");
  container.innerHTML = กล่องสถานะ
    .map(({ status, label, testId }) => {
      const จำนวน = ตัวอย่างใบลา.filter((r) => r.status === status).length;
      const href = `leave-requests.html?${STATUS_PARAM}=${encodeURIComponent(status)}`;
      return (
        `<a class="home-link-card" href="${href}">` +
        `<div class="home-link-title">${escapeHtml(label)}</div>` +
        `<div class="home-link-desc" style="font-size:2rem;font-weight:700;color:var(--color-text);" ` +
        `data-testid="${testId}">${จำนวน}</div>` +
        `</a>`
      );
    })
    .join("");
}

// วาดรายการใบลาล่าสุด 5 รายการ จากข้อมูลตัวอย่างคงที่ด้านบน
function วาดรายการล่าสุด() {
  const list = document.getElementById("recent-list");

  list.innerHTML = ตัวอย่างใบลา
    .map(
      (r) =>
        `<li data-testid="recent-item" data-id="${escapeHtml(r.id)}" ` +
        `style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;` +
        `justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--color-border);cursor:pointer;">` +
        `<span>${escapeHtml(r.title)}</span>` +
        `<span>${escapeHtml(r.requesterName)}</span>` +
        `<span>${escapeHtml(formatDateRange(r.startDate, r.endDate))}</span>` +
        `${statusBadgeHtml(r.status)}` +
        `</li>`
    )
    .join("");

  // กดที่รายการล่าสุดแล้วไปดูรายละเอียดใบนั้นได้เลย เพื่อความสะดวก
  // (ไม่ได้อยู่ในรายการ data-testid บังคับ แต่เป็นพฤติกรรมที่สมเหตุสมผลของหน้าสรุป)
  list.querySelectorAll('[data-testid="recent-item"]').forEach((li) => {
    li.addEventListener("click", () => {
      location.href = `leave-request-detail.html?id=${encodeURIComponent(li.dataset.id)}`;
    });
  });
}

async function init() {
  const ผู้ใช้ = await requireAuth();
  if (!ผู้ใช้) return; // requireAuth() เด้งไปหน้า login.html ให้แล้ว

  วาดกล่องตัวเลข();
  วาดรายการล่าสุด();
}

init();
