import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApprovalActionType, ACTION_TYPE_LABELS, ACTION_TYPE_ICONS, ACTION_TYPE_COLORS } from './ApprovalActionTypes';

interface AddActionButtonProps {
  onSelectAction: (actionType: ApprovalActionType) => void;
}

export function AddActionButton({ onSelectAction }: AddActionButtonProps) {
  const actionTypes: ApprovalActionType[] = [
    'add_tags',
    'remove_tags',
    'change_status',
    'create_task',
    'assign_user',
    'update_field',
    'send_email',
    'create_board_message',
    'create_broadcast',
    'send_webhook',
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Add Action
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actionTypes.map((actionType) => (
          <DropdownMenuItem
            key={actionType}
            onClick={() => onSelectAction(actionType)}
            className="cursor-pointer"
          >
            <FontAwesomeIcon 
              icon={ACTION_TYPE_ICONS[actionType]} 
              className={`mr-2 ${ACTION_TYPE_COLORS[actionType]}`} 
            />
            {ACTION_TYPE_LABELS[actionType]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

