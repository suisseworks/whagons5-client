import type { UserTeam } from "@/store/types";

export const getUserTeamRoleId = (ut: UserTeam | any) => {
  const val = ut?.role_id ?? ut?.roleId ?? ut?.role?.id;
  return val == null ? null : Number(val);
};

