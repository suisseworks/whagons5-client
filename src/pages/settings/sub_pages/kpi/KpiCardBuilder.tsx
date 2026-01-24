import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { useLanguage } from '@/providers/LanguageProvider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar,
  faChartLine,
  faPercent,
  faHashtag,
  faCode,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface KpiCard {
  id?: number;
  name: string;
  type: string;
  query_config: any;
  display_config: any;
  workspace_id?: number | null;
  position?: number;
  is_enabled?: boolean;
}

interface KpiCardBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: Partial<KpiCard>) => Promise<void>;
  onDelete?: () => Promise<void>;
  editingCard?: KpiCard | null;
}

const COLOR_OPTIONS = [
  { name: 'Blue', value: 'text-blue-500', badgeClass: 'bg-gradient-to-br from-blue-500 to-blue-600', barClass: 'from-blue-500 via-blue-400 to-blue-500' },
  { name: 'Indigo', value: 'text-indigo-500', badgeClass: 'bg-gradient-to-br from-indigo-500 to-indigo-600', barClass: 'from-indigo-500 via-indigo-400 to-indigo-500' },
  { name: 'Amber', value: 'text-amber-500', badgeClass: 'bg-gradient-to-br from-amber-500 to-orange-500', barClass: 'from-amber-500 via-amber-400 to-amber-500' },
  { name: 'Emerald', value: 'text-emerald-500', badgeClass: 'bg-gradient-to-br from-emerald-500 to-green-600', barClass: 'from-emerald-500 via-emerald-400 to-emerald-500' },
  { name: 'Purple', value: 'text-purple-500', badgeClass: 'bg-gradient-to-br from-purple-500 to-violet-600', barClass: 'from-purple-500 via-purple-400 to-purple-500' },
  { name: 'Rose', value: 'text-rose-500', badgeClass: 'bg-gradient-to-br from-rose-500 to-pink-600', barClass: 'from-rose-500 via-rose-400 to-rose-500' },
  { name: 'Teal', value: 'text-teal-500', badgeClass: 'bg-gradient-to-br from-teal-500 to-cyan-600', barClass: 'from-teal-500 via-teal-400 to-teal-500' },
  { name: 'Orange', value: 'text-orange-500', badgeClass: 'bg-gradient-to-br from-orange-500 to-red-500', barClass: 'from-orange-500 via-orange-400 to-orange-500' },
];

export default function KpiCardBuilder({ isOpen, onClose, onSave, onDelete, editingCard }: KpiCardBuilderProps) {
  const { t } = useLanguage();
  const workspaces = useSelector((state: RootState) => (state as any).workspaces?.value ?? []);
  const statuses = useSelector((state: RootState) => state.statuses?.value ?? []);
  const priorities = useSelector((state: RootState) => state.priorities?.value ?? []);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<KpiCard>>({
    name: '',
    type: 'task_count',
    query_config: { filters: {} },
    display_config: {
      color: 'text-blue-500',
      badgeClass: COLOR_OPTIONS[0].badgeClass,
      barClass: COLOR_OPTIONS[0].barClass,
    },
    workspace_id: null,
    is_enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (editingCard) {
      setFormData(editingCard);
      setStep(1);
    } else {
      setFormData({
        name: '',
        type: 'task_count',
        query_config: { filters: {} },
        display_config: {
          color: 'text-blue-500',
          badgeClass: COLOR_OPTIONS[0].badgeClass,
          barClass: COLOR_OPTIONS[0].barClass,
        },
        workspace_id: null,
        is_enabled: true,
      });
      setStep(1);
    }
  }, [editingCard, isOpen]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      setConfirmDeleteOpen(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (colorOption: typeof COLOR_OPTIONS[0]) => {
    setFormData({
      ...formData,
      display_config: {
        ...formData.display_config,
        color: colorOption.value,
        badgeClass: colorOption.badgeClass,
        barClass: colorOption.barClass,
      },
    });
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">{t('kpiCards.builder.name', 'Card Name')} *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t('kpiCards.builder.namePlaceholder', 'My Custom KPI')}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="type">{t('kpiCards.builder.type', 'Card Type')} *</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="task_count">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faHashtag} />
                {t('kpiCards.types.taskCount', 'Task Count')}
              </div>
            </SelectItem>
            <SelectItem value="task_percentage">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faPercent} />
                {t('kpiCards.types.taskPercentage', 'Percentage')}
              </div>
            </SelectItem>
            <SelectItem value="trend">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faChartLine} />
                {t('kpiCards.types.trend', 'Trend (7 days)')}
              </div>
            </SelectItem>
            <SelectItem value="custom_query">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faCode} />
                {t('kpiCards.types.customQuery', 'Custom Query')}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="workspace">{t('kpiCards.builder.workspace', 'Workspace Scope')}</Label>
        <Select
          value={formData.workspace_id?.toString() || 'all'}
          onValueChange={(value) => setFormData({ ...formData, workspace_id: value === 'all' ? null : parseInt(value) })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('kpiCards.builder.allWorkspaces', 'All Workspaces')}</SelectItem>
            {workspaces.map((ws: any) => (
              <SelectItem key={ws.id} value={ws.id.toString()}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('kpiCards.builder.queryConfigDescription', 'Configure the data query for this KPI card')}
      </p>

      {formData.type === 'task_count' && (
        <div>
          <Label>{t('kpiCards.builder.filters', 'Filters')}</Label>
          <p className="text-xs text-muted-foreground mb-2">
            {t('kpiCards.builder.filtersDescription', 'Select which tasks to count')}
          </p>
          
          <div className="space-y-2">
            <div>
              <Label htmlFor="status_filter" className="text-xs">{t('kpiCards.builder.statusFilter', 'Status Filter')}</Label>
              <Select
                value={formData.query_config?.filters?.status_id?.[0]?.toString() || 'all'}
                onValueChange={(value) => {
                  const filters = value === 'all' 
                    ? {}
                    : { status_id: [parseInt(value)] };
                  setFormData({
                    ...formData,
                    query_config: { ...formData.query_config, filters },
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
                  {statuses.map((status: any) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {formData.type === 'task_percentage' && (
        <div className="space-y-4">
          <div>
            <Label>{t('kpiCards.builder.numerator', 'Numerator (Top Number)')}</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {t('kpiCards.builder.numeratorDescription', 'Which tasks to count for the percentage calculation')}
            </p>
            <div>
              <Label htmlFor="numerator_status" className="text-xs">{t('kpiCards.builder.statusFilter', 'Status Filter')}</Label>
              <Select
                value={formData.query_config?.numerator_filters?.status_id?.[0]?.toString() || 'all'}
                onValueChange={(value) => {
                  const numerator_filters = value === 'all' 
                    ? {}
                    : { status_id: [parseInt(value)] };
                  setFormData({
                    ...formData,
                    query_config: { ...formData.query_config, numerator_filters },
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
                  {statuses.map((status: any) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>{t('kpiCards.builder.denominator', 'Denominator (Bottom Number)')}</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {t('kpiCards.builder.denominatorDescription', 'Total tasks to compare against')}
            </p>
            <div>
              <Label htmlFor="denominator_status" className="text-xs">{t('kpiCards.builder.statusFilter', 'Status Filter')}</Label>
              <Select
                value={formData.query_config?.denominator_filters?.status_id?.[0]?.toString() || 'all'}
                onValueChange={(value) => {
                  const denominator_filters = value === 'all' 
                    ? {}
                    : { status_id: [parseInt(value)] };
                  setFormData({
                    ...formData,
                    query_config: { ...formData.query_config, denominator_filters },
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
                  {statuses.map((status: any) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {formData.type === 'trend' && (
        <div>
          <Label htmlFor="days">{t('kpiCards.builder.days', 'Number of Days')}</Label>
          <Input
            id="days"
            type="number"
            min="3"
            max="30"
            value={formData.query_config?.days || 7}
            onChange={(e) => setFormData({
              ...formData,
              query_config: { ...formData.query_config, days: parseInt(e.target.value) || 7 },
            })}
            className="mt-1"
          />
        </div>
      )}

      {formData.type === 'custom_query' && (
        <div>
          <Label htmlFor="custom_query">{t('kpiCards.builder.customQuery', 'Query Configuration (JSON)')}</Label>
          <Textarea
            id="custom_query"
            value={JSON.stringify(formData.query_config || {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setFormData({ ...formData, query_config: parsed });
              } catch {}
            }}
            rows={6}
            className="mt-1 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <Label>{t('kpiCards.builder.color', 'Color Theme')}</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {COLOR_OPTIONS.map((colorOption) => (
            <button
              key={colorOption.value}
              type="button"
              onClick={() => handleColorChange(colorOption)}
              className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                formData.display_config?.color === colorOption.value
                  ? 'border-primary'
                  : 'border-border hover:border-primary/50'
              }`}
              title={colorOption.name}
            >
              <div className={`w-full h-8 rounded bg-gradient-to-br ${colorOption.badgeClass} text-white flex items-center justify-center`}>
                <FontAwesomeIcon icon={faChartBar} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="helper_text">{t('kpiCards.builder.helperText', 'Helper Text (Optional)')}</Label>
        <Input
          id="helper_text"
          value={formData.display_config?.helperText || ''}
          onChange={(e) => setFormData({
            ...formData,
            display_config: { ...formData.display_config, helperText: e.target.value },
          })}
          placeholder={t('kpiCards.builder.helperTextPlaceholder', 'Additional information...')}
          className="mt-1"
        />
      </div>

      {/* Preview */}
      <div className="mt-6 p-4 border rounded-lg bg-muted/20">
        <p className="text-xs text-muted-foreground mb-2">{t('kpiCards.builder.preview', 'Preview')}</p>
        <div className={`flex items-center gap-3 p-3 rounded-lg border bg-card`}>
          <div className={`text-2xl ${formData.display_config?.color || 'text-blue-500'}`}>
            <FontAwesomeIcon icon={faChartBar} />
          </div>
          <div>
            <h3 className="font-bold">{formData.name || t('kpiCards.builder.untitled', 'Untitled Card')}</h3>
            <p className="text-sm text-muted-foreground">
              {formData.display_config?.helperText || t('kpiCards.builder.noHelperText', 'No helper text')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingCard 
              ? t('kpiCards.builder.editTitle', 'Edit KPI Card')
              : t('kpiCards.builder.createTitle', 'Create KPI Card')
            }
          </DialogTitle>
          <DialogDescription>
            {t('kpiCards.builder.description', 'Step {step} of 3', { step })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={handleBack}>
                  {t('common.back', 'Back')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editingCard?.id && onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => setConfirmDeleteOpen(true)}
                  title={t('common.delete', 'Delete')}
                  aria-label={t('common.delete', 'Delete')}
                  disabled={saving}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
              ) : null}
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel', 'Cancel')}
              </Button>
              {step < 3 ? (
                <Button onClick={handleNext} disabled={!formData.name}>
                  {t('common.next', 'Next')}
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saving || !formData.name}>
                  {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('common.delete', 'Delete')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('common.deleteConfirm', 'Are you sure? This action cannot be undone.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={saving}
          >
            {saving ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
