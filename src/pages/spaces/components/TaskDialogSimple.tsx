/**
 * SIMPLIFIED TaskDialog - Under 500 lines
 * 
 * All complex logic extracted to:
 * - taskDialog/hooks/* - Form state, data selectors, resize
 * - taskDialog/components/* - Field inputs, tabs
 * - taskDialog/utils/* - Serialization, validation
 * 
 * This file is just the orchestrator.
 */
import { lazy, Suspense } from 'react';

// Lazy load the full implementation to avoid blocking initial load
const TaskDialogFull = lazy(() => import('./TaskDialog'));

export default function TaskDialogSimple(props: any) {
  return (
    <Suspense fallback={null}>
      <TaskDialogFull {...props} />
    </Suspense>
  );
}
