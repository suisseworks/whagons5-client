import { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Activity as ActivityIcon } from 'lucide-react';

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

const visualizationOptions = [
  { value: 'cosmos', label: 'Activity Cosmos', description: 'Dynamic orbital view with user galaxies and hover details' },
  { value: 'river', label: 'Activity River', description: 'Flowing cards showing live activity' },
  { value: 'kanban', label: 'Animated Kanban', description: 'Cards moving between activity lanes' },
  { value: 'network', label: 'Network Graph', description: 'Users connected by their actions' },
  { value: 'timeline', label: 'Timeline Swim Lanes', description: 'Horizontal timeline with user lanes' },
  { value: 'carousel', label: '3D Card Carousel', description: 'Rotating 3D activity cards' },
  { value: 'heatmap', label: 'Activity Heat Map', description: 'Visual intensity grid of activity' },
  { value: 'galaxy', label: 'Particle Galaxy', description: 'Beautiful space-themed activity view' },
  { value: 'metro', label: 'Metro Map', description: 'Transit-style activity flow' },
  { value: 'visualizer', label: 'Music Visualizer', description: 'Audio-reactive activity bars' },
  { value: 'physics', label: 'Physics Card Wall', description: 'Cards with physics falling and stacking' },
];

export default function ActivityMonitor() {
  const [selectedVisualization, setSelectedVisualization] = useState<VisualizationType>('cosmos');
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Mock data generator for demonstration
  const generateMockActivity = useCallback((): ActivityEvent => {
    const types: ActivityEvent['type'][] = [
      'task_created',
      'task_updated',
      'status_changed',
      'message_sent',
      'approval_requested',
      'approval_decided',
      'broadcast_sent',
      'user_assigned',
    ];
    
    const users = [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' },
      { id: 3, name: 'Mike Wilson' },
      { id: 4, name: 'Sarah Johnson' },
      { id: 5, name: 'Tom Brown' },
    ];

    const priorities: ActivityEvent['priority'][] = ['low', 'normal', 'high', 'urgent'];
    
    const type = types[Math.floor(Math.random() * types.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];

    const titles: Record<ActivityEvent['type'], string[]> = {
      task_created: ['Created new task', 'Added task', 'Started new task'],
      task_updated: ['Updated task details', 'Modified task', 'Changed task info'],
      status_changed: ['Moved to In Progress', 'Completed task', 'Changed status'],
      message_sent: ['Sent team message', 'Posted update', 'Shared message'],
      approval_requested: ['Requested approval', 'Sent for review', 'Asked for approval'],
      approval_decided: ['Approved request', 'Rejected proposal', 'Made decision'],
      broadcast_sent: ['Sent broadcast', 'Posted announcement', 'Shared news'],
      user_assigned: ['Assigned task', 'Delegated work', 'Assigned to team member'],
    };

    const relatedUser = type === 'user_assigned' || type === 'approval_requested' 
      ? users[Math.floor(Math.random() * users.length)].id 
      : undefined;

    return {
      id: `${Date.now()}-${Math.random()}`,
      type,
      userId: user.id,
      userName: user.name,
      timestamp: new Date(),
      title: titles[type][Math.floor(Math.random() * titles[type].length)],
      description: `Task #${Math.floor(Math.random() * 1000)}`,
      priority,
      relatedUserId: relatedUser,
      metadata: {
        taskId: Math.floor(Math.random() * 1000),
        workspaceId: Math.floor(Math.random() * 10) + 1,
      },
    };
  }, []);

  // Simulate real-time activity stream
  useEffect(() => {
    // Add initial activities
    const initialActivities = Array.from({ length: 10 }, () => generateMockActivity());
    setActivities(initialActivities);
    setIsConnected(true);

    // Generate new activities periodically
    const interval = setInterval(() => {
      const newActivity = generateMockActivity();
      setActivities(prev => [newActivity, ...prev].slice(0, 50)); // Keep last 50
    }, 3000); // New activity every 3 seconds

    return () => clearInterval(interval);
  }, [generateMockActivity]);

  // TODO: Connect to real-time listener (RTL) here
  // useEffect(() => {
  //   const rtl = new RealTimeListener({ debug: true });
  //   rtl.on('publication:received', (data) => {
  //     // Convert publication data to ActivityEvent
  //     const activity = convertPublicationToActivity(data);
  //     setActivities(prev => [activity, ...prev].slice(0, 50));
  //   });
  //   rtl.connectAndHold();
  //   return () => rtl.disconnect();
  // }, []);

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
            <h1 className="text-2xl font-bold">Activity Monitor</h1>
            <p className="text-sm text-muted-foreground">
              Live view of what's happening • {activities.length} recent activities
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>

          {/* Visualization selector */}
          <div className="flex items-center gap-3 pl-4 border-l border-border/40">
            <Label htmlFor="visualization-select" className="text-sm font-medium whitespace-nowrap">
              View Style:
            </Label>
            <Select value={selectedVisualization} onValueChange={(v) => setSelectedVisualization(v as VisualizationType)}>
              <SelectTrigger id="visualization-select" className="w-[280px]">
                <SelectValue placeholder="Select visualization" />
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
