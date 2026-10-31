import {
  Bot,
  History,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquareText,
  MessagesSquare,
  PlugZap,
  Settings,
  Users,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export const NAV_ITEMS: { href: string; label: string; icon: typeof Bot; permission: Permission }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { href: "/inbox", label: "กล่องข้อความ", icon: MessagesSquare, permission: "inbox:view" },
  { href: "/customers", label: "ลูกค้า", icon: Users, permission: "customers:view" },
  { href: "/auto-reply", label: "ระบบตอบกลับอัตโนมัติ", icon: Bot, permission: "rules:view" },
  { href: "/text-messages", label: "Text Message", icon: MessageSquareText, permission: "templates:view" },
  { href: "/flex-builder", label: "Flex Message Builder", icon: LayoutTemplate, permission: "templates:view" },
  { href: "/reply-logs", label: "ประวัติการตอบกลับ", icon: History, permission: "logs:view" },
  { href: "/line-settings", label: "LINE OA Settings", icon: PlugZap, permission: "line:view" },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: Settings, permission: "settings:view" },
];
