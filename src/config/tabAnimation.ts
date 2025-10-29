export type TabKey = 'grid' | 'calendar' | 'scheduler' | 'map' | 'board' | 'settings';

export interface TabAnimationConfig {
  order: TabKey[];
  distance: string | number;
  transition: {
    duration: number;
    type: 'spring';
    stiffness: number;
    damping: number;
  };
}

export const TAB_ANIMATION: TabAnimationConfig = {
  order: ['grid', 'calendar', 'scheduler', 'map', 'board', 'settings'],
  distance: '80vw',
  transition: {
    duration: 0.10,
    type: 'spring',
    stiffness: 350,
    damping: 30,
  },
};

function negativeDistance(distance: string | number): string | number {
  if (typeof distance === 'number') return -distance;
  return distance.startsWith('-') ? distance : `-${distance}`;
}

export function getTabInitialX(
  prev: TabKey | string | null | undefined,
  next: TabKey | string
): string | number {
  if (!prev || prev === next) return 0;
  const order = TAB_ANIMATION.order;
  const from = order.indexOf(prev as TabKey);
  const to = order.indexOf(next as TabKey);
  if (from === -1 || to === -1) return 0;
  return to > from ? TAB_ANIMATION.distance : negativeDistance(TAB_ANIMATION.distance);
}


