-- Codify the chat-confidentiality posture so it is version-controlled and
-- cannot silently regress.
--
-- The browser bundle ships NEXT_PUBLIC_SUPABASE_ANON_KEY, so Supabase's
-- PostgREST data API (/rest/v1/messages, /rest/v1/conversations) is reachable by
-- anyone holding that public key. The app NEVER reads these tables via the anon
-- key — chat is fetched through the authenticated Next.js API over the Prisma /
-- service-role connection — so the correct posture is: RLS enabled, NO anon
-- policy (deny-all), and the public PostgREST roles stripped of table privileges.
--
-- SAFETY: this ENABLEs (not FORCEs) RLS. The table owner — the role Prisma
-- connects as, which created these tables — is exempt from non-forced RLS, so the
-- app's own queries are unaffected. Supabase's service_role has BYPASSRLS, so
-- service-role operations also keep working. Only non-owner roles that are subject
-- to RLS (anon, authenticated) are affected, and with no policy they default-deny.
-- Idempotent: ENABLE RLS and REVOKE are safe to re-run.

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;

-- Strip table privileges from the public PostgREST roles. Guarded by a role
-- existence check so the migration stays portable to a plain Postgres (local /
-- CI) where these Supabase-managed roles don't exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "messages" FROM "anon";
    REVOKE ALL ON "conversations" FROM "anon";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "messages" FROM "authenticated";
    REVOKE ALL ON "conversations" FROM "authenticated";
  END IF;
END $$;
