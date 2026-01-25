import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import type { Invitation, Team, UserTeam } from "@/store/types";
import { buildInvitationLink } from "@/lib/invitationLink";

import { createActionsCellRenderer, AvatarCellRenderer } from "../../../components";
import { CopyButton } from "../components/CopyButton";
import type { TranslateFn, UserData } from "../types";

export function useUsersColumnDefs({
  translate,
  teams,
  jobPositions,
  userTeams,
}: {
  translate: TranslateFn;
  teams: Team[];
  jobPositions: any[];
  userTeams: UserTeam[];
}): ColDef[] {
  return useMemo<ColDef[]>(() => {
    const columnLabels = {
      id: translate("grid.columns.id", "ID"),
      name: translate("grid.columns.name", "Name"),
      email: translate("grid.columns.email", "Email"),
      teams: translate("grid.columns.teams", "Teams"),
      jobPosition: translate("grid.columns.jobPosition", "Job Position"),
      subscription: translate("grid.columns.subscription", "Subscription"),
      actions: translate("grid.columns.actions", "Actions"),
    };
    const noTeamsLabel = translate("grid.values.noTeams", "No Teams");
    const noJobPositionLabel = translate("grid.values.noJobPosition", "No Job Position");
    const activeLabel = translate("grid.values.active", "Active");
    const inactiveLabel = translate("grid.values.inactive", "Inactive");

    return [
      {
        field: "id",
        headerName: columnLabels.id,
        width: 90,
        hide: true,
      },
      {
        field: "name",
        headerName: columnLabels.name,
        flex: 2,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams) => (
          <AvatarCellRenderer name={params.data?.name || ""} color={params.data?.color} />
        ),
      },
      {
        field: "email",
        headerName: columnLabels.email,
        flex: 1.8,
        minWidth: 180,
      },
      {
        field: "teams",
        headerName: columnLabels.teams,
        flex: 2,
        minWidth: 240,
        cellRenderer: (params: ICellRendererParams) => {
          const userId = (params.data as UserData | undefined)?.id;
          if (!userId) return <span className="text-muted-foreground">{noTeamsLabel}</span>;

          const userTeamRelationships = userTeams.filter((ut: UserTeam) => ut.user_id === userId);
          if (!userTeamRelationships || userTeamRelationships.length === 0) {
            return <span className="text-muted-foreground">{noTeamsLabel}</span>;
          }

          const userTeamObjects = userTeamRelationships
            .map((ut: UserTeam) => {
              const team = teams.find((t: Team) => t.id === ut.team_id);
              return team ? { id: team.id, name: team.name, color: team.color ?? null } : null;
            })
            .filter((team): team is { id: number; name: string; color: string | null } => team !== null);

          if (userTeamObjects.length === 0) {
            return <span className="text-muted-foreground">{noTeamsLabel}</span>;
          }

          return (
            <div className="flex flex-wrap gap-1 py-1 px-1 items-center">
              {userTeamObjects.map((team: { id: number; name: string; color: string | null }) => {
                const initial = (team.name || "").charAt(0).toUpperCase();
                const hex = String(team.color || "").trim();
                let bg = hex;
                let fg = "#fff";
                try {
                  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
                    const h =
                      hex.length === 4
                        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
                        : hex;
                    const r = parseInt(h.slice(1, 3), 16);
                    const g = parseInt(h.slice(3, 5), 16);
                    const b = parseInt(h.slice(5, 7), 16);
                    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                    fg = brightness > 180 ? "#111827" : "#ffffff";
                  } else if (!hex) {
                    bg = "";
                  }
                } catch {
                  /* ignore */
                }
                return (
                  <div
                    key={team.id}
                    className={`w-6 h-6 min-w-[1.5rem] rounded-full flex items-center justify-center text-xs font-semibold cursor-default leading-none ${bg ? "" : "bg-muted text-foreground/80"}`}
                    style={bg ? { backgroundColor: bg, color: fg } : undefined}
                    title={team.name}
                  >
                    {initial || "T"}
                  </div>
                );
              })}
            </div>
          );
        },
        cellStyle: { overflow: "visible", padding: "0" },
        autoHeight: true,
      },
      {
        field: "job_position_id",
        headerName: columnLabels.jobPosition,
        flex: 1.6,
        minWidth: 160,
        cellRenderer: (params: ICellRendererParams) => {
          const idVal = params.value as number | string | undefined;
          if (idVal == null || idVal === "") return <span className="text-muted-foreground">{noJobPositionLabel}</span>;
          const idNum = typeof idVal === "string" ? Number(idVal) : idVal;
          const jp = jobPositions.find((p: any) => Number(p.id) === idNum);
          return (
            <Badge variant="secondary" className="h-6 px-2 inline-flex items-center self-center">
              {jp?.title || idNum}
            </Badge>
          );
        },
      },
      {
        field: "has_active_subscription",
        headerName: columnLabels.subscription,
        flex: 1,
        minWidth: 150,
        cellRenderer: (params: ICellRendererParams) =>
          params.value ? (
            <Badge variant="default" className="bg-green-500">
              {activeLabel}
            </Badge>
          ) : (
            <Badge variant="destructive">{inactiveLabel}</Badge>
          ),
      },
      {
        field: "actions",
        headerName: columnLabels.actions,
        width: 220,
        cellRenderer: createActionsCellRenderer({}),
        sortable: false,
        filter: false,
        resizable: false,
        pinned: "right",
      },
    ];
  }, [translate, teams, jobPositions, userTeams]);
}

export function useInvitationsColumnDefs({
  translate,
  teams,
  onDeleteInvitation,
}: {
  translate: TranslateFn;
  teams: Team[];
  onDeleteInvitation: (invitation: Invitation) => void;
}): ColDef[] {
  return useMemo<ColDef[]>(() => {
    const columnLabels = {
      id: translate("invitations.columns.id", "ID"),
      email: translate("invitations.columns.email", "Email"),
      teams: translate("invitations.columns.teams", "Teams"),
      link: translate("invitations.columns.link", "Invitation Link"),
      created: translate("invitations.columns.created", "Created"),
      actions: translate("invitations.columns.actions", "Actions"),
    };
    const noEmailLabel = translate("invitations.values.noEmail", "No email");
    const noTeamsLabel = translate("grid.values.noTeams", "No Teams");

    return [
      { field: "id", headerName: columnLabels.id, width: 90, hide: true },
      {
        field: "user_email",
        headerName: columnLabels.email,
        flex: 2,
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams) => {
          return params.value || <span className="text-muted-foreground">{noEmailLabel}</span>;
        },
      },
      {
        field: "team_ids",
        headerName: columnLabels.teams,
        flex: 2,
        minWidth: 240,
        cellRenderer: (params: ICellRendererParams) => {
          const teamIds = params.value as number[] | null | undefined;
          if (!teamIds || teamIds.length === 0) {
            return <span className="text-muted-foreground">{noTeamsLabel}</span>;
          }

          const invitationTeams = teamIds
            .map((teamId: number) => {
              const team = teams.find((t: Team) => t.id === teamId);
              return team ? { id: team.id, name: team.name, color: team.color ?? null } : null;
            })
            .filter((team): team is { id: number; name: string; color: string | null } => team !== null);

          if (invitationTeams.length === 0) {
            return <span className="text-muted-foreground">{noTeamsLabel}</span>;
          }

          return (
            <div className="flex flex-wrap gap-1 py-1 px-1 items-center">
              {invitationTeams.map((team: { id: number; name: string; color: string | null }) => {
                const initial = (team.name || "").charAt(0).toUpperCase();
                const hex = String(team.color || "").trim();
                let bg = hex;
                let fg = "#fff";
                try {
                  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
                    const h =
                      hex.length === 4
                        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
                        : hex;
                    const r = parseInt(h.slice(1, 3), 16);
                    const g = parseInt(h.slice(3, 5), 16);
                    const b = parseInt(h.slice(5, 7), 16);
                    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                    fg = brightness > 180 ? "#111827" : "#ffffff";
                  } else if (!hex) {
                    bg = "";
                  }
                } catch {
                  /* ignore */
                }
                return (
                  <div
                    key={team.id}
                    className={`w-6 h-6 min-w-[1.5rem] rounded-full flex items-center justify-center text-xs font-semibold cursor-default ${bg ? "" : "bg-muted text-foreground/80"}`}
                    style={bg ? { backgroundColor: bg, color: fg } : undefined}
                    title={team.name}
                  >
                    {initial || "T"}
                  </div>
                );
              })}
            </div>
          );
        },
        cellStyle: { overflow: "visible", padding: "0" },
        autoHeight: true,
      },
      {
        field: "invitation_link",
        headerName: columnLabels.link,
        flex: 3,
        minWidth: 300,
        cellRenderer: (params: ICellRendererParams) => {
          const invitation = params.data as Invitation;
          if (!invitation?.invitation_token) return <span className="text-muted-foreground">No token</span>;

          const invitationLink = buildInvitationLink({
            invitationToken: invitation.invitation_token,
            tenantDomainPrefix: invitation.tenant_domain_prefix,
          });

          return (
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={invitationLink}
                data-grid-stop-row-click="true"
                className="flex-1 px-2 py-1 text-xs border rounded bg-background text-foreground"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.nativeEvent as any)?.stopImmediatePropagation?.();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  (e.nativeEvent as any)?.stopImmediatePropagation?.();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  (e.nativeEvent as any)?.stopImmediatePropagation?.();
                  (e.target as HTMLInputElement).select();
                }}
              />
              <CopyButton text={invitationLink} translate={translate} />
            </div>
          );
        },
      },
      {
        field: "created_at",
        headerName: columnLabels.created,
        flex: 1.5,
        minWidth: 150,
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value) return <span className="text-muted-foreground">-</span>;
          const date = new Date(params.value);
          return (
            <span>
              {date.toLocaleDateString()}{" "}
              {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          );
        },
      },
      {
        field: "actions",
        headerName: columnLabels.actions,
        width: 100,
        cellRenderer: createActionsCellRenderer({
          onDelete: (invitation: Invitation) => onDeleteInvitation(invitation),
        }),
        sortable: false,
        filter: false,
        resizable: false,
        pinned: "right",
      },
    ];
  }, [translate, teams, onDeleteInvitation]);
}

