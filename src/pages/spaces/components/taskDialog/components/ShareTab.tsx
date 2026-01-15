import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import TaskShareManager from '@/components/tasks/TaskShareManager';

export function ShareTab(props: any) {
  const {
    task,
    sharesRefreshKey,
    handleShareChange,
    shareTargetType,
    setShareTargetType,
    setShareUserId,
    setShareTeamId,
    shareUserId,
    users,
    user,
    shareTeamId,
    teams,
    sharePermission,
    setSharePermission,
    handleShare,
    shareBusy,
    shareError,
    shareSuccess,
  } = props;

  return (
    <div className="space-y-6">
      {/* Existing Shares */}
      {task?.id && (
        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium font-[500] text-foreground">Existing Shares</div>
          <p className="text-sm text-muted-foreground">
            Manage who has access to this task. You can revoke access at any time.
          </p>
          <TaskShareManager 
            key={sharesRefreshKey}
            taskId={task.id} 
            onShareChange={handleShareChange}
          />
        </div>
      )}

      {/* Share New */}
      <div className="flex flex-col gap-4 pt-4 border-t border-border/40">
        <div className="text-sm font-medium font-[500] text-foreground">Share New</div>
        
        {/* Target Type Selector */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">Share with</Label>
          <ToggleGroup
            type="single"
            value={shareTargetType}
            onValueChange={(value) => {
              if (value) {
                setShareTargetType(value as 'user' | 'team');
                setShareUserId(null);
                setShareTeamId(null);
              }
            }}
            className="justify-start"
          >
            <ToggleGroupItem value="user" aria-label="Share with user">User</ToggleGroupItem>
            <ToggleGroupItem value="team" aria-label="Share with team">Team</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* User Picker */}
        {shareTargetType === 'user' && (
          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">Select User</Label>
            <Combobox
              options={users
                .filter((u: any) => u?.id !== user?.id && u?.is_active !== false)
                .map((u: any) => ({
                  value: String(u.id),
                  label: `${u.name || u.email || `User ${u.id}`}${u.email ? ` (${u.email})` : ''}`,
                }))}
              value={shareUserId ? String(shareUserId) : undefined}
              onValueChange={(v) => setShareUserId(v ? parseInt(v, 10) : null)}
              placeholder="Select a user"
              searchPlaceholder="Search users..."
              emptyText="No users available"
            />
          </div>
        )}

        {/* Team Picker */}
        {shareTargetType === 'team' && (
          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">Select Team</Label>
            <Select
              value={shareTeamId ? String(shareTeamId) : ''}
              onValueChange={(v) => setShareTeamId(v ? parseInt(v, 10) : null)}
            >
              <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background">
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(teams) && teams.length > 0 ? (
                  teams
                    .filter((t: any) => t?.is_active !== false)
                    .map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name || `Team ${t.id}`}
                      </SelectItem>
                    ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No teams available</div>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Permission Selector */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">Permission Level</Label>
          <Select
            value={sharePermission}
            onValueChange={(v) => setSharePermission(v as 'COMMENT_ATTACH' | 'STATUS_TRACKING')}
          >
            <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STATUS_TRACKING">Full Access (View, Comment, Update Status)</SelectItem>
              <SelectItem value="COMMENT_ATTACH">View & Comment Only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {sharePermission === 'STATUS_TRACKING' 
              ? 'Recipients can view, comment, attach files, and update task status.'
              : 'Recipients can view, comment, and attach files, but cannot update status.'}
          </p>
        </div>

        {/* Share Button */}
        <Button
          type="button"
          onClick={handleShare}
          disabled={
            (shareTargetType === 'user' && !shareUserId) ||
            (shareTargetType === 'team' && !shareTeamId) ||
            shareBusy ||
            !task?.id
          }
          className="h-10 px-4 rounded-[10px] font-medium bg-primary hover:opacity-90 text-primary-foreground transition-all duration-150 disabled:opacity-50"
        >
          {shareBusy ? 'Sharing…' : 'Share'}
        </Button>

        {/* Feedback Messages */}
        {shareError && (
          <div className="text-sm text-destructive p-2 rounded-md bg-destructive/10 border border-destructive/20">
            {shareError}
          </div>
        )}
        {shareSuccess && (
          <div className="text-sm text-foreground text-primary p-2 rounded-md bg-primary/10 border border-primary/20">
            {shareSuccess}
          </div>
        )}
      </div>
    </div>
  );
}
