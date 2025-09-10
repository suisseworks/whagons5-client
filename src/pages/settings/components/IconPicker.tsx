import React, { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iconService } from '@/database/iconService';

// Popular icons list to show initially
const POPULAR_ICONS = [
  'building', 'briefcase', 'user', 'users', 'settings', 'home', 'folder',
  'file', 'star', 'heart', 'check', 'times', 'plus', 'minus', 'edit',
  'trash', 'search', 'filter', 'sort', 'calendar', 'clock', 'bell',
  'envelope', 'phone', 'map', 'tag', 'bookmark', 'share', 'link',
  'broom', 'wrench', 'seedling', 'tools', 'car', 'utensils', 'laptop', 'book'
];

const ICONS_PER_PAGE = 100;

export interface IconPickerProps {
  id?: string;
  label?: string;
  value: string; // e.g., "fas fa-tags"
  onChange: (iconClass: string) => void;
  color?: string;
  className?: string;
  required?: boolean;
}

export function IconPicker({
  id,
  label,
  value,
  onChange,
  color = '#6B7280',
  className = "",
  required = false
}: IconPickerProps) {
  const [iconSearch, setIconSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [displayedIcons, setDisplayedIcons] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [popularIcons, setPopularIcons] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [allIconsMetadata, setAllIconsMetadata] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [loadedIconsCount, setLoadedIconsCount] = useState(0);
  const [totalIconsCount, setTotalIconsCount] = useState(0);
  const [loadingIcons, setLoadingIcons] = useState(false);
  const [loadingMoreIcons, setLoadingMoreIcons] = useState(false);
  const [currentIcon, setCurrentIcon] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load default icon and popular icons
  useEffect(() => {
    const loadDefaultAndPopularIcons = async () => {
      try {
        // Load current icon
        if (value) {
          const iconName = value.replace('fas fa-', '');
          const icon = await iconService.getIcon(iconName);
          setCurrentIcon(icon);
        }
        
        // Load popular icons immediately
        const popularIconsData = await Promise.all(
          POPULAR_ICONS.map(async (iconName) => {
            const icon = await iconService.getIcon(iconName);
            return {
              name: iconName,
              icon: icon,
              keywords: [iconName]
            };
          })
        );
        
        setPopularIcons(popularIconsData);
        setDisplayedIcons(popularIconsData);
        setLoadedIconsCount(popularIconsData.length);
        
        // Get total icons count without loading all icons
        const allIcons = await iconService.getAllIcons();
        setTotalIconsCount(allIcons.length);
        setAllIconsMetadata(allIcons);
      } catch (error) {
        console.error('Error loading icons:', error);
      }
    };
    loadDefaultAndPopularIcons();
  }, [value]);

  // Handle scroll to load more icons
  const handleIconScroll = useCallback(async () => {
    if (!scrollContainerRef.current || loadingMoreIcons || isSearching) return;
    
    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Load more when user scrolls to within 200px of bottom
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      if (loadedIconsCount < totalIconsCount) {
        setLoadingMoreIcons(true);
        
        try {
          const startIndex = loadedIconsCount;
          const endIndex = Math.min(startIndex + ICONS_PER_PAGE, totalIconsCount);
          const iconsToLoad = allIconsMetadata.slice(startIndex, endIndex);
          
          // Load the actual icon data for this batch
          const loadedIconsData = await Promise.all(
            iconsToLoad.map(async (iconMeta) => {
              const icon = await iconService.getIcon(iconMeta.name);
              return {
                name: iconMeta.name,
                icon: icon,
                keywords: iconMeta.keywords
              };
            })
          );
          
          setDisplayedIcons(prev => [...prev, ...loadedIconsData]);
          setLoadedIconsCount(endIndex);
        } catch (error) {
          console.error('Error loading more icons:', error);
        } finally {
          setLoadingMoreIcons(false);
        }
      }
    }
  }, [loadedIconsCount, totalIconsCount, allIconsMetadata, loadingMoreIcons, isSearching]);

  // Handle icon search
  useEffect(() => {
    const searchIcons = async () => {
      if (!iconSearch.trim()) {
        // Reset to popular icons when search is cleared
        setIsSearching(false);
        setDisplayedIcons(popularIcons);
        setLoadedIconsCount(popularIcons.length);
        return;
      }

      setIsSearching(true);
      setLoadingIcons(true);
      try {
        const searchResults = await iconService.searchIcons(iconSearch);
        setDisplayedIcons(searchResults);
        setLoadedIconsCount(searchResults.length);
      } catch (error) {
        console.error('Error searching icons:', error);
        setDisplayedIcons([]);
        setLoadedIconsCount(0);
      } finally {
        setLoadingIcons(false);
      }
    };

    // Add a small delay to avoid searching on every keystroke
    const debounceTimer = setTimeout(searchIcons, 300);
    return () => clearTimeout(debounceTimer);
  }, [iconSearch, popularIcons]);

  const handleIconSelect = (iconName: string) => {
    onChange(`fas fa-${iconName}`);
    setShowDropdown(false);
    setIconSearch('');
    // Update the current icon for preview
    iconService.getIcon(iconName).then(icon => {
      setCurrentIcon(icon);
    }).catch(error => {
      console.error('Error loading selected icon:', error);
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setIconSearch('');
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const iconName = value.replace('fas fa-', '');

  const fieldContent = (
    <div className="relative" ref={dropdownRef}>
      <div
        className="flex items-center justify-between w-full px-3 py-2 border border-input bg-background rounded-md cursor-pointer hover:bg-accent transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <div className="flex items-center space-x-2">
          <FontAwesomeIcon 
            icon={currentIcon} 
            className="w-4 h-4" 
            style={{ color }}
          />
          <span className="text-sm">{iconName}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </div>
      
      {showDropdown && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-popover border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          <div className="p-3">
            <Input
              placeholder="Search icons... (e.g., heart, user, star)"
              value={iconSearch}
              onChange={(e) => setIconSearch(e.target.value)}
              className="mb-3"
              autoFocus
            />
            <div className="text-xs text-muted-foreground mb-2">
              {loadingIcons ? 'Searching icons...' : 
               isSearching ? 
                 `${displayedIcons.length} icons found for "${iconSearch}"` :
                 `${displayedIcons.length} popular icons • ${totalIconsCount} total icons available`}
            </div>
            <div 
              ref={scrollContainerRef}
              className="grid grid-cols-10 gap-1 overflow-y-auto pr-2"
              style={{ 
                height: (() => {
                  const iconsPerRow = 10;
                  const totalRows = Math.ceil(displayedIcons.length / iconsPerRow);
                  const iconHeight = 32;
                  const gapSize = 4;
                  const calculatedHeight = totalRows * iconHeight + Math.max(0, totalRows - 1) * gapSize;
                  if (displayedIcons.length > 50 || (!isSearching && loadedIconsCount > 50)) {
                    return '240px';
                  } else if (totalRows <= 3) {
                    return `${calculatedHeight}px`;
                  } else {
                    return 'auto';
                  }
                })(),
                maxHeight: '240px',
                minHeight: (() => {
                  if (displayedIcons.length > 50 || (!isSearching && loadedIconsCount > 50)) {
                    return '240px';
                  }
                  return 'auto';
                })()
              }}
              onScroll={handleIconScroll}
            >
              {loadingIcons ? (
                <div className="col-span-10 text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              ) : (
                <>
                  {displayedIcons.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      onClick={() => handleIconSelect(item.name)}
                      className="w-8 h-8 text-sm hover:bg-accent rounded-md transition-colors flex items-center justify-center"
                      title={item.name}
                    >
                      <FontAwesomeIcon icon={item.icon} />
                    </button>
                  ))}
                  {loadingMoreIcons && (
                    <div className="col-span-10 text-center py-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                    </div>
                  )}
                </>
              )}
            </div>
            {!loadingIcons && !isSearching && loadedIconsCount < totalIconsCount && (
              <div className="text-xs text-muted-foreground mt-2 text-center">
                Scroll down to load more icons ({loadedIconsCount} of {totalIconsCount} loaded)
              </div>
            )}
            {!loadingIcons && displayedIcons.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                {iconSearch.trim() ? 'No icons found. Try different search terms.' : 'No popular icons available.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (label) {
    return (
      <div className={`grid grid-cols-4 items-center gap-4 ${className}`}>
        <Label htmlFor={id} className="text-right">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="col-span-3">
          {fieldContent}
        </div>
      </div>
    );
  }

  return fieldContent;
}

export default IconPicker;
