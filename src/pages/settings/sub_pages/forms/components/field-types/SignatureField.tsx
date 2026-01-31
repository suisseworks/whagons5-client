import SignatureInput from "@/components/ui/signature-input";
import { useState } from "react";

interface SignatureFieldProps {
  isEditing?: boolean;
  // Controlled mode props for form filling
  value?: string | null;
  onChange?: (value: string | null) => void;
}

export function SignatureField({ 
  isEditing = true,
  value: externalValue,
  onChange
}: SignatureFieldProps) {
  // Internal state for uncontrolled mode (preview)
  const [internalValue, setInternalValue] = useState<string | null>(null);
  
  // Use external value if provided (controlled mode), otherwise internal
  const value = externalValue !== undefined ? externalValue : internalValue;
  
  const handleChange = (newValue: string | null) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  // Show the signature input in both modes, but disabled/grayed out in edit mode
  // Note: SignatureInput doesn't support pre-populating with value, only captures new signatures
  return (
    <div className="py-2">
      <SignatureInput
        onSignatureChange={handleChange}
        disabled={isEditing}
      />
    </div>
  );
}

