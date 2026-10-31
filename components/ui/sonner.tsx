"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return <Sonner position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} {...props} />;
}
