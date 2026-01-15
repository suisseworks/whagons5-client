export type TaskDialogMode = 'create' | 'edit' | 'create-all';

export interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TaskDialogMode;
  workspaceId?: number;
  task?: any | null;
}

