import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { Tag } from '@/store/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faTag } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

interface TagsConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  actionType?: 'add_tags' | 'remove_tags';
}

export function TagsConfigForm({ config, onChange, actionType = 'add_tags' }: TagsConfigFormProps) {
  const tags = useSelector((s: RootState) => s.tags?.value ?? []) as Tag[];
  const tagIds = config.tag_ids || [];
  const tagNames = config.tag_names || [];

  // Convert tags to MultiSelect options format
  const tagOptions = useMemo(() => {
    return tags.map((tag) => ({
      value: String(tag.id),
      label: tag.name,
      icon: () => <FontAwesomeIcon icon={faTag} />,
    }));
  }, [tags]);

  // Get currently selected tag IDs as strings for MultiSelect
  const selectedTagIds = useMemo(() => {
    return tagIds.map((id: number) => String(id));
  }, [tagIds]);

  // Handle tag selection from dropdown
  const handleTagSelectionChange = (selectedValues: string[]) => {
    const newTagIds = selectedValues.map((val) => parseInt(val, 10));
    onChange({ ...config, tag_ids: newTagIds });
  };

  const handleAddTagName = () => {
    onChange({ ...config, tag_names: [...tagNames, ''] });
  };

  const handleRemoveTagName = (index: number) => {
    const newTagNames = [...tagNames];
    newTagNames.splice(index, 1);
    onChange({ ...config, tag_names: newTagNames });
  };

  const handleTagNameChange = (index: number, value: string) => {
    const newTagNames = [...tagNames];
    newTagNames[index] = value;
    onChange({ ...config, tag_names: newTagNames });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Select Existing Tags</Label>
        <p className="text-sm text-muted-foreground mb-2">
          {actionType === 'add_tags' 
            ? 'Select tags from your existing tags in settings' 
            : 'Select tags to remove from the task'}
        </p>
        <MultiSelect
          options={tagOptions}
          defaultValue={selectedTagIds}
          onValueChange={handleTagSelectionChange}
          placeholder="Select tags..."
          searchable
          maxCount={5}
        />
      </div>

      {actionType === 'add_tags' && (
        <div>
          <Label>Or Create New Tags</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Add tags by name (will be created if they don't exist)
          </p>
          <div className="space-y-2">
            {tagNames.map((tagName: string, index: number) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={tagName}
                  onChange={(e) => handleTagNameChange(index, e.target.value)}
                  placeholder="Enter tag name"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveTagName(index)}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddTagName}>
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Add New Tag Name
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

