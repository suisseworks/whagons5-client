import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Users, Key, Mail, BarChart3, Settings, HelpCircle, FileText } from "lucide-react";

interface PromptButton {
  label: string;
  prompt: string;
}

const topicButtons = [
  { label: "Tasks", id: "tasks", icon: FileText },
  { label: "Settings", id: "settings", icon: Settings },
  { label: "Teams", id: "teams", icon: Users },
  { label: "Help", id: "help", icon: HelpCircle },
];

const promptSuggestionsByTopic: Record<string, PromptButton[]> = {
  tasks: [
    {
      label: "How do I create a new task?",
      prompt: "How do I create a new task?",
    },
    {
      label: "How can I filter tasks by status?",
      prompt: "How can I filter tasks by status?",
    },
    {
      label: "What are SLAs and how do they work?",
      prompt: "What are SLAs and how do they work?",
    },
    {
      label: "How do I assign tasks to team members?",
      prompt: "How do I assign tasks to team members?",
    },
  ],
  settings: [
    {
      label: "How do I configure statuses?",
      prompt: "How do I configure statuses?",
    },
    {
      label: "Show me templates best practices",
      prompt: "Show me templates best practices",
    },
    {
      label: "Where can I manage teams?",
      prompt: "Where can I manage teams?",
    },
    {
      label: "How do I customize my workspace?",
      prompt: "How do I customize my workspace?",
    },
  ],
  teams: [
    {
      label: "How do I add team members?",
      prompt: "How do I add team members?",
    },
    {
      label: "How do I manage team permissions?",
      prompt: "How do I manage team permissions?",
    },
    {
      label: "What are team roles?",
      prompt: "What are team roles?",
    },
  ],
  help: [
    {
      label: "What can you do?",
      prompt: "What can you do?",
    },
    {
      label: "Keyboard shortcuts",
      prompt: "Keyboard shortcuts",
    },
    {
      label: "How do I get started?",
      prompt: "How do I get started?",
    },
  ],
};

interface NewChatProps {
  onPromptClick: (prompt: string) => void;
}

const NewChat: React.FC<NewChatProps> = ({ onPromptClick }) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const currentPrompts = useMemo(() => {
    const selectedTopicId = topicButtons[selectedTab].id;
    return promptSuggestionsByTopic[selectedTopicId] || [];
  }, [selectedTab]);

  return (
    <div className="flex flex-col w-full px-4 sm:px-0 max-w-[600px] mx-auto">
      <h1 className="text-3xl md:text-4xl font-semibold mb-8 text-left bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
        How can I help you today?
      </h1>

      <div className="w-full mb-8">
        <div className="flex flex-wrap gap-3 justify-start">
          {topicButtons.map((topic, index) => {
            const IconComponent = topic.icon;
            return (
              <Button
                key={topic.id}
                variant="outline"
                className={`h-auto min-h-[40px] px-4 py-2 text-center justify-center whitespace-nowrap flex items-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedTab === index
                    ? 'bg-card border border-border/40 shadow-sm'
                    : 'bg-transparent hover:bg-card/30'
                }`}
                onClick={() => setSelectedTab(index)}
              >
                <IconComponent size={16} />
                {topic.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="w-full">
        <div className="space-y-0">
          {currentPrompts.map((promptItem, index) => (
            <div key={index}>
              <button
                className="w-full text-left p-4 bg-transparent hover:bg-card/20 transition-colors duration-200 text-base font-medium rounded-xl"
                onClick={() => onPromptClick(promptItem.prompt)}
              >
                {promptItem.label}
              </button>
              {index < currentPrompts.length - 1 && (
                <div className="border-b border-border/10 mx-2 my-1"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewChat;
