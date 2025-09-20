'use client';

import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const HoverPopover = ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        onMouseEnter={() => { setOpen(true); }}
        onMouseLeave={() => { setOpen(false); }}
        className="inline-flex"
      >
        <PopoverTrigger asChild>
          <div>{children}</div>
        </PopoverTrigger>
      </div>
      <PopoverContent side="top" align="center" className="w-auto min-w-[200px] p-4">
        {content}
      </PopoverContent>
    </Popover>
  );
};

export default HoverPopover;


