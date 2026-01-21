import { useEffect, useState, useRef } from "react";
import Prism from "prismjs";

interface CustomPreProps {
  children: any;
}

const CustomPre: React.FC<CustomPreProps> = (props) => {
  const [copied, setCopied] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const preRef = useRef<HTMLPreElement>(null);

  const language = () => {
    if (props.children?.props?.className) {
      return props.children.props.className.replace("language-", "");
    }
    return "";
  };

  useEffect(() => {
    const initialLang = language();
    setDetectedLanguage(initialLang);
    if (initialLang) {
      try {
        // Load Prism language if available
        if (initialLang && Prism.languages[initialLang] && preRef.current) {
          const codeElement = preRef.current.querySelector('code');
          if (codeElement) {
            Prism.highlightElement(codeElement as HTMLElement);
          }
        }
      } catch (e) {
        console.warn(`Failed to load language: ${initialLang}`, e);
      }
    }
  }, [props.children]);

  useEffect(() => {
    if (!preRef.current) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const codeElement = preRef.current?.querySelector("code");
          if (codeElement) {
            const langClass = codeElement.className;
            const lang = langClass.replace("language-", "");
            if (lang && lang !== detectedLanguage) {
              setDetectedLanguage(lang);
              try {
                if (lang && Prism.languages[lang] && preRef.current) {
                  const codeElement = preRef.current.querySelector('code');
                  if (codeElement) {
                    Prism.highlightElement(codeElement as HTMLElement);
                  }
                }
              } catch (e) {
                console.warn(`Failed to load language: ${lang}`, e);
              }
            }
          }
        }
      });
    });

    observer.observe(preRef.current, { attributes: true, subtree: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
    };
  }, [detectedLanguage]);

  const handleCopy = () => {
    const codeElement = preRef.current?.querySelector("code");
    const textToCopy = codeElement?.textContent || "";
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-gray-100 border border-gray-300 rounded-lg my-4 dark:bg-gray-800 dark:border-gray-600 p-0 m-0">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 text-gray-600 text-xs p-2 rounded hover:text-gray-800 transition flex items-center gap-1 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`icon icon-tabler icons-tabler-outline icon-tabler-copy transition-all duration-200 ${
            copied ? "scale-75" : "scale-100"
          }`}
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
          <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
        </svg>
        <span
          className={`transition-all duration-200 ${
            copied ? "text-sm" : "text-xs"
          } dark:text-gray-400`}
        >
          {copied ? "Copied!" : "Copy"}
        </span>
      </button>
      <pre ref={preRef} className="overflow-x-auto dark:text-gray-100 p-4 whitespace-pre-wrap break-words !rounded-lg !m-0 scrollbar">
        {props.children}
      </pre>
    </div>
  );
};

export default CustomPre;
