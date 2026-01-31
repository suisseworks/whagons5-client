import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Pencil, 
  Eraser, 
  Type, 
  Square, 
  Circle, 
  Minus,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Download,
  Upload,
  Undo,
  Redo,
  MousePointer2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/LanguageProvider';

type Tool = 'select' | 'draw' | 'erase' | 'text' | 'rectangle' | 'circle' | 'line';

interface Point {
  x: number;
  y: number;
}

interface DrawingElement {
  id: string;
  type: Tool;
  points?: Point[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  lineWidth: number;
}

interface Page {
  id: string;
  name: string;
  elements: DrawingElement[];
}

export default function WhiteboardViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [pages, setPages] = useState<Page[]>([
    { id: '1', name: 'Page 1', elements: [] }
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [tempElement, setTempElement] = useState<DrawingElement | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [history, setHistory] = useState<Page[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const currentPage = pages[currentPageIndex];

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        redrawCanvas();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Redraw canvas whenever elements change
  useEffect(() => {
    redrawCanvas();
  }, [currentPage, tempElement]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    [...currentPage.elements, tempElement].filter(Boolean).forEach((element) => {
      if (!element) return;
      drawElement(ctx, element as DrawingElement);
    });
  };

  const drawElement = (ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineWidth = element.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element.type) {
      case 'draw':
        if (element.points && element.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          element.points.forEach(point => ctx.lineTo(point.x, point.y));
          ctx.stroke();
        }
        break;

      case 'rectangle':
        if (element.x !== undefined && element.y !== undefined && element.width && element.height) {
          ctx.strokeRect(element.x, element.y, element.width, element.height);
        }
        break;

      case 'circle':
        if (element.x !== undefined && element.y !== undefined && element.width && element.height) {
          const radiusX = Math.abs(element.width) / 2;
          const radiusY = Math.abs(element.height) / 2;
          const centerX = element.x + element.width / 2;
          const centerY = element.y + element.height / 2;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;

      case 'line':
        if (element.points && element.points.length === 2) {
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          ctx.lineTo(element.points[1].x, element.points[1].y);
          ctx.stroke();
        }
        break;

      case 'text':
        if (element.x !== undefined && element.y !== undefined && element.text) {
          ctx.font = `${element.lineWidth * 8}px Arial`;
          ctx.fillText(element.text, element.x, element.y);
        }
        break;
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    setIsDrawing(true);
    setStartPoint(point);

    if (currentTool === 'draw') {
      setTempElement({
        id: Date.now().toString(),
        type: 'draw',
        points: [point],
        color: currentColor,
        lineWidth
      });
    } else if (currentTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        addElement({
          id: Date.now().toString(),
          type: 'text',
          x: point.x,
          y: point.y,
          text,
          color: currentColor,
          lineWidth
        });
      }
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;
    const point = getCanvasPoint(e);

    if (currentTool === 'draw' && tempElement) {
      setTempElement({
        ...tempElement,
        points: [...(tempElement.points || []), point]
      });
    } else if (['rectangle', 'circle', 'line'].includes(currentTool)) {
      const width = point.x - startPoint.x;
      const height = point.y - startPoint.y;

      if (currentTool === 'line') {
        setTempElement({
          id: Date.now().toString(),
          type: 'line',
          points: [startPoint, point],
          color: currentColor,
          lineWidth
        });
      } else {
        setTempElement({
          id: Date.now().toString(),
          type: currentTool as Tool,
          x: startPoint.x,
          y: startPoint.y,
          width,
          height,
          color: currentColor,
          lineWidth
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (tempElement && isDrawing) {
      addElement(tempElement);
      setTempElement(null);
    }
    setIsDrawing(false);
    setStartPoint(null);
  };

  const addElement = (element: DrawingElement) => {
    const newPages = [...pages];
    newPages[currentPageIndex] = {
      ...currentPage,
      elements: [...currentPage.elements, element]
    };
    setPages(newPages);
    addToHistory(newPages);
  };

  const addToHistory = (newPages: Page[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newPages)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPages(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPages(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  const clearPage = () => {
    if (confirm('Clear this page?')) {
      const newPages = [...pages];
      newPages[currentPageIndex] = {
        ...currentPage,
        elements: []
      };
      setPages(newPages);
      addToHistory(newPages);
    }
  };

  const addPage = () => {
    const newPage: Page = {
      id: Date.now().toString(),
      name: `Page ${pages.length + 1}`,
      elements: []
    };
    const newPages = [...pages, newPage];
    setPages(newPages);
    setCurrentPageIndex(pages.length);
    addToHistory(newPages);
  };

  const deletePage = () => {
    if (pages.length === 1) {
      alert('Cannot delete the last page');
      return;
    }
    if (confirm('Delete this page?')) {
      const newPages = pages.filter((_, i) => i !== currentPageIndex);
      setPages(newPages);
      setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
      addToHistory(newPages);
    }
  };

  const exportWhiteboard = () => {
    const dataStr = JSON.stringify(pages, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `whiteboard-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importWhiteboard = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target?.result as string);
            setPages(imported);
            setCurrentPageIndex(0);
            addToHistory(imported);
          } catch (error) {
            alert('Failed to import whiteboard');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const tools = [
    { id: 'select' as Tool, icon: MousePointer2, label: 'Select' },
    { id: 'draw' as Tool, icon: Pencil, label: 'Draw' },
    { id: 'erase' as Tool, icon: Eraser, label: 'Erase' },
    { id: 'text' as Tool, icon: Type, label: 'Text' },
    { id: 'rectangle' as Tool, icon: Square, label: 'Rectangle' },
    { id: 'circle' as Tool, icon: Circle, label: 'Circle' },
    { id: 'line' as Tool, icon: Minus, label: 'Line' },
  ];

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b border-border bg-card">
        {/* Drawing Tools */}
        <div className="flex items-center gap-1 px-3 py-1 border border-border rounded-lg bg-background">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={currentTool === tool.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentTool(tool.id)}
              title={tool.label}
            >
              <tool.icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {/* Color Picker */}
        <div className="flex items-center gap-1 px-3 py-1 border border-border rounded-lg bg-background">
          {colors.map((color) => (
            <button
              key={color}
              className={cn(
                "w-6 h-6 rounded border-2 transition-all",
                currentColor === color ? 'border-primary scale-110' : 'border-muted'
              )}
              style={{ backgroundColor: color }}
              onClick={() => setCurrentColor(color)}
            />
          ))}
        </div>

        {/* Line Width */}
        <div className="flex items-center gap-2 px-3 py-1 border border-border rounded-lg bg-background">
          <span className="text-xs text-muted-foreground">Width:</span>
          <input
            type="range"
            min="1"
            max="10"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs font-medium w-6 text-right">{lineWidth}</span>
        </div>

        <div className="flex-1" />

        {/* History */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>

        {/* Page Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={clearPage} title="Clear Page">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={exportWhiteboard} title="Export">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={importWhiteboard} title="Import">
            <Upload className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 bg-white",
            currentTool === 'draw' && "cursor-crosshair",
            currentTool === 'erase' && "cursor-pointer",
            currentTool === 'text' && "cursor-text"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-center gap-2 p-4 border-t border-border bg-card">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
          disabled={currentPageIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-2">
          {pages.map((page, index) => (
            <Button
              key={page.id}
              variant={index === currentPageIndex ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentPageIndex(index)}
            >
              {page.name}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={addPage}>
            <Plus className="w-4 h-4" />
          </Button>
          {pages.length > 1 && (
            <Button variant="ghost" size="sm" onClick={deletePage}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
          disabled={currentPageIndex === pages.length - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
