import { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Activity as ActivityIcon } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { RealTimeListener } from '@/store/realTimeListener/RTL';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';

// Import visualization components
import ActivityCosmos from './visualizations/ActivityCosmos';
import ActivityRiver from './visualizations/ActivityRiver';
import AnimatedKanban from './visualizations/AnimatedKanban';
import NetworkGraph from './visualizations/NetworkGraph';
import TimelineSwimLanes from './visualizations/TimelineSwimLanes';
import CardCarousel3D from './visualizations/CardCarousel3D';
import ActivityHeatMap from './visualizations/ActivityHeatMap';
import ParticleGalaxy from './visualizations/ParticleGalaxy';
import MetroMap from './visualizations/MetroMap';
import MusicVisualizer from './visualizations/MusicVisualizer';
import CardWallPhysics from './visualizations/CardWallPhysics';

// Types for activity data
export interface ActivityEvent {
  id: string;
  type: 'task_created' | 'task_updated' | 'status_changed' | 'message_sent' | 'approval_requested' | 'approval_decided' | 'broadcast_sent' | 'user_assigned';
  userId: number;
  userName: string;
  userAvatar?: string;
  timestamp: Date;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  relatedUserId?: number; // For assignments, approvals, etc.
}

type VisualizationType = 
  | 'cosmos'
  | 'river' 
  | 'kanban' 
  | 'network' 
  | 'timeline' 
  | 'carousel' 
  | 'heatmap' 
  | 'galaxy' 
  | 'metro' 
  | 'visualizer' 
  | 'physics';

const visualizationKeys = [
  'cosmos', 'river', 'kanban', 'network', 'timeline', 
  'carousel', 'heatmap', 'galaxy', 'metro', 'visualizer', 'physics'
] as const;

interface RTLMessage {
  type: 'ping' | 'system' | 'error' | 'echo' | 'database';
  operation?: string;
  message?: string;
  data?: any;
  tenant_name?: string;
  table?: string;
  new_data?: any;
  old_data?: any;
  db_timestamp?: number;
  client_timestamp?: string;
  sessionId?: string;
}

export default function ActivityMonitor() {
  const [selectedVisualization, setSelectedVisualization] = useState<VisualizationType>('cosmos');
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const users = useSelector((s: RootState) => (s as any).users?.value as any[] || []);
  const priorities = useSelector((s: RootState) => (s as any).priorities?.value as any[] || []);

  // Build visualization options with translations
  const visualizationOptions = useMemo(() => 
    visualizationKeys.map(key => ({
      value: key,
      label: t(`activity.visualizations.${key}.label`, key),
      description: t(`activity.visualizations.${key}.description`, '')
    })),
    [t]
  );

  // Convert RTL publication message to ActivityEvent
  const convertPublicationToActivity = useCallback((data: RTLMessage): ActivityEvent | null => {
    if (data.type !== 'database' || !data.table || !data.operation) {
      console.debug('ActivityMonitor: Skipping non-database message', data.type);
      return null;
    }

    const table = data.table;
    const operation = data.operation.toUpperCase();
    const newData = data.new_data || {};
    const oldData = data.old_data || {};

    // Helper to normalize userId to number
    const normalizeUserId = (id: any): number | undefined => {
      if (id === null || id === undefined) return undefined;
      const numId = typeof id === 'number' ? id : Number(id);
      return isNaN(numId) ? undefined : numId;
    };

    // Determine activity type based on table and operation
    let activityType: ActivityEvent['type'] | null = null;
    let title = '';
    let description = '';
    let priority: ActivityEvent['priority'] | undefined = undefined;
    let userId: number | undefined = undefined;
    let relatedUserId: number | undefined = undefined;

    // Get user info from new_data or old_data
    const getUserInfo = (data: any) => {
      const userId = data.created_by || data.updated_by || data.user_id || data.assigned_to;
      if (userId && users.length > 0) {
        const user = users.find((u: any) => u.id === userId);
        return user ? { id: userId, name: user.name || user.email || `User ${userId}` } : null;
      }
      return null;
    };

    // Map priority_id to activity priority level
    const getPriorityLevel = (priorityId: any): ActivityEvent['priority'] | undefined => {
      if (!priorityId) return undefined;
      const priority = priorities.find((p: any) => p.id === priorityId);
      if (!priority || !priority.name) return undefined;
      
      // Normalize priority name to lowercase and map to activity priority levels
      const name = priority.name.toLowerCase().trim();
      if (name === 'low') return 'low';
      if (name === 'medium' || name === 'normal') return 'normal';
      if (name === 'high') return 'high';
      if (name === 'urgent') return 'urgent';
      
      // Default fallback based on common patterns
      return 'normal';
    };

    // Handle different tables
    switch (table) {
      case 'wh_tasks':
        if (operation === 'INSERT') {
          activityType = 'task_created';
          title = `Created task: ${newData.name || 'Untitled'}`;
          description = newData.description || '';
          priority = getPriorityLevel(newData.priority_id);
          userId = normalizeUserId(newData.created_by);
        } else if (operation === 'UPDATE') {
          // Check if status changed
          if (oldData.status_id !== newData.status_id) {
            activityType = 'status_changed';
            title = `Status changed for task: ${newData.name || 'Untitled'}`;
            description = `Changed from status ${oldData.status_id} to ${newData.status_id}`;
          } else {
            activityType = 'task_updated';
            title = `Updated task: ${newData.name || 'Untitled'}`;
            description = newData.description || '';
          }
          priority = getPriorityLevel(newData.priority_id);
          // Tasks only have created_by, no updated_by field
          userId = normalizeUserId(newData.created_by);
        }
        break;

      case 'wh_task_users':
        if (operation === 'INSERT') {
          activityType = 'user_assigned';
          title = `User assigned to task`;
          userId = normalizeUserId(newData.user_id);
          relatedUserId = normalizeUserId(newData.task_id);
        }
        break;

      case 'wh_broadcasts':
        if (operation === 'INSERT') {
          activityType = 'broadcast_sent';
          title = `Broadcast sent: ${newData.name || newData.title || 'Untitled'}`;
          description = newData.message || '';
          userId = normalizeUserId(newData.created_by);
        }
        break;

      case 'wh_task_approval_instances':
        if (operation === 'INSERT') {
          activityType = 'approval_requested';
          title = `Approval requested`;
          userId = normalizeUserId(newData.requested_by);
          relatedUserId = normalizeUserId(newData.approver_id);
        } else if (operation === 'UPDATE' && oldData.status !== newData.status) {
          activityType = 'approval_decided';
          title = `Approval ${newData.status === 'approved' ? 'approved' : 'rejected'}`;
          userId = normalizeUserId(newData.approver_id);
        }
        break;

      default:
        // Generic activity for other tables
        if (operation === 'INSERT') {
          activityType = 'task_created';
          title = `Created ${table.replace('wh_', '')}`;
          userId = normalizeUserId(newData.created_by);
        } else if (operation === 'UPDATE') {
          activityType = 'task_updated';
          title = `Updated ${table.replace('wh_', '')}`;
          userId = normalizeUserId(newData.updated_by || newData.created_by);
        }
    }

    if (!activityType) {
      console.debug('ActivityMonitor: No activity type determined', { table, operation });
      return null;
    }

    // Use current user as fallback if no userId found
    if (!userId && user?.id) {
      userId = typeof user.id === 'number' ? user.id : Number(user.id);
      console.debug('ActivityMonitor: Using current user as fallback', userId);
    }

    // If still no userId, we can't create an activity
    if (!userId) {
      console.debug('ActivityMonitor: No userId found, skipping activity', { table, operation, newData });
      return null;
    }

    const userInfo = getUserInfo(newData);
    const userName = userInfo?.name || (users.find((u: any) => u.id === userId)?.name) || (users.find((u: any) => u.id === userId)?.email) || `User ${userId}`;

    // Create timestamp from db_timestamp or use current time
    // db_timestamp is Unix timestamp in seconds (with fractional seconds)
    const timestamp = data.db_timestamp 
      ? new Date(Math.floor(data.db_timestamp * 1000)) 
      : new Date();

    const activity: ActivityEvent = {
      id: `${table}-${newData.id || oldData.id || Date.now()}-${Math.random()}`,
      type: activityType,
      userId,
      userName,
      timestamp,
      title,
      description,
      priority,
      metadata: {
        table,
        operation,
        ...newData,
      },
      relatedUserId,
    };

    console.debug('ActivityMonitor: Created activity', activity);
    return activity;
  }, [users, user, priorities]);

  // Connect to real-time listener (RTL)
  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      return;
    }

    const rtl = new RealTimeListener({ debug: false });

    // Handle publication messages
    const handlePublication = (data: RTLMessage) => {
      console.debug('ActivityMonitor: Received publication', data);
      const activity = convertPublicationToActivity(data);
      if (activity) {
        console.debug('ActivityMonitor: Adding activity', activity);
        setActivities(prev => [activity, ...prev].slice(0, 100)); // Keep last 100
      } else {
        console.debug('ActivityMonitor: No activity created from publication', data);
      }
    };

    // Handle connection status
    const handleConnectionStatus = (status: any) => {
      if (status.status === 'connected') {
        setIsConnected(true);
      } else if (status.status === 'disconnected' || status.status === 'failed') {
        setIsConnected(false);
      }
    };

    rtl.on('publication:received', handlePublication);
    rtl.on('connection:status', handleConnectionStatus);

    // Connect to RTE
    rtl.connectAndHold().catch((error) => {
      console.error('Failed to connect to RTE:', error);
      setIsConnected(false);
    });

    return () => {
      rtl.off('publication:received', handlePublication);
      rtl.off('connection:status', handleConnectionStatus);
      rtl.disconnect();
    };
  }, [user, convertPublicationToActivity]);

  const selectedOption = useMemo(
    () => visualizationOptions.find(opt => opt.value === selectedVisualization),
    [selectedVisualization]
  );

  const renderVisualization = () => {
    switch (selectedVisualization) {
      case 'cosmos':
        return <ActivityCosmos activities={activities} />;
      case 'river':
        return <ActivityRiver activities={activities} />;
      case 'kanban':
        return <AnimatedKanban activities={activities} />;
      case 'network':
        return <NetworkGraph activities={activities} />;
      case 'timeline':
        return <TimelineSwimLanes activities={activities} />;
      case 'carousel':
        return <CardCarousel3D activities={activities} />;
      case 'heatmap':
        return <ActivityHeatMap activities={activities} />;
      case 'galaxy':
        return <ParticleGalaxy activities={activities} />;
      case 'metro':
        return <MetroMap activities={activities} />;
      case 'visualizer':
        return <MusicVisualizer activities={activities} />;
      case 'physics':
        return <CardWallPhysics activities={activities} />;
      default:
        return <ActivityCosmos activities={activities} />;
    }
  };

return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with Visualization Selector */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <ActivityIcon className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t('activity.monitor.title', 'Activity Monitor')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('activity.monitor.subtitle', 'Live view of what\'s happening')} • {activities.length} {t('activity.monitor.recentActivities', 'recent activities')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? t('activity.monitor.live', 'Live') : t('activity.monitor.disconnected', 'Disconnected')}
            </span>
          </div>

          {/* Visualization selector */}
          <div className="flex items-center gap-3 pl-4 border-l border-border/40">
            <Label htmlFor="visualization-select" className="text-sm font-medium whitespace-nowrap">
              {t('activity.monitor.viewStyle', 'View Style:')}
            </Label>
            <Select value={selectedVisualization} onValueChange={(v) => setSelectedVisualization(v as VisualizationType)}>
              <SelectTrigger id="visualization-select" className="w-[280px]">
                <SelectValue placeholder={t('activity.monitor.selectVisualization', 'Select visualization')} />
              </SelectTrigger>
              <SelectContent>
                {visualizationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Description of current visualization */}
      {selectedOption && (
        <div className="px-6 py-2 bg-muted/30 border-b border-border/40">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedOption.label}:</span> {selectedOption.description}
          </p>
        </div>
      )}

      {/* Visualization Container */}
      <div className="flex-1 overflow-hidden relative">
        {renderVisualization()}
      </div>
    </div>
  );
}
