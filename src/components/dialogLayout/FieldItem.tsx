import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Asterisk } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DraggableFieldItem } from './types';
import { Button } from '@/components/ui/button';

interface FieldItemProps {
    item: DraggableFieldItem;
    onRemove?: (uniqueId: string) => void;
    isRequired?: boolean;
    disabled?: boolean;
}

export function FieldItem({ item, onRemove, isRequired, disabled }: FieldItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: item.uniqueId,
        disabled,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'flex items-center gap-2 px-3 py-2 bg-background border rounded-md',
                'hover:border-primary/50 transition-colors',
                isDragging && 'opacity-50 shadow-lg z-50',
                item.isCustom && 'border-l-4 border-l-blue-500',
                disabled && 'opacity-50 cursor-not-allowed'
            )}
        >
            <button
                className={cn(
                    'touch-none cursor-grab active:cursor-grabbing',
                    disabled && 'cursor-not-allowed'
                )}
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            
            <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-sm truncate">{item.label}</span>
                {item.isCustom && (
                    <span className="text-xs text-blue-500 font-medium shrink-0">
                        Custom
                    </span>
                )}
                {isRequired && (
                    <Asterisk className="h-3 w-3 text-red-500 shrink-0" />
                )}
            </div>

            {onRemove && !disabled && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onRemove(item.uniqueId)}
                    title="Remove from this tab"
                >
                    <X className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}
