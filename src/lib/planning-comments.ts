export const PLANNING_COMMENT_TYPES = ["CA", "FORMATION", "ABSENCE", "INFO", "BLOCAGE"] as const;
export const PLANNING_COMMENT_STATUSES = ["NONE", "PENDING", "APPROVED", "REFUSED"] as const;
export const PLANNING_COMMENT_VISIBILITIES = ["TEAM", "MANAGER", "PRIVATE"] as const;

export type PlanningCommentType = (typeof PLANNING_COMMENT_TYPES)[number];
export type PlanningCommentStatus = (typeof PLANNING_COMMENT_STATUSES)[number];
export type PlanningCommentVisibility = (typeof PLANNING_COMMENT_VISIBILITIES)[number];

const TYPE_LABELS: Record<PlanningCommentType, string> = {
  CA: "CA",
  FORMATION: "Formation",
  ABSENCE: "Absence",
  INFO: "Info",
  BLOCAGE: "Blocage",
};

const TYPE_BADGES: Record<PlanningCommentType, string> = {
  CA: "CA",
  FORMATION: "FO",
  ABSENCE: "AB",
  INFO: "IN",
  BLOCAGE: "BL",
};

const STATUS_LABELS: Record<PlanningCommentStatus, string> = {
  NONE: "Sans statut",
  PENDING: "En attente",
  APPROVED: "Valide",
  REFUSED: "Refuse",
};

const VISIBILITY_LABELS: Record<PlanningCommentVisibility, string> = {
  TEAM: "Equipe",
  MANAGER: "Manager",
  PRIVATE: "Prive",
};

export function planningCommentTypeLabel(type: PlanningCommentType): string {
  return TYPE_LABELS[type];
}

export function planningCommentTypeBadge(type: PlanningCommentType): string {
  return TYPE_BADGES[type];
}

export function planningCommentStatusLabel(status: PlanningCommentStatus): string {
  return STATUS_LABELS[status];
}

export function planningCommentVisibilityLabel(visibility: PlanningCommentVisibility): string {
  return VISIBILITY_LABELS[visibility];
}

export function canViewPlanningComment(
  visibility: PlanningCommentVisibility,
  opts: { isStaff: boolean; viewerUserId?: string | null; commentUserId: string },
): boolean {
  if (opts.isStaff) return true;
  if (visibility === "TEAM") return true;
  return visibility === "PRIVATE" && opts.viewerUserId === opts.commentUserId;
}
