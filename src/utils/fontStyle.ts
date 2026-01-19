export type FontStyle = 'system' | 'inter' | 'roboto' | 'montserrat' | 'georgia' | 'playfair' | 'poppins' | 'raleway' | 'bebas' | 'oswald';

const FONT_STYLE_SETTING_KEY = 'wh-font-style';

const FONT_FAMILIES: Record<FontStyle, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
  inter: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  roboto: '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  montserrat: '"Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  playfair: '"Playfair Display", Georgia, serif',
  poppins: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  raleway: '"Raleway", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  bebas: '"Bebas Neue", "Arial Black", sans-serif',
  oswald: '"Oswald", "Arial Narrow", sans-serif',
};

/**
 * Get the current font style from localStorage
 */
export function getFontStyle(): FontStyle {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(FONT_STYLE_SETTING_KEY);
    const validFonts: FontStyle[] = ['system', 'inter', 'roboto', 'montserrat', 'georgia', 'playfair', 'poppins', 'raleway', 'bebas', 'oswald'];
    if (stored && validFonts.includes(stored as FontStyle)) {
      return stored as FontStyle;
    }
  } catch (error) {
    console.warn('[FontStyle] Error reading localStorage:', error);
  }
  return 'system'; // Default
}

/**
 * Set the font style in localStorage and apply it globally
 */
export function setFontStyle(style: FontStyle) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FONT_STYLE_SETTING_KEY, style);
    applyFontStyle(style);
    
    // Load Google Font if needed
    if (style === 'inter' || style === 'roboto' || style === 'montserrat' || 
        style === 'playfair' || style === 'poppins' || style === 'raleway' || 
        style === 'bebas' || style === 'oswald') {
      loadGoogleFont(style);
    }
  } catch (error) {
    console.warn('[FontStyle] Error saving to localStorage:', error);
  }
}

/**
 * Apply the font style to the document root
 */
export function applyFontStyle(style: FontStyle = getFontStyle()) {
  if (typeof document === 'undefined') return;
  
  const fontFamily = FONT_FAMILIES[style];
  document.documentElement.style.setProperty('--font-family', fontFamily);
  
  // Also apply directly to body for immediate effect
  document.body.style.fontFamily = fontFamily;
}

/**
 * Initialize font style on app load
 */
export function initFontStyle() {
  if (typeof window === 'undefined') return;
  
  // Apply font style on load
  applyFontStyle();
  
  // Load Google Fonts if needed
  const fontStyle = getFontStyle();
  if (fontStyle === 'inter' || fontStyle === 'roboto' || fontStyle === 'montserrat' || 
      fontStyle === 'playfair' || fontStyle === 'poppins' || fontStyle === 'raleway' || 
      fontStyle === 'bebas' || fontStyle === 'oswald') {
    loadGoogleFont(fontStyle);
  }
}

/**
 * Add preconnect links for Google Fonts (performance optimization)
 */
function addGoogleFontsPreconnect() {
  if (typeof document === 'undefined') return;
  
  // Check if preconnect links already exist
  if (document.querySelector('link[rel="preconnect"][href="https://fonts.googleapis.com"]')) {
    return;
  }
  
  // Add preconnect links for Google Fonts
  const preconnect1 = document.createElement('link');
  preconnect1.rel = 'preconnect';
  preconnect1.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preconnect1);
  
  const preconnect2 = document.createElement('link');
  preconnect2.rel = 'preconnect';
  preconnect2.href = 'https://fonts.gstatic.com';
  preconnect2.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect2);
}

/**
 * Load Google Font dynamically
 */
function loadGoogleFont(font: 'inter' | 'roboto' | 'montserrat' | 'playfair' | 'poppins' | 'raleway' | 'bebas' | 'oswald') {
  if (typeof document === 'undefined') return;
  
  // Add preconnect links first for better performance
  addGoogleFontsPreconnect();
  
  // Check if font is already loaded
  const existingLink = document.querySelector(`link[data-font="${font}"]`);
  if (existingLink) return;
  
  const fontUrls: Record<string, string> = {
    inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    roboto: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    montserrat: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
    playfair: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap',
    poppins: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap',
    raleway: 'https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700;800;900&display=swap',
    bebas: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
    oswald: 'https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap',
  };
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontUrls[font];
  link.setAttribute('data-font', font);
  document.head.appendChild(link);
}
