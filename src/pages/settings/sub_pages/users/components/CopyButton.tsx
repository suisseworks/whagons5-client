import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy as CopyIcon } from "lucide-react";
import type { TranslateFn } from "../types";

export function CopyButton({
  text,
  translate,
}: {
  text: string;
  translate: TranslateFn;
}) {
  const [copied, setCopied] = useState(false);
  const copyText = translate("copyButton.copy", "Copy");
  const copiedText = translate("copyButton.copied", "Copied");

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Radix/AG Grid can listen above React; stop the native event too
    (e.nativeEvent as any)?.stopImmediatePropagation?.();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-grid-stop-row-click="true"
      onPointerDown={(e) => {
        // Prevent AG Grid from treating this as a row click (which would open Edit)
        e.preventDefault();
        e.stopPropagation();
        // Radix/AG Grid can listen above React; stop the native event too
        (e.nativeEvent as any)?.stopImmediatePropagation?.();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.nativeEvent as any)?.stopImmediatePropagation?.();
      }}
      onClick={handleCopy}
      className="min-w-[80px]"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1" />
          {copiedText}
        </>
      ) : (
        <>
          <CopyIcon className="h-4 w-4 mr-1" />
          {copyText}
        </>
      )}
    </Button>
  );
}

