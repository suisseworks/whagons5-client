import { useState, useRef } from 'react';
import { Image, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/providers/LanguageProvider';
import { useDispatch } from 'react-redux';
import { genericActions } from '@/store/genericSlices';
import { uploadFile, getFileUrl } from '@/api/assetApi';

interface PostComposerProps {
  user: {
    id: number;
    name: string;
    email?: string;
    avatar_url?: string;
  } | null;
  boardId: number;
  onPost: (data: { content: string; title?: string; is_pinned?: boolean }) => Promise<any>;
  placeholder?: string;
  isLoading?: boolean;
}

export function PostComposer({ user, boardId, onPost, placeholder, isLoading }: PostComposerProps) {
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter to images only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    // Check file size (limit to 100MB - same as backend)
    const maxSize = 100 * 1024 * 1024; // 100MB
    const validFiles = imageFiles.filter(file => {
      if (file.size > maxSize) {
        alert(`File ${file.name} exceeds the maximum limit of ${Math.round(maxSize / 1024 / 1024)}MB. Please choose a smaller file.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    // Limit to 4 images
    const filesToAdd = validFiles.slice(0, 4 - selectedImages.length);
    setSelectedImages([...selectedImages, ...filesToAdd]);

    // Create previews
    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((!content.trim() && selectedImages.length === 0) || isLoading) return;
    
    try {
      // Step 1: Create the board message first (allow empty content if images exist)
      // Send at least a space if content is empty to satisfy backend validation
      const messageContent = content.trim() || (selectedImages.length > 0 ? ' ' : '');
      console.log('Posting message with content length:', messageContent.length, 'and', selectedImages.length, 'images');
      
      let messageResult;
      try {
        messageResult = await onPost({ content: messageContent });
        console.log('Message post result:', messageResult);
        
        // Wait a tiny bit to ensure Redux state is fully updated
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error('Failed to create message:', error);
        console.error('Error details:', {
          message: error?.message,
          payload: error?.payload,
          response: error?.response?.data
        });
        // Don't clear form on error so user can retry
        alert('Failed to create message. Please try again.');
        return;
      }
      
      if (!messageResult) {
        console.error('Failed to create message - no result returned');
        alert('Failed to create message. Please try again.');
        return;
      }
      
      const messageId = messageResult?.id;
      console.log('Extracted message ID:', messageId, 'Type:', typeof messageId, 'Is positive:', messageId > 0);
      
      // Validate we have a real positive ID (not the temporary optimistic negative ID)
      if (!messageId || typeof messageId !== 'number' || messageId <= 0) {
        console.error('Invalid message ID - got temporary/optimistic ID or invalid value.');
        console.error('Full result:', JSON.stringify(messageResult, null, 2));
        console.error('This usually means the message creation failed or returned an optimistic update');
        alert('Message was created but we could not get the message ID. Please refresh the page.');
        return;
      }

      // Step 2: Upload images and create attachments
      if (selectedImages.length > 0 && user) {
        const uploadPromises = selectedImages.map(async (file) => {
          try {
            // Upload file to asset storage
            const uploadedFile = await uploadFile(file);
            const fileUrl = uploadedFile.url || getFileUrl(uploadedFile.id);
            
            // Get file extension
            const fileExtension = file.name.split('.').pop() || '';
            
            // Create board attachment
            const attachment = {
              uuid: crypto.randomUUID(),
              board_message_id: messageId,
              type: 'IMAGE' as const,
              file_path: fileUrl,
              file_name: file.name,
              file_extension: fileExtension,
              file_size: file.size,
              user_id: Number(user.id)
            };

            const attachmentResult = await dispatch(genericActions.boardAttachments.addAsync(attachment) as any).unwrap();
            console.log('Attachment created successfully:', attachmentResult);
            return true;
          } catch (error: any) {
            console.error('Failed to upload image:', error);
            console.error('Attachment error details:', {
              message: error?.message,
              payload: error?.payload,
              response: error?.response?.data,
              attachment: attachment
            });
            // Show user-friendly error
            if (error?.response?.data?.error?.includes('Tenant database not ready')) {
              alert('Your workspace is still being set up. Please wait a moment and try again.');
            }
            return false;
          }
        });
        
        // Wait for all uploads to complete
        await Promise.all(uploadPromises);
        
        // Refresh attachments from IndexedDB first (fast), then API (ensures sync)
        dispatch(genericActions.boardAttachments.getFromIndexedDB());
        await dispatch(genericActions.boardAttachments.fetchFromAPI({ board_message_id: messageId }) as any);
      }

      // Step 3: Clear form
      setContent('');
      setSelectedImages([]);
      setImagePreviews([]);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to post message:', error);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-border">
      {/* Avatar */}
      <Avatar className="size-10 ring-2 ring-background flex-shrink-0">
        {user?.avatar_url ? (
          <AvatarImage src={user.avatar_url} alt={user.name} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
          {user ? getInitials(user.name) : '??'}
        </AvatarFallback>
      </Avatar>

      {/* Input Area */}
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('boards.composer.placeholder', "What's happening?")}
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-base min-h-[24px] max-h-[300px]"
          rows={1}
        />

        {/* Image Previews */}
        {imagePreviews.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden border border-border">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-32 object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-primary"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={selectedImages.length >= 4}
            >
              <Image className="size-5" />
            </Button>
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={(!content.trim() && selectedImages.length === 0) || isLoading}
            size="sm"
            className="rounded-full px-4 font-semibold"
          >
            {isLoading 
              ? t('boards.composer.posting', 'Posting...') 
              : t('boards.composer.post', 'Post')
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PostComposer;
