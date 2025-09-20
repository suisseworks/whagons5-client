import { iconService } from './iconService';

/**
 * Initialize icon service
 * This should be called when the app starts
 */
export async function initializeIcons(): Promise<void> {
  try {
    // Only clear outdated icons on startup, don't preload
    await iconService.clearOutdatedIcons();
    
    // Log cache statistics for debugging
    const stats = await iconService.getCacheStats();
    // console.log('Icon cache initialized:', stats);
  } catch (error) {
    console.error('Error initializing icon cache:', error);
  }
}

/**
 * Preload common icons (call this only when needed)
 */
export async function preloadCommonIcons(): Promise<void> {
  try {
    await iconService.preloadCommonIcons();
    console.log('Common icons preloaded');
  } catch (error) {
    console.error('Error preloading common icons:', error);
  }
}

// Auto-initialize when this module is imported (lightweight)
initializeIcons(); 