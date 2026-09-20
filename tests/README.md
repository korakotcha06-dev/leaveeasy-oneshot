# ชุดทดสอบอัตโนมัติของ LeaveEasy

สัปดาห์ที่ 9 · เทสหน้าจอจริงด้วย Playwright และเทส Security Rules ด้วย Firebase emulator

---

## กฎเหล็กข้อเดียวที่ห้ามพลาด — พอร์ต 5050 เท่านั้น

โปรเจกต์นี้เปิดเว็บได้สองทาง และสองทางนี้คุยกับ **ฐานข้อมูลคนละก้อน**

| คำสั่ง | พอร์ต | คุยกับฐานข้อมูล | ใช้กับเทสได้ไหม |
|---|---|---|---|
| `npm run emulators` | **5050** | ฐานจำลองในเครื่อง | ต้องใช้ทางนี้ |
| `npm run dev` | 3000 | **ฐานข้อมูลจริงบน Firebase** | ห้ามใช้เด็ดขาด |

เหตุผลที่ต้องเป็น 5050 เป๊ะ ๆ อยู่ใน `js/firebase.js`

```js
export const useEmulator = location.hostname === "localhost" && location.port === "5050";
```

แอปจะต่อฐานจำลองก็ต่อเมื่อพอร์ตเป็น `5050` เท่านั้น เปิดจากพอร์ตอื่นเมื่อไร
แอปจะวิ่งไปหาฐานข้อมูลจริงทันที

**ทำไมข้อนี้ถึงอันตรายกว่าที่คิด**
ชุดทดสอบนี้ **ล้างฐานข้อมูลทิ้งทั้งก้อน** ก่อนเริ่มทุกเทส (เพื่อให้ผลเทสคงที่)
ถ้าเทสไปวิ่งที่พอร์ต 3000 ก็เท่ากับสั่งลบข้อมูลจริงของโปรเจกต์ทิ้ง

กันไว้สองชั้นแล้ว
1. `playwright.config.js` ตั้ง `baseURL` เป็น `http://localhost:5050` ตายตัว
2. `signInAs()` ตรวจพอร์ตซ้ำอีกรอบ เจอพอร์ตผิดจะล้มทันทีพร้อมบอกเหตุผล

---

## เรื่อง Java ที่ต้องรู้ก่อนรันครั้งแรก

Firestore emulator เขียนด้วย Java จึงต้องมี Java ในเครื่อง

เครื่องนี้ลง Java ผ่าน Homebrew ซึ่งติดตั้งแบบ **keg-only** แปลว่า
Homebrew **ไม่** เอา `java` ไปวางใน PATH ปกติให้ พิมพ์ `java -version` เฉย ๆ จะขึ้นว่าหาไม่เจอ

```
$ java -version
The operation couldn't be completed. Unable to locate a Java Runtime.

$ /opt/homebrew/opt/openjdk/bin/java -version
openjdk version "27" 2026-09-15
```

ทุกคำสั่งที่เปิด emulator จึงต้องชี้ที่อยู่ของ Java เองแบบนี้

```bash
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" firebase emulators:start
```

**ไม่ต้องจำ** — ใส่ไว้ใน npm script ให้แล้วทั้งหมด เรียก `npm run emulators` ได้เลย

> อยากพิมพ์ `java` เฉย ๆ ได้ทั่วเครื่อง ต้องไปเพิ่มบรรทัดนี้ใน `~/.zshrc` เอง
> ```
> export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
> ```
> เป็นการแก้ไฟล์ส่วนตัวของเครื่อง ชุดทดสอบนี้จึงไม่ไปยุ่งให้

---

## วิธีรันเทส

### ครั้งแรกเท่านั้น — ติดตั้งเครื่องมือ

```bash
npm install
npx playwright install chromium
```

### วิธีที่ 1 · สองหน้าต่าง (แนะนำตอนพัฒนา)

**หน้าต่างที่ 1** เปิด emulator ค้างไว้ อย่าปิด

```bash
npm run emulators
```

รอจนขึ้นตาราง `All emulators ready!` แล้วปล่อยไว้แบบนั้น
(เปิดดูข้อมูลในฐานจำลองได้ที่ http://localhost:4000)

**หน้าต่างที่ 2** รันเทส จะรันกี่รอบก็ได้ ไม่ต้องปิด-เปิด emulator ใหม่

```bash
npm run test:e2e
```

### วิธีที่ 2 · คำสั่งเดียวจบ (เหมาะกับตอนส่งงาน หรือ CI)

เปิด emulator ให้ รันเทส แล้วปิดเก็บกวาดให้เองครบ

```bash
npm run test:ci
```

ช้ากว่าวิธีที่ 1 ประมาณ 10 วินาทีต่อรอบ เพราะต้องรอ emulator เปิดใหม่ทุกครั้ง

### เทส Security Rules

```bash
npm run test:rules
```

ระวัง **อย่ารันปนกับเทส e2e ในรอบเดียวกัน**
เครื่องมือทดสอบกฎจะ **โหลดไฟล์กฎทับ** ลงใน emulator ระหว่างรัน
ถ้ารัน `test:rules` แล้วต่อด้วย `test:e2e` ทันที กฎที่ค้างอยู่อาจไม่ใช่ตัวจริง
**ให้ปิดแล้วเปิด emulator ใหม่คั่นกลางทุกครั้ง**

### ดูรายงานผลแบบมีภาพ

```bash
npm run test:report
```

เปิดรายงาน HTML ของรอบล่าสุด · เทสไหนล้มจะมีภาพหน้าจอกับ trace ให้กดดูย้อนได้

### คำสั่งอื่นที่มีให้

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run test:e2e:headed` | รันแบบเห็นเบราว์เซอร์ทำงานจริง ใช้ตอนหาสาเหตุที่เทสล้ม |
| `npm run test:e2e:ui` | เปิดหน้าจอควบคุมของ Playwright กดรันทีละเทสได้ |

---

## ลำดับที่ถูกต้อง ถ้าเริ่มจากศูนย์

```bash
npm install                      # 1. ลงเครื่องมือ
npx playwright install chromium  # 2. ลงเบราว์เซอร์ให้ Playwright
npm run emulators                # 3. เปิด emulator ค้างไว้ (หน้าต่างที่ 1)
npm run test:e2e                 # 4. รันเทสหน้าจอ (หน้าต่างที่ 2)
# ปิดแล้วเปิด emulator ใหม่คั่น
npm run test:rules               # 5. รันเทสกฎความปลอดภัย
```

---

## โครงไฟล์

```
tests/
  README.md              ไฟล์นี้
  global-setup.js        ด่านรอ emulator ให้พร้อม ก่อนเทสไฟล์แรกจะเริ่ม
  smoke.spec.js          เทสพิสูจน์ว่าเครื่องมือทดสอบเองใช้งานได้
  fixtures/              ตัวช่วยกลาง ใช้ร่วมกันทุกไฟล์เทส
    index.js               ประตูเดียวที่ไฟล์เทสควร require
    config.js              พอร์ต บัญชีทดสอบ ชื่อหน้า และ data-testid ทั้งหมด
    emulator.js            คุยกับ emulator ผ่าน REST (ล้าง เขียน อ่าน สร้างบัญชี)
    seed-data.js           ข้อมูลตัวอย่างตามสเปกหัวข้อ 7
    app.js                 seed ข้อมูล และ signInAs
  rules/                 เทส Security Rules (รันด้วย node --test ไม่ใช่ Playwright)
```

---

## เขียนเทสใหม่ยังไง

ทุกไฟล์เทสเริ่มเหมือนกันหมดแบบนี้

```js
const { test, expect } = require("@playwright/test");
const {
  seedEmulator, signInAs, byTestId, TESTID, STATUS, PAGES, detailUrl, COUNTS
} = require("./fixtures");

test.beforeEach(async () => {
  await seedEmulator();          // ล้างแล้วใส่ข้อมูลตั้งต้นใหม่ทุกครั้ง
});

test("ผู้อนุมัติเห็นใบลาครบทุกใบ", async ({ page }) => {
  await signInAs(page, "manager");                  // จบที่หน้ารายการใบลา
  await expect(byTestId(page, TESTID.requestRow))
    .toHaveCount(COUNTS.visibleToManager);
});
```

### กฎ 4 ข้อของการเขียนเทสในโปรเจกต์นี้

1. **เรียก `seedEmulator()` ใน `beforeEach` เสมอ**
   เทสต้องเริ่มจากข้อมูลชุดเดิมทุกครั้ง ไม่ใช่ของที่เทสก่อนหน้าทิ้งไว้

2. **ห้ามพิมพ์สตริงพวกนี้เองในไฟล์เทส**
   - `data-testid` → ใช้ `TESTID.xxx`
   - สถานะใบลา → ใช้ `STATUS.PENDING / APPROVED / REJECTED`
   - ชื่อหน้า → ใช้ `PAGES.xxx`
   - อีเมล รหัสผ่าน uid → ใช้ `TEST_USERS.employee` เป็นต้น

   เหตุผล: พิมพ์ `รอพิจารณา` ผิดไปตัวเดียว เทสจะ **เขียว** ทั้งที่ระบบพัง

3. **ห้ามตั้ง `workers` เกิน 1**
   emulator มีฐานข้อมูลก้อนเดียว ทุกเทสใช้ร่วมกัน
   ถ้ารันขนานกัน เทสหนึ่งจะล้างข้อมูลระหว่างที่อีกเทสกำลังอ่านอยู่

4. **จัดฉากข้อมูลด้วย fixtures ไม่ใช่ด้วยการกดหน้าเว็บ**
   อยากได้ใบลาที่อนุมัติแล้ว ให้ `createLeaveRequest({ status: STATUS.APPROVED })`
   ไม่ใช่ไล่กดยื่นใบลาแล้วกดอนุมัติ — ช้าและพังง่าย

---

## API ของ fixtures

`require("./fixtures")` แล้วได้ทั้งหมดนี้

### ข้อมูลคงที่

| ชื่อ | คืออะไร |
|---|---|
| `TEST_USERS` | บัญชีทดสอบ 3 บทบาท `{ employee, manager, hr }` แต่ละตัวมี `uid, email, password, name, role` |
| `ROLE` | `{ EMPLOYEE, MANAGER, HR }` |
| `STATUS` | `{ PENDING, APPROVED, REJECTED }` สามค่าภาษาไทยตามสเปก |
| `PAGES` | ชื่อไฟล์ทุกหน้า เช่น `PAGES.leaveRequests` |
| `detailUrl(id)` | ลิงก์ไปหน้ารายละเอียดของใบลาใบนั้น |
| `TESTID` | `data-testid` ทุกตัวตาม contract |
| `COUNTS` | จำนวนที่ควรเจอ เช่น `COUNTS.visibleToEmployee`, `COUNTS.pending` |
| `LEAVE_TYPES` `LEAVE_REQUESTS` `APPROVALS` | ข้อมูลตั้งต้นทั้งชุด |
| `findRequest(id)` `findLeaveType(id)` `approvalsOf(id)` | หยิบข้อมูลตั้งต้นมาดูค่าที่คาดหวัง |

### ใส่และล้างข้อมูล

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `await seedEmulator()` | ล้างทุกอย่าง แล้วใส่ข้อมูลตั้งต้นครบชุด · คืน `{ users, counts }` |
| `await seedEmptyEmulator()` | ล้างทุกอย่าง เหลือแค่บัญชีกับประเภทการลา · ใช้เทสหน้าจอว่างเปล่า |
| `await resetEmulator()` | ล้างอย่างเดียว ไม่ใส่อะไรเลย |

### จัดฉากข้อมูลเพิ่ม

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `makeLeaveRequest(overrides?)` | สร้าง object ใบลาที่มีช่องครบ ยังไม่เขียนลงฐาน |
| `await createLeaveRequest(overrides?, id?)` | สร้างแล้วเขียนลงฐานเลย · คืนค่าพร้อม `id` |
| `makeApproval(overrides?)` | สร้าง object ความเห็น |
| `await createApproval(requestId, overrides?, id?)` | เขียนความเห็นลงใต้ใบลานั้น |
| `await createLeaveType(id, name)` | เพิ่มประเภทการลา |

ไม่ส่ง `id` มาจะตั้งให้เองเป็น `lrtest001`, `aptest002` … ไม่ชนกับ `lr001`–`lr005`

### ล็อกอิน

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `await signInAs(page, role, options?)` | ล็อกอินผ่านหน้า login จริง · `role` = `"employee"` `"manager"` `"hr"` |
| `await signOutFrom(page)` | กดปุ่มออกจากระบบบนแถบเมนู |
| `await expectRedirectedToLogin(page, path)` | เปิดหน้าทั้งที่ยังไม่ล็อกอิน แล้วยืนยันว่าถูกเด้งกลับหน้า login |

`signInAs` จบที่หน้ารายการใบลา · อยากไปหน้าอื่นส่ง `{ goto: ... }`

```js
await signInAs(page, "employee");
await signInAs(page, "manager", { goto: PAGES.dashboard });
await signInAs(page, "hr", { goto: detailUrl("lr001") });
```

เมื่อ `signInAs` คืนค่าแล้ว รับประกันว่าล็อกอินติดจริงและหน้าปลายทางโหลดข้อมูลเสร็จแล้ว
(รอจนแถบเมนูขึ้นชื่อคนนั้นก่อนถึงจะคืนค่า) จึงเช็คผลต่อได้เลย ไม่ต้องใส่ `waitForTimeout` เอง

### คุยกับ emulator ตรง ๆ

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `byTestId(page, TESTID.xxx)` | หา element จาก `data-testid` |
| `await writeDoc(path, data)` | เขียนทับทั้งเอกสาร เช่น `writeDoc("users/xxx", {...})` |
| `await readDoc(path)` | อ่านเอกสารเดียว · ไม่มีคืน `null` |
| `await listDocs(collectionPath)` | อ่านทั้งโฟลเดอร์ คืน array ที่มีช่อง `id` |
| `await deleteDoc(path)` | ลบเอกสาร |

ทุกตัวยิงผ่านสิทธิ์ผู้ดูแลของ emulator จึง **ข้าม Security Rules** ได้
ใช้จัดฉากได้ทุกแบบ รวมถึงตั้ง `role` เป็น `manager` หรือ `hr`
ซึ่งสมัครผ่านหน้าเว็บทำไม่ได้ (กฎบังคับให้ทุกคนเริ่มที่ `employee`)

> ใช้ยืนยันผลก็ได้ เช่น กดอนุมัติบนหน้าจอแล้วอ่านกลับมาดูว่าฐานข้อมูลเปลี่ยนจริง
> ```js
> await byTestId(page, TESTID.approveButton).click();
> const ใบ = await readDoc("leaveRequests/lr001");
> expect(ใบ.status).toBe(STATUS.APPROVED);
> ```

---

## รหัสผู้ใช้ในเทส ไม่เหมือนในสเปก — และตั้งใจให้ต่าง

สเปกหัวข้อ 7 เขียนว่าผู้ใช้มีรหัส `u001` `u002` `u003`
แต่ของจริง Firebase Auth เป็นคนแจก `uid` ให้เอง และ Security Rules เทียบแบบนี้

```
requesterId == request.auth.uid
```

ถ้าเทส seed ใบลาด้วย `requesterId: "u001"` ตามสเปกเป๊ะ ๆ
พนักงานที่ล็อกอินจริงจะมี `uid` เป็นคนละค่า → เห็นใบลาของตัวเอง **0 ใบ**
แล้วเทสจะล้มทั้งที่แอปไม่ได้ผิด

fixtures จึงยึดของจริง

| สเปก | ในเทส |
|---|---|
| `u001` สมชาย ใจดี | `uid-employee-u001` |
| `u002` สมหญิง รักงาน | `uid-manager-u002` |
| `u003` สมศรี ตั้งใจ | `uid-hr-u003` |

ส่วนที่เหลือตรงตามสเปกทุกตัว — ชื่อ อีเมล บทบาท และชื่อไฟล์ใบลา `lr001`–`lr005`
(ชื่อไฟล์ใบลาต้องคงไว้ เพราะหน้ารายละเอียดใช้เป็น `?id=` ใน URL)

รหัสผ่านของทุกบัญชีทดสอบคือ `test1234`

---

## ทำไมไม่ให้ Playwright เปิด emulator ให้เอง

Playwright มีท่า `webServer` ที่สั่งเปิดเซิร์ฟเวอร์ให้อัตโนมัติ **ลองแล้วและตัดทิ้ง**

รอบแรกทำงานได้ แต่ตอนจบเทส Playwright ฆ่าได้แค่ `firebase` ซึ่งเป็นโปรเซสแม่
ส่วน Firestore emulator เป็นโปรเซส **Java ลูก** ที่รอดมาและยังจับพอร์ต 8080 ค้างไว้

พอรันเทสรอบถัดไป Playwright เห็นว่า emulator ยังไม่พร้อม เลยสั่งเปิดใหม่
แล้วชนพอร์ตกับผีตัวเดิม ล้มด้วยข้อความที่ไม่ได้บอกสาเหตุจริงเลย

```
Error: Process from config.webServer was not able to start. Exit code: 1
```

จึงเลือกทางที่คาดเดาได้แทน — ให้คนเปิด emulator เอง
ถ้าลืมเปิด `global-setup.js` จะล้มภายใน 1 วินาที พร้อมบอกวิธีแก้เป็นภาษาไทย
ส่วนใครอยากได้คำสั่งเดียวจบ ใช้ `npm run test:ci` ซึ่งเก็บกวาดโปรเซสให้เองครบ

---

## เจอปัญหาแล้วแก้ยังไง

### `Firebase emulator ยังไม่พร้อม: Firestore, Authentication, Hosting`

ยังไม่ได้เปิด emulator · เปิดอีกหน้าต่างหนึ่งด้วย `npm run emulators`

### `Could not start Firestore Emulator` หรือหา Java ไม่เจอ

เปิด emulator โดยไม่ได้ใส่ PATH ของ Java ให้ใช้ `npm run emulators` แทนการพิมพ์ `firebase emulators:start` เอง

### เปิด emulator ไม่ได้ บอกว่าพอร์ตไม่ว่าง

มีโปรเซสเก่าค้างอยู่ ตรวจแล้วปิดทิ้ง

```bash
lsof -nP -iTCP:5050 -iTCP:8080 -iTCP:9099 -sTCP:LISTEN
pkill -f cloud-firestore-emulator
```

### เทสล้มเพราะ `permission-denied`

ปกติแปลว่ากฎทำงานถูกแล้ว แต่เทสจัดฉากผิด — ตรวจสองข้อนี้
1. ล็อกอินด้วยบทบาทที่ทำสิ่งนั้นได้จริงหรือยัง
2. `requesterId` ของใบลาตรงกับ `uid` ของคนที่ล็อกอินอยู่ไหม

### เทสล้มแบบไม่คงที่ เดี๋ยวผ่านเดี๋ยวไม่ผ่าน

มักเป็นสองสาเหตุนี้
1. ลืมเรียก `seedEmulator()` ใน `beforeEach` → ข้อมูลค้างจากเทสก่อนหน้า
2. ไปแก้ `workers` ให้มากกว่า 1 → เทสแย่งฐานข้อมูลก้อนเดียวกัน

### อยากเห็นว่าเทสล้มตรงไหน

```bash
npm run test:e2e:headed   # เห็นเบราว์เซอร์ทำงานจริง
npm run test:report       # เปิดรายงานพร้อมภาพหน้าจอและ trace
```
