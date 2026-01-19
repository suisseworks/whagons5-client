import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"

interface DeleteTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  taskName?: string
}

export function DeleteTaskDialog({
  open,
  onOpenChange,
  onConfirm,
  taskName,
}: DeleteTaskDialogProps) {
  const isMultiple = taskName && taskName.includes('tasks')
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              {isMultiple ? 'Delete Tasks' : 'Delete Task'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base leading-relaxed">
            {isMultiple 
              ? `Are you sure you want to delete ${taskName}? This action can be undone within a limited time.`
              : `Are you sure you want to delete this task${taskName ? ` "${taskName}"` : ""}? This action can be undone within a limited time.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete {isMultiple ? 'Tasks' : 'Task'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

