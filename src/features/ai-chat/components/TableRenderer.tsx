import { useMemo, useState, useEffect, useRef } from "react";

interface TableRow {
  cells: string[];
}

interface TableData {
  headers: string[];
  rows: TableRow[];
  isComplete: boolean;
}

interface TableRendererProps {
  content: string;
  isStreaming: boolean;
}

const TableRenderer: React.FC<TableRendererProps> = (props) => {
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDownloadOptions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const tableData = useMemo(() => {
    const lines = props.content.split('\n').filter(line => line.trim());

    if (lines.length < 3) {
      return null;
    }

    const headers: string[] = [];
    const rows: TableRow[] = [];
    let inTable = false;
    let headerParsed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|')
          .slice(1, -1)
          .map(cell => cell.trim());

        if (!headerParsed) {
          headers.push(...cells);
          headerParsed = true;
          inTable = true;
        } else if (inTable) {
          if (cells.every(cell => /^:?-{2,}:?$/.test(cell))) {
            continue;
          }
          rows.push({ cells });
        }
      } else if (inTable && line === '') {
        break;
      } else if (inTable) {
        break;
      }
    }

    if (headers.length === 0) {
      return null;
    }

    return {
      headers,
      rows,
      isComplete: !props.isStreaming || lines.some(line => line.trim() && !line.startsWith('|'))
    };
  }, [props.content, props.isStreaming]);

  const colWidths = useMemo(() => {
    const t = tableData;
    const headers = t?.headers ?? [];
    const rows = t?.rows ?? [];
    const colCount = headers.length;
    if (colCount === 0) return [] as string[];

    const isCompactColumn = (col: number) => {
      const header = (headers[col] || '').trim().toLowerCase();
      const headerSuggestsCompact = ['#', 'no', 'no.', 'index', 'id', 'rank'].includes(header);
      if (headerSuggestsCompact) return true;
      const sampleCount = Math.min(8, rows.length);
      if (sampleCount === 0) return false;
      let numericOrTiny = 0;
      for (let r = 0; r < sampleCount; r++) {
        const cell = String(rows[r]?.cells[col] ?? '').trim();
        if (/^\d+$/.test(cell) || cell.length <= 3) numericOrTiny++;
      }
      return numericOrTiny / sampleCount >= 0.8;
    };

    const isEmailColumn = (col: number) => {
      const header = (headers[col] || '').toLowerCase();
      if (header.includes('email')) return true;
      const sampleCount = Math.min(8, rows.length);
      for (let r = 0; r < sampleCount; r++) {
        const cell = String(rows[r]?.cells[col] ?? '').toLowerCase();
        if (cell.includes('@')) return true;
      }
      return false;
    };

    const compact: boolean[] = [];
    const weights: number[] = [];
    let totalWeight = 0;
    for (let c = 0; c < colCount; c++) {
      const isCompact = isCompactColumn(c);
      compact[c] = isCompact;
      if (isCompact) {
        weights[c] = 0;
      } else if (isEmailColumn(c)) {
        weights[c] = 2;
        totalWeight += 2;
      } else {
        weights[c] = 1;
        totalWeight += 1;
      }
    }

    const widths: string[] = new Array(colCount);
    let consumedPercent = 0;
    let lastFlexCol = -1;
    for (let c = 0; c < colCount; c++) {
      if (!compact[c]) lastFlexCol = c;
    }
    for (let c = 0; c < colCount; c++) {
      if (compact[c]) {
        widths[c] = '4rem';
      } else {
        if (totalWeight === 0) {
          widths[c] = `${Math.floor(100 / Math.max(1, colCount))}%`;
          consumedPercent += parseInt(widths[c]);
        } else {
          const pct = c === lastFlexCol
            ? Math.max(0, 100 - consumedPercent)
            : Math.floor((weights[c] / totalWeight) * 100);
          widths[c] = `${pct}%`;
          consumedPercent += pct;
        }
      }
    }
    return widths;
  }, [tableData]);

  const getMarkdownContent = () => {
    if (!tableData) return '';
    const { headers, rows } = tableData;

    let markdown = `| ${headers.join(' | ')} |\n`;
    markdown += `| ${headers.map(() => '---').join(' | ')} |\n`;

    rows.forEach(row => {
      markdown += `| ${row.cells.join(' | ')} |\n`;
    });

    return markdown;
  };

  const getCSVContent = () => {
    if (!tableData) return '';
    const { headers, rows } = tableData;

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.cells.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + '\n';
    });

    return csv;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getMarkdownContent());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error('Failed to copy table:', err);
    }
  };

  const handleDownload = (format: 'csv' | 'markdown') => {
    const content = format === 'csv' ? getCSVContent() : getMarkdownContent();
    const filename = `table.${format === 'csv' ? 'csv' : 'md'}`;
    const mimeType = format === 'csv' ? 'text/csv' : 'text/markdown';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowDownloadOptions(false);
  };

  if (!tableData) return null;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full table-fixed border-collapse border border-gray-300 dark:border-gray-600">
        <colgroup>
          {colWidths.map((w, index) => (
            <col key={index} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-gray-800/80 dark:bg-gray-800 text-white">
            {tableData.headers.map((header, index) => (
              <th key={index} className="px-6 py-4 text-left text-sm font-semibold tracking-wide truncate border border-gray-300 dark:border-gray-600">
                {header}
                {props.isStreaming && !tableData.isComplete && index === tableData.headers.length - 1 && (
                  <span className="inline-block w-2 h-3 bg-blue-400 animate-pulse ml-2 rounded"></span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {tableData.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
              {row.cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 align-top whitespace-normal break-words border border-gray-300 dark:border-gray-600">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-900/80 dark:bg-gray-900/70">
            <td colSpan={tableData.headers.length} className="px-4 py-2">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={handleCopy}
                  className="relative p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors inline-flex items-center"
                  title="Copy table as Markdown"
                >
                  <svg className={`w-4 h-4 transition-opacity ${copied ? 'opacity-0' : 'opacity-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <svg className={`w-4 h-4 absolute text-green-400 transition-opacity ${copied ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title="Download table"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>

                  {showDownloadOptions && (
                    <div className="absolute right-0 bottom-full mb-1 w-36 bg-white dark:bg-gray-700 border border-gray-200/40 dark:border-gray-600 rounded-md shadow-lg z-10">
                      <button
                        onClick={() => handleDownload('csv')}
                        className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 rounded-t-md"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSV
                      </button>
                      <button
                        onClick={() => handleDownload('markdown')}
                        className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 rounded-b-md"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Markdown
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      {props.isStreaming && !tableData.isComplete && (
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-3 flex items-center justify-center">
          <span className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </span>
          <span className="ml-2">Building table...</span>
        </div>
      )}
    </div>
  );
};

export default TableRenderer;
