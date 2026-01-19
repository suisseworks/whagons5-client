import { actionsApi } from '@/api/whagonsActionsApi';

export function useShareHandlers(params: any) {
  const {
    task,
    shareTeamId,
    sharePermission,
    shareUserId,
    setShareBusy,
    setShareError,
    setShareSuccess,
    setShareTeamId,
    setShareUserId,
    setSharesRefreshKey,
  } = params;

  const handleShareToTeam = async () => {
    const taskId = Number(task?.id);
    if (!Number.isFinite(taskId) || !shareTeamId) return;
    setShareBusy(true);
    setShareError(null);
    setShareSuccess(null);
    try {
      await actionsApi.post(`/tasks/${taskId}/share`, {
        shared_to_team_id: shareTeamId,
        permission: sharePermission,
      });
      setShareSuccess('Shared successfully');
      setShareTeamId(null);
      setSharesRefreshKey((prev: number) => prev + 1);
      setTimeout(() => setShareSuccess(null), 3000);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.share?.[0] || e?.message || 'Failed to share';
      setShareError(String(msg));
    } finally {
      setShareBusy(false);
    }
  };

  const handleShareToUser = async () => {
    const taskId = Number(task?.id);
    if (!Number.isFinite(taskId) || !shareUserId) return;
    setShareBusy(true);
    setShareError(null);
    setShareSuccess(null);
    try {
      await actionsApi.post(`/tasks/${taskId}/share`, {
        shared_to_user_id: shareUserId,
        permission: sharePermission,
      });
      setShareSuccess('Shared successfully');
      setShareUserId(null);
      setSharesRefreshKey((prev: number) => prev + 1);
      setTimeout(() => setShareSuccess(null), 3000);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.share?.[0] || e?.message || 'Failed to share';
      setShareError(String(msg));
    } finally {
      setShareBusy(false);
    }
  };

  const handleShare = async () => {
    if (params.shareTargetType === 'user') {
      await handleShareToUser();
    } else {
      await handleShareToTeam();
    }
  };

  const handleShareChange = () => {
    setSharesRefreshKey((prev: number) => prev + 1);
  };

  return {
    handleShareToTeam,
    handleShareToUser,
    handleShare,
    handleShareChange,
  };
}
