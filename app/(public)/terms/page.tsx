import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "ข้อกำหนดการใช้งาน", robots: { index: true, follow: true } };

export default function TermsPage() {
  return (
    <LegalPage title="ข้อกำหนดการใช้งาน (Terms of Service)" updated="4 พฤศจิกายน 2569">
      <p>การเข้าใช้งาน LINE OA Auto Reply Manager (“ระบบ”) ถือว่าคุณยอมรับข้อกำหนดต่อไปนี้</p>

      <section>
        <h2>1. การใช้งาน</h2>
        <ul>
          <li>ระบบใช้สำหรับจัดการ LINE Official Account และตอบกลับข้อความอัตโนมัติด้วยกฎที่คุณตั้งไว้</li>
          <li>คุณต้องเป็นเจ้าของ หรือได้รับอนุญาตจากเจ้าของ LINE Official Account ที่นำมาเชื่อมต่อ</li>
          <li>คุณต้องปฏิบัติตามข้อกำหนดของ LINE และกฎหมายที่เกี่ยวข้อง รวมถึงกฎหมายคุ้มครองข้อมูลส่วนบุคคล</li>
        </ul>
      </section>

      <section>
        <h2>2. สิ่งที่ห้ามทำ</h2>
        <ul>
          <li>ส่งสแปม ข้อความหลอกลวง หรือเนื้อหาที่ผิดกฎหมาย</li>
          <li>พยายามเข้าถึงโปรเจกต์หรือข้อมูลที่คุณไม่ได้รับสิทธิ์ หรือรบกวนการทำงานของระบบ</li>
        </ul>
      </section>

      <section>
        <h2>3. บัญชีผู้ใช้</h2>
        <ul>
          <li>คุณรับผิดชอบการใช้งานที่เกิดจากบัญชีของคุณ และสมาชิกที่คุณเพิ่มเข้าโปรเจกต์</li>
          <li>ผู้ดูแลระบบอาจระงับบัญชีที่ละเมิดข้อกำหนดนี้</li>
        </ul>
      </section>

      <section>
        <h2>4. ข้อจำกัดความรับผิด</h2>
        <p>
          ระบบให้บริการตามสภาพที่เป็นอยู่ (as is) ผู้ให้บริการพยายามรักษาความถูกต้องและความต่อเนื่อง แต่ไม่รับประกันว่าระบบจะทำงานได้ตลอดเวลา
          และไม่รับผิดชอบต่อความเสียหายจากการหยุดให้บริการของ LINE หรือผู้ให้บริการภายนอก
        </p>
      </section>

      <section>
        <h2>5. ข้อมูลส่วนบุคคล</h2>
        <p>
          การเก็บและใช้ข้อมูลเป็นไปตาม <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
        </p>
        <ContactLine />
      </section>
    </LegalPage>
  );
}
