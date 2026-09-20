// ─────────────────────────────────────────────────────────────
// tests/fixtures/config.js — ค่าคงที่ของชุดทดสอบ
//
// ที่เดียวที่รู้ว่า emulator อยู่พอร์ตไหน บัญชีทดสอบคือใคร
// ไฟล์เทสอื่นห้ามพิมพ์พอร์ตหรืออีเมลเองซ้ำ ให้ require จากที่นี่
//
// ไฟล์นี้ไม่รู้จักหน้าเว็บหรือโครงข้อมูลของแอปเลย รู้แค่เรื่อง emulator
// จึงไม่พังตามเวลาโค้ดแอปถูกเขียนใหม่
//
// สำคัญมาก ข้อบังคับข้อเดียวที่ห้ามพลาด
//    ทุกเทสต้องเปิดเว็บจาก http://localhost:5050 (hosting ของ emulator)
//    เพราะแอปเปิดโหมด "ฐานจำลอง" จากพอร์ต 5050 เท่านั้น
//    พอร์ต 3000 (npm run dev) คุยกับฐานข้อมูล "ของจริง"
//    ถ้าเทสไปวิ่งที่ 3000 จะไปล้างและเขียนทับข้อมูลจริง — ห้ามเด็ดขาด
// ─────────────────────────────────────────────────────────────

// ต้องตรงกับ .firebaserc (projects.default)
// emulator เปิด singleProjectMode ไว้ ใช้ projectId อื่นจะถูกปฏิเสธ
const PROJECT_ID = "leaveeasy-korakot";

// ต้องตรงกับ firebase.json หัวข้อ emulators
const PORTS = {
  auth: 9099,
  firestore: 8080,
  hosting: 5050,
  ui: 4000
};

// ฝั่ง Node ใช้ 127.0.0.1 ไม่ใช่ localhost
// เพราะ Node 18+ อาจแปลง localhost เป็น ::1 (IPv6) ก่อน แล้ว emulator ฟังที่ IPv4
// ส่วนฝั่งเบราว์เซอร์ต้องเป็น localhost เป๊ะ ๆ (แอปเช็ค location.hostname)
const HOST = "127.0.0.1";

const BASE_URL = `http://localhost:${PORTS.hosting}`;
const FIRESTORE_ORIGIN = `http://${HOST}:${PORTS.firestore}`;
const AUTH_ORIGIN = `http://${HOST}:${PORTS.auth}`;

// รหัสผ่านเดียวกันทุกบัญชีทดสอบ (Firebase บังคับอย่างน้อย 6 ตัวอักษร)
const TEST_PASSWORD = "test1234";

// บทบาทตามสเปก (หัวข้อ 7) — สามค่านี้เท่านั้น
const ROLE = {
  EMPLOYEE: "employee",
  MANAGER: "manager",
  HR: "hr"
};

// สถานะใบลาตามสเปก — สะกดผิดตัวเดียวเทสจะเขียวทั้งที่ระบบพัง ให้ require ค่านี้เสมอ
const STATUS = {
  PENDING: "รอพิจารณา",
  APPROVED: "อนุมัติ",
  REJECTED: "ไม่อนุมัติ"
};

// ── บัญชีทดสอบ 3 บทบาท ───────────────────────────────────────
//
// uid กำหนดเองแบบคงที่ (Auth emulator ยอมให้ตั้ง localId เองผ่านช่องผู้ดูแล)
// ข้อดีคือ seed ข้อมูลที่อ้างถึงตัวคนได้ล่วงหน้า โดยไม่ต้องรอผลจากการสมัคร
//
// ระวัง ชื่อ-อีเมลมาจากสเปกหัวข้อ 7 (u001/u002/u003) แต่ uid ตั้งใหม่
//    เพราะ Firebase Auth เป็นคนแจก uid ไม่ใช่เราตั้งเลขเรียงเอง
//    ช่อง specId เก็บรหัสตามสเปกไว้ เผื่อเทสต้องอ้างอิงเอกสาร
const TEST_USERS = {
  employee: {
    uid: "uid-employee-u001",
    specId: "u001",
    email: "somchai@example.com",
    password: TEST_PASSWORD,
    name: "สมชาย ใจดี",
    role: ROLE.EMPLOYEE
  },
  manager: {
    uid: "uid-manager-u002",
    specId: "u002",
    email: "somying@example.com",
    password: TEST_PASSWORD,
    name: "สมหญิง รักงาน",
    role: ROLE.MANAGER
  },
  hr: {
    uid: "uid-hr-u003",
    specId: "u003",
    email: "somsri@example.com",
    password: TEST_PASSWORD,
    name: "สมศรี ตั้งใจ",
    role: ROLE.HR
  }
};

// ── หน้าเว็บทั้งหมด (contract.md หัวข้อ 4) ────────────────────
// เขียนเป็น path เทียบกับ BASE_URL · อย่าพิมพ์ชื่อไฟล์เองในเทส
const PAGES = {
  home: "/index.html",
  login: "/login.html",
  leaveRequests: "/leave-requests.html",
  newLeaveRequest: "/new-leave-request.html",
  leaveRequestDetail: "/leave-request-detail.html",
  leaveTypes: "/leave-types.html",
  dashboard: "/dashboard.html",
  seed: "/seed.html"
};

// ลิงก์ไปหน้ารายละเอียดของใบลาใบหนึ่ง
function detailUrl(requestId) {
  return `${PAGES.leaveRequestDetail}?id=${encodeURIComponent(requestId)}`;
}

// ── data-testid ทั้งหมด (contract.md หัวข้อ 5) ────────────────
// contract ตรึงรายการนี้ไว้ เพื่อให้คนเขียนเทสกับคนเขียนหน้าจอทำงานขนานกันได้
// เทสควรอ้างผ่านตัวแปรนี้ ไม่ใช่พิมพ์สตริงเอง — พิมพ์ผิดจะรู้ตอนเทสล้มเท่านั้น
const TESTID = {
  // ใช้ร่วมทุกหน้า
  navHome: "nav-home",
  navRequests: "nav-requests",
  navNew: "nav-new",
  navTypes: "nav-types",
  navDashboard: "nav-dashboard",
  navSignout: "nav-signout",
  authState: "auth-state",
  errorMessage: "error-message",

  // login.html
  signinEmail: "signin-email",
  signinPassword: "signin-password",
  signinSubmit: "signin-submit",
  signupName: "signup-name",
  signupEmail: "signup-email",
  signupPassword: "signup-password",
  signupSubmit: "signup-submit",

  // leave-requests.html
  requestList: "request-list",
  requestRow: "request-row",
  requestRowTitle: "request-row-title",
  requestRowType: "request-row-type",
  requestRowStatus: "request-row-status",
  requestRowRequester: "request-row-requester",
  requestRowDates: "request-row-dates",
  emptyState: "empty-state",
  newRequestButton: "new-request-button",

  // new-leave-request.html
  fieldTitle: "field-title",
  fieldReason: "field-reason",
  fieldLeaveType: "field-leave-type",
  fieldStartDate: "field-start-date",
  fieldEndDate: "field-end-date",
  saveButton: "save-button",
  cancelButton: "cancel-button",
  aiClassifyButton: "ai-classify-button",
  aiNotice: "ai-notice",

  // leave-request-detail.html
  detailTitle: "detail-title",
  detailReason: "detail-reason",
  detailType: "detail-type",
  detailDates: "detail-dates",
  detailRequester: "detail-requester",
  detailApprover: "detail-approver",
  detailStatus: "detail-status",
  detailCreated: "detail-created",
  approveButton: "approve-button",
  rejectButton: "reject-button",
  deleteButton: "delete-button",
  approvalList: "approval-list",
  approvalItem: "approval-item",
  approvalAuthor: "approval-author",
  approvalMessage: "approval-message",
  approvalTime: "approval-time",
  commentInput: "comment-input",
  commentSubmit: "comment-submit",
  backButton: "back-button",

  // leave-types.html
  typeNameInput: "type-name-input",
  typeAddButton: "type-add-button",
  typeList: "type-list",
  typeRow: "type-row",
  typeEditButton: "type-edit-button",
  typeDeleteButton: "type-delete-button",

  // dashboard.html
  countPending: "count-pending",
  countApproved: "count-approved",
  countRejected: "count-rejected",
  recentList: "recent-list",
  recentItem: "recent-item"
};

module.exports = {
  PROJECT_ID,
  PORTS,
  HOST,
  BASE_URL,
  FIRESTORE_ORIGIN,
  AUTH_ORIGIN,
  TEST_PASSWORD,
  TEST_USERS,
  ROLE,
  STATUS,
  PAGES,
  detailUrl,
  TESTID
};
