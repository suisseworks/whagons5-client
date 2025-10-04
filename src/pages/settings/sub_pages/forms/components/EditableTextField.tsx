import { useState, useRef, useEffect } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBold, faItalic, faUnderline, faLink, faListOl, faListUl } from "@fortawesome/free-solid-svg-icons";
import { useClickOutside } from "./hooks/useClickOutside";

interface EditableTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function EditableTextField({ value, onChange, placeholder = "Enter text", isEditing: externalIsEditing, onEditingChange }: EditableTextFieldProps) {
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const isEditing = externalIsEditing !== undefined ? externalIsEditing : internalIsEditing;
  
  const setIsEditing = (editing: boolean) => {
    if (onEditingChange) {
      onEditingChange(editing);
    } else {
      setInternalIsEditing(editing);
    }
  };
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const divRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasEditingRef = useRef<boolean>(isEditing);

  useEffect(() => {
    if (divRef.current && !isEditing) {
      divRef.current.innerHTML = value || '';
    }
  }, [value]);

  // Ensure content is saved when editing ends due to focus moving elsewhere
  // (e.g., clicking into another editable field like the title).
  useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      if (divRef.current) {
        const content = divRef.current.innerHTML;
        onChange(content);
      }
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, onChange]);

  useEffect(() => {
    if (isEditing && divRef.current) {
      setTimeout(() => {
        if (divRef.current) {
          divRef.current.focus();
          // Move cursor to end
          const range = document.createRange();
          const sel = window.getSelection();
          if (divRef.current.childNodes.length > 0) {
            range.selectNodeContents(divRef.current);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }
      }, 0);
    }
  }, [isEditing]);

  // Update active formats when selection changes
  useEffect(() => {
    if (!isEditing) return;

    const updateFormats = () => {
      const formats: string[] = [];
      // @ts-ignore - queryCommandState is deprecated but still supported
      if (document.queryCommandState('bold')) formats.push('bold');
      // @ts-ignore - queryCommandState is deprecated but still supported
      if (document.queryCommandState('italic')) formats.push('italic');
      // @ts-ignore - queryCommandState is deprecated but still supported
      if (document.queryCommandState('underline')) formats.push('underline');
      // @ts-ignore - queryCommandState is deprecated but still supported
      if (document.queryCommandState('insertOrderedList')) formats.push('orderedList');
      // @ts-ignore - queryCommandState is deprecated but still supported
      if (document.queryCommandState('insertUnorderedList')) formats.push('unorderedList');
      setActiveFormats(formats);
    };

    const handleSelectionChange = () => {
      updateFormats();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    updateFormats();

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isEditing]);

  useClickOutside({
    isActive: isEditing,
    onOutsideClick: () => {
      if (divRef.current) {
        const content = divRef.current.innerHTML;
        onChange(content);
      }
      setIsEditing(false);
    }
  });

  const handleSave = () => {
    if (divRef.current) {
      const content = divRef.current.innerHTML;
      onChange(content);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      if (divRef.current) {
        divRef.current.innerHTML = value || '';
      }
      setIsEditing(false);
    }
  };

  const applyFormatting = (type: 'bold' | 'italic' | 'underline' | 'link' | 'orderedList' | 'unorderedList') => {
    if (!divRef.current) return;
    
    divRef.current.focus();
    
    // For lists, don't auto-select all text - lists work better line by line
    if (type !== 'orderedList' && type !== 'unorderedList') {
      // If no text is selected, select all text
      const selection = window.getSelection();
      if (selection && selection.toString().length === 0) {
        const range = document.createRange();
        range.selectNodeContents(divRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    // Note: execCommand is deprecated but still widely supported across all browsers
    // For a production app, consider using a modern rich text editor like Tiptap or Lexical
    switch (type) {
      case 'bold':
        // @ts-ignore - execCommand is deprecated but still supported
        document.execCommand('bold', false);
        break;
      case 'italic':
        // @ts-ignore - execCommand is deprecated but still supported
        document.execCommand('italic', false);
        break;
      case 'underline':
        // @ts-ignore - execCommand is deprecated but still supported
        document.execCommand('underline', false);
        break;
      case 'orderedList':
        // @ts-ignore - execCommand is deprecated but still supported
        document.execCommand('insertOrderedList', false);
        break;
      case 'unorderedList':
        // @ts-ignore - execCommand is deprecated but still supported
        document.execCommand('insertUnorderedList', false);
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          // @ts-ignore - execCommand is deprecated but still supported
          document.execCommand('createLink', false, url);
        }
        break;
    }

    // Update active formats after applying
    setTimeout(() => {
      const formats: string[] = [];
      // @ts-ignore
      if (document.queryCommandState('bold')) formats.push('bold');
      // @ts-ignore
      if (document.queryCommandState('italic')) formats.push('italic');
      // @ts-ignore
      if (document.queryCommandState('underline')) formats.push('underline');
      // @ts-ignore
      if (document.queryCommandState('insertOrderedList')) formats.push('orderedList');
      // @ts-ignore
      if (document.queryCommandState('insertUnorderedList')) formats.push('unorderedList');
      setActiveFormats(formats);
    }, 0);
  };

  return (
    <div ref={containerRef} className="relative w-full">
        <div
          className={`min-h-[3rem] flex items-center cursor-text px-3 py-2.5 rounded-md transition-all ${
            isEditing ? 'bg-muted/30 border-b-2 border-primary' : 'bg-muted/20 border-b-2 border-transparent hover:bg-muted/40'
          }`}
          onMouseDown={() => {
            setIsEditing(true);
            setTimeout(() => divRef.current?.focus(), 0);
          }}
        >
          <div
            ref={divRef}
            contentEditable={true}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              const target = e.target as HTMLDivElement;
              if (target.innerHTML === '<br>') {
                target.innerHTML = '';
              }
              // Call onChange with current innerHTML for live updates
              onChange(target.innerHTML);
            }}
            className="text-sm text-foreground bg-transparent border-none outline-none w-full min-h-[2.5rem] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50"
            data-placeholder={placeholder}
            suppressContentEditableWarning
          />
        </div>
        
        {/* Slide-out formatting toolbar */}
        <div 
          className={`formatting-toolbar overflow-hidden transition-all duration-200 ease-in-out ${
            isEditing ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex gap-1 px-2 py-2">
            <ToggleGroup type="multiple" value={activeFormats}>
              <ToggleGroupItem
                value="bold"
                size="sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatting('bold');
                }}
                title="Bold (Ctrl+B)"
              >
                <FontAwesomeIcon icon={faBold} className="h-3 w-3" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="italic"
                size="sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatting('italic');
                }}
                title="Italic (Ctrl+I)"
              >
                <FontAwesomeIcon icon={faItalic} className="h-3 w-3" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="underline"
                size="sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatting('underline');
                }}
                title="Underline (Ctrl+U)"
              >
                <FontAwesomeIcon icon={faUnderline} className="h-3 w-3" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="orderedList"
                size="sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatting('orderedList');
                }}
                title="Numbered list"
              >
                <FontAwesomeIcon icon={faListOl} className="h-3 w-3" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="unorderedList"
                size="sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatting('unorderedList');
                }}
                title="Bulleted list"
              >
                <FontAwesomeIcon icon={faListUl} className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 ml-1"
              onMouseDown={(e) => {
                e.preventDefault();
                applyFormatting('link');
              }}
              title="Insert link"
            >
              <FontAwesomeIcon icon={faLink} className="h-3 w-3" />
            </Button>
          </div>
        </div>
    </div>
  );
}

