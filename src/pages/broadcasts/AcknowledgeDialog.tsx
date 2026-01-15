import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import { Broadcast } from '@/types/broadcast';
import { RootState } from '@/store/store';
import api from '@/api/whagonsApi';

interface AcknowledgeDialogProps {
  broadcast: Broadcast;
  onClose: () => void;
}

function AcknowledgeDialog({ broadcast, onClose }: AcknowledgeDialogProps) {
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const currentUser = useSelector((state: RootState) => (state as any).currentUser);

  // Local state
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAcknowledge = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      // Call the acknowledge endpoint
      await api.post(`/broadcasts/${broadcast.id}/acknowledge`, {
        comment: comment.trim() || null,
      });

      // Show success message (you can use a toast here)
      onClose();
      
      // Refresh the data
      setTimeout(() => {
        window.location.reload(); // Or use proper state refresh
      }, 500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to acknowledge broadcast');
    } finally {
      setIsSubmitting(false);
    }
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            {t('broadcasts.acknowledge.title', 'Acknowledge Broadcast')}
          </DialogTitle>
          <DialogDescription>
            {t('broadcasts.acknowledge.description', 'Please confirm you have received and read this message')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Broadcast Details */}
          <div className="space-y-3 p-4 rounded-lg border bg-accent/50">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-semibold text-lg">{broadcast.title}</h3>
              <Badge variant={getPriorityColor(broadcast.priority)}>
                {broadcast.priority}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Label>{t('broadcasts.acknowledge.message', 'Message')}:</Label>
              <div className="text-sm whitespace-pre-wrap bg-background p-3 rounded border">
                {broadcast.message}
              </div>
            </div>

            {broadcast.due_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                {t('broadcasts.acknowledge.dueBy', 'Due by')}: {new Date(broadcast.due_date).toLocaleString()}
              </div>
            )}
          </div>

          {/* Optional Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">
              {t('broadcasts.acknowledge.comment', 'Comment')} ({t('common.optional', 'optional')})
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('broadcasts.acknowledge.commentPlaceholder', 'Add any comments or feedback...')}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {comment.length} / 500 {t('common.characters', 'characters')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleAcknowledge} disabled={isSubmitting}>
            {isSubmitting ? (
              t('broadcasts.acknowledge.acknowledging', 'Acknowledging...')
            ) : (
              t('broadcasts.acknowledge.confirm', 'Confirm Acknowledgment')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AcknowledgeDialog;
