-- Remove organisation sector feature from UserTeam.
ALTER TABLE "UserTeam" DROP COLUMN IF EXISTS "organisationSector";

DROP TYPE IF EXISTS "OrganisationSector";
