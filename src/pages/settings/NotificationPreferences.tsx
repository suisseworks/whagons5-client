import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import toast from 'react-hot-toast';
import api from '@/api/whagonsApi';
import { isFCMReady, isTokenRegistered } from '@/firebase/fcmHelper';

interface NotificationPreferences {
  broadcasts: boolean;
  task_assignments: boolean;
  task_mentions: boolean;
  task_comments: boolean;
  task_status_changes: boolean;
  messages: boolean;
  approval_requests: boolean;
  approval_decisions: boolean;
  sla_alerts: boolean;
  workflow_notifications: boolean;
}

const defaultPreferences: NotificationPreferences = {
  broadcasts: true,
  task_assignments: true,
  task_mentions: true,
  task_comments: true,
  task_status_changes: true,
  messages: true,
  approval_requests: true,
  approval_decisions: true,
  sla_alerts: true,
  workflow_notifications: true,
};

function NotificationPreferences() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [fcmEnabled, setFcmEnabled] = useState(false);

  useEffect(() => {
    loadPreferences();
    checkFCMStatus();
  }, []);

  const checkFCMStatus = async () => {
    const isReady = await isFCMReady();
    const isRegistered = isTokenRegistered();
    setFcmEnabled(isReady && isRegistered);
  };

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notification-preferences');
      const data = response.data?.data || response.data;
      
      if (data.notifications) {
        setPreferences(data.notifications);
      }
    } catch (error: any) {
      console.error('Failed to load notification preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      await api.put('/notification-preferences', {
        notifications: preferences
      });
      
      toast.success('Notification preferences saved successfully');
      setHasChanges(false);
    } catch (error: any) {
      console.error('Failed to save notification preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setHasChanges(true);
  };

  const handleEnableAll = () => {
    const allEnabled = Object.keys(defaultPreferences).reduce((acc, key) => ({
      ...acc,
      [key]: true
    }), {} as NotificationPreferences);
    
    setPreferences(allEnabled);
    setHasChanges(true);
  };

  const handleDisableAll = () => {
    const allDisabled = Object.keys(defaultPreferences).reduce((acc, key) => ({
      ...acc,
      [key]: false
    }), {} as NotificationPreferences);
    
    setPreferences(allDisabled);
    setHasChanges(true);
  };

  const notificationTypes = [
    {
      key: 'broadcasts' as keyof NotificationPreferences,
      label: 'Broadcasts',
      description: 'Important announcements and system-wide messages',
      icon: '📢'
    },
    {
      key: 'task_assignments' as keyof NotificationPreferences,
      label: 'Task Assignments',
      description: 'When you are assigned to a new task',
      icon: '📋'
    },
    {
      key: 'task_mentions' as keyof NotificationPreferences,
      label: 'Task Mentions',
      description: 'When someone mentions you in a task',
      icon: '@'
    },
    {
      key: 'task_comments' as keyof NotificationPreferences,
      label: 'Task Comments',
      description: 'New comments on tasks you follow',
      icon: '💬'
    },
    {
      key: 'task_status_changes' as keyof NotificationPreferences,
      label: 'Task Status Changes',
      description: 'When task status changes on tasks you follow',
      icon: '🔄'
    },
    {
      key: 'messages' as keyof NotificationPreferences,
      label: 'Messages',
      description: 'Direct messages and workspace messages',
      icon: '✉️'
    },
    {
      key: 'approval_requests' as keyof NotificationPreferences,
      label: 'Approval Requests',
      description: 'When you need to approve something',
      icon: '✅'
    },
    {
      key: 'approval_decisions' as keyof NotificationPreferences,
      label: 'Approval Decisions',
      description: 'When your approval request is decided',
      icon: '⚖️'
    },
    {
      key: 'sla_alerts' as keyof NotificationPreferences,
      label: 'SLA Alerts',
      description: 'Service level agreement warnings',
      icon: '⏰'
    },
    {
      key: 'workflow_notifications' as keyof NotificationPreferences,
      label: 'Workflow Notifications',
      description: 'Automated workflow triggers and updates',
      icon: '⚙️'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Preferences</h1>
          <p className="text-muted-foreground mt-2">
            Choose which notifications you want to receive
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fcmEnabled ? (
            <Badge variant="default" className="gap-1">
              <Bell className="w-3 h-3" />
              Enabled
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <BellOff className="w-3 h-3" />
              Disabled
            </Badge>
          )}
        </div>
      </div>

      {!fcmEnabled && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/10">
          <CardHeader>
            <CardTitle className="text-yellow-700 dark:text-yellow-500 flex items-center gap-2">
              <BellOff className="w-5 h-5" />
              Push Notifications Disabled
            </CardTitle>
            <CardDescription className="text-yellow-600 dark:text-yellow-400">
              You haven't enabled push notifications. You can still configure your preferences,
              but you won't receive push notifications until you grant permission in your browser.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notification Types</CardTitle>
              <CardDescription>
                Enable or disable specific types of notifications
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnableAll}
                disabled={saving}
              >
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableAll}
                disabled={saving}
              >
                Disable All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationTypes.map((type) => (
            <div
              key={type.key}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                <span className="text-2xl">{type.icon}</span>
                <div className="flex-1">
                  <Label
                    htmlFor={type.key}
                    className="text-base font-medium cursor-pointer"
                  >
                    {type.label}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {type.description}
                  </p>
                </div>
              </div>
              <Switch
                id={type.key}
                checked={preferences[type.key]}
                onCheckedChange={() => handleToggle(type.key)}
                disabled={saving}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button
            variant="outline"
            onClick={loadPreferences}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default NotificationPreferences;
