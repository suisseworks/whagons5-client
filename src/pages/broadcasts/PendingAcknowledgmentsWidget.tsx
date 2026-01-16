import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Bell, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuthUser } from '@/providers/AuthProvider';
import { RootState } from '@/store/store';
import { genericActions } from '@/store/genericSlices';
import { Broadcast } from '@/types/broadcast';
import AcknowledgeDialog from './AcknowledgeDialog';

function PendingAcknowledgmentsWidget() {
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const { value: broadcasts } = useSelector(
    (state: RootState) => (state as any).broadcasts || { value: [] }
  );
  const { value: acknowledgments } = useSelector(
    (state: RootState) => (state as any).broadcastAcknowledgments || { value: [] }
  );
  const currentUser = useAuthUser();

  // Local state
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);

  // Load data
  useEffect(() => {
    dispatch(genericActions.broadcasts.getFromIndexedDB());
    dispatch(genericActions.broadcastAcknowledgments.getFromIndexedDB());
  }, [dispatch]);

  // Filter broadcasts that are pending for current user
  const pendingBroadcasts = broadcasts.filter((broadcast: Broadcast) => {
    if (broadcast.status !== 'active') return false;
    
    // Check if user has a pending acknowledgment
    const userAck = acknowledgments.find(
      (ack: any) => ack.broadcast_id === broadcast.id && ack.user_id === currentUser?.id
    );
    
    return userAck && userAck.status === 'pending';
  }).slice(0, 5); // Show max 5

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'normal': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  if (pendingBroadcasts.length === 0) {
    return null; // Don't show widget if no pending broadcasts
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('broadcasts.widget.title', 'Pending Acknowledgments')}
              <Badge variant="default">{pendingBroadcasts.length}</Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/broadcasts?tab=pending')}
            >
              {t('common.viewAll', 'View All')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingBroadcasts.map((broadcast: Broadcast) => (
            <div
              key={broadcast.id}
              className="flex items-start justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
              onClick={() => setSelectedBroadcast(broadcast)}
            >
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm truncate">{broadcast.title}</p>
                  <Badge variant={getPriorityColor(broadcast.priority)} className="text-xs">
                    {broadcast.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {broadcast.message}
                </p>
                {broadcast.due_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('broadcasts.due', 'Due')}: {new Date(broadcast.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBroadcast(broadcast);
                }}
              >
                {t('broadcasts.acknowledge', 'Acknowledge')}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedBroadcast && (
        <AcknowledgeDialog
          broadcast={selectedBroadcast}
          onClose={() => setSelectedBroadcast(null)}
        />
      )}
    </>
  );
}

export default PendingAcknowledgmentsWidget;
