export interface Broadcast {
  id: number;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  recipient_selection_type: 'manual' | 'role_based' | 'team_based' | 'mixed';
  recipient_config: {
    manual_user_ids?: number[];
    roles?: string[];
    teams?: number[];
    departments?: string[];
  };
  total_recipients: number;
  total_acknowledged: number;
  progress_percentage: number;
  due_date: string | null;
  reminder_interval_hours: number;
  last_reminder_sent_at: string | null;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_by: number;
  workspace_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface BroadcastAcknowledgment {
  id: number;
  broadcast_id: number;
  user_id: number;
  status: 'pending' | 'acknowledged' | 'dismissed';
  acknowledged_at: string | null;
  comment: string | null;
  notified_at: string | null;
  reminder_count: number;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BroadcastFormData {
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  recipient_selection_type: 'manual' | 'role_based' | 'team_based' | 'mixed';
  recipient_config: {
    manual_user_ids?: number[];
    roles?: string[];
    teams?: number[];
    departments?: string[];
  };
  due_date?: string;
  reminder_interval_hours?: number;
  workspace_id?: number;
  status?: 'draft' | 'active';
}

export interface AcknowledgeBroadcastRequest {
  comment?: string;
}
