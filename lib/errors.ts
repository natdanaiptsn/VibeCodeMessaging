export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "ERROR",
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, "BAD_REQUEST", details);
export const unauthorized = (message = "กรุณาเข้าสู่ระบบ") => new ApiError(401, message, "UNAUTHORIZED");
export const forbidden = (message = "คุณไม่มีสิทธิ์ดำเนินการนี้") => new ApiError(403, message, "FORBIDDEN");
export const notFound = (message = "ไม่พบข้อมูล") => new ApiError(404, message, "NOT_FOUND");
export const conflict = (message: string) => new ApiError(409, message, "CONFLICT");
export const tooManyRequests = (message = "มีการเรียกใช้งานถี่เกินไป กรุณาลองใหม่ภายหลัง", retryAfter?: number) =>
  new ApiError(429, message, "RATE_LIMITED", retryAfter ? { retryAfter } : undefined);
