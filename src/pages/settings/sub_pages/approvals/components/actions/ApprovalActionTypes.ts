import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faTag,
  faMinusCircle,
  faArrowRightArrowLeft,
  faTasks,
  faUser,
  faEdit,
  faEnvelope,
  faComment,
  faBullhorn,
  faLink,
} from '@fortawesome/free-solid-svg-icons';

export type ApprovalActionType = 
  | 'add_tags'
  | 'remove_tags'
  | 'change_status'
  | 'create_task'
  | 'assign_user'
  | 'update_field'
  | 'send_email'
  | 'create_board_message'
  | 'create_broadcast'
  | 'send_webhook';

export interface ApprovalAction {
  action: ApprovalActionType;
  enabled: boolean;
  order: number;
  config: Record<string, any>;
}

export interface ActionTypeSchema {
  type: ApprovalActionType;
  label: string;
  description: string;
  config_schema: Record<string, any>;
}

export const ACTION_TYPE_LABELS: Record<ApprovalActionType, string> = {
  add_tags: 'Add Tags',
  remove_tags: 'Remove Tags',
  change_status: 'Change Status',
  create_task: 'Create Task',
  assign_user: 'Assign User',
  update_field: 'Update Field',
  send_email: 'Send Email',
  create_board_message: 'Create Board Message',
  create_broadcast: 'Create Broadcast',
  send_webhook: 'Send Webhook',
};

export const ACTION_TYPE_ICONS: Record<ApprovalActionType, IconDefinition> = {
  add_tags: faTag,
  remove_tags: faMinusCircle,
  change_status: faArrowRightArrowLeft,
  create_task: faTasks,
  assign_user: faUser,
  update_field: faEdit,
  send_email: faEnvelope,
  create_board_message: faComment,
  create_broadcast: faBullhorn,
  send_webhook: faLink,
};

export const ACTION_TYPE_COLORS: Record<ApprovalActionType, string> = {
  add_tags: 'text-green-600',
  remove_tags: 'text-red-600',
  change_status: 'text-blue-600',
  create_task: 'text-purple-600',
  assign_user: 'text-orange-600',
  update_field: 'text-blue-500',
  send_email: 'text-blue-600',
  create_board_message: 'text-cyan-600',
  create_broadcast: 'text-amber-600',
  send_webhook: 'text-indigo-600',
};

