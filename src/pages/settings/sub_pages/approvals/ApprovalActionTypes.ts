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

export const ACTION_TYPE_ICONS: Record<ApprovalActionType, string> = {
  add_tags: '🏷️',
  remove_tags: '✂️',
  change_status: '🔄',
  create_task: '📝',
  assign_user: '👤',
  update_field: '✏️',
  send_email: '📧',
  create_board_message: '💬',
  create_broadcast: '📢',
  send_webhook: '🔗',
};
