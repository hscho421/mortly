import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth/next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { authOptions } from "@/lib/auth";

/**
 * Shared admin getServerSideProps — gates the entire admin section on an
 * ADMIN session at render time instead of inside a client useEffect.
 *
 * Replaces the AdminShell auth-gate flash + lets us kill the bundled
 * getStaticProps that admin pages were using (which can't safely check auth).
 *
 * Usage:
 *   export const getServerSideProps = adminSSR();
 *
 * Or with custom merging (future need):
 *   export const getServerSideProps = adminSSR(async (ctx) => ({
 *     props: { extra: 1 }
 *   }));
 */
export function adminSSR<P extends Record<string, unknown> = Record<string, unknown>>(
  extra?: (ctx: GetServerSidePropsContext) => Promise<{ props: P } | { redirect: { destination: string; permanent: boolean } } | { notFound: true }>,
): GetServerSideProps {
  return async (ctx) => {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session as any)?.user?.role;
    if (!session || role !== "ADMIN") {
      const callbackUrl = encodeURIComponent(ctx.resolvedUrl || "/admin/inbox");
      return {
        redirect: {
          destination: `/login?callbackUrl=${callbackUrl}`,
          permanent: false,
        },
      };
    }

    const i18n = await serverSideTranslations(ctx.locale ?? "ko", ["common"]);

    if (extra) {
      const r = await extra(ctx);
      if ("redirect" in r || "notFound" in r) return r;
      return { props: { ...i18n, ...r.props } };
    }

    return { props: i18n };
  };
}
