import { useEffect, useState, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

interface JsonSyntaxHighlighterProps {
  content: any;
}

const JsonSyntaxHighlighter: React.FC<JsonSyntaxHighlighterProps> = ({ content }) => {
  const [highlighted, setHighlighted] = useState('');

  const formattedContent = useMemo(() => {
    try {
      if (typeof content === 'string') {
        return content;
      }
      return JSON.stringify(content, null, 2);
    } catch (e) {
      console.error("Error formatting JSON:", e);
      return String(content);
    }
  }, [content]);

  useEffect(() => {
    const applyHighlighting = () => {
      if (formattedContent && Prism.languages.json) {
        const html = Prism.highlight(formattedContent, Prism.languages.json, 'json');
        setHighlighted(html);
      } else {
        setHighlighted(formattedContent || '');
      }
    };

    applyHighlighting();
  }, [formattedContent]);

  return (
    <pre className="overflow-auto max-h-[400px] rounded-md bg-muted p-2 text-xs scrollbar-visible">
      <code 
        className="language-json"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
};

export default JsonSyntaxHighlighter;
