import { useRouter } from "next/router";
import AdminShell from "./admin/AdminShell";

/**
 * Back-compat shim for the old admin detail pages (users/[id].tsx,
 * brokers/[id].tsx, conversations/[id].tsx). Keeping this wrapper so the
 * detail pages don't need per-file edits during the IA migration — they
 * now automatically get the new AdminShell chrome + auth gate + ⌘K palette.
 *
 * New pages (inbox/people/activity/reports/system) wrap AdminShell directly
 * with an explicit `active` prop; this wrapper just derives it from the URL.
 */

type NavKey = "inbox" | "people" | "activity" | "reports" | "system";

function deriveActive(pathname: string): NavKey {
  if (pathname.startsWith("/admin/people") || pathname.startsWith("/admin/users") || pathname.startsWith("/admin/brokers")) {
    return "people";
  }
  if (pathname.startsWith("/admin/activity") || pathname.startsWith("/admin/requests") || pathname.startsWith("/admin/conversations")) {
    return "activity";
  }
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/system") || pathname.startsWith("/admin/settings")) return "system";
  return "inbox";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return <AdminShell active={deriveActive(router.pathname)}>{children}</AdminShell>;
}
