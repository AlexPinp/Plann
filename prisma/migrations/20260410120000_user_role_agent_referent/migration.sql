-- READ_ONLY -> AGENT, ajout REFERENT
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('AGENT', 'CADRE', 'REFERENT', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'READ_ONLY' THEN 'AGENT'::"UserRole_new"
    WHEN 'AGENT' THEN 'AGENT'::"UserRole_new"
    WHEN 'CADRE' THEN 'CADRE'::"UserRole_new"
    WHEN 'REFERENT' THEN 'REFERENT'::"UserRole_new"
    WHEN 'ADMIN' THEN 'ADMIN'::"UserRole_new"
    ELSE 'AGENT'::"UserRole_new"
  END
);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'AGENT'::"UserRole_new";
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;
