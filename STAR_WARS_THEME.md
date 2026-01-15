# Star Wars Theme

The Star Wars theme brings the iconic look and feel of the Star Wars universe to WHagons.

## Features

- **Classic Star Wars Color Palette**: Deep space black backgrounds with Rebel Alliance blue (#4A90E2) and iconic yellow (#FFE81F) accents
- **Audiowide Font**: Bold, futuristic typography inspired by the Star Wars aesthetic
- **Glow Effects**: Subtle blue and yellow glow effects on interactive elements
- **Custom Animations**: Star Wars-inspired pulse and scroll animations
- **Full Component Support**: All UI components styled with Star Wars theming

## How to Use

### Via Theme Toggle Button

Click the theme toggle button (sun/moon/sparkles icon) in the navigation bar to cycle through themes:
- **Light** → **Dark** → **Star Wars** → **Light**

### Programmatically

```typescript
import { useTheme } from "@/providers/ThemeProvider"

function MyComponent() {
  const { setTheme } = useTheme()
  
  const enableStarWarsTheme = () => {
    setTheme("starwars")
  }
  
  return <button onClick={enableStarWarsTheme}>Enable Star Wars Theme</button>
}
```

## Color Palette

- **Background**: `#000000` (Deep space black)
- **Foreground**: `#FFE81F` (Classic Star Wars yellow)
- **Primary**: `#4A90E2` (Rebel Alliance blue)
- **Accent**: `#FFE81F` (Star Wars yellow)
- **Muted Text**: `#C5A572` (Gold/bronze)
- **Destructive**: `#DC143C` (Sith red)

## CSS Classes

### Utility Classes

- `.starwars-glow` - Blue glow effect
- `.starwars-glow-yellow` - Yellow glow effect
- `.starwars-border-glow` - Glowing border effect
- `.starwars-pulse` - Pulsing animation
- `.starwars-scroll-text` - Scrolling text animation (for special effects)

### Example Usage

```tsx
<div className="starwars-glow">
  This element has a Star Wars blue glow
</div>

<button className="starwars-pulse">
  Pulsing Star Wars button
</button>
```

## Component Styling

All components automatically adapt to the Star Wars theme when active:

- **Buttons**: Gradient backgrounds with glow effects
- **Cards**: Dark backgrounds with blue borders
- **Inputs**: Blue focus rings with glow
- **Grids**: Star Wars color scheme with blue accents
- **Sidebar**: Deep black with yellow text
- **Scrollbars**: Blue glowing scrollbars

## Font

The theme uses **Audiowide** font family, a bold futuristic sans-serif font that captures the Star Wars aesthetic. The font is automatically loaded via Google Fonts when the theme is active.

## Browser Support

The Star Wars theme works in all modern browsers that support:
- CSS Custom Properties (CSS Variables)
- CSS Grid and Flexbox
- Modern CSS animations

## Customization

To customize the Star Wars theme, edit the CSS variables in `src/index.css` under the `.starwars` selector:

```css
.starwars {
  --primary: #4A90E2; /* Change primary color */
  --foreground: #FFE81F; /* Change text color */
  /* ... other variables */
}
```

## Notes

- The theme persists across page reloads via localStorage
- The theme toggle cycles through: Light → Dark → Star Wars → Light
- System theme preference is respected when "system" is selected (but Star Wars theme must be manually selected)

