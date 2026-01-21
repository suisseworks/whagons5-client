import { X } from "lucide-react";
import { toast as hotToast } from "react-hot-toast";

interface NotificationToastProps {
  title: string;
  body: string;
  toastId: string;
  onClick?: () => void;
  icon?: string;
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type?: string): string {
  if (!type) return '🔔';
  
  switch (type) {
    case 'broadcast':
      return '📢';
    case 'task_assigned':
      return '📋';
    case 'task_updated':
      return '✏️';
    case 'approval_requested':
      return '🔍';
    case 'approval_approved':
      return '✅';
    case 'approval_rejected':
      return '❌';
    case 'message':
      return '💬';
    case 'reminder':
      return '⏰';
    case 'mention':
      return '👤';
    default:
      return '🔔';
  }
}

export function NotificationToast({ title, body, toastId, onClick, icon = '🔔' }: NotificationToastProps) {
  return (
    <div 
      className={`
        flex items-start gap-3 w-full max-w-md
        bg-background border border-border rounded-lg shadow-lg
        p-4 pr-10
        ${onClick ? 'cursor-pointer hover:shadow-xl' : ''}
        transition-all duration-200
        animate-in slide-in-from-right-full
      `}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
          <span className="text-xl">{icon}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-semibold text-sm text-foreground leading-tight">
          {title}
        </div>
        <div className="text-sm text-muted-foreground leading-snug">
          {body}
        </div>
        {onClick && (
          <div className="text-xs text-primary font-medium pt-1">
            Click to view →
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          hotToast.dismiss(toastId);
        }}
        className="
          absolute right-2 top-2
          rounded-md p-1.5
          text-muted-foreground hover:text-foreground
          hover:bg-muted/50
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary/50
        "
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Helper function to show notification toast
export function showNotificationToast(options: {
  title: string;
  body: string;
  onClick?: () => void;
  icon?: string;
  duration?: number;
}) {
  const toastId = hotToast.custom(
    (t) => (
      <NotificationToast
        title={options.title}
        body={options.body}
        toastId={t.id}
        onClick={() => {
          if (options.onClick) {
            options.onClick();
            hotToast.dismiss(t.id);
          }
        }}
        icon={options.icon}
      />
    ),
    {
      duration: options.duration || 6000,
      position: 'top-right',
    }
  );
  return toastId;
}
