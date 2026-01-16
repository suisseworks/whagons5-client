import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, Clock, X, Send } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuthUser } from '@/providers/AuthProvider';
import { Broadcast } from '@/types/broadcast';
import { RootState } from '@/store/store';
import { genericActions } from '@/store/genericSlices';
import AcknowledgeDialog from './AcknowledgeDialog';

interface BroadcastDetailViewProps {
  broadcast: Broadcast;
  onClose: () => void;
}

function BroadcastDetailView({ broadcast, onClose }: BroadcastDetailViewProps) {
  const { t } = useLanguage();
  const dispatch = useDispatch();

  // Redux state
  const { value: acknowledgments } = useSelector(
    (state: RootState) => (state as any).broadcastAcknowledgments || { value: [] }
  );
  const { value: users } = useSelector(
    (state: RootState) => (state as any).users || { value: [] }
  );
  const currentUser = useAuthUser();

  // Local state
  const [showAcknowledgeDialog, setShowAcknowledgeDialog] = useState(false);

  // Filter acknowledgments for this broadcast
  const broadcastAcks = acknowledgments.filter(
    (ack: any) => Number(ack.broadcast_id) === Number(broadcast.id)
  );

  // Check if current user has a pending acknowledgment
  const currentUserAck = broadcastAcks.find(
    (ack: any) => Number(ack.user_id) === Number(currentUser?.id)
  );
  const canAcknowledge = currentUserAck && currentUserAck.status === 'pending';

  // Debug logging
  useEffect(() => {
    if (broadcast.id) {
      console.log('🔍 [BroadcastDetailView] Debug:', {
        broadcastId: broadcast.id,
        currentUserId: currentUser?.id,
        broadcastAcksCount: broadcastAcks.length,
        broadcastAcks: broadcastAcks,
        currentUserAck,
        canAcknowledge,
        acknowledgmentsCount: acknowledgments.length,
      });
    }
  }, [broadcast.id, currentUser?.id, broadcastAcks.length, currentUserAck, canAcknowledge]);

  // Group by status
  const acknowledged = broadcastAcks.filter((ack: any) => ack.status === 'acknowledged');
  const pending = broadcastAcks.filter((ack: any) => ack.status === 'pending');
  const dismissed = broadcastAcks.filter((ack: any) => ack.status === 'dismissed');

  const [filter, setFilter] = useState<'all' | 'acknowledged' | 'pending' | 'dismissed'>('all');

  // Load acknowledgments
  useEffect(() => {
    dispatch(genericActions.broadcastAcknowledgments.fetchFromAPI());
    dispatch(genericActions.users.getFromIndexedDB());
  }, [dispatch, broadcast.id]);

  const getUserName = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    return user?.name || t('common.unknown', 'Unknown');
  };

  const filteredAcks = () => {
    switch (filter) {
      case 'acknowledged': return acknowledged;
      case 'pending': return pending;
      case 'dismissed': return dismissed;
      default: return broadcastAcks;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'acknowledged':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'dismissed':
        return <X className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      acknowledged: 'default',
      pending: 'secondary',
      dismissed: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'normal': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <>
    <Dialog open={!showAcknowledgeDialog} onOpenChange={onClose}>
      <DialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">{broadcast.title}</DialogTitle>
            {canAcknowledge && (
              <Button onClick={() => setShowAcknowledgeDialog(true)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t('broadcasts.acknowledge', 'Acknowledge')}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Broadcast Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{t('broadcasts.detail.priority', 'Priority')}</p>
              <Badge variant={getPriorityColor(broadcast.priority)}>{broadcast.priority}</Badge>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{t('broadcasts.detail.status', 'Status')}</p>
              <Badge>{broadcast.status}</Badge>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{t('broadcasts.detail.recipients', 'Recipients')}</p>
              <p className="text-2xl font-bold">{broadcast.total_recipients}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{t('broadcasts.detail.acknowledged', 'Acknowledged')}</p>
              <p className="text-2xl font-bold text-green-600">{broadcast.total_acknowledged}</p>
            </Card>
          </div>

          {/* Message */}
          <Card className="p-4">
            <h3 className="font-semibold mb-2">{t('broadcasts.detail.message', 'Message')}</h3>
            <p className="whitespace-pre-wrap text-sm">{broadcast.message}</p>
          </Card>

          {/* Progress */}
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{t('broadcasts.detail.progress', 'Acknowledgment Progress')}</span>
                <span>{broadcast.progress_percentage}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all"
                  style={{ width: `${broadcast.progress_percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {acknowledged.length} {t('broadcasts.detail.acknowledged', 'Acknowledged')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {pending.length} {t('broadcasts.detail.pending', 'Pending')}
                </span>
              </div>
            </div>
          </Card>

          {/* Acknowledgments Table */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{t('broadcasts.detail.acknowledgments', 'Acknowledgments')}</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                >
                  {t('common.all', 'All')} ({broadcastAcks.length})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'acknowledged' ? 'default' : 'outline'}
                  onClick={() => setFilter('acknowledged')}
                >
                  {t('broadcasts.detail.acknowledged', 'Acknowledged')} ({acknowledged.length})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'pending' ? 'default' : 'outline'}
                  onClick={() => setFilter('pending')}
                >
                  {t('broadcasts.detail.pending', 'Pending')} ({pending.length})
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('broadcasts.detail.user', 'User')}</TableHead>
                    <TableHead>{t('broadcasts.detail.status', 'Status')}</TableHead>
                    <TableHead>{t('broadcasts.detail.acknowledgedAt', 'Acknowledged At')}</TableHead>
                    <TableHead>{t('broadcasts.detail.comment', 'Comment')}</TableHead>
                    <TableHead>{t('broadcasts.detail.reminders', 'Reminders')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAcks().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {t('broadcasts.detail.noAcknowledgments', 'No acknowledgments found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAcks().map((ack: any) => (
                      <TableRow key={ack.id}>
                        <TableCell className="font-medium">{getUserName(ack.user_id)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(ack.status)}
                            {getStatusBadge(ack.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {ack.acknowledged_at
                            ? new Date(ack.acknowledged_at).toLocaleString()
                            : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {ack.comment || '-'}
                        </TableCell>
                        <TableCell>{ack.reminder_count || 0}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>

    {/* Acknowledge Dialog - Render outside the main dialog to avoid nesting issues */}
    {showAcknowledgeDialog && (
      <AcknowledgeDialog
        broadcast={broadcast}
        onClose={() => {
          setShowAcknowledgeDialog(false);
          // Refresh acknowledgments after acknowledgment
          dispatch(genericActions.broadcastAcknowledgments.fetchFromAPI());
          dispatch(genericActions.broadcasts.fetchFromAPI());
          // Also refresh the detail view
          dispatch(genericActions.broadcastAcknowledgments.getFromIndexedDB());
          dispatch(genericActions.broadcasts.getFromIndexedDB());
        }}
      />
    )}
  </>
  );
}

export default BroadcastDetailView;
