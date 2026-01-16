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
    icon?: string | null;
    is_active?: boolean;
    parent_team_id?: number | null;
    team_lead_id?: number | null;
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
    approval_id?: number | null;
    team_id: number;
    workspace_id: number;
    status_transition_group_id: number;
    reporting_team_ids: number[];
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
    approval_id?: number | null;
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
    is_private?: boolean;
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
    approval_id: number | null;
    approval_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | null;
    approval_triggered_at: string | null;
    approval_completed_at: string | null;
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
    icon?: string | null;
    category_id?: number | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface CustomField {
    id: number;
    name: string;
    field_type: string;
    options?: any;
    validation_rules?: Record<string, any> | null;
    category_id?: number | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export type ApprovalConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_set' | 'is_not_set';

export interface ApprovalCondition {
    id?: string;
    field: string;
    label?: string | null;
    source?: 'task_field' | 'custom_field';
    custom_field_id?: number | null;
    operator: ApprovalConditionOperator;
    value?: string | number | boolean | Array<string | number> | null;
    value_label?: string | null;
    value_type?: 'string' | 'number' | 'boolean' | 'date' | 'option';
    metadata?: Record<string, any> | null;
}

export interface Approval {
    id: number;
    name: string;
    description?: string | null;
    approval_type: 'SEQUENTIAL' | 'PARALLEL' | string;
    require_all: boolean;
    minimum_approvals?: number | null;
    trigger_type: 'ON_CREATE' | 'MANUAL' | 'CONDITIONAL' | 'ON_COMPLETE' | string;
    trigger_conditions?: ApprovalCondition[] | null;
    require_rejection_comment: boolean;
    block_editing_during_approval: boolean;
    deadline_type: 'hours' | 'date' | string;
    deadline_value?: string | null;
    order_index?: number;
    is_active: boolean;
    created_at?: string | Date;
    updated_at?: string | Date;
    deleted_at?: string | Date | null;
}

export interface ApprovalApprover {
    id: number;
    approval_id: number;
    approver_type: 'user' | 'role' | string;
    approver_id: number;
    scope?: 'global' | 'creator_department' | 'creator_manager' | 'specific_department' | string;
    scope_id?: number | null;
    required: boolean;
    order_index: number;
    created_by?: number | null;
    created_at?: string | Date;
    updated_at?: string | Date;
    deleted_at?: string | Date | null;
}

// High Priority - User Management & Authentication
export interface User {
    id: number;
    name: string;
    email: string;
    url_picture?: string | null;
    color?: string | null;
    birthday_month?: number | null; // 1-12
    birthday_day?: number | null; // 1-31
    gender?: string | null;
    zodiac_sign?: string | null;
    phone?: string | null;
    bio?: string | null;
    hobbies?: string[] | null;
    role_id?: number | null;
    workspace_id?: number | null;
    is_active: boolean;
    last_login_at?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    organization_name?: string | null;
}

export interface Role {
    id: number;
    name: string;
    description?: string | null;
    scope?: 'GLOBAL' | 'TEAM';
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

export type JobPositionLevel = 'executive' | 'director' | 'manager' | 'senior' | 'junior';

export interface JobPosition {
    id: number;
    code: string;
    title: string;
    level: JobPositionLevel;
    is_leadership: boolean;
    is_active: boolean;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
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
    color?: string | null;
    enabled?: boolean;
    response_time?: number | null;   // seconds
    resolution_time: number;         // seconds
    sla_policy_id?: number | null;
    priority_id?: number | null;
    workspace_id?: number | null;
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
    invitation_token: string;
    user_email?: string | null;
    team_ids?: number[] | null;
    tenant_domain_prefix?: string | null;
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

// Boards (Communication Boards)
export interface Board {
    id: number;
    name: string;
    description?: string | null;
    visibility: 'public' | 'private';
    created_by: number;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface BoardMember {
    id: number;
    board_id: number;
    member_type: 'user' | 'team';
    member_id: number;
    role: 'admin' | 'member';
    created_at: string;
    updated_at: string;
}

export interface BoardMessage {
    id: number;
    board_id: number;
    created_by: number;
    title?: string | null;
    content: string;
    is_pinned: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    metadata?: Record<string, any> | null;
    source_type?: string | null;
    source_id?: number | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}
