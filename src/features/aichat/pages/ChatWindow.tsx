import React, { useState, useRef, useEffect, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import WaveIcon from './WaveIcon';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

import Prism from 'prismjs';
// import 'prismjs/components/prism-python'
import './index.css';
import { Message } from '../models/models';
import useColorMode from '@/hooks/useColorMode';

const HOST = import.meta.env.VITE_CHAT_HOST;

// Client-side language registry
const loadedLanguages: { [key: string]: boolean } = {
  markup: true,     // HTML, XML, SVG, MathML...
  HTML: true,
  XML: true,
  SVG: true,
  MathML: true,
  SSML: true,
  Atom: true,
  RSS: true,
  css: true,
  'c-like': true,
  javascript: true,  // IMPORTANT: Use 'javascript' not 'js'
};

// Function to dynamically fetch and load a language
const loadLanguage = async (language: string) => {
  if (loadedLanguages[language]) {
    return; // Already loaded
  }

  try {
    const response = await fetch(`${HOST}/api/prism-language?name=${language}`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch language "${language}": ${response.status}`,
      );
    }
    const scriptText = await response.text();

    console.log("Script: ", language)
    // console.log(scriptText);

    // Execute the script.  Important: This is where the Prism component is registered.
    eval(scriptText); // VERY CAREFUL.  See security notes below.

    loadedLanguages[language] = true;
    console.log(`Language "${language}" loaded successfully.`);
    Prism.highlightAll();
  } catch (error) {
    console.error(`Error loading language "${language}":`, error);
    // Consider a fallback (e.g., plain text highlighting)
  }
};

function CustomPre({ children }: any) {
  const [copied, setCopied] = useState(false);
  const codeContent = children?.props?.children?.toString() || '';
  const language = children?.props?.className?.replace('language-', '') || '';

  useEffect(() => {
    console.log(language, " detected")
    if (language && !loadedLanguages[language]) {
      loadLanguage(language); // Load the language if it's not already loaded.
    }
  }, [language]);


  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-gray-100 border border-gray-300 rounded-lg my-4 dark:bg-gray-800 dark:border-gray-600">
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
          className={`icon icon-tabler icons-tabler-outline icon-tabler-copy transition-all duration-200 ${copied ? 'scale-75' : 'scale-100'}`}
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
          <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
        </svg>
        <span
          className={`transition-all duration-200 ${copied ? 'text-sm' : 'text-xs'} dark:text-gray-400`}
        >
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </button>
      <pre className="overflow-x-auto dark:text-gray-100">{children}</pre>
    </div>
  );
}

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatHistory {
  store: Record<string, ChatMessage[]>;
  class_name: string;
}

interface Chat {
  chat_id: string;
  collection: string;
  chat_history: ChatHistory;
}

interface Props {
  userId: string;
  chats: Chat[];
  selectedChat: string;
}

function ChatWindow() {
  const [colorMode, setColorMode] = useColorMode();
  const [gettingResponse, setGettingResponse] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [chatId, setChatId] = useState<string>('123456');
  const user_id = 'gabriel';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    scrollToBottom();
    Prism.highlightAll();
  }, [messages]);

  //   //when chats load set messages
  useEffect(() => {
    // load messages based on chat_id 123 and user_id random
    (async () => {
      await fetchMessageHistory();

      Prism.highlightAll();
    })();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (gettingResponse) return;

    if (input.trim()) {
      const newMessage: Message = {
        role: 'user',
        content: input,
      };

      setInput('');

      messages.push(newMessage);
      scrollToBottom();

      const url = new URL(`${HOST}/chat`);
      url.searchParams.append('chat_id', chatId);
      url.searchParams.append('user_id', user_id);
      url.searchParams.append('message', input);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let assistantMessage: Message = {
          role: 'assistant',
          content: '',
        };
        messages.push(assistantMessage);
        let buffer = '';

        try {
          // Added a try...finally block
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? ''; //Keep incomplete line, default to empty string if undefined

            for (const line of lines) {
              if (line.trim() !== '') {
                //Skip empty lines
                try {
                  const parsedObject = JSON.parse(line);
                  // console.log(line);
                  // console.log('Parsed JSON object', parsedObject.content);

                  // Access content correctly (adjust if your structure is different)
                  (assistantMessage.content as String) = parsedObject.content;
                  const updatedMessages = [...messages];
                  updatedMessages[updatedMessages.length - 1] =
                    assistantMessage;
                  setMessages(updatedMessages);
                } catch (error) {
                  if (error instanceof SyntaxError) {
                    console.log(
                      'Waiting for more data. Partial chunk received.',
                    );
                  } else {
                    console.error('Error parsing JSON:', error);
                  }
                }
              }
            }
          }
        } finally {
          // Ensure the reader is always released, even if an error occurs.
          reader.releaseLock();
        }
        //Handle any remaining data.
        if (buffer.trim() !== '') {
          try {
            const parsedObject = JSON.parse(buffer);
            // console.log('Received and parsed:', parsedObject);
            if (
              parsedObject &&
              parsedObject.parts &&
              Array.isArray(parsedObject.parts) &&
              parsedObject.parts[0] &&
              parsedObject.parts[0].content
            ) {
              assistantMessage.content += parsedObject.parts[0].content; // Append, don't overwrite
            }
            const updatedMessages = [...messages, newMessage, assistantMessage];
            setMessages(updatedMessages);
          } catch (error) {
            console.error('Error parsing JSON line:', error, 'Line:', buffer);
          }
        }
      } catch (error) {
        console.error('Error sending messages:', error);
      }
      // console.log(messages);

      setGettingResponse(false);
    }
  };

  const fetchMessageHistory = async () => {
    const url = new URL(`${HOST}/chat/history`);
    url.searchParams.append('chat_id', chatId);
    url.searchParams.append('user_id', user_id);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // console.log(data);
      setMessages(data.chat_history);
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
  };

  const handleFileAttachment = () => {
    console.log('File attachment initiated');
  };

  const toggleListening = () => {
    if (input.trim() === '') {
      setIsListening(!isListening);
    } else {
      handleSubmit({ preventDefault: () => {} } as FormEvent); // Mock event object
    }
  };

  return (
    <div className="Chat-Container">
      <h1>AI Chat Window</h1>
      <div className="chat-window">
        {isListening ? (
          // <AudioCircle onClose={() => setIsListening(false)} />
          <></>
        ) : (
          <>
            <div className="chat-messages">
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  {message.role === 'user'
                    ? (message.content as string)
                    : message.role === 'assistant' && (
                        <ReactMarkdown
                          components={{
                            pre: CustomPre,
                          }}
                          children={message.content as string}
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                        />
                      )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="chat-input">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
              />
              <div className="button-container">
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleFileAttachment}
                >
                  <i className="fas fa-paperclip"></i>
                </button>
                <button
                  type="button"
                  className="icon-button main-action"
                  onClick={toggleListening}
                >
                  {input.trim() === '' ? (
                    <WaveIcon />
                  ) : (
                    <i className="fas fa-paper-plane"></i>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ChatWindow;

// function CustomPre({ children }: any) {
//   const [copied, setCopied] = useState(false);

//   // Extract code content (children will be the <code> block)
//   const codeContent = children?.props?.children?.toString() || '';

//   const handleCopy = () => {
//     navigator.clipboard.writeText(codeContent);
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   };

//   return (
//     <div className="relative bg-gray-100 border border-gray-300 rounded-lg my-4 dark:bg-gray-800 dark:border-gray-600">
//       <button
//         onClick={handleCopy}
//         className="absolute top-2 right-2 text-gray-600 text-xs p-2 rounded hover:text-gray-800 transition flex items-center gap-1 dark:text-gray-400 dark:hover:text-gray-200"
//       >
//         <svg
//           xmlns="http://www.w3.org/2000/svg"
//           width="18"
//           height="18"
//           viewBox="0 0 24 24"
//           fill="none"
//           stroke="currentColor"
//           strokeWidth="2"
//           strokeLinecap="round"
//           strokeLinejoin="round"
//           className={`icon icon-tabler icons-tabler-outline icon-tabler-copy transition-all duration-200 ${copied ? 'scale-75' : 'scale-100'}`}
//         >
//           <path stroke="none" d="M0 0h24v24H0z" fill="none" />
//           <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
//           <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
//         </svg>
//         <span
//           className={`transition-all duration-200 ${copied ? 'text-sm' : 'text-xs'} dark:text-gray-400`}
//         >
//           {copied ? 'Copied!' : 'Copy'}
//         </span>
//       </button>
//       <pre className="overflow-x-auto dark:text-gray-100">{children}</pre>
//     </div>
//   );
// }
