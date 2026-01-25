import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { Status } from '@/store/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StatusConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  approvalId?: number | null;
}

export function StatusConfigForm({ config, onChange, approvalId }: StatusConfigFormProps) {
  const allStatuses = useSelector((s: RootState) => s.statuses?.value ?? []) as Status[];
  const categories = useSelector((s: RootState) => (s as any).categories?.value ?? []) as Array<{ id: number; approval_id?: number | null; status_transition_group_id?: number | null }>;
  const templates = useSelector((s: RootState) => (s as any).templates?.value ?? []) as Array<{ id: number; approval_id?: number | null; category_id?: number | null }>;
  const statusTransitions = useSelector((s: RootState) => (s as any).statusTransitions?.value ?? []) as Array<{ status_transition_group_id: number; from_status: number; to_status: number }>;

  // Filter statuses based on categories/templates that use this approval
  const filteredStatuses = useMemo(() => {
    if (!approvalId) {
      // If no approvalId, show all statuses (fallback for backward compatibility)
      return allStatuses;
    }

    // Find categories that use this approval directly
    const categoriesWithApproval = categories.filter(
      (cat) => cat.approval_id === approvalId
    );

    // Find templates that use this approval, then get their categories
    const templatesWithApproval = templates
      .filter((tpl) => tpl.approval_id === approvalId)
      .map((tpl) => tpl.category_id)
      .filter((catId): catId is number => catId != null);

    // Get all category IDs that use this approval
    const categoryIds = new Set([
      ...categoriesWithApproval.map((cat) => cat.id),
      ...templatesWithApproval,
    ]);

    // Get status transition groups for these categories
    const transitionGroupIds = new Set<number>();
    categories.forEach((cat) => {
      if (categoryIds.has(cat.id) && cat.status_transition_group_id) {
        transitionGroupIds.add(cat.status_transition_group_id);
      }
    });

    if (transitionGroupIds.size === 0) {
      // If no transition groups found, show all statuses
      return allStatuses;
    }

    // Get all status IDs from transitions in these groups
    const validStatusIds = new Set<number>();
    statusTransitions.forEach((transition) => {
      if (transitionGroupIds.has(transition.status_transition_group_id)) {
        validStatusIds.add(transition.from_status);
        validStatusIds.add(transition.to_status);
      }
    });

    // Filter statuses to only those that appear in valid transitions
    const filtered = allStatuses.filter((status) =>
      validStatusIds.has(status.id)
    );

    // If no statuses found, fallback to all statuses with a warning
    return filtered.length > 0 ? filtered : allStatuses;
  }, [approvalId, allStatuses, categories, templates, statusTransitions]);

  const helpText = approvalId && filteredStatuses.length < allStatuses.length
    ? `Showing statuses valid for categories using this approval`
    : 'Select the status to change the task to';

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="status_id">Status</Label>
        <Select
          value={config.status_id ? String(config.status_id) : ''}
          onValueChange={(value) => onChange({ ...config, status_id: parseInt(value, 10) })}
        >
          <SelectTrigger id="status_id">
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            {filteredStatuses.map((status) => (
              <SelectItem key={status.id} value={String(status.id)}>
                <div className="flex items-center gap-2">
                  {status.color && (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: status.color }}
                    />
                  )}
                  <span>{status.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-1">
          {helpText}
        </p>
      </div>

      <div>
        <Label htmlFor="comment">Comment (Optional)</Label>
        <Textarea
          id="comment"
          value={config.comment || ''}
          onChange={(e) => onChange({ ...config, comment: e.target.value })}
          placeholder="Enter an optional comment"
          rows={3}
        />
      </div>
    </div>
  );
}

