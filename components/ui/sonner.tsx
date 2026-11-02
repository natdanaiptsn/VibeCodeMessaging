"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useThemePreference } from "@/lib/theme";

export function Toaster(props: ToasterProps) {
  const theme = useThemePreference();
  return <Sonner theme={theme} position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} {...props} />;
}
