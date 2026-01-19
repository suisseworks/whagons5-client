/**
 * Owner column definition with user avatars and assignment
 */

import HoverPopover from '@/pages/spaces/components/HoverPopover';
import { Avatar } from "@/components/ui/avatar";
import { ColumnBuilderOptions } from './types';
import { UserInitial, createUserNameCache } from './shared/utils';

export function createOwnerColumn(opts: ColumnBuilderOptions) {
  const {
    userMap,
    usersLoaded,
    getUsersFromIds,
    getUserDisplayName,
  } = opts;

  const getCachedUserName = createUserNameCache(getUserDisplayName);

  return {
    field: 'user_ids',
    headerName: 'Owner',
    width: 140,
    filter: 'agSetColumnFilter',
    filterValueGetter: (p: any) => {
      const ids = p.data?.user_ids;
      if (!Array.isArray(ids)) return null;
      return ids
        .map((id: any) => Number(id))
        .filter((n: number) => Number.isFinite(n));
    },
    filterParams: {
      values: (params: any) => {
        const ids = Object.keys(userMap || {})
          .map((k: any) => Number(k))
          .filter((n: number) => Number.isFinite(n));
        params.success(ids);
      },
      suppressMiniFilter: false,
      valueFormatter: (p: any) => {
        const user = userMap[p.value as number];
        return getUserDisplayName(user) || user?.name || `#${p.value}`;
      },
    },
    cellRenderer: (p: any) => {
      if (!p.data) {
        return (
          <div className="flex items-center h-full py-1 gap-2">
            <div className="flex items-center -space-x-1.5">
              <div className="h-6 w-6 rounded-full bg-muted animate-pulse border" />
              <div className="h-6 w-6 rounded-full bg-muted animate-pulse border" />
              <div className="h-6 w-6 rounded-full bg-muted animate-pulse border" />
            </div>
          </div>
        );
      }
      if (!usersLoaded) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
      const userIds = p.data?.user_ids;
      if (userIds == null) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
      const users = getUsersFromIds(userIds, userMap) || [];
      if (users.length === 0) return (
        <div className="flex items-center h-full py-1">
        </div>
      );
      const displayUsers = users.slice(0, 3);
      const remainingCount = users.length - displayUsers.length;
      const node = (
        <div className="flex items-center h-full py-1 gap-2">
          <div className="flex items-center -space-x-1.5">
            {displayUsers.map((user: any) => (
              <HoverPopover key={user.id} content={(
                <div className="flex flex-col items-center gap-3">
                  <Avatar className="h-16 w-16 border-2 border-background">
                    <UserInitial user={user} getUserDisplayName={getUserDisplayName} />
                  </Avatar>
                  <span className="text-base font-medium text-popover-foreground text-center">{getCachedUserName(user)}</span>
                </div>
              )}>
                <Avatar
                  className="h-6 w-6 border transition-colors cursor-pointer"
                  title={getCachedUserName(user)}
                  style={{ borderColor: '#e5e7eb' }}
                >
                  <UserInitial user={user} getUserDisplayName={getUserDisplayName} />
                </Avatar>
              </HoverPopover>
            ))}
            {remainingCount > 0 && (
              <div className="h-6 w-6 rounded-full bg-muted border flex items-center justify-center" style={{ borderColor: '#e5e7eb' }}>
                <span className="text-[9px] text-muted-foreground font-medium">+{remainingCount}</span>
              </div>
            )}
          </div>
        </div>
      );
      return node;
    },
    minWidth: 140,
    maxWidth: 200,
  };
}
