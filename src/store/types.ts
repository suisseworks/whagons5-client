export interface Workspace {
    id: number;
    name: string;
    icon: string;
    color: string;
    description: string | null;
    teams: [] | null;
    type: string;
    category_id: number | null;
    spots: [] | null;
    created_by: number;
    created_at: Date;
    updated_at: Date;
}

export interface Team {
    id: number;
    name: string;
    description: string | null;
    color: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface Category {
    id: number;
    name: string;
    description: string;
    color: string;
    icon: string;
    enabled: boolean;
    sla_id?: number | null;
    team_id: number;
    workspace_id: number;
    status_transition_group_id: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export interface Template {
    id: number;
    name: string;
    // New canonical columns per migration
    category_id: number;
    priority_id: number | null;
    sla_id: number | null;
    default_spot_id?: number | null;
    default_user_ids?: number[] | null;
    expected_duration?: number | null;
    // Legacy/previous fields kept optional for compatibility during transition
    description?: string | null;
    team_id?: number;
    workspace_id?: number;
    default_priority?: number;
    default_duration?: number;
    instructions?: string | null;
    enabled?: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface Task {
    id: number;
    name: string;
    description: string | null;
    workspace_id: number;
    category_id: number;
    team_id: number;
    template_id: number | null;
    spot_id: number | null;
    status_id: number;
    priority_id: number;
    start_date: string | null;
    due_date: string | null;
    expected_duration: number;
    response_date: string | null;
    resolution_date: string | null;
    work_duration: number;
    pause_duration: number;
    // Store responsible user IDs as JSON array for efficient storage
    // Most tasks have few responsible users, so this avoids a large junction table
    user_ids: number[] | null;
    // Approval workflow fields
    approval_metadata?: any | null; // JSON metadata for approval workflows
    approval_metadata_updated_at?: string | null; // Timestamp for approval metadata updates
    created_at: string;
    updated_at: string;
}

export interface Status {
    id: number;
    name: string;
    action: 'NONE' | 'WORKING' | 'PAUSED' | 'FINISHED';
    color?: string | null;
    icon?: string | null;
    system: boolean;
    initial: boolean;
    created_at?: string | Date;
    updated_at?: string | Date;
    deleted_at?: string | Date | null;
}

export interface Priority {
    id: number;
    name: string;
    color?: string | null;
    level?: number | null;
    category_id?: number | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface Spot {
    id: number;
    name: string;
    parent_id?: number | null;
    spot_type_id: number;
    is_branch: boolean;
    created_at?: string | Date;
    updated_at?: string | Date;
    deleted_at?: string | Date | null;
}

export interface Tag {
    id: number;
    name: string;
    color?: string | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

// High Priority - User Management & Authentication
export interface User {
    id: number;
    name: string;
    email: string;
    url_picture?: string | null;
    role_id?: number | null;
    workspace_id?: number | null;
    is_active: boolean;
    last_login_at?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface Role {
    id: number;
    name: string;
    description?: string | null;
    workspace_id?: number | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface Permission {
    id: number;
    name: string;
    description?: string | null;
    resource: string;
    action: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

// Relations & Assignments
export interface UserTeam {
    id: number;
    user_id: number;
    team_id: number;
    role_id?: number | null;
    created_at: string;
    updated_at: string;
}

export interface UserPermission {
    id: number;
    user_id: number;
    permission_id: number;
    granted_by: number;
    created_at: string;
    updated_at: string;
}

export interface RolePermission {
    id: number;
    role_id: number;
    permission_id: number;
    created_at: string;
    updated_at: string;
}

export interface TaskTag {
    id: number;
    task_id: number;
    tag_id: number;
    created_at: string;
    updated_at: string;
}

// Status & Transitions
export interface StatusTransition {
    id: number;
    status_transition_group_id: number;
    from_status: number;
    to_status: number;
    initial: boolean;
    created_at: string;
    updated_at: string;
}

export interface StatusTransitionGroup {
    id: number;
    name: string;
    description?: string | null;
    is_default: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SpotType {
    id: number;
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    workspace_id?: number | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

// SLA & Alerts
export interface Sla {
    id: number;
    name: string;
    description?: string | null;
    target_duration: number; // in minutes
    priority_id?: number | null;
    workspace_id?: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SlaAlert {
    id: number;
    sla_id: number;
    task_id: number;
    alert_type: string; // 'warning', 'breach', 'escalation'
    message: string;
    triggered_at: string;
    acknowledged_at?: string | null;
    acknowledged_by?: number | null;
    created_at: string;
    updated_at: string;
}

// Custom Fields & Values
export interface SpotCustomField {
    id: number;
    spot_id: number;
    custom_field_id: number;
    created_at: string;
    updated_at: string;
}

export interface TemplateCustomField {
    id: number;
    template_id: number;
    custom_field_id: number;
    required: boolean;
    default_value?: string | null;
    created_at: string;
    updated_at: string;
}

export interface TaskCustomFieldValue {
    id: number;
    task_id: number;
    custom_field_id: number;
    value: string;
    created_at: string;
    updated_at: string;
}

export interface SpotCustomFieldValue {
    id: number;
    spot_id: number;
    custom_field_id: number;
    value: string;
    created_at: string;
    updated_at: string;
}

// SLA & Priority Management
export interface CategoryPriority {
    id: number;
    category_id: number;
    priority_id: number;
    sla_id?: number | null;
    created_at: string;
    updated_at: string;
}

// Forms & Field Management
export interface Form {
    id: number;
    name: string;
    description?: string | null;
    workspace_id?: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface FormField {
    id: number;
    form_id: number;
    field_type: string;
    label: string;
    placeholder?: string | null;
    required: boolean;
    options?: string | null; // JSON string for select options
    validation_rules?: string | null;
    position: number;
    created_at: string;
    updated_at: string;
}

export interface FormVersion {
    id: number;
    form_id: number;
    version: number;
    schema_data: string; // JSON schema
    is_active: boolean;
    created_by: number;
    created_at: string;
    updated_at: string;
}

export interface TaskForm {
    id: number;
    task_id: number;
    form_id: number;
    form_data: string; // JSON form responses
    submitted_by: number;
    submitted_at: string;
    created_at: string;
    updated_at: string;
}

export interface FieldOption {
    id: number;
    form_field_id: number;
    label: string;
    value: string;
    position: number;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

// Activity & Logging
export interface TaskLog {
    id: number;
    task_id: number;
    user_id: number;
    action: string;
    old_values?: string | null; // JSON
    new_values?: string | null; // JSON
    created_at: string;
}

export interface SessionLog {
    id: number;
    user_id: number;
    session_token: string;
    ip_address?: string | null;
    user_agent?: string | null;
    login_at: string;
    logout_at?: string | null;
    created_at: string;
}

export interface ConfigLog {
    id: number;
    user_id: number;
    action: string;
    entity_type: string;
    entity_id: number;
    old_values?: string | null; // JSON
    new_values?: string | null; // JSON
    created_at: string;
}

// File Management
export interface TaskAttachment {
    id: number;
    task_id: number;
    filename: string;
    original_filename: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    uploaded_by: number;
    created_at: string;
    updated_at: string;
}

export interface TaskRecurrence {
    id: number;
    task_id: number;
    recurrence_pattern: string; // 'daily', 'weekly', 'monthly', etc.
    interval: number; // every N days/weeks/months
    end_date?: string | null;
    created_at: string;
    updated_at: string;
}

// Invitations & Onboarding
export interface Invitation {
    id: number;
    email: string;
    role_id?: number | null;
    workspace_id?: number | null;
    invited_by: number;
    token: string;
    expires_at: string;
    accepted_at?: string | null;
    created_at: string;
    updated_at: string;
}

// Error Tracking
export interface Exception {
    id: number;
    user_id?: number | null;
    error_message: string;
    error_code?: string | null;
    stack_trace?: string | null;
    url?: string | null;
    user_agent?: string | null;
    ip_address?: string | null;
    resolved_at?: string | null;
    resolved_by?: number | null;
    created_at: string;
}

// Workflow Management (Coming Soon)
export interface Workflow {
    id: number;
    name: string;
    description?: string | null;
    workspace_id?: number | null;
    is_active: boolean;
    trigger_conditions?: string | null; // JSON conditions for when workflow runs
    actions?: string | null; // JSON array of actions to perform
    created_by?: number | null;
    created_at: string;
    updated_at: string;
}

