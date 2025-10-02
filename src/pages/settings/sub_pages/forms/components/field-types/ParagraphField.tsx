interface ParagraphFieldProps {
  isEditing?: boolean;
}

export function ParagraphField({ isEditing = true }: ParagraphFieldProps) {
  if (!isEditing) {
    // Rendered view - what users see when filling the form
    return (
      <div className="text-sm text-muted-foreground py-2 border-b border-muted-foreground/30">
        Long answer text
      </div>
    );
  }

  // Edit view - what form creator sees
  return (
    <div className="text-sm text-muted-foreground px-3 py-2 border rounded bg-muted/30">
      Long answer text
    </div>
  );
}
