import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Plus, Bell, Send, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/providers/LanguageProvider';
import { RootState } from '@/store/store';
import { genericActions } from '@/store/genericSlices';
import { Broadcast } from '@/types/broadcast';
import CreateBroadcastDialog from './CreateBroadcastDialog';
import BroadcastDetailView from './BroadcastDetailView';

function BroadcastsPage() {
  const { t } = useLanguage();
  const dispatch = useDispatch();

  // Redux state
  const { value: broadcasts, loading } = useSelector(
    (state: RootState) => (state as any).broadcasts || { value: [], loading: false }
  );
  const currentUser = useSelector((state: RootState) => (state as any).currentUser);

  // Local state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // Load broadcasts on mount
  useEffect(() => {
    dispatch(genericActions.broadcasts.getFromIndexedDB());
    dispatch(genericActions.broadcasts.fetchFromAPI());
    dispatch(genericActions.broadcastAcknowledgments.getFromIndexedDB());
    dispatch(genericActions.broadcastAcknowledgments.fetchFromAPI());
  }, [dispatch]);

  // Filter broadcasts by tab
  const filteredBroadcasts = broadcasts.filter((broadcast: Broadcast) => {
    switch (activeTab) {
      case 'my-broadcasts':
        return broadcast.created_by === currentUser?.id;
      case 'pending':
        // This would need acknowledgment data to filter properly
        return broadcast.status === 'active';
      case 'completed':
        return broadcast.status === 'completed';
      default:
        return true;
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'normal': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'cancelled': return 'outline';
      case 'draft': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
            {t('broadcasts.title', 'Broadcasts')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('broadcasts.subtitle', 'Send messages and track acknowledgments')}
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('broadcasts.create', 'Create Broadcast')}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="gap-2">
            <Send className="h-4 w-4" />
            {t('broadcasts.tabs.all', 'All')}
          </TabsTrigger>
          <TabsTrigger value="my-broadcasts" className="gap-2">
            <Bell className="h-4 w-4" />
            {t('broadcasts.tabs.mine', 'My Broadcasts')}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Bell className="h-4 w-4" />
            {t('broadcasts.tabs.pending', 'Pending')}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {t('broadcasts.tabs.completed', 'Completed')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading', 'Loading...')}
            </div>
          ) : filteredBroadcasts.length === 0 ? (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t('broadcasts.empty', 'No broadcasts found')}</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredBroadcasts.map((broadcast: Broadcast) => (
                <Card
                  key={broadcast.id}
                  className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedBroadcast(broadcast)}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-1 truncate">
                          {broadcast.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {broadcast.message}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={getPriorityColor(broadcast.priority)}>
                          {broadcast.priority}
                        </Badge>
                        <Badge variant={getStatusColor(broadcast.status)}>
                          {broadcast.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t('broadcasts.progress', 'Acknowledgments')}
                        </span>
                        <span className="font-medium">
                          {broadcast.total_acknowledged} / {broadcast.total_recipients}
                          {' '}({broadcast.progress_percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${broadcast.progress_percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {t('broadcasts.recipients', 'Recipients')}: {broadcast.total_recipients}
                      </span>
                      {broadcast.due_date && (
                        <span>
                          {t('broadcasts.due', 'Due')}: {new Date(broadcast.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateBroadcastDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {selectedBroadcast && (
        <BroadcastDetailView
          broadcast={selectedBroadcast}
          onClose={() => setSelectedBroadcast(null)}
        />
      )}
    </div>
  );
}

export default BroadcastsPage;
