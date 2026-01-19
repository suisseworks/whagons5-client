import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/providers/LanguageProvider';
import { genericActions } from '@/store/genericSlices';
import { BroadcastFormData } from '@/types/broadcast';
import { RootState } from '@/store/store';
import { MultiSelect } from '@/components/ui/multi-select';
import toast from 'react-hot-toast';

interface CreateBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateBroadcastDialog({ open, onOpenChange }: CreateBroadcastDialogProps) {
  const { t } = useLanguage();
  const dispatch = useDispatch();

  // Redux state
  const { value: users } = useSelector((state: RootState) => (state as any).users || { value: [] });
  const { value: teams } = useSelector((state: RootState) => (state as any).teams || { value: [] });
  const { value: roles } = useSelector((state: RootState) => state.roles) as { value: any[]; loading: boolean };

  // Form state
  const [formData, setFormData] = useState<BroadcastFormData>({
    title: '',
    message: '',
    priority: 'normal',
    recipient_selection_type: 'manual',
    recipient_config: {},
    reminder_interval_hours: 24,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientTab, setRecipientTab] = useState('manual');

  // Data is hydrated on login; this dialog should not trigger ad-hoc IndexedDB/API loading.

  const validateRecipients = (): boolean => {
    const { recipient_selection_type, recipient_config } = formData;
    
    console.log('🔍 [CreateBroadcastDialog] Validating recipients:', {
      recipient_selection_type,
      recipient_config,
      manual_user_ids: recipient_config.manual_user_ids,
      manual_user_ids_length: recipient_config.manual_user_ids?.length,
      roles: recipient_config.roles,
      teams: recipient_config.teams,
    });
    
    if (recipient_selection_type === 'manual') {
      const userIds = recipient_config.manual_user_ids;
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        toast.error(t('broadcasts.create.errors.noUsers', 'Please select at least one user'));
        return false;
      }
    } else if (recipient_selection_type === 'role_based') {
      const roles = recipient_config.roles;
      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        toast.error(t('broadcasts.create.errors.noRoles', 'Please select at least one role'));
        return false;
      }
    } else if (recipient_selection_type === 'team_based') {
      const teams = recipient_config.teams;
      if (!teams || !Array.isArray(teams) || teams.length === 0) {
        toast.error(t('broadcasts.create.errors.noTeams', 'Please select at least one team'));
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error(t('broadcasts.create.errors.requiredFields', 'Please fill in all required fields'));
      return;
    }

    if (!validateRecipients()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(genericActions.broadcasts.addAsync(formData) as any);
      toast.success(t('broadcasts.create.success', 'Broadcast created successfully'));
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Failed to create broadcast:', error);
      
      // Extract validation errors from API response
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.error ||
                          error?.message ||
                          t('broadcasts.create.errors.generic', 'Failed to create broadcast. Please check your input.');
      
      // If there are validation errors, show them
      if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        const firstError = Object.values(errors)[0] as string[];
        toast.error(firstError?.[0] || errorMessage);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      priority: 'normal',
      recipient_selection_type: 'manual',
      recipient_config: {},
      reminder_interval_hours: 24,
    });
    setRecipientTab('manual');
  };

  const updateRecipientConfig = (key: string, value: any) => {
    console.log('🔍 [CreateBroadcastDialog] updateRecipientConfig called:', { key, value, valueType: typeof value, isArray: Array.isArray(value) });
    setFormData(prev => {
      const updated = {
        ...prev,
        recipient_config: {
          ...prev.recipient_config,
          [key]: value,
        },
      };
      console.log('🔍 [CreateBroadcastDialog] Updated formData:', updated);
      return updated;
    });
  };

  const handleRecipientTabChange = (tab: string) => {
    setRecipientTab(tab);
    const typeMap: Record<string, BroadcastFormData['recipient_selection_type']> = {
      manual: 'manual',
      roles: 'role_based',
      teams: 'team_based',
    };
    setFormData(prev => ({
      ...prev,
      recipient_selection_type: typeMap[tab] || 'manual',
      recipient_config: {},
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('broadcasts.create.title', 'Create New Broadcast')}</DialogTitle>
          <DialogDescription>
            {t('broadcasts.create.description', 'Send a message to multiple recipients and track acknowledgments')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('broadcasts.create.titleLabel', 'Title')} *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('broadcasts.create.titlePlaceholder', 'Enter broadcast title')}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">{t('broadcasts.create.message', 'Message')} *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder={t('broadcasts.create.messagePlaceholder', 'Enter your message')}
              rows={4}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">{t('broadcasts.create.priority', 'Priority')}</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t('common.priority.low', 'Low')}</SelectItem>
                <SelectItem value="normal">{t('common.priority.normal', 'Normal')}</SelectItem>
                <SelectItem value="high">{t('common.priority.high', 'High')}</SelectItem>
                <SelectItem value="urgent">{t('common.priority.urgent', 'Urgent')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label>{t('broadcasts.create.recipients', 'Recipients')} *</Label>
            <Tabs value={recipientTab} onValueChange={handleRecipientTabChange}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="manual">{t('broadcasts.create.manual', 'Manual')}</TabsTrigger>
                <TabsTrigger value="roles">{t('broadcasts.create.roles', 'Roles')}</TabsTrigger>
                <TabsTrigger value="teams">{t('broadcasts.create.teams', 'Teams')}</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-2" key={`manual-${recipientTab}`}>
                <MultiSelect
                  key={`manual-select-${JSON.stringify(formData.recipient_config.manual_user_ids)}`}
                  options={users.map((u: any) => ({ label: u.name, value: String(u.id) }))}
                  defaultValue={(formData.recipient_config.manual_user_ids || []).map(String)}
                  onValueChange={(ids) => {
                    console.log('🔍 [CreateBroadcastDialog] MultiSelect onValueChange (manual):', ids);
                    const numericIds = ids.map(id => {
                      const num = Number(id);
                      if (isNaN(num)) {
                        console.warn('🔍 [CreateBroadcastDialog] Invalid ID:', id);
                        return null;
                      }
                      return num;
                    }).filter(id => id !== null);
                    updateRecipientConfig('manual_user_ids', numericIds);
                  }}
                  placeholder={t('broadcasts.create.selectUsers', 'Select users')}
                />
              </TabsContent>

              <TabsContent value="roles" className="space-y-2">
                <MultiSelect
                  options={roles.map((r: any) => ({ label: r.name, value: r.name }))}
                  defaultValue={formData.recipient_config.roles || []}
                  onValueChange={(roleNames) => updateRecipientConfig('roles', roleNames)}
                  placeholder={t('broadcasts.create.selectRoles', 'Select roles')}
                />
              </TabsContent>

              <TabsContent value="teams" className="space-y-2" key={`teams-${recipientTab}`}>
                <MultiSelect
                  key={`teams-select-${JSON.stringify(formData.recipient_config.teams)}`}
                  options={teams.map((t: any) => ({ label: t.name, value: String(t.id) }))}
                  defaultValue={(formData.recipient_config.teams || []).map(String)}
                  onValueChange={(teamIds) => {
                    console.log('🔍 [CreateBroadcastDialog] MultiSelect onValueChange (teams):', teamIds);
                    const numericIds = teamIds.map(id => {
                      const num = Number(id);
                      if (isNaN(num)) {
                        console.warn('🔍 [CreateBroadcastDialog] Invalid team ID:', id);
                        return null;
                      }
                      return num;
                    }).filter(id => id !== null);
                    updateRecipientConfig('teams', numericIds);
                  }}
                  placeholder={t('broadcasts.create.selectTeams', 'Select teams')}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="due_date">{t('broadcasts.create.dueDate', 'Due Date')}</Label>
            <Input
              id="due_date"
              type="datetime-local"
              value={formData.due_date || ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          {/* Reminder Interval */}
          <div className="space-y-2">
            <Label htmlFor="reminder">{t('broadcasts.create.reminderInterval', 'Reminder Interval (hours)')}</Label>
            <Input
              id="reminder"
              type="number"
              min="1"
              max="168"
              value={formData.reminder_interval_hours}
              onChange={(e) => setFormData({ ...formData, reminder_interval_hours: parseInt(e.target.value) || 24 })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title.trim() || !formData.message.trim()}
          >
            {isSubmitting ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateBroadcastDialog;
