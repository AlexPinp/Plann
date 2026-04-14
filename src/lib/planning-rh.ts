export const PLANNING_RH_PROFILES = [
  "WITH_RTT_VARIABLE_1",
  "WITH_RTT_VARIABLE_2",
  "WITH_RTT_FIXED",
  "WITH_RTT_NIGHT",
  "WITH_RTT_FORFAIT_JOUR",
  "WITHOUT_RTT_VARIABLE_1",
  "WITHOUT_RTT_VARIABLE_2",
  "WITHOUT_RTT_FIXED",
] as const;

export type PlanningRhProfile = (typeof PLANNING_RH_PROFILES)[number];

export const DEFAULT_PLANNING_RH_PROFILE: PlanningRhProfile = "WITH_RTT_VARIABLE_1";

export const planningRhProfileLabelsFr: Record<PlanningRhProfile, string> = {
  WITH_RTT_VARIABLE_1: "Avec RTT - Variable 1 (10 a 19 dimanches/JF)",
  WITH_RTT_VARIABLE_2: "Avec RTT - Variable 2 (20 dimanches/JF)",
  WITH_RTT_FIXED: "Avec RTT - Repos fixe (< 10 dimanches/JF)",
  WITH_RTT_NIGHT: "Avec RTT - Nuit",
  WITH_RTT_FORFAIT_JOUR: "Avec RTT - Forfait jours",
  WITHOUT_RTT_VARIABLE_1: "Sans RTT - Variable 1 (10 a 19 dimanches/JF)",
  WITHOUT_RTT_VARIABLE_2: "Sans RTT - Variable 2 (20 dimanches/JF)",
  WITHOUT_RTT_FIXED: "Sans RTT - Repos fixe (< 10 dimanches/JF)",
};

type PlanningRhRules = {
  dailyHours: number | null;
  annualHoursCommonYear: number | null;
  annualHoursLeapYear: number | null;
  annualRestDays: number;
  annualPublicHolidays: number;
  annualRttDays: number;
  annualLeaveQuota: {
    CA: number;
    CF: number;
    CH: number;
    RTT: number;
  };
};

export const planningRhRulesByProfile: Record<PlanningRhProfile, PlanningRhRules> = {
  WITH_RTT_VARIABLE_1: {
    dailyHours: 7.5,
    annualHoursCommonYear: 1560,
    annualHoursLeapYear: 1567.5,
    annualRestDays: 104,
    annualPublicHolidays: 11,
    annualRttDays: 14,
    annualLeaveQuota: { CA: 25, CF: 1, CH: 2, RTT: 14 },
  },
  WITH_RTT_VARIABLE_2: {
    dailyHours: 7.5,
    annualHoursCommonYear: 1545,
    annualHoursLeapYear: 1552.5,
    annualRestDays: 104,
    annualPublicHolidays: 11,
    annualRttDays: 14,
    annualLeaveQuota: { CA: 25, CF: 1, CH: 2, RTT: 14 },
  },
  WITH_RTT_FIXED: {
    dailyHours: 7.5,
    annualHoursCommonYear: 1575,
    annualHoursLeapYear: 1582.5,
    annualRestDays: 104,
    annualPublicHolidays: 9,
    annualRttDays: 14,
    annualLeaveQuota: { CA: 25, CF: 1, CH: 2, RTT: 14 },
  },
  WITH_RTT_NIGHT: {
    dailyHours: 7,
    annualHoursCommonYear: 1456,
    annualHoursLeapYear: 1463,
    annualRestDays: 104,
    annualPublicHolidays: 11,
    annualRttDays: 14,
    annualLeaveQuota: { CA: 25, CF: 1, CH: 2, RTT: 14 },
  },
  WITH_RTT_FORFAIT_JOUR: {
    dailyHours: null,
    annualHoursCommonYear: null,
    annualHoursLeapYear: null,
    annualRestDays: 104,
    annualPublicHolidays: 9,
    annualRttDays: 19,
    annualLeaveQuota: { CA: 25, CF: 1, CH: 2, RTT: 19 },
  },
  WITHOUT_RTT_VARIABLE_1: {
    dailyHours: 7,
    annualHoursCommonYear: 1561,
    annualHoursLeapYear: 1568,
    annualRestDays: 104,
    annualPublicHolidays: 10,
    annualRttDays: 0,
    annualLeaveQuota: { CA: 25, CF: 1, CH: 2, RTT: 0 },
  },
  WITHOUT_RTT_VARIABLE_2: {
    dailyHours: 7,
    annualHoursCommonYear: 1547,
    annualHoursLeapYear: 1554,
    annualRestDays: 104,
    annualPublicHolidays: 10,
    annualRttDays: 0,
    annualLeaveQuota: { CA: 25, CF: 1, CH: 2, RTT: 0 },
  },
  WITHOUT_RTT_FIXED: {
    dailyHours: 7,
    annualHoursCommonYear: 1575,
    annualHoursLeapYear: 1582,
    annualRestDays: 104,
    annualPublicHolidays: 8,
    annualRttDays: 0,
    annualLeaveQuota: { CA: 25, CF: 1, CH: 2, RTT: 0 },
  },
};

export function parsePlanningRhProfile(value: FormDataEntryValue | string | null | undefined): PlanningRhProfile {
  const candidate = String(value ?? "");
  if ((PLANNING_RH_PROFILES as readonly string[]).includes(candidate)) {
    return candidate as PlanningRhProfile;
  }
  return DEFAULT_PLANNING_RH_PROFILE;
}

export function isLeapYear(year: number) {
  return new Date(Date.UTC(year, 1, 29, 12, 0, 0, 0)).getUTCDate() === 29;
}
