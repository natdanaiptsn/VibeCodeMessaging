import "server-only";
import bcrypt from "bcryptjs";

const COST = 12;

// hash จำลองสำหรับกรณีไม่พบผู้ใช้ เพื่อให้เวลาตอบสนองใกล้เคียงกัน (ป้องกัน user enumeration)
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= bcrypt.hash("dummy-password-for-timing", COST);
  return dummyHash;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, await getDummyHash()).catch(() => false);
    return false;
  }
  return bcrypt.compare(password, hash);
}
