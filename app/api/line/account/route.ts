import { route } from "@/lib/api/handler";
import { getLineAccountPublic } from "@/services/line-account.service";

export const GET = route({ permission: "line:view" }, async () => getLineAccountPublic());
