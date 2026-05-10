-- Visibilité agent par équipe : planning équipe (consultation) vs grille admin (édition)

ALTER TABLE "UserTeam" ADD COLUMN IF NOT EXISTS "showInTeamPlanning" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserTeam" ADD COLUMN IF NOT EXISTS "showInAdminPlanning" BOOLEAN NOT NULL DEFAULT true;
