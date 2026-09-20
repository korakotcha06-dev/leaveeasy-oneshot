// js/nav.js
// แถบนำทางร่วมของทุกหน้า — เขียนไว้ที่เดียวเพื่อไม่ให้แต่ละหน้าคัดลอกลิงก์ซ้ำกัน 8 รอบ
// แล้ววันหนึ่งแก้ไม่ครบ (ลืมหน้าใดหน้าหนึ่ง) ทุกหน้าจึงเรียก mountNav() แทน
//
// วิธีใช้: ใส่ <div id="nav-root"></div> ไว้บนสุดของ <body> แล้ว import ไฟล์นี้
// เป็น module ธรรมดา ฟังก์ชันจะ mount ตัวเองอัตโนมัติเมื่อ DOM พร้อม

import { onUser, signOutUser } from "./auth.js";

// รายการลิงก์ต้องตรงกับ data-testid ใน contract.md ส่วนที่ 5 ทุกตัวอักษร
// ห้ามเปลี่ยนชื่อ id เหล่านี้ เพราะสคริปต์ทดสอบเขียนอ้างอิงไว้ตายตัวแล้ว
// nav-types มี hrOnly: true เพราะสเปคข้อ 4 (หน้าที่ 4) ให้ซ่อนหน้านี้จากผู้ที่ไม่ใช่ฝ่ายบุคคล
const ALL_NAV_LINKS = [
  { testId: "nav-home", href: "index.html", label: "หน้าแรก" },
  { testId: "nav-requests", href: "leave-requests.html", label: "รายการใบลา" },
  { testId: "nav-new", href: "new-leave-request.html", label: "ยื่นใบลาใหม่" },
  { testId: "nav-types", href: "leave-types.html", label: "ประเภทการลา", hrOnly: true },
  { testId: "nav-dashboard", href: "dashboard.html", label: "แดชบอร์ด" },
];

// กรองลิงก์ตาม role — fail closed: ต้องเป็น "hr" ตรงตัวเท่านั้นถึงจะเห็น nav-types
// role ว่างหรือไม่รู้จัก (รวมถึงตอนที่ยังไม่ resolve auth เสร็จ) ต้องตกไปฝั่งซ่อนเสมอ
function visibleLinks(role) {
  return ALL_NAV_LINKS.filter((link) => !link.hrOnly || role === "hr");
}

// escape ข้อความก่อนแทรกลง innerHTML กันกรณีมีคนตั้งชื่อผู้ใช้เป็นข้อความแปลก ๆ
// (ในไฟล์นี้ใช้ textContent กับชื่อผู้ใช้อยู่แล้ว แต่กันไว้เผื่อมีคนก๊อปโค้ดไปใช้ที่อื่น)
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// หาไฟล์ปัจจุบันจาก URL เพื่อไฮไลต์ลิงก์ที่กำลังเปิดอยู่
function currentFile() {
  const path = window.location.pathname;
  const file = path.substring(path.lastIndexOf("/") + 1);
  return file === "" ? "index.html" : file;
}

// สร้าง html ของลิงก์ตาม role ปัจจุบัน แยกออกมาต่างหากเพื่อให้เรียกซ้ำได้
// ทุกครั้งที่ onUser ยิง role ใหม่มา โดยไม่ต้อง render ทั้งแถบใหม่ (auth-state/signout ไม่กระทบ)
function linksHtmlFor(role) {
  const active = currentFile();
  return visibleLinks(role)
    .map((link) => {
      const activeClass = link.href === active ? " is-active" : "";
      return (
        `<a class="nav-link${activeClass}" data-testid="${link.testId}" href="${link.href}">` +
        `${escapeHtml(link.label)}</a>`
      );
    })
    .join("");
}

// เติม/ถอดลิงก์ที่จำกัดตาม role ลงใน DOM จริง (ไม่ใช้ CSS ซ่อน) เพื่อให้เทสต์เช็คว่า
// element ไม่มีอยู่เลยได้ เรียกครั้งแรกด้วย role = null (ยังไม่รู้สถานะ = ปิดไว้ก่อน กัน flash)
// แล้วเรียกซ้ำทุกครั้งที่ onUser callback ยิง role จริงมา
function renderLinks(role) {
  const container = document.getElementById("nav-links-list");
  if (!container) return;
  container.innerHTML = linksHtmlFor(role);
}

function buildNavHtml() {
  return (
    `<span class="nav-brand">LeaveEasy</span>` +
    `<nav class="nav-links" id="nav-links-list" aria-label="เมนูหลัก"></nav>` +
    `<div class="nav-user">` +
    `<span id="auth-state" data-testid="auth-state"></span>` +
    `<button type="button" class="btn btn-ghost" data-testid="nav-signout">ออกจากระบบ</button>` +
    `</div>`
  );
}

function findOrCreateRoot() {
  let root = document.getElementById("nav-root");
  if (!root) {
    // ถ้าหน้าไหนลืมใส่ nav-root ไว้ ให้สร้างให้เองที่บนสุดของ body
    // กันไม่ให้ทั้งหน้าพังเพราะลืม 1 บรรทัด
    root = document.createElement("div");
    root.id = "nav-root";
    document.body.insertBefore(root, document.body.firstChild);
  }
  root.classList.add("nav");
  return root;
}

// แสดง/ซ่อนปุ่มออกจากระบบ และเติมชื่อผู้ใช้ตามสถานะล็อกอินปัจจุบัน
// ใช้ textContent เสมอ (ไม่ใช่ innerHTML) เพราะชื่อผู้ใช้เป็นข้อมูลจากคนอื่น
function applyUserState(user) {
  const authState = document.querySelector('[data-testid="auth-state"]');
  const signOutButton = document.querySelector('[data-testid="nav-signout"]');
  if (!authState || !signOutButton) return;

  if (user && user.name) {
    authState.textContent = user.name;
    signOutButton.hidden = false;
  } else {
    authState.textContent = "";
    signOutButton.hidden = true;
  }
}

function wireSignOut() {
  const signOutButton = document.querySelector('[data-testid="nav-signout"]');
  if (!signOutButton) return;
  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      await signOutUser();
    } finally {
      // ไปหน้า login เสมอหลังออกจากระบบ ไม่ว่าจะสำเร็จหรือ error
      // เพราะไม่มี session ค้างให้แสดงต่อแล้ว และการล็อกอินใหม่เป็นคนละคน
      // ควรทำได้ในขั้นตอนเดียวแทนที่จะวนกลับหน้าแรกก่อน
      window.location.href = "login.html";
    }
  });
}

export function mountNav() {
  const root = findOrCreateRoot();
  root.innerHTML = buildNavHtml();
  // role = null ตอนยังไม่รู้สถานะ auth เลย -> nav-types ต้องถูกซ่อนไว้ก่อนตั้งแต่ paint แรก
  // กันไม่ให้ลิงก์โผล่มาแวบหนึ่งแล้วหายไปตอน onUser resolve เสร็จภายหลัง
  renderLinks(null);
  wireSignOut();

  // onUser มาจาก auth.js (สัญญาส่วนที่ 3) — ยิง callback ทุกครั้งที่สถานะล็อกอินเปลี่ยน
  // ครอบ try/catch ไว้เผื่อ auth.js ยังไม่พร้อมหรือ import ล้มเหลวระหว่างพัฒนา
  try {
    onUser((user) => {
      applyUserState(user);
      // user เป็น null (ออกจากระบบ) หรือไม่มี role (auth.js อ่านโปรไฟล์ไม่ได้ ตั้งเป็น "")
      // ต้องตกไปฝั่งซ่อนเสมอ — ส่ง role ตรง ๆ ให้ renderLinks ตัดสินด้วย === "hr" เท่านั้น
      renderLinks(user ? user.role : null);
    });
  } catch (err) {
    // ไม่ throw ต่อ เพราะแค่แถบนำทางพังไม่ควรทำทั้งหน้าใช้งานไม่ได้
    console.error("nav.js: onUser ใช้งานไม่ได้", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountNav);
} else {
  mountNav();
}
