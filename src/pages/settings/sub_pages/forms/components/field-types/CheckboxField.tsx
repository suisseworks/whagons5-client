interface CheckboxFieldProps {
  isEditing?: boolean;
}

export function CheckboxField({ isEditing = true }: CheckboxFieldProps) {
  if (!isEditing) {
    // Rendered view - what users see when filling the form
    return (
      <div className="flex items-center gap-2 py-2">
        <input type="checkbox" disabled className="w-4 h-4" />
        <span className="text-sm text-muted-foreground">Checkbox option</span>
      </div>
    );
  }

  // Edit view - what form creator sees
  return (
    <div className="text-sm text-muted-foreground px-3 py-2 border rounded bg-muted/30">
      Checkboxes
    </div>
  );
}
