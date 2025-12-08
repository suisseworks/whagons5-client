import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  assignee?: string;
}

export default function TaskBoardTab({ workspaceId }: { workspaceId: string | undefined }) {
  const columns = useMemo(() => ([
    { key: 'todo', title: 'To Do', color: 'bg-gray-200', items: [
      { id: 't1', title: 'Draft spec', assignee: 'Alice' },
      { id: 't2', title: 'Prepare assets' },
    ] as TaskItem[] },
    { key: 'doing', title: 'In Progress', color: 'bg-blue-200', items: [
      { id: 't3', title: 'Implement API', assignee: 'Bob' },
    ] as TaskItem[] },
    { key: 'review', title: 'Review', color: 'bg-amber-200', items: [
      { id: 't4', title: 'UX pass', assignee: 'Charlie' },
    ] as TaskItem[] },
    { key: 'done', title: 'Done', color: 'bg-emerald-200', items: [
      { id: 't5', title: 'Setup CI' },
    ] as TaskItem[] },
  ]), []);

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <LayoutDashboard className="w-4 h-4" />
        <span>Task Board</span>
        <span className="text-xs ml-auto">space {workspaceId ?? ""}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map(col => (
          <Card key={col.key} className="flex flex-col min-h-[260px]">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${col.color.replace('bg-', 'bg-')}`}></span>
                {col.title}
                <span className="text-xs text-muted-foreground">({col.items.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {col.items.map(item => (
                  <div key={item.id} className="border rounded p-2 bg-background">
                    <div className="text-sm font-medium">{item.title}</div>
                    {item.assignee && (
                      <div className="text-xs text-muted-foreground mt-1">Assignee: {item.assignee}</div>
                    )}
                  </div>
                ))}
                {col.items.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">No tasks</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


