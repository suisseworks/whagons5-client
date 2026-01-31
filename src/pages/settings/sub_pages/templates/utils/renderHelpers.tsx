import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faCheckCircle, faFileAlt } from "@fortawesome/free-solid-svg-icons";
import { Badge } from "@/components/ui/badge";
import { Template } from "@/store/types";
import { secondsToHHMM, minutesToHHMM } from "../../../shared/utils";

interface RenderSlaSummaryProps {
  slaId: string | number | null;
  slaById: Map<number, any>;
  translate: (key: string, fallback: string) => string;
}

export function renderSlaSummary({ slaId, slaById, translate }: RenderSlaSummaryProps) {
  const id = Number(slaId);
  if (!id || isNaN(id)) return null;
  const sla = slaById.get(id);
  if (!sla) return null;

  const tt = (key: string, fallback: string) => translate(`dialogs.create.fields.${key}`, fallback);

  return (
    <div className="bg-muted/30 rounded-md p-3 text-sm space-y-2 border">
      <div className="font-medium flex items-center gap-2 text-primary">
        <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
        <span>{tt('slaConfig', 'SLA Configuration')}</span>
      </div>
      {sla.description && <div className="text-muted-foreground text-xs">{sla.description}</div>}
      <div className="flex flex-wrap gap-2 mt-2">
        <Badge variant="secondary" className="text-xs">{tt('slaResponse', 'Response')}: {secondsToHHMM((sla as any).response_time)}</Badge>
        <Badge variant="secondary" className="text-xs">{tt('slaResolution', 'Resolution')}: {secondsToHHMM((sla as any).resolution_time)}</Badge>
      </div>
    </div>
  );
}

interface RenderApprovalSummaryProps {
  approvalId: string | number | null;
  approvalById: Map<number, any>;
  translate: (key: string, fallback: string) => string;
}

export function renderApprovalSummary({ approvalId, approvalById, translate }: RenderApprovalSummaryProps) {
  const id = Number(approvalId);
  if (!id || isNaN(id)) return null;
  const approval = approvalById.get(id);
  if (!approval) return null;

  const tt = (key: string, fallback: string) => translate(`dialogs.create.fields.${key}`, fallback);

  return (
    <div className="bg-muted/30 rounded-md p-3 text-sm space-y-2 border">
      <div className="font-medium flex items-center gap-2 text-primary">
        <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3" />
        <span>{tt('approvalProcess', 'Approval Process')}</span>
      </div>
      {approval.description && <div className="text-muted-foreground text-xs">{approval.description}</div>}
      <div className="flex flex-wrap gap-2 mt-2">
        <Badge variant="secondary" className="text-xs">{approval.approval_type === 'SEQUENTIAL' ? tt('approvalSequential', 'Sequential') : tt('approvalParallel', 'Parallel')}</Badge>
        <Badge variant="secondary" className="text-xs">{tt('approvalTrigger', 'Trigger')}: {approval.trigger_type?.replace(/_/g, ' ').toLowerCase()}</Badge>
        {approval.require_all && <Badge variant="outline" className="text-xs">{tt('approvalRequiresAll', 'Requires All')}</Badge>}
      </div>
    </div>
  );
}

interface RenderTemplatePreviewProps {
  template: Template;
  priorityById: Map<number, { name: string; color?: string | null }>;
  spotById: Map<number, { name: string }>;
  getTemplateTaskCount: (id: number) => number;
}

export function renderTemplatePreview({ template, priorityById, spotById, getTemplateTaskCount }: RenderTemplatePreviewProps) {
  return (
    <div className="flex items-center space-x-3">
      <FontAwesomeIcon icon={faFileAlt} className="w-5 h-5 text-blue-500" />
      <div>
        <div className="font-medium">{template.name}</div>
        <div className="text-sm text-muted-foreground">{template.description}</div>
        <div className="flex items-center space-x-2 mt-1">
          <Badge variant="outline" style={{ borderColor: priorityById.get((template as any).priority_id)?.color || '#6b7280', color: priorityById.get((template as any).priority_id)?.color || '#6b7280' }}>
            {priorityById.get((template as any).priority_id)?.name || 'Priority'}
          </Badge>
          {((template as any).expected_duration ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">{minutesToHHMM((template as any).expected_duration)}</Badge>
          )}
          {(template as any).default_spot_id && (
            <Badge variant="secondary" className="text-xs">
              {spotById.get((template as any).default_spot_id)?.name || `Spot ${(template as any).default_spot_id}`}
            </Badge>
          )}
          {Array.isArray((template as any).default_user_ids) && (template as any).default_user_ids.length > 0 && (
            <Badge variant="secondary" className="text-xs">{(template as any).default_user_ids.length} users</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {getTemplateTaskCount(template.id)} task{getTemplateTaskCount(template.id) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
