import { projectRoute } from "@/lib/api/handler";
import { getLineAccountPublic } from "@/services/line-account.service";

export const GET = projectRoute({ permission: "line:view" }, async ({ project }) => getLineAccountPublic(project.id));
