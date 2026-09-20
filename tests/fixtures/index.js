// ─────────────────────────────────────────────────────────────
// tests/fixtures/index.js — ประตูเดียวที่ไฟล์เทสควร require
//
//   const { test, expect } = require("@playwright/test");
//   const { signInAs, seedEmulator, byTestId, TESTID, STATUS } = require("./fixtures");
//
// เขียนเป็น CommonJS ตั้งใจ ไม่ใช่ ES module
// เพราะ package.json ไม่มี "type": "module" · Node จึงอ่าน .js เป็น CommonJS
// ทำให้ทั้ง Playwright และ `node --test` (ที่ใช้รันเทส security rules)
// require ไฟล์ชุดเดียวกันนี้ได้ โดยไม่ต้องมีขั้นตอน build
// ─────────────────────────────────────────────────────────────

const config = require("./config");
const emulator = require("./emulator");
const seedData = require("./seed-data");
const app = require("./app");

module.exports = {
  ...config,     // PROJECT_ID, PORTS, BASE_URL, TEST_USERS, ROLE, STATUS, PAGES, detailUrl, TESTID
  ...emulator,   // resetEmulator, writeDoc, readDoc, listDocs, createTestAuthUsers, waitForEmulator
  ...seedData,   // LEAVE_TYPES, LEAVE_REQUESTS, APPROVALS, COUNTS, findRequest, approvalsOf
  ...app         // seedEmulator, signInAs, signOutFrom, createLeaveRequest, byTestId
};
