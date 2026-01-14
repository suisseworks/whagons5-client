'use client';

import * as React from 'react';
import { Collapsible as CollapsiblePrimitive } from 'radix-ui';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';

import { getStrictContext } from '@/lib/get-strict-context';
import { useControlledState } from '@/hooks/use-controlled-state';

type CollapsibleContextType = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

const [CollapsibleProvider, useCollapsible] =
  getStrictContext<CollapsibleContextType>('CollapsibleContext');

type CollapsibleProps = React.ComponentProps<typeof CollapsiblePrimitive.Root>;

function Collapsible(props: CollapsibleProps) {
  const [isOpen, setIsOpen] = useControlledState({
    value: props?.open,
    defaultValue: props?.defaultOpen,
    onChange: props?.onOpenChange,
  });

  return (
    <CollapsibleProvider value={{ isOpen, setIsOpen }}>
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        {...props}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </CollapsibleProvider>
  );
}

type CollapsibleTriggerProps = React.ComponentProps<
  typeof CollapsiblePrimitive.Trigger
>;

function CollapsibleTrigger(props: CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

type CollapsibleContentProps = Omit<
  React.ComponentProps<typeof CollapsiblePrimitive.Content>,
  'asChild' | 'forceMount'
> &
  HTMLMotionProps<'div'> & {
    keepRendered?: boolean;
    forceVisible?: boolean;
  };

function CollapsibleContent({
  keepRendered = false,
  forceVisible = false,
  transition = { duration: 0.2, ease: 'easeInOut' },
  style,
  ...props
}: CollapsibleContentProps) {
  const { isOpen } = useCollapsible();
  const visible = forceVisible || isOpen;
  const mergedStyle = { overflow: 'hidden', ...style };

  if (keepRendered) {
    return (
      <CollapsiblePrimitive.Content asChild forceMount>
        <motion.div
          key="collapsible-content"
          data-slot="collapsible-content"
          animate={{
            height: visible ? 'auto' : 0,
            opacity: visible ? 1 : 0,
          }}
          transition={transition}
          style={mergedStyle}
          {...props}
        />
      </CollapsiblePrimitive.Content>
    );
  }

  return (
    <AnimatePresence>
      {visible && (
        <CollapsiblePrimitive.Content asChild forceMount>
          <motion.div
            key="collapsible-content"
            data-slot="collapsible-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            style={mergedStyle}
            {...props}
          />
        </CollapsiblePrimitive.Content>
      )}
    </AnimatePresence>
  );
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  useCollapsible,
  type CollapsibleProps,
  type CollapsibleTriggerProps,
  type CollapsibleContentProps,
  type CollapsibleContextType,
};
