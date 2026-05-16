/** Nom court pour les cellules de planification : prénom + initiale du nom. */
export function agentNameInPlanningCell(firstName: string, lastName: string): string {
  const given = firstName.trim();
  const initial = lastName.trim().charAt(0);
  if (!initial) return given;
  return `${given} ${initial.toUpperCase()}.`;
}
