import { iconCacheManager } from './iconCacheDB';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { IconDefinition } from '@fortawesome/fontawesome-common-types';

// Simple inline default icon definition (building icon)
const defaultIcon = {
  prefix: 'far',
  iconName: 'building',
  icon: [
    512, // width
    512, // height
    [], // ligatures
    'f1ad', // unicode
    'M176 48c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16h160c8.8 0 16-7.2 16-16V64c0-8.8-7.2-16-16-16H176zM128 64c0-26.5 21.5-48 48-48H336c26.5 0 48 21.5 48 48V448c0 26.5-21.5 48-48 48H176c-26.5 0-48-21.5-48-48V64zm64 80c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H208c-8.8 0-16-7.2-16-16V144zm16 80c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V240c0-8.8-7.2-16-16-16H208zm-16 112c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H208c-8.8 0-16-7.2-16-16V336zM304 144c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H320c-8.8 0-16-7.2-16-16V144zm16 80c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V240c0-8.8-7.2-16-16-16H320zm-16 112c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H320c-8.8 0-16-7.2-16-16V336z',
  ],
};

interface IconItem {
  name: string;
  icon: any;
  keywords: string[];
}

interface IconDatabase extends DBSchema {
  icons: {
    key: string;
    value: any;
  };
}

interface FontAwesomeMetadata {
  [iconName: string]: {
    search?: {
      terms?: string[];
    };
    label?: string;
  };
}

class IconService {
  private loadedIcons: Map<string, any> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private allIconsPromise: Promise<IconItem[]> | null = null;
  private allIconsCache: IconItem[] | null = null;
  private defaultIcon = defaultIcon;
  private db!: IDBPDatabase<IconDatabase>;
  private initialized = false;
  private faMetadata: FontAwesomeMetadata | null = null;

  constructor() {
    // Clear outdated icons on startup
    this.clearOutdatedIcons();
  }

  /**
   * Clear outdated icons from cache
   */
  async clearOutdatedIcons(): Promise<void> {
    try {
      await iconCacheManager.clearOutdatedIcons();
    } catch (error) {
      console.error('Error clearing outdated icons:', error);
    }
  }

  /**
   * Load a single icon by name with caching
   */
  async loadIcon(iconName: string): Promise<any> {
    if (!iconName || typeof iconName !== 'string') {
      return this.defaultIcon;
    }

    // Check if icon is already loaded in memory
    if (this.loadedIcons.has(iconName)) {
      return this.loadedIcons.get(iconName);
    }

    // Check if there's already a loading promise for this icon
    if (this.loadingPromises.has(iconName)) {
      return this.loadingPromises.get(iconName);
    }

    // Create loading promise
    const loadingPromise = this.loadIconFromCache(iconName);
    this.loadingPromises.set(iconName, loadingPromise);

    try {
      const icon = await loadingPromise;
      this.loadedIcons.set(iconName, icon);
      return icon;
    } catch (error) {
      console.error(`Error loading icon ${iconName}:`, error);
      return this.defaultIcon;
    } finally {
      this.loadingPromises.delete(iconName);
    }
  }

  private async loadIconFromCache(iconName: string): Promise<any> {
    try {
      // First check IndexedDB cache
      const cachedIcon = await iconCacheManager.getCachedIcon(iconName);
      if (cachedIcon) {
        return cachedIcon;
      }

      // If not in cache, load from Font Awesome
      const icon = await this.loadIconFromFontAwesome(iconName);
      if (icon) {
        // Cache the loaded icon
        await iconCacheManager.setCachedIcon(iconName, icon);
        return icon;
      }

      return this.defaultIcon;
    } catch (error) {
      console.error(`Error loading icon ${iconName} from cache:`, error);
      return this.defaultIcon;
    }
  }

  private async loadIconFromFontAwesome(iconName: string): Promise<any> {
    try {
      // Convert iconName to the expected format (fa + PascalCase)
      // For hyphenated names like "clock-seven", convert to "faClockSeven"
      const toPascalCase = (str: string) => {
        return str.split('-').map(part => 
          part.charAt(0).toUpperCase() + part.slice(1)
        ).join('');
      };
      
      const faIconName = 'fa' + toPascalCase(iconName);

      // Dynamically import only the specific icon we need
      // Avoid importing the full module to prevent circular dependency issues
      try {
        const iconModule = await import(/* @vite-ignore */ `@fortawesome/pro-regular-svg-icons/${faIconName}.js`);
        return iconModule[faIconName];
      } catch (specificError) {
        // Don't fall back to full module import - it causes circular dependency crashes
        // Just return null and let the default icon be used
        console.warn(`Could not load icon ${iconName} (${faIconName}):`, specificError);
        return null;
      }

      return null;
    } catch (error) {
      console.error(`Error loading icon ${iconName} from Font Awesome:`, error);
      return null;
    }
  }

  /**
   * Load multiple icons at once with caching
   */
  async loadIcons(iconNames: string[]): Promise<{ [key: string]: any }> {
    // Parse FontAwesome class formats first
    const parsedNames = iconNames
      .filter((name) => name && typeof name === 'string')
      .map((name) => this.parseFontAwesomeIconName(name));
      
    const uniqueNames = [...new Set(parsedNames)];

    if (uniqueNames.length === 0) {
      return {};
    }

    try {
      // Check cache first for all icons
      const cachedIcons = await iconCacheManager.getCachedIcons(uniqueNames);
      const result: { [key: string]: any } = { ...cachedIcons };

      // Find icons that need to be loaded
      const iconsToLoad = uniqueNames.filter((name) => !cachedIcons[name]);

      if (iconsToLoad.length > 0) {
        // Load missing icons
        const loadPromises = iconsToLoad.map(async (iconName) => {
          const icon = await this.loadIconFromFontAwesome(iconName);
          if (icon) {
            result[iconName] = icon;
            return { [iconName]: icon };
          }
          return null;
        });

        const loadedIconsArray = await Promise.all(loadPromises);
        const loadedIcons = loadedIconsArray.reduce((acc, iconObj) => {
          if (iconObj) {
            return { ...acc, ...iconObj };
          }
          return acc;
        }, {} as { [key: string]: any });

        // Cache newly loaded icons
        if (loadedIcons && Object.keys(loadedIcons).length > 0) {
          await iconCacheManager.setCachedIcons(loadedIcons);
        }
      }

      // Store in memory cache
      Object.entries(result).forEach(([name, icon]) => {
        this.loadedIcons.set(name, icon);
      });

      return result;
    } catch (error) {
      console.error('Error loading multiple icons:', error);
      return {};
    }
  }

  /**
   * Get all available icons with lazy loading (only loads when needed)
   * Returns a subset of commonly used icons to avoid circular dependency issues
   */
  async getAllIcons(): Promise<IconItem[]> {
    if (this.allIconsPromise) {
      return this.allIconsPromise;
    }

    this.allIconsPromise = this.loadAllIconsInternal();
    return this.allIconsPromise;
  }

  private async loadAllIconsInternal(): Promise<IconItem[]> {
    if (this.allIconsCache) {
      return this.allIconsCache;
    }

    // For now, return a curated list of common icons instead of loading all FontAwesome icons
    // This avoids the circular dependency issues during build
    this.allIconsCache = await this.getCuratedIconList();
    return this.allIconsCache;
  }

  /**
   * Get a curated list of common icons without loading the entire FontAwesome module
   */
  private async getCuratedIconList(): Promise<IconItem[]> {
    const commonIconNames = [
      'building', 'briefcase', 'user', 'users', 'settings', 'home', 'folder',
      'file', 'star', 'heart', 'check', 'times', 'plus', 'minus', 'edit',
      'trash', 'search', 'filter', 'sort', 'calendar', 'clock', 'bell',
      'envelope', 'phone', 'map', 'tag', 'bookmark', 'share', 'link',
      'broom', 'wrench', 'seedling', 'tools', 'car', 'utensils', 'laptop', 'book',
      'circle', 'square', 'triangle', 'diamond', 'hexagon', 'octagon', 'shield',
      'key', 'lock', 'unlock', 'eye', 'eye-slash', 'cog', 'gears', 'bolt',
      'cloud', 'sun', 'moon', 'rain', 'snow', 'wind', 'umbrella', 'fire',
      'leaf', 'tree', 'flower', 'bug', 'paw', 'fish', 'bird', 'cat', 'dog'
    ];

    const iconList: IconItem[] = [];

    // Load each icon individually to avoid bulk import issues
    for (const iconName of commonIconNames) {
      try {
        const icon = await this.loadIcon(iconName);
        if (icon) {
          const keywords = this.getIconKeywords(iconName);
          iconList.push({
            name: iconName,
            icon: icon,
            keywords: keywords,
          });
        }
      } catch (error) {
        // Skip icons that can't be loaded
        console.warn(`Could not load curated icon ${iconName}:`, error);
      }
    }

    return iconList.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Load FontAwesome metadata containing official keywords
   */
  private async loadFontAwesomeMetadata(): Promise<void> {
    try {
      // Try to load from public folder first (you'll need to copy the metadata file there)
      let response = await fetch('/metadata/icon-families.json');
      
      if (!response.ok) {
        // Fallback to CDN
        response = await fetch('https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.0/metadata/icon-families.json');
      }
      
      if (response.ok) {
        this.faMetadata = await response.json();
        // console.log('FontAwesome metadata loaded successfully');
      } else {
        console.warn('Could not load FontAwesome metadata, falling back to generated keywords');
      }
    } catch (error) {
      console.warn('Error loading FontAwesome metadata:', error);
    }
  }

  /**
   * Get keywords for an icon, preferring official FontAwesome terms
   */
  private getIconKeywords(iconName: string): string[] {
    const keywordSet = new Set<string>();
    
    // Add the base icon name
    keywordSet.add(iconName);
    
    // Try to get official FontAwesome keywords first
    if (this.faMetadata && this.faMetadata[iconName]?.search?.terms) {
      const officialTerms = this.faMetadata[iconName].search.terms;
      officialTerms.forEach(term => keywordSet.add(term));
      // console.log(`Using official keywords for ${iconName}:`, officialTerms);
      
      // Even with official keywords, add some basic variations for better search
      this.addBasicVariations(iconName, keywordSet);
      return Array.from(keywordSet);
    }
    
    // Fall back to generated keywords if official ones aren't available
    // console.log(`No official keywords found for ${iconName}, generating keywords`);
    
    this.addBasicVariations(iconName, keywordSet);
    return Array.from(keywordSet);
  }

  private addBasicVariations(iconName: string, keywordSet: Set<string>): void {
    // Add hyphen-separated parts (for names like "arrow-left")
    if (iconName.includes('-')) {
      iconName.split('-').forEach(part => {
        if (part.length > 1) {
          keywordSet.add(part);
        }
      });
      // Also add the full hyphenated name
      keywordSet.add(iconName);
    }
    
    // Add underscore-separated parts
    if (iconName.includes('_')) {
      iconName.split('_').forEach(part => {
        if (part.length > 1) {
          keywordSet.add(part);
        }
      });
    }
    
    // Add space-separated version (for camelCase names)
    const spaceVersion = iconName.replace(/([A-Z])/g, ' $1').toLowerCase();
    if (spaceVersion !== iconName) {
      keywordSet.add(spaceVersion);
      // Add individual words from space-separated version
      spaceVersion.split(' ').forEach(word => {
        if (word.length > 1) {
          keywordSet.add(word);
        }
      });
    }
    
    // Add hyphen-separated version (for camelCase names)
    const hyphenVersion = iconName.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (hyphenVersion !== iconName) {
      keywordSet.add(hyphenVersion);
    }
    
    // Add additional common variations
    const variations = [
      // Common prefixes/suffixes
      iconName.replace(/^fa/, ''),
      iconName.replace(/Icon$/, ''),
      iconName.replace(/^icon/, ''),
      
      // Word boundaries
      iconName.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(),
      iconName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
      iconName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(),
    ];
    
    variations.forEach(variation => {
      if (variation && variation !== iconName && variation.length > 1) {
        keywordSet.add(variation);
      }
    });
  }


  /**
   * Search icons by keyword
   */
  async searchIcons(searchTerm: string): Promise<IconItem[]> {
    if (!searchTerm.trim()) {
      return this.getAllIcons();
    }

    const allIcons = await this.getAllIcons();
    const searchTermLower = searchTerm.toLowerCase();

    return allIcons.filter((iconItem) => {
      //if broom print all keywords
      if (iconItem.name === 'broom') {
        console.log("keywords", iconItem.keywords);
      }
      return iconItem.keywords.some((keyword) => keyword.includes(searchTermLower));
    });
  }

  /**
   * Parse FontAwesome class format (e.g., "fas fa-broom" -> "broom")
   */
  private parseFontAwesomeIconName(iconName: string): string {
    if (!iconName || typeof iconName !== 'string') {
      return '';
    }

    // Handle FontAwesome class format (fas fa-icon-name, far fa-icon-name, etc.)
    const faClassMatch = iconName.match(/^(fas|far|fal|fat|fab|fad|fass)\s+fa-(.+)$/);
    if (faClassMatch) {
      return faClassMatch[2]; // Return just the icon name part
    }

    // Handle fa-prefix format (fa-icon-name -> icon-name)
    if (iconName.startsWith('fa-')) {
      return iconName.substring(3);
    }

    // Return as-is if no special format detected
    return iconName;
  }

  /**
   * Get icon by name with fallback to default
   */
  async getIcon(iconName?: string): Promise<any> {
    if (!iconName || typeof iconName !== 'string') {
      return this.defaultIcon;
    }

    // Parse FontAwesome class format if needed
    const parsedIconName = this.parseFontAwesomeIconName(iconName);
    return this.loadIcon(parsedIconName);
  }

  /**
   * Preload commonly used icons
   */
  async preloadCommonIcons(): Promise<void> {
    const commonIcons = [
      'building',
      'briefcase',
      'user',
      'users',
      'settings',
      'home',
      'folder',
      'file',
      'star',
      'heart',
      'check',
      'times',
      'plus',
      'minus',
      'edit',
      'trash',
      'search',
      'filter',
      'sort',
      'calendar',
      'clock',
      'bell',
      'envelope',
      'phone',
      'map',
      'tag',
      'bookmark',
      'share',
      'link',
    ];

    try {
      await this.loadIcons(commonIcons);
    } catch (error) {
      console.error('Error preloading common icons:', error);
    }
  }

  /**
   * Clear all cached icons
   */
  async clearCache(): Promise<void> {
    try {
      await iconCacheManager.clearAllIcons();
      this.loadedIcons.clear();
      this.allIconsCache = null;
      this.allIconsPromise = null;
    } catch (error) {
      console.error('Error clearing icon cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ totalIcons: number; cacheSize: number }> {
    try {
      return await iconCacheManager.getStorageInfo();
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalIcons: 0, cacheSize: 0 };
    }
  }
}

// Export singleton instance
export const iconService = new IconService();
export default iconService;
