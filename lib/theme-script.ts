/** ค่าคงที่ของธีม (ใช้ได้ทั้ง Server และ Client) — สคริปต์นี้ถูกใส่ใน <head> ของทุกหน้า */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "lineoa-theme";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** ใส่ class "dark" ก่อนหน้าเว็บแสดงผล เพื่อไม่ให้จอกะพริบเป็นสีขาวตอนโหลด */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;
