/**
 * Empty overlay component for when no tasks are shown
 */

export function EmptyOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        pointerEvents: 'none',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width="190" height="190" viewBox="0 0 24 24" style={{ opacity: 0.18 }}>
            <path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4l3 3l3-3h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12H16.17L12 19.17L7.83 15H5V5h14v10z"/>
            <path fill="currentColor" d="M7 7h10v2H7V7zm0 4h7v2H7v-2z"/>
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em', opacity: 0.9, marginBottom: 6 }}>
          No tasks to show
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.65 }}>
          This workspace is empty, or you don't have access to its tasks.
        </div>
      </div>
    </div>
  );
}
