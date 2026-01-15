/**
 * Hook to keep a ref updated with the latest value
 * Useful for avoiding stale closures in callbacks
 */

import { useRef, useEffect } from 'react';

export function useLatestRef<T>(value: T) {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
