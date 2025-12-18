import SignatureInput from "@/components/ui/signature-input";
import { useState } from "react";

interface SignatureFieldProps {
  isEditing?: boolean;
}

export function SignatureField({ isEditing = true }: SignatureFieldProps) {
  const [signature, setSignature] = useState<string | null>(null);

  // Show the signature input in both modes, but disabled/grayed out in edit mode
  return (
    <div className="py-2">
      <SignatureInput
        onSignatureChange={setSignature}
        disabled={isEditing}
      />
    </div>
  );
}

