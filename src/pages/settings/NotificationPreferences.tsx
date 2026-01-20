import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import { isFCMReady, isTokenRegistered } from '@/firebase/fcmHelper';
import { AppDispatch, RootState } from '@/store/store';
import { 
  fetchNotificationPreferences, 
  updateNotificationPreferences,
  type NotificationPreferences 
} from '@/store/reducers/notificationPreferencesSlice';

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
  const dispatch = useDispatch<AppDispatch>();
  
  // Get preferences and loading/saving state from Redux
  const { preferences, loading, saving } = useSelector((state: RootState) => state.notificationPreferences);
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences>(preferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [fcmEnabled, setFcmEnabled] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    dispatch(fetchNotificationPreferences());
    checkFCMStatus();
  }, [dispatch]);

  // Sync local preferences with Redux state
  useEffect(() => {
    setLocalPreferences(preferences);
    setHasChanges(false);
  }, [preferences]);

  const checkFCMStatus = async () => {
    const isReady = await isFCMReady();
    const isRegistered = isTokenRegistered();
    setFcmEnabled(isReady && isRegistered);
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    const updated = {
      ...localPreferences,
      [key]: !localPreferences[key]
    };
    setLocalPreferences(updated);
    setHasChanges(true);
  };

  const handleEnableAll = () => {
    const allEnabled = Object.keys(defaultPreferences).reduce((acc, key) => ({
      ...acc,
      [key]: true
    }), {} as NotificationPreferences);
    
    setLocalPreferences(allEnabled);
    setHasChanges(true);
  };

  const handleDisableAll = () => {
    const allDisabled = Object.keys(defaultPreferences).reduce((acc, key) => ({
      ...acc,
      [key]: false
    }), {} as NotificationPreferences);
    
    setLocalPreferences(allDisabled);
    setHasChanges(true);
  };

  const handleSave = () => {
    dispatch(updateNotificationPreferences(localPreferences));
  };

  const handleCancel = () => {
    setLocalPreferences(preferences);
    setHasChanges(false);
  };

  const notificationTypes = [
    {
      key: 'broadcasts' as keyof NotificationPreferences,
      label: t('notifications.broadcasts.label'),
      description: t('notifications.broadcasts.description'),
      icon: '📢'
    },
    {
      key: 'task_assignments' as keyof NotificationPreferences,
      label: t('notifications.task_assignments.label'),
      description: t('notifications.task_assignments.description'),
      icon: '📋'
    },
    {
      key: 'task_mentions' as keyof NotificationPreferences,
      label: t('notifications.task_mentions.label'),
      description: t('notifications.task_mentions.description'),
      icon: '@'
    },
    {
      key: 'task_comments' as keyof NotificationPreferences,
      label: t('notifications.task_comments.label'),
      description: t('notifications.task_comments.description'),
      icon: '💬'
    },
    {
      key: 'task_status_changes' as keyof NotificationPreferences,
      label: t('notifications.task_status_changes.label'),
      description: t('notifications.task_status_changes.description'),
      icon: '🔄'
    },
    {
      key: 'messages' as keyof NotificationPreferences,
      label: t('notifications.messages.label'),
      description: t('notifications.messages.description'),
      icon: '✉️'
    },
    {
      key: 'approval_requests' as keyof NotificationPreferences,
      label: t('notifications.approval_requests.label'),
      description: t('notifications.approval_requests.description'),
      icon: '✅'
    },
    {
      key: 'approval_decisions' as keyof NotificationPreferences,
      label: t('notifications.approval_decisions.label'),
      description: t('notifications.approval_decisions.description'),
      icon: '⚖️'
    },
    {
      key: 'sla_alerts' as keyof NotificationPreferences,
      label: t('notifications.sla_alerts.label'),
      description: t('notifications.sla_alerts.description'),
      icon: '⏰'
    },
    {
      key: 'workflow_notifications' as keyof NotificationPreferences,
      label: t('notifications.workflow_notifications.label'),
      description: t('notifications.workflow_notifications.description'),
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
                checked={localPreferences[type.key]}
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
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
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
