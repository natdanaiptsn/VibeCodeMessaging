import { route } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { enabledProviders, providerIdOf } from "@/lib/auth/oauth/providers";

/** บัญชี Google / LINE ที่ผูกไว้ และผู้ให้บริการที่ระบบเปิดใช้ */
export const GET = route({}, async ({ session }) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      identities: { select: { provider: true, email: true, displayName: true, pictureUrl: true, createdAt: true, lastUsedAt: true } },
    },
  });
  return {
    providers: enabledProviders(),
    allowSignup: env().AUTH_ALLOW_SIGNUP,
    hasPassword: Boolean(user.passwordHash),
    identities: user.identities.map(({ provider, ...rest }) => ({ provider: providerIdOf(provider), ...rest })),
  };
});
