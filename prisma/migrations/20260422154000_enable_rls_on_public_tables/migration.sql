-- Enable Row Level Security on every table exposed via the `public` schema.
--
-- Rationale:
--   Supabase exposes the `public` schema through PostgREST to the `anon` and
--   `authenticated` roles. This project never accesses the DB through the
--   Supabase JS client (it is only used for Auth); all reads/writes go through
--   Prisma on the server, using the Supabase `postgres` pooler role which has
--   the `BYPASSRLS` attribute. We therefore enable RLS with NO policies, which
--   effectively denies every request coming from the Data API while leaving
--   the Prisma-based server code completely unaffected.
--
--   This resolves Supabase linter advisor `rls_disabled_in_public` (0013) for
--   all application tables.

ALTER TABLE "public"."User"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Skill"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserSkill"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ShiftType"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ShiftSkill"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Availability"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Assignment"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PlanningWeek"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PlanningTemplate"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PlanningTemplateEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PlanningComment"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CommentaryEntry"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FollowUpEntry"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeaveRequest"          ENABLE ROW LEVEL SECURITY;

-- The Prisma migrations table is also exposed in `public`. It contains no
-- sensitive data but enabling RLS silences the advisor for it as well.
-- We guard this with a regclass check because the shadow database used by
-- `prisma migrate dev` may not have `_prisma_migrations` yet at the moment
-- this migration is replayed.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;
