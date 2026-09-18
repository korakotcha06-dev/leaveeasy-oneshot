// ─────────────────────────────────────────────────────────────
// js/ai.js — จุดเรียก AI ที่เดียวของทั้งเว็บ (OpenRouter)
//
// ทุกหน้าที่ใช้ AI ให้ import จากไฟล์นี้ จะได้คุมเรื่องเดียวกันที่เดียว
//   - อ่านคีย์จาก js/ai-config.js (ไฟล์นี้ .gitignore กันไว้ ห้ามขึ้น GitHub)
//   - รอได้ไม่เกิน 15 วินาที เกินแล้วยกเลิกเอง หน้าเว็บจะได้ไม่ค้าง
//   - แปลรหัสข้อผิดพลาดเป็นภาษาไทยที่บอกว่าควรทำอะไรต่อ
//
// ข้อจำกัดที่รู้อยู่แล้ว: คีย์ถูกส่งไปกับหน้าเว็บ ใครกด F12 ก็เห็น
//    ระบบจริงต้องมีตัวกลางเก็บคีย์ฝั่งที่ผู้ใช้แตะไม่ได้ — อยู่ใน Backlog Sprint 2
// ─────────────────────────────────────────────────────────────

let ค่าAI = null;
try {
  const โมดูล = await import("./ai-config.js");
  ค่าAI = โมดูล.aiConfig;
} catch (e) {
  ค่าAI = null;          // ยังไม่ได้สร้างไฟล์ · หน้าเว็บยังใช้ได้ แค่ปุ่ม AI จะบอกว่ายังไม่พร้อม
}

export const รุ่นโมเดล = (ค่าAI && ค่าAI.model) || "google/gemini-2.5-flash-lite";

export const มีคีย์AI = Boolean(
  ค่าAI && typeof ค่าAI.apiKey === "string" && ค่าAI.apiKey.startsWith("sk-or-")
);

const เวลารอสูงสุด = 15000;   // 15 วินาที ตาม spec US-09

// ถาม AI หนึ่งครั้ง คืนค่าเป็นข้อความคำตอบ · พังเมื่อไรจะโยน Error ที่มีข้อความภาษาไทย
export async function ถามAI(คำสั่งระบบ, ข้อความ) {
  if (!มีคีย์AI) {
    throw new Error("ยังไม่ได้ใส่คีย์ AI — คัดลอก js/ai-config.example.js เป็น js/ai-config.js แล้วใส่คีย์");
  }

  const ตัวยกเลิก = new AbortController();
  const ตัวจับเวลา = setTimeout(() => ตัวยกเลิก.abort(), เวลารอสูงสุด);

  try {
    const คำตอบ = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ตัวยกเลิก.signal,
      headers: {
        "Authorization": "Bearer " + ค่าAI.apiKey,
        "Content-Type": "application/json",
        "X-Title": "LeaveEasy"
      },
      body: JSON.stringify({
        model: รุ่นโมเดล,
        temperature: 0,          // อยากได้คำตอบนิ่ง ถามซ้ำได้ผลเดิม
        messages: [
          { role: "system", content: คำสั่งระบบ },
          { role: "user", content: ข้อความ }
        ]
      })
    });

    if (!คำตอบ.ok) throw new Error(แปลรหัสHTTP(คำตอบ.status));

    const ข้อมูล = await คำตอบ.json();
    const เนื้อความ = ข้อมูล && ข้อมูล.choices && ข้อมูล.choices[0] &&
      ข้อมูล.choices[0].message && ข้อมูล.choices[0].message.content;
    if (!เนื้อความ) throw new Error("AI ตอบกลับมาว่างเปล่า");
    return String(เนื้อความ).trim();

  } catch (e) {
    if (e.name === "AbortError") throw new Error("AI ตอบช้าเกิน 15 วินาที จึงยกเลิกไปก่อน");
    if (e instanceof TypeError) throw new Error("ต่อ AI ไม่ได้ — ตรวจอินเทอร์เน็ต");
    throw e;
  } finally {
    clearTimeout(ตัวจับเวลา);
  }
}

// AI ชอบห่อ JSON ด้วย ```json ... ``` มาให้ · แกะออกก่อนแปลง ถ้าแปลงไม่ได้คืน null ไม่โยน Error
export function แกะJSON(ข้อความ) {
  const ตัด = String(ข้อความ).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(ตัด);
  } catch (e) {
    return null;
  }
}

function แปลรหัสHTTP(รหัส) {
  if (รหัส === 401) return "คีย์ AI ไม่ถูกต้องหรือคัดลอกมาไม่ครบ (401)";
  if (รหัส === 402) return "วงเงินของคีย์ AI หมดแล้ว (402)";
  if (รหัส === 404) return "ไม่พบรุ่นโมเดล " + รุ่นโมเดล + " — ใช้ชื่อรุ่นสำรองที่ผู้สอนประกาศ (404)";
  if (รหัส === 429) return "เรียก AI ถี่เกินไป รอสักครู่แล้วลองใหม่ (429)";
  return "เรียก AI ไม่สำเร็จ (รหัส " + รหัส + ")";
}
