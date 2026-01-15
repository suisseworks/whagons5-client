import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';

export function AdditionalTab(props: any) {
  const { mode, tags, selectedTagIds, setSelectedTagIds, slas, slaId, setSlaId, approvals, approvalId, setApprovalId, dueDate, setDueDate } = props;

  return (
    <div className="space-y-4">
      {/* Tags - Only for create and edit modes */}
      {(mode === 'create' || mode === 'edit') && (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium font-[500] text-foreground">Tags</Label>
          <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
            <TagMultiSelect
              tags={tags}
              value={selectedTagIds}
              onValueChange={(values) => setSelectedTagIds(values)}
              placeholder="Select tags..."
              searchPlaceholder="Search tags..."
              emptyText="No tags found."
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* SLA */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium font-[500] text-foreground">SLA</Label>
        <Select value={slaId ? String(slaId) : ""} onValueChange={(v) => setSlaId(v ? parseInt(v, 10) : null)}>
          <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background">
            <SelectValue placeholder="Select SLA (optional)" />
          </SelectTrigger>
          <SelectContent>
            {Array.isArray(slas) && slas.length > 0 ? (
              slas.filter((s: any) => s.enabled !== false).map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name || `SLA ${s.id}`}</SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No SLAs available</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Approval */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium font-[500] text-foreground">Approval</Label>
        <Select value={approvalId ? String(approvalId) : ""} onValueChange={(v) => setApprovalId(v ? parseInt(v, 10) : null)}>
          <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background">
            <SelectValue placeholder="Select approval (optional)" />
          </SelectTrigger>
          <SelectContent>
            {Array.isArray(approvals) && approvals.length > 0 ? (
              approvals.filter((a: any) => a.is_active !== false).map((a: any) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name || `Approval ${a.id}`}</SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No approvals available</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Due Date */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="due" className="text-sm font-medium font-[500] text-foreground">Due Date</Label>
        <Input 
          id="due" 
          type="date" 
          value={dueDate} 
          onChange={(e) => setDueDate(e.target.value)} 
          className="h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
        />
      </div>
    </div>
  );
}
