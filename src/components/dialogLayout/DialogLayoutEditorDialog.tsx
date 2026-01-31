import { useState, useCallback } from 'react';
import { LayoutGrid, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import type { DialogLayout } from '@/store/types';
import { DialogLayoutEditor } from './DialogLayoutEditor';

interface DialogLayoutEditorDialogProps {
    categoryId: number;
    categoryName?: string;
    value: DialogLayout | null | undefined;
    onChange: (layout: DialogLayout | null) => void;
}

/**
 * A full-width dialog wrapper for the DialogLayoutEditor.
 * Provides more space for editing complex layouts.
 */
export function DialogLayoutEditorDialog({
    categoryId,
    categoryName,
    value,
    onChange,
}: DialogLayoutEditorDialogProps) {
    const [open, setOpen] = useState(false);
    const [localValue, setLocalValue] = useState<DialogLayout | null>(value ?? null);

    // Reset local value when dialog opens
    const handleOpenChange = useCallback((isOpen: boolean) => {
        if (isOpen) {
            setLocalValue(value ?? null);
        }
        setOpen(isOpen);
    }, [value]);

    // Handle local changes
    const handleChange = useCallback((layout: DialogLayout | null) => {
        setLocalValue(layout);
    }, []);

    // Save changes
    const handleSave = useCallback(() => {
        onChange(localValue);
        setOpen(false);
    }, [localValue, onChange]);

    // Cancel without saving
    const handleCancel = useCallback(() => {
        setLocalValue(value ?? null);
        setOpen(false);
    }, [value]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    <span>Open Layout Editor</span>
                    <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5" />
                        Dialog Layout Editor
                        {categoryName && (
                            <span className="text-muted-foreground font-normal">
                                — {categoryName}
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        Customize how the task create/edit dialog appears for this category.
                        Drag fields between tabs, add custom tabs, and control which fields are shown.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto py-4 min-h-0">
                    <DialogLayoutEditor
                        categoryId={categoryId}
                        value={localValue}
                        onChange={handleChange}
                    />
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Layout
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
