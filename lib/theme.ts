"use client";

/**
 * ธีมสว่าง/มืด ของหน้าเว็บ (เก็บใน localStorage ของเบราว์เซอร์แต่ละเครื่อง)
 * - "system" = ตามการตั้งค่าของอุปกรณ์ (prefers-color-scheme)
 * - สคริปต์ใน <head> (THEME_INIT_SCRIPT) ใส่ class "dark" ก่อนหน้าเว็บแสดงผล จึงไม่กะพริบ
 */
import { useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme-script";

export type { ThemePreference };

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    if (readPreference() === "system") apply("system");
    notify();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    apply(readPreference());
    notify();
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* โหมดส่วนตัว/ปิด storage — ยังเปลี่ยนธีมได้ในหน้านี้ */
  }
  apply(pref);
  notify();
}

/** ธีมที่ผู้ใช้เลือก (light / dark / system) */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system");
}

/** ธีมที่ใช้งานจริงตอนนี้ (หลังแปลง system เป็น light/dark) */
export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );
}
