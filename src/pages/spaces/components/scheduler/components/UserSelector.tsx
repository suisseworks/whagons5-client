import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, UserPlus } from "lucide-react";

interface User {
  id: number;
  name: string;
  email?: string;
  url_picture?: string | null;
  color?: string | null;
}

interface UserSelectorProps {
  availableUsers: User[];
  selectedUserIds: number[];
  onUserToggle: (userId: number) => void;
  onClearAll: () => void;
}

export default function UserSelector({
  availableUsers,
  selectedUserIds,
  onUserToggle,
  onClearAll,
}: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = availableUsers.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelected = (userId: number) => selectedUserIds.includes(userId);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Users ({selectedUserIds.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Select Users</h4>
            {selectedUserIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-auto p-1 text-xs"
              >
                Clear All
              </Button>
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search users..."
            className="w-full px-3 py-2 text-sm border rounded-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* User List */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users found
              </p>
            ) : (
              filteredUsers.map((user) => {
                const selected = isSelected(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => onUserToggle(user.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors ${
                      selected ? "bg-accent" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{
                        backgroundColor: user.color || "#6366f1",
                      }}
                    >
                      {user.url_picture ? (
                        <img
                          src={user.url_picture}
                          alt={user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        user.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{user.name}</div>
                      {user.email && (
                        <div className="text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      )}
                    </div>

                    {/* Checkmark */}
                    {selected && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="pt-2 border-t text-xs text-muted-foreground">
            {selectedUserIds.length === 0
              ? "Select users to display in scheduler"
              : `${selectedUserIds.length} user${selectedUserIds.length > 1 ? "s" : ""} selected`}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
