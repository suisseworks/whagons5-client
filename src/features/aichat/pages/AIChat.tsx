'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
1;
import { Ghost, Send } from 'lucide-react';
import { Message } from '../models/models';

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

function AIChat() {
  const [gettingResponse, setGettingResponse] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [collection, setCollection] = useState<string>('');
  const [chatId, setChatId] = useState<string>('123456');
  const user_id = "gabriel"

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const selectedChat: string = 'stuff';

  const scrollToBottom = async () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  //   //when chats load set messages
  useEffect(() => {
    // load messages based on chat_id 123 and user_id random
    fetchMessageHistory();
  }, []);

  const handleSend = async () => {
    if (gettingResponse) return;
    setGettingResponse(true);

    if (input.trim()) {
      const newMessage: Message = {
        role: 'user',
        content: input,
      };

      setInput('');

      messages.push(newMessage);
      await scrollToBottom();

      const url = new URL('http://127.0.0.1:8000/chat');
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
            buffer = lines.pop(); //Keep incomplete line

            for (const line of lines) {
              if (line.trim() !== '') {
                //Skip empty lines
                try {
                  const parsedObject = JSON.parse(line);
                  console.log(line)
                  console.log('Parsed JSON object', parsedObject.content);

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
            console.log('Received and parsed:', parsedObject);
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
      console.log(messages);

      setGettingResponse(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const fetchMessageHistory = async () => {
    const url = new URL('http://127.0.0.1:8000/chat/history');
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
      console.log(data);
      setMessages(data.chat_history);
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
  };

  return (
    <div className="flex max-h-full h-full w-full bg-white overflow-auto">
      <div className="flex-1 flex flex-col mr-[28px] ">
        {/* Header */}
        <header className="fixed top-0 bg-white pb-5 pt-1 pl-2 justify-left align-top w-full z-10">
          <h1 className="text-xl font-semibold">Compass</h1>
        </header>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col mx-0 sm:mx-0 md:mx-[5%] lg:mx-[20%]">
          <div className="flex-1 p-4 space-y-4 max-sm:mt-[25%] max-md:mt-[10%] max-lg:mt-[10%] mt-[10%] ">
            {messages.map((message, index) => (
              <Card
                key={index}
                className={` ${
                  message.role === 'user' ? 'ml-auto bg-blue-100' : 'bg-white'
                }`}
              >
                <div className="flex flex-col items-start">
                  {message.role === 'assistant' && (
                    <Avatar className="absolute m-2">
                      <AvatarImage
                        src="/placeholder.svg?height=40&width=40"
                        alt="AI"
                      />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className="p-4 "
                    // style={{
                    //   display: 'flex',
                    //   justifyContent:
                    //     message.role === 'user' ? 'flex-end' : 'flex-start',
                    // }}
                  >
                    {message.role === 'user'
                      ? (message.content as string)
                      : message.role === 'assistant' && (
                          <ReactMarkdown>
                            {message.content as string}
                          </ReactMarkdown>
                        )}
                  </div>
                </div>
              </Card>
            ))}
            <div ref={chatEndRef} />
          </div>
          {/*Input area **/}
          {selectedChat != '' ? (
            <div className="sticky bottom-0 left-0 right-0 p-4 border-t bg-white">
              <div className="flex space-x-2">
                <Input
                  value={input}
                  onInput={(e) =>
                    setInput((e.target as HTMLInputElement).value)
                  }
                  placeholder="Type your message here..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} variant="outline">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIChat;
