import { adminSSR } from "@/lib/admin/ssrAuth";
import prisma from "@/lib/prisma";

/**
 * /admin/brokers/[id] — legacy route, now a redirect only.
 *
 * The standalone broker-detail page was folded into /admin/users/[id]: a
 * single role-aware user-detail page whose "broker panel" carries the
 * verification actions (verify / reject / reset), photo, and profile that
 * used to live here. Account moderation already shared one endpoint, so the
 * only thing that moved was verification.
 *
 * This shim preserves old bookmarks and the operator-manual link by resolving
 * the id — a broker internal id OR the owning user's 9-digit publicId — to the
 * user publicId and 302-ing to the unified page. Unresolvable ids fall back to
 * the broker-filtered people list. adminSSR gates it on an ADMIN session.
 */
export default function AdminBrokerDetailRedirect() {
  return null;
}

export const getServerSideProps = adminSSR(async (ctx) => {
  const id = typeof ctx.params?.id === "string" ? ctx.params.id : "";

  // 9-digit ids are already the user publicId; anything else is a broker id we
  // resolve to its owning user's publicId (brokers have no publicId column).
  let publicId: string | null = /^\d{9}$/.test(id) ? id : null;
  if (!publicId && id) {
    const broker = await prisma.broker.findUnique({
      where: { id },
      select: { user: { select: { publicId: true } } },
    });
    publicId = broker?.user.publicId ?? null;
  }

  return {
    redirect: {
      destination: publicId ? `/admin/users/${publicId}` : "/admin/people?role=BROKER",
      permanent: false,
    },
  };
});
