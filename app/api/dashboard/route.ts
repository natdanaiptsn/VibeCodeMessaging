import { route } from "@/lib/api/handler";
import { getDashboardData } from "@/services/dashboard.service";

export const GET = route({ permission: "dashboard:view" }, async () => getDashboardData(14));
