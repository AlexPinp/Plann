-- CreateEnum
CREATE TYPE "OrganisationSector" AS ENUM ('CMC', 'CC', 'SAUV', 'UDOM');

-- AlterTable
ALTER TABLE "UserTeam" ADD COLUMN "organisationSector" "OrganisationSector";
