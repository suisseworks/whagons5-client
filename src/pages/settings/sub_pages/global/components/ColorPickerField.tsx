import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convert } from "colorizr";
import Color from "color";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerOutput,
} from "@/components/ui/shadcn-io/color-picker";
import { cn } from "@/lib/utils";
import { ColorPickerFieldProps } from "../types";

export const ColorPickerField = ({ label, value, onChange, id, allowGradients = true }: ColorPickerFieldProps) => {
  const [open, setOpen] = useState(false);
  const isInternalUpdateRef = useRef(false);
  
  // Detect if value is a gradient
  const isGradient = useMemo(() => {
    return allowGradients && value && value.startsWith('linear-gradient');
  }, [value, allowGradients]);

  // Parse gradient string to extract colors and angle
  const parseGradient = useCallback((gradientStr: string | undefined) => {
    if (!gradientStr || !gradientStr.startsWith('linear-gradient')) {
      return null;
    }
    
    // Match linear-gradient(angle, color1, color2)
    const match = gradientStr.match(/linear-gradient\((\d+)deg,\s*(.+?),\s*(.+?)\)/);
    if (match) {
      return {
        angle: parseInt(match[1], 10),
        startColor: match[2].trim(),
        endColor: match[3].trim()
      };
    }
    
    return null;
  }, []);

  // Get solid color value (extract from gradient or use value directly)
  const solidColorValue = useMemo(() => {
    if (isGradient) {
      const parsed = parseGradient(value);
      return parsed?.startColor || '#000000';
    }
    return value || '#000000';
  }, [value, isGradient, parseGradient]);

  // Convert OKLCH or hex to hex using colorizr, then to Color object for ColorPicker
  const colorValue = useMemo(() => {
    try {
      const inputValue = solidColorValue;
      let hexValue: string;
      
      // If it's already hex, use it directly
      if (inputValue.startsWith('#')) {
        hexValue = inputValue;
      } else {
        // Convert from OKLCH (or other format) to hex using colorizr
        try {
          hexValue = convert(inputValue, 'hex');
        } catch {
          // Fallback to default if conversion fails
          hexValue = '#000000';
        }
      }
      
      // Convert hex to Color object for ColorPicker component
      return Color(hexValue);
    } catch {
      return Color('#000000');
    }
  }, [solidColorValue]);

  // Get hex value for display using colorizr
  const displayHex = useMemo(() => {
    try {
      const inputValue = solidColorValue;
      if (inputValue.startsWith('#')) {
        return inputValue;
      }
      // Convert from OKLCH to hex using colorizr
      try {
        return convert(inputValue, 'hex');
      } catch {
        return '#000000';
      }
    } catch {
      return '#000000';
    }
  }, [solidColorValue]);

  // Gradient state
  const gradientData = useMemo(() => {
    if (isGradient) {
      const parsed = parseGradient(value);
      if (parsed) {
        return parsed;
      }
    }
    return {
      startColor: solidColorValue,
      endColor: solidColorValue,
      angle: 130
    };
  }, [value, isGradient, solidColorValue, parseGradient]);

  const [startColor, setStartColor] = useState(gradientData.startColor);
  const [endColor, setEndColor] = useState(gradientData.endColor);
  const [angle, setAngle] = useState(gradientData.angle);
  const [mode, setMode] = useState<'solid' | 'gradient'>(
    allowGradients && isGradient ? 'gradient' : 'solid'
  );

  // Update local state when value prop changes (but not if it's our own update)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    
    if (allowGradients && isGradient) {
      const parsed = parseGradient(value);
      if (parsed) {
        setStartColor(parsed.startColor);
        setEndColor(parsed.endColor);
        setAngle(parsed.angle);
        setMode('gradient');
      }
    } else {
      setMode('solid');
      // If gradients not allowed but value is gradient, extract solid color
      if (!allowGradients && value && value.startsWith('linear-gradient')) {
        const parsed = parseGradient(value);
        if (parsed) {
          handleColorChange(Color(parsed.startColor));
        }
      }
    }
  }, [value, isGradient, parseGradient, allowGradients]);

  // Convert Color object back to OKLCH format using colorizr (brand config uses OKLCH)
  const handleColorChange = useCallback((color: Parameters<typeof Color.rgb>[0]) => {
    try {
      // ColorPicker actually passes a Color object (despite the type signature)
      // Handle both Color object and other formats
      let hex: string;
      
      if (typeof color === 'object' && color !== null && 'hex' in color) {
        // It's a Color object
        hex = (color as ReturnType<typeof Color>).hex();
      } else {
        // It's a string or array, convert to Color then hex
        const colorObj = Color(color);
        hex = colorObj.hex();
      }
      
      // Convert hex to OKLCH using colorizr to match brand config format
      try {
        const oklch = convert(hex, 'oklch');
        onChange(oklch);
      } catch (e) {
        // Fallback to hex if conversion fails
        console.warn('Failed to convert hex to OKLCH using colorizr:', hex, e);
        onChange(hex);
      }
    } catch (e) {
      console.warn('Failed to process color change:', e);
      onChange('#000000');
    }
  }, [onChange]);

  // Handle gradient color changes - use refs to avoid stale closures during drag
  const startColorRef = useRef(startColor);
  const endColorRef = useRef(endColor);
  const angleRef = useRef(angle);
  
  useEffect(() => {
    startColorRef.current = startColor;
    endColorRef.current = endColor;
    angleRef.current = angle;
  }, [startColor, endColor, angle]);

  // Helper to convert color to CSS-compatible format (hex or rgb)
  const getCssColor = useCallback((color: string): string => {
    try {
      // If it's already hex, use it
      if (color.startsWith('#')) {
        return color;
      }
      // Convert OKLCH to hex for CSS compatibility
      try {
        return convert(color, 'hex');
      } catch {
        // If conversion fails, try to use as-is (might be rgb or other format)
        return color;
      }
    } catch {
      return '#000000';
    }
  }, []);

  const handleGradientColorChange = useCallback((color: Parameters<typeof Color.rgb>[0], which: 'start' | 'end') => {
    try {
      let hex: string;
      
      if (typeof color === 'object' && color !== null && 'hex' in color) {
        hex = (color as ReturnType<typeof Color>).hex();
      } else {
        hex = Color(color).hex();
      }
      
      try {
        const oklch = convert(hex, 'oklch');
        // Store OKLCH for internal state, convert to CSS-compatible format for gradient
        const cssNewColor = getCssColor(oklch);
        
        if (which === 'start') {
          const newStartColor = oklch;
          setStartColor(newStartColor);
          startColorRef.current = newStartColor;
          const cssEndColor = getCssColor(endColorRef.current);
          isInternalUpdateRef.current = true;
          // Use CSS-compatible colors in gradient string: start, end
          const gradientStr = `linear-gradient(${angleRef.current}deg, ${cssNewColor}, ${cssEndColor})`;
          onChange(gradientStr);
        } else {
          const newEndColor = oklch;
          setEndColor(newEndColor);
          endColorRef.current = newEndColor;
          const cssStartColor = getCssColor(startColorRef.current);
          isInternalUpdateRef.current = true;
          // Use CSS-compatible colors in gradient string: start, end
          const gradientStr = `linear-gradient(${angleRef.current}deg, ${cssStartColor}, ${cssNewColor})`;
          onChange(gradientStr);
        }
      } catch {
        // Fallback to hex
        const cssNewColor = hex;
        
        if (which === 'start') {
          const newStartColor = hex;
          setStartColor(newStartColor);
          startColorRef.current = newStartColor;
          const cssEndColor = getCssColor(endColorRef.current);
          isInternalUpdateRef.current = true;
          const gradientStr = `linear-gradient(${angleRef.current}deg, ${cssNewColor}, ${cssEndColor})`;
          onChange(gradientStr);
        } else {
          const newEndColor = hex;
          setEndColor(newEndColor);
          endColorRef.current = newEndColor;
          const cssStartColor = getCssColor(startColorRef.current);
          isInternalUpdateRef.current = true;
          const gradientStr = `linear-gradient(${angleRef.current}deg, ${cssStartColor}, ${cssNewColor})`;
          onChange(gradientStr);
        }
      }
    } catch (e) {
      console.warn('Failed to process gradient color change:', e);
    }
  }, [onChange, getCssColor]);

  // Handle angle change
  const handleAngleChange = useCallback((newAngle: number) => {
    setAngle(newAngle);
    angleRef.current = newAngle;
    isInternalUpdateRef.current = true;
    // Convert colors to CSS-compatible format
    const cssStartColor = getCssColor(startColorRef.current);
    const cssEndColor = getCssColor(endColorRef.current);
    const gradientStr = `linear-gradient(${newAngle}deg, ${cssStartColor}, ${cssEndColor})`;
    onChange(gradientStr);
  }, [onChange, getCssColor]);

  // Get hex for gradient colors
  const getGradientHex = useCallback((color: string): string => {
    try {
      if (color.startsWith('#')) {
        return color;
      }
      return convert(color, 'hex');
    } catch {
      return '#000000';
    }
  }, []);

  const startHex = useMemo(() => getGradientHex(startColor), [startColor, getGradientHex]);
  const endHex = useMemo(() => getGradientHex(endColor), [endColor, getGradientHex]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              "w-full h-10 justify-start text-left font-normal p-0 overflow-hidden",
              "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {mode === 'gradient' ? (
              <div
                className="w-full h-full flex items-center justify-between px-3"
                style={{
                  background: value || `linear-gradient(130deg, ${getCssColor(startColor)}, ${getCssColor(endColor)})`
                }}
              >
                <span className="text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  Gradient {angle}°
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full px-3">
                <div
                  className="h-5 w-5 rounded border border-border"
                  style={{ backgroundColor: displayHex }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {displayHex}
                </span>
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-4" 
          align="start"
          onInteractOutside={(e) => {
            // Prevent popover from closing when interacting with color picker
            const target = e.target as HTMLElement;
            if (target.closest('[role="slider"]') || 
                target.closest('.cursor-crosshair') ||
                target.closest('[class*="ColorPicker"]')) {
              e.preventDefault();
            }
          }}
        >
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mode === 'solid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setMode('solid');
                  // Convert gradient to solid color (use start color)
                  if (isGradient) {
                    onChange(startColor);
                  }
                }}
                className="flex-1"
              >
                Solid
              </Button>
              <Button
                type="button"
                variant={mode === 'gradient' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setMode('gradient');
                  // Convert solid color to gradient
                  if (!isGradient) {
                    const currentColor = value || '#000000';
                    // Convert to OKLCH for storage, but use hex for gradient
                    let cssColor = currentColor;
                    try {
                      if (!currentColor.startsWith('#')) {
                        cssColor = convert(currentColor, 'hex');
                      }
                      const oklch = convert(cssColor, 'oklch');
                      setStartColor(oklch);
                      setEndColor(oklch);
                      startColorRef.current = oklch;
                      endColorRef.current = oklch;
                    } catch {
                      setStartColor(currentColor);
                      setEndColor(currentColor);
                      startColorRef.current = currentColor;
                      endColorRef.current = currentColor;
                    }
                    setAngle(130);
                    angleRef.current = 130;
                    isInternalUpdateRef.current = true;
                    // Use hex for gradient string
                    const gradientStr = `linear-gradient(130deg, ${cssColor}, ${cssColor})`;
                    onChange(gradientStr);
                  }
                }}
                className="flex-1"
              >
                Gradient
              </Button>
            </div>

            {(!allowGradients || mode === 'solid') ? (
              <div style={{ pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}>
                <ColorPicker
                  value={colorValue}
                  onChange={handleColorChange}
                  className="w-[240px]"
                >
                  <div className="space-y-3" style={{ touchAction: 'none', userSelect: 'none' }}>
                    <ColorPickerSelection 
                      className="h-[150px] rounded-md cursor-crosshair"
                    />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ColorPickerHue className="flex-1" />
                      <ColorPickerEyeDropper />
                    </div>
                    <ColorPickerAlpha />
                    <div className="flex items-center gap-2">
                      <ColorPickerFormat className="flex-1" />
                      <ColorPickerOutput />
                    </div>
                    </div>
                  </div>
                </ColorPicker>
              </div>
            ) : (
              <div className="space-y-4 w-[280px]">
                {/* Gradient Preview */}
                <div
                  className="h-20 rounded-md border"
                  style={{
                    background: `linear-gradient(${angle}deg, ${getCssColor(startColor)}, ${getCssColor(endColor)})`
                  }}
                />
                
                {/* Start Color */}
                <div className="space-y-2">
                  <Label className="text-xs">Start Color</Label>
                  <div style={{ pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}>
                    <ColorPicker
                      defaultValue={startHex}
                      onChange={(color) => handleGradientColorChange(color, 'start')}
                      className="w-full"
                    >
                      <div className="space-y-2" style={{ touchAction: 'none', userSelect: 'none' }}>
                        <ColorPickerSelection 
                      className="h-[100px] rounded-md cursor-crosshair"
                        />
                        <div className="flex items-center gap-2">
                          <ColorPickerHue className="flex-1" />
                          <ColorPickerEyeDropper />
                        </div>
                      </div>
                    </ColorPicker>
                  </div>
                </div>

                {/* End Color */}
                <div className="space-y-2">
                  <Label className="text-xs">End Color</Label>
                  <div style={{ pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}>
                    <ColorPicker
                      defaultValue={endHex}
                      onChange={(color) => handleGradientColorChange(color, 'end')}
                      className="w-full"
                    >
                      <div className="space-y-2" style={{ touchAction: 'none', userSelect: 'none' }}>
                        <ColorPickerSelection 
                      className="h-[100px] rounded-md cursor-crosshair"
                        />
                        <div className="flex items-center gap-2">
                          <ColorPickerHue className="flex-1" />
                          <ColorPickerEyeDropper />
                        </div>
                      </div>
                    </ColorPicker>
                  </div>
                </div>

                {/* Angle Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Angle</Label>
                    <span className="text-xs text-muted-foreground">{angle}°</span>
                  </div>
                  <Slider
                    value={[angle]}
                    onValueChange={([newAngle]) => handleAngleChange(newAngle)}
                    min={0}
                    max={360}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
