"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { toast } from "sonner";

export type ApiErrorDetail = { path: string; message: string };

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: ApiErrorDetail[] | unknown,
  ) {
    super(message);
  }

  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as ApiErrorDetail[]) {
        if (d && typeof d.path === "string" && !out[d.path]) out[d.path] = d.message;
      }
    }
    return out;
  }
}

type FetchOptions = Omit<RequestInit, "body"> & { body?: unknown; formData?: FormData };

/** เรียก API ภายในระบบ (ส่ง cookie อัตโนมัติ, แปลง error เป็นข้อความภาษาไทย) */
export async function apiFetch<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { body, formData, headers, ...rest } = opts;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiClientError(0, "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/login")) {
      // session หมดอายุ — โหลดหน้าใหม่ไปยังหน้า Login (อยู่นอก React จึงใช้ router ไม่ได้)
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    const err = json?.error;
    throw new ApiClientError(res.status, err?.message ?? `เกิดข้อผิดพลาด (${res.status})`, err?.code, err?.details);
  }
  return (json?.data ?? json) as T;
}

export function useApiQuery<T>(
  key: QueryKey,
  url: string | null,
  options?: Omit<UseQueryOptions<T, ApiClientError>, "queryKey" | "queryFn">,
) {
  return useQuery<T, ApiClientError>({
    queryKey: key,
    queryFn: () => apiFetch<T>(url!),
    enabled: url !== null && (options?.enabled ?? true),
    ...options,
  });
}

type MutationConfig<TVars, TData> = {
  url: string | ((vars: TVars) => string);
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: (vars: TVars) => unknown;
  successMessage?: string | ((data: TData) => string | null) | null;
  invalidate?: QueryKey[];
  onSuccess?: (data: TData, vars: TVars) => void;
  showErrorToast?: boolean;
};

export function useApiMutation<TVars = void, TData = unknown>(config: MutationConfig<TVars, TData>) {
  const qc = useQueryClient();
  return useMutation<TData, ApiClientError, TVars>({
    mutationFn: (vars) =>
      apiFetch<TData>(typeof config.url === "function" ? config.url(vars) : config.url, {
        method: config.method ?? "POST",
        body: config.body ? config.body(vars) : vars === undefined ? undefined : vars,
      }),
    onSuccess: async (data, vars) => {
      const msg = typeof config.successMessage === "function" ? config.successMessage(data) : config.successMessage;
      if (msg) toast.success(msg);
      await Promise.all((config.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      config.onSuccess?.(data, vars);
    },
    onError: (err) => {
      if (config.showErrorToast !== false) toast.error(err.message);
    },
  });
}
