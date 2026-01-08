import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/api/whagonsApi';
import { Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface TaskShare {
  id: number;
  task_id: number;
  shared_by_user_id: number;
  shared_by_user_name?: string | null;
  shared_to_user_id?: number | null;
  shared_to_user_name?: string | null;
  shared_to_user_email?: string | null;
  shared_to_team_id?: number | null;
  shared_to_team_name?: string | null;
  permission: 'COMMENT_ATTACH' | 'STATUS_TRACKING';
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskShareManagerProps {
  taskId: number;
  onShareChange?: () => void;
}

export default function TaskShareManager({ taskId, onShareChange }: TaskShareManagerProps) {
  const [shares, setShares] = useState<TaskShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ userId?: number; teamId?: number } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadShares = async () => {
    if (!taskId) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/tasks/${taskId}/shares`);
      const sharesData = response.data?.data || response.data || [];
      // Filter out revoked shares for display
      const activeShares = sharesData.filter((share: TaskShare) => !share.revoked_at);
      setShares(activeShares);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load shares');
      console.error('Failed to load shares:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
  }, [taskId]);

  const handleRevoke = async () => {
    if (!revokeTarget || !taskId) return;

    setRevoking(true);
    try {
      await api.delete(`/tasks/${taskId}/share`, {
        data: {
          shared_to_user_id: revokeTarget.userId,
          shared_to_team_id: revokeTarget.teamId,
        },
      });
      setRevokeTarget(null);
      await loadShares();
      onShareChange?.();
    } catch (err: any) {
      console.error('Failed to revoke share:', err);
      toast.error(err?.response?.data?.message || 'Failed to revoke share');
    } finally {
      setRevoking(false);
    }
  };

  const getPermissionLabel = (permission: string) => {
    switch (permission) {
      case 'STATUS_TRACKING':
        return 'Full Access';
      case 'COMMENT_ATTACH':
        return 'View & Comment';
      default:
        return permission;
    }
  };

  const getPermissionVariant = (permission: string): 'default' | 'secondary' => {
    return permission === 'STATUS_TRACKING' ? 'default' : 'secondary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive py-2">
        {error}
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No active shares
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {shares.map((share) => {
          const sharedWithName = share.shared_to_user_name || share.shared_to_team_name || 'Unknown';
          const sharedWithEmail = share.shared_to_user_email;
          const isUserShare = !!share.shared_to_user_id;

          return (
            <div
              key={share.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/40 bg-background hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {sharedWithName}
                  </span>
                  {sharedWithEmail && (
                    <span className="text-xs text-muted-foreground truncate">
                      ({sharedWithEmail})
                    </span>
                  )}
                  <Badge variant={getPermissionVariant(share.permission)} className="text-xs">
                    {getPermissionLabel(share.permission)}
                  </Badge>
                </div>
                {share.shared_by_user_name && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Shared by {share.shared_by_user_name}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRevokeTarget({
                  userId: share.shared_to_user_id || undefined,
                  teamId: share.shared_to_team_id || undefined,
                })}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Share</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this share? The user or team will no longer have access to this task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {revoking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Revoking...
                </>
              ) : (
                'Revoke'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


