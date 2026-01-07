import { useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import WorkspaceTable, { WorkspaceTableHandle } from '@/pages/spaces/components/WorkspaceTable';
import TaskDialog from '@/pages/spaces/components/TaskDialog';

export default function SharedWithMe() {
  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());
  const tableRef = useRef<WorkspaceTableHandle | null>(null);

  const [searchText, setSearchText] = useState('');
  const [openEditTask, setOpenEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const onRowDoubleClicked = useMemo(() => {
    return (task: any) => {
      setSelectedTask(task);
      setOpenEditTask(true);
    };
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl font-semibold tracking-tight">Shared with me</div>
          <div className="text-sm text-muted-foreground">
            Tasks shared to you or your teams.
          </div>
        </div>
        <div className="w-[280px] max-w-[50vw]">
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search shared tasks…"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <WorkspaceTable
          ref={tableRef as any}
          rowCache={rowCache as any}
          workspaceId="shared"
          searchText={searchText}
          onRowDoubleClicked={onRowDoubleClicked}
        />
      </div>

      <TaskDialog
        open={openEditTask}
        onOpenChange={setOpenEditTask}
        mode="edit"
        task={selectedTask}
      />
    </div>
  );
}



