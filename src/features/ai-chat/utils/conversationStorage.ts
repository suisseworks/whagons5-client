import { Message } from "../models";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

const STORAGE_KEY = "assistant:conversations";
const MESSAGES_STORAGE_PREFIX = "assistant:messages:";

/**
 * Get all saved conversations
 */
export function getConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const conversations = JSON.parse(stored) as Conversation[];
    
    // Deduplicate by ID, keeping the most recent version
    const conversationMap = new Map<string, Conversation>();
    for (const conv of conversations) {
      const existing = conversationMap.get(conv.id);
      if (!existing || new Date(conv.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        conversationMap.set(conv.id, conv);
      }
    }
    
    // Update messageCount from actual stored messages and save if changed
    const deduplicated = Array.from(conversationMap.values());
    let needsSave = false;
    for (const conv of deduplicated) {
      const messages = loadMessages(conv.id);
      const actualCount = messages.length;
      if (conv.messageCount !== actualCount) {
        conv.messageCount = actualCount;
        needsSave = true;
      }
    }
    
    // Save updated counts if they changed
    if (needsSave) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
      } catch (e) {
        console.error("Failed to save updated message counts:", e);
      }
    }
    
    // Sort by updatedAt descending (most recent first)
    return deduplicated.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error("Failed to load conversations:", error);
    return [];
  }
}

/**
 * Save a conversation metadata
 */
export function saveConversation(conversation: Conversation): void {
  try {
    // Get conversations directly from storage to avoid recursion
    const stored = localStorage.getItem(STORAGE_KEY);
    const conversations: Conversation[] = stored ? JSON.parse(stored) : [];
    
    const existingIndex = conversations.findIndex(c => c.id === conversation.id);
    
    if (existingIndex >= 0) {
      // Merge with existing, keeping the earlier createdAt
      conversations[existingIndex] = {
        ...conversation,
        createdAt: conversations[existingIndex].createdAt,
      };
    } else {
      conversations.push(conversation);
    }
    
    // Deduplicate before saving
    const uniqueConversations = Array.from(
      new Map(conversations.map(c => [c.id, c])).values()
    );
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueConversations));
  } catch (error) {
    console.error("Failed to save conversation:", error);
  }
}

/**
 * Delete a conversation
 */
export function deleteConversation(conversationId: string): void {
  try {
    const conversations = getConversations();
    const filtered = conversations.filter(c => c.id !== conversationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    
    // Also delete the messages
    localStorage.removeItem(`${MESSAGES_STORAGE_PREFIX}${conversationId}`);
  } catch (error) {
    console.error("Failed to delete conversation:", error);
  }
}

/**
 * Save messages for a conversation
 */
export function saveMessages(conversationId: string, messages: Message[]): void {
  try {
    localStorage.setItem(
      `${MESSAGES_STORAGE_PREFIX}${conversationId}`,
      JSON.stringify(messages)
    );
    
    // Update conversation metadata
    const conversation = getConversation(conversationId);
    if (conversation) {
      const firstUserMessage = messages.find(m => m.role === "user");
      let title = "New conversation";
      
      if (firstUserMessage) {
        if (typeof firstUserMessage.content === "string") {
          title = firstUserMessage.content.trim().slice(0, 50);
        } else if (Array.isArray(firstUserMessage.content)) {
          // Extract text from ContentItem array
          const textItem = firstUserMessage.content.find(
            item => typeof item.content === "string"
          );
          if (textItem && typeof textItem.content === "string") {
            title = textItem.content.trim().slice(0, 50);
          }
        }
      }
      
      saveConversation({
        ...conversation,
        title: title.length > 50 ? `${title}...` : title || "New conversation",
        updatedAt: new Date().toISOString(),
        messageCount: messages.length,
      });
    }
  } catch (error) {
    console.error("Failed to save messages:", error);
  }
}

/**
 * Load messages for a conversation
 */
export function loadMessages(conversationId: string): Message[] {
  try {
    const stored = localStorage.getItem(`${MESSAGES_STORAGE_PREFIX}${conversationId}`);
    if (!stored) return [];
    return JSON.parse(stored) as Message[];
  } catch (error) {
    console.error("Failed to load messages:", error);
    return [];
  }
}

/**
 * Get a specific conversation
 */
export function getConversation(conversationId: string): Conversation | null {
  const conversations = getConversations();
  return conversations.find(c => c.id === conversationId) || null;
}

/**
 * Create a new conversation
 */
export function createConversation(id: string, title: string = "New conversation"): Conversation {
  // Check if conversation already exists
  const existing = getConversation(id);
  if (existing) {
    // Update title if provided and different
    if (title !== "New conversation" && title !== existing.title) {
      saveConversation({
        ...existing,
        title,
        updatedAt: new Date().toISOString(),
      });
      return getConversation(id)!;
    }
    return existing;
  }
  
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
  saveConversation(conversation);
  return conversation;
}
