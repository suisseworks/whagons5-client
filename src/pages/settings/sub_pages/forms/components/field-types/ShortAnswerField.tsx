interface ShortAnswerFieldProps {
  isEditing?: boolean;
}

export function ShortAnswerField({ isEditing = true }: ShortAnswerFieldProps) {
  if (!isEditing) {
    // Rendered view - what users see when filling the form
    return (
      <div className="text-sm text-muted-foreground py-2 border-b border-muted-foreground/30">
        Short answer text
      </div>
    );
  }

  // Edit view - what form creator sees
  return (
    <div className="text-sm text-muted-foreground py-2">
      Short answer text
    </div>
  );
}
