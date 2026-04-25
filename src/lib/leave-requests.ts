/** Filtre les demandes de congé : auteurs actuellement membres de l'équipe (UserTeam). */

export function leaveRequestsWhereUserInTeam(teamId: string) {
  return {
    user: {
      teams: {
        some: { teamId },
      },
    },
  };
}
