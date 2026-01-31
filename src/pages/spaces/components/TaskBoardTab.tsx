import { KanbanBoard } from './kanban';

export default function TaskBoardTab({ workspaceId }: { workspaceId: string | undefined }) {
  return (
    <div className="h-full w-full flex flex-col">
      <KanbanBoard workspaceId={workspaceId} />
    </div>
  );
}


