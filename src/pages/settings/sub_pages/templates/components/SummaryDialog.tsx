import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { Template, Category } from "@/store/types";
import { minutesToHHMM } from "../../../shared/utils/timeFormatters";

interface SummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  categories: Category[];
  priorityById: Map<number, { name: string; color?: string | null }>;
  slaById: Map<number, any>;
  approvalById: Map<number, any>;
  spotById: Map<number, any>;
  defaultUsers: any[];
  usageCount: number;
  translate: (key: string, fallback: string) => string;
}

export const SummaryDialog = ({
  open,
  onOpenChange,
  template,
  categories,
  priorityById,
  slaById,
  approvalById,
  spotById,
  defaultUsers,
  usageCount,
  translate: tt
}: SummaryDialogProps) => {
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faInfoCircle} className="text-sky-600 w-4 h-4" />
            {template.name || tt('summary.title', 'Template summary')}
          </DialogTitle>
          <DialogDescription>
            {template.description || tt('summary.description', 'Overview of template configuration')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.category', 'Category')}</div>
            <div className="font-medium">
              {(() => {
                const c = (categories as any[]).find((cat: any) => Number(cat.id) === Number((template as any)?.category_id));
                return c?.name || '—';
              })()}
            </div>
          </div>
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.priority', 'Priority')}</div>
            <div className="font-medium">
              {priorityById.get(Number((template as any)?.priority_id))?.name || '—'}
            </div>
          </div>
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.sla', 'SLA')}</div>
            <div className="font-medium">
              {(() => {
                const s = slaById.get(Number((template as any)?.sla_id));
                if (!s) return '—';
                return s.name || `${s.response_time ?? '?'} / ${s.resolution_time ?? '?'} min`;
              })()}
            </div>
          </div>
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.approval', 'Approval')}</div>
            <div className="font-medium">
              {(() => {
                const a = approvalById.get(Number((template as any)?.approval_id));
                return a?.name || '—';
              })()}
            </div>
          </div>
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.defaultSpot', 'Default Spot')}</div>
            <div className="font-medium">
              {(() => {
                const s = spotById.get(Number((template as any)?.default_spot_id));
                return s?.name || '—';
              })()}
            </div>
          </div>
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.defaultUsers', 'Default Users')}</div>
            <div className="font-medium">
              {defaultUsers.length > 0
                ? defaultUsers.map((u: any) => u.name || `User #${u.id}`).join(', ')
                : '—'}
            </div>
          </div>
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.expectedDuration', 'Expected Duration')}</div>
            <div className="font-medium">
              {(template as any)?.expected_duration ? `${(template as any).expected_duration} min (${minutesToHHMM((template as any).expected_duration)})` : '—'}
            </div>
          </div>
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.usage', 'Usage')}</div>
            <div className="font-medium">{usageCount}</div>
          </div>
          <div className="p-3 border rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">{tt('summary.status', 'Status')}</div>
            <div className="font-medium">
              <Badge variant={(template as any)?.enabled ? 'default' : 'outline'}>
                {(template as any)?.enabled ? tt('summary.enabled', 'Enabled') : tt('summary.disabled', 'Disabled')}
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
