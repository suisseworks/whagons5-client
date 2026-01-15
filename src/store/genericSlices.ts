import { combineReducers } from "@reduxjs/toolkit";
import { createGenericSlices } from "./genericSliceFactory";

// Import all type interfaces
// Type imports kept for reference; not used directly in this file
// import { SpotCustomField, TemplateCustomField, TaskCustomFieldValue, SpotCustomFieldValue } from "./types";
// import { FormField, FormVersion, TaskForm, FieldOption } from "./types";
// import { SessionLog, ConfigLog, TaskAttachment, TaskRecurrence, Exception } from "./types";

// Configuration for all generic slices
const genericSliceConfigs = [
    // Custom Fields & Values
    { name: 'spotCustomFields', table: 'wh_spot_custom_fields', endpoint: '/spot-custom-fields', store: 'spot_custom_fields', hashFields: ['id','name','field_type','options','validation_rules','spot_type_id','is_required','default_value','updated_at'] },
    { name: 'templateCustomFields', table: 'wh_template_custom_field', endpoint: '/template-custom-fields', store: 'template_custom_fields', hashFields: ['id','field_id','template_id','is_required','order','default_value','updated_at'] },
    { name: 'taskCustomFieldValues', table: 'wh_task_custom_field_value', endpoint: '/task-custom-field-values', store: 'task_custom_field_values', hashFields: ['id','task_id','field_id','name','type','value','value_numeric','value_date','value_json','updated_at'] },
    { name: 'spotCustomFieldValues', table: 'wh_spot_custom_field_value', endpoint: '/spot-custom-field-values', store: 'spot_custom_field_values', hashFields: ['id','spot_id','field_id','name','type','value','value_numeric','value_date','value_json','updated_at'] },

    // Forms & Fields
    { name: 'forms', table: 'wh_forms', endpoint: '/forms', store: 'forms', hashFields: ['id','current_version_id','name','description','created_by','updated_at'] },
    { name: 'formFields', table: 'wh_form_fields', endpoint: '/form-fields', store: 'form_fields', hashFields: ['id','form_id','option_version_id','name','type','position','properties','is_required','validation_rules','display_rules','updated_at'] },
    { name: 'formVersions', table: 'wh_form_versions', endpoint: '/form-versions', store: 'form_versions', hashFields: ['id','form_id','version','fields','updated_at'] },
    { name: 'taskForms', table: 'wh_task_form', endpoint: '/task-forms', store: 'task_forms', hashFields: ['id','task_id','form_version_id','data','updated_at'] },
    { name: 'fieldOptions', table: 'wh_field_options', endpoint: '/field-options', store: 'field_options', hashFields: ['id','name','version','data','enabled','created_by','updated_at'] },

    // User Management
    { name: 'users', table: 'wh_users', endpoint: '/users', store: 'users', hashFields: ['id','google_uuid','name','email','role_id','job_position_id','spots','color','url_picture','organization_name','tenant_domain_prefix','stripe_id','is_admin','has_active_subscription','initialization_stage','updated_at'] },
    { name: 'roles', table: 'wh_roles', endpoint: '/roles', store: 'roles', hashFields: ['id','name','description','updated_at'] },
    { name: 'permissions', table: 'wh_permissions', endpoint: '/permissions', store: 'permissions', hashFields: ['id','name','key','group','type','updated_at'] },
  { name: 'userTeams', table: 'wh_user_team', endpoint: '/user-teams', store: 'user_teams', hashFields: ['id','user_id','team_id','role_id','updated_at'] },
    { name: 'userPermissions', table: 'wh_user_permission', endpoint: '/user-permissions', store: 'user_permissions', hashFields: ['id','user_id','permission_id','updated_at'] },
    { name: 'rolePermissions', table: 'wh_role_permission', endpoint: '/role-permissions', store: 'role_permissions', hashFields: ['id','role_id','permission_id','updated_at'] },

    // Task Relations
    { name: 'taskUsers', table: 'wh_task_user', endpoint: '/task-users', store: 'task_users', hashFields: ['id','task_id','user_id','updated_at'] },
    { name: 'taskTags', table: 'wh_task_tag', endpoint: '/task-tags', store: 'task_tags', hashFields: ['id','task_id','tag_id','user_id','updated_at'] },
    { name: 'taskLogs', table: 'wh_task_logs', endpoint: '/task-logs', store: 'task_logs', hashFields: ['id','uuid','task_id','user_id','action','old_values','new_values','updated_at'] },
    { name: 'statusTransitionLogs', table: 'wh_status_transition_logs', endpoint: '/status-transition-logs', store: 'status_transition_logs', hashFields: ['id','task_id','type','from_status','to_status','start','end','user_id','updated_at'] },

    // Reference Tables
    { name: 'statuses', table: 'wh_statuses', endpoint: '/statuses', store: 'statuses', hashFields: ['id','name','action','color','icon','system','initial','updated_at'] },
    { name: 'priorities', table: 'wh_priorities', endpoint: '/priorities', store: 'priorities', hashFields: ['id','name','color','category_id','updated_at'] },
    { name: 'spots', table: 'wh_spots', endpoint: '/spots', store: 'spots', hashFields: ['id','name','parent_id','spot_type_id','is_branch','updated_at'] },
    { name: 'tags', table: 'wh_tags', endpoint: '/tags', store: 'tags', hashFields: ['id','name','color','icon','category_id','updated_at'] },
    { name: 'spotTypes', table: 'wh_spot_types', endpoint: '/spot-types', store: 'spot_types', hashFields: ['id','name','color','updated_at'] },
    { name: 'statusTransitions', table: 'wh_status_transitions', endpoint: '/status-transitions', store: 'status_transitions', hashFields: ['id','status_transition_group_id','from_status','to_status','initial','updated_at'] },
    { name: 'statusTransitionGroups', table: 'wh_status_transition_groups', endpoint: '/status-transition-groups', store: 'status_transition_groups', hashFields: ['id','name','description','is_default','is_active','updated_at'] },

    // Business Logic
    { name: 'slas', table: 'wh_slas', endpoint: '/slas', store: 'slas', hashFields: ['id','name', 'description', 'color', 'enabled', 'response_time','resolution_time','sla_policy_id','updated_at'] },
    { name: 'slaPolicies', table: 'wh_sla_policies', endpoint: '/sla-policies', store: 'sla_policies', hashFields: ['id','name','description','active','trigger_type','trigger_status_id','trigger_field_id','trigger_operator','trigger_value_text','trigger_value_number','trigger_value_boolean','grace_seconds','updated_at'] },
    { name: 'slaAlerts', table: 'wh_sla_alerts', endpoint: '/sla-alerts', store: 'sla_alerts', hashFields: ['id','sla_id','time','type','notify_to','updated_at'] },
    { name: 'approvals', table: 'wh_approvals', endpoint: '/approvals', store: 'approvals', hashFields: ['id','name','description','approval_type','require_all','minimum_approvals','trigger_type','trigger_conditions','require_rejection_comment','block_editing_during_approval','deadline_type','deadline_value','order_index','is_active','updated_at'] },
    { name: 'approvalApprovers', table: 'wh_approval_approvers', endpoint: '/approval-approvers', store: 'approval_approvers', hashFields: ['id','approval_id','approver_type','approver_id','scope','scope_id','required','order_index','created_by','updated_at'] },
    { name: 'taskApprovalInstances', table: 'wh_task_approval_instances', endpoint: '/task-approval-instances', store: 'task_approval_instances', hashFields: ['id','task_id','approver_user_id','source_approver_id','order_index','is_required','status','notified_at','responded_at','response_comment','updated_at'] },
    
    // Broadcasts & Acknowledgments
    { name: 'broadcasts', table: 'wh_broadcasts', endpoint: '/broadcasts', store: 'broadcasts', hashFields: ['id','title','message','priority','recipient_selection_type','total_recipients','total_acknowledged','due_date','status','created_by','workspace_id','updated_at'] },
    { name: 'broadcastAcknowledgments', table: 'wh_broadcast_acknowledgments', endpoint: '/broadcast-acknowledgments', store: 'broadcast_acknowledgments', hashFields: ['id','broadcast_id','user_id','status','acknowledged_at','notified_at','updated_at'] },
    { name: 'categoryPriorities', table: 'wh_category_priority', endpoint: '/category-priorities', store: 'category_priorities', hashFields: ['id','priority_id','category_id','sla_id','updated_at'] },
    { name: 'invitations', table: 'wh_invitations', endpoint: '/invitations', store: 'invitations', hashFields: ['id','invitation_token','user_email','team_ids','tenant_domain_prefix','updated_at'] },

    // Activity & Logging
    { name: 'sessionLogs', table: 'wh_session_logs', endpoint: '/session-logs', store: 'session_logs', hashFields: ['id','user_id','action_type','ip_address','user_agent','description','device_data','updated_at'] },
    { name: 'configLogs', table: 'wh_config_logs', endpoint: '/config-logs', store: 'config_logs', hashFields: ['id','entity_type','entity_id','action','old_values','new_values','updated_at'] },

    // File Management
    { name: 'taskAttachments', table: 'wh_task_attachments', endpoint: '/task-attachments', store: 'task_attachments', hashFields: ['id','uuid','task_id','type','file_path','file_name','file_extension','file_size','user_id','updated_at'] },
    { name: 'taskNotes', table: 'wh_task_notes', endpoint: '/task-notes', store: 'task_notes', hashFields: ['id','uuid','task_id','note','user_id','updated_at'] },
    { name: 'taskRecurrences', table: 'wh_task_recurrences', endpoint: '/task-recurrences', store: 'task_recurrences', hashFields: ['id','updated_at'] },
    { name: 'workspaceChat', table: 'wh_workspace_chat', endpoint: '/workspace-chat', store: 'workspace_chat', hashFields: ['id','uuid','workspace_id','message','user_id','updated_at'] },

    // Error Tracking
    { name: 'exceptions', table: 'wh_exceptions', endpoint: '/exceptions', store: 'exceptions', hashFields: ['id','workspace_id','user_id','role_id','updated_at'] },

    // Core Entities (converted from custom to generic)
    { name: 'categories', table: 'wh_categories', endpoint: '/categories', store: 'categories', hashFields: ['id','name','description','color','icon','enabled','sla_id','approval_id','team_id','workspace_id','updated_at'] },
    { name: 'categoryCustomFields', table: 'wh_category_custom_field', endpoint: '/category-custom-fields', store: 'category_custom_fields', hashFields: ['id','field_id','category_id','is_required','order','default_value','updated_at'] },
    { name: 'customFields', table: 'wh_custom_fields', endpoint: '/custom-fields', store: 'custom_fields', hashFields: ['id','name','field_type','options','validation_rules','updated_at'] },
    { name: 'teams', table: 'wh_teams', endpoint: '/teams', store: 'teams', hashFields: ['id','name','description','color','icon','is_active','parent_team_id','team_lead_id','updated_at'] },
    { name: 'templates', table: 'wh_templates', endpoint: '/templates', store: 'templates', hashFields: ['id','name','category_id','priority_id','sla_id','approval_id','is_private','updated_at'] },
    { name: 'messages', table: 'wh_messages', endpoint: '/messages', store: 'messages', hashFields: ['id','title','content','workspace_id','team_id','spot_id','created_by','starts_at','ends_at','is_pinned','updated_at'] },
    { name: 'workflows', table: 'wh_workflows', endpoint: '/workflows', store: 'workflows', hashFields: ['id','name','description','workspace_id','is_active','current_version_id','created_by','updated_by','activated_at','updated_at'] },
    { name: 'workspaces', table: 'wh_workspaces', endpoint: '/workspaces', store: 'workspaces', hashFields: ['id','name','description','color','icon','teams','type','category_id','spots','created_by','updated_at'] },

    // Boards (Communication Boards)
    { name: 'boards', table: 'wh_boards', endpoint: '/boards', store: 'boards', hashFields: ['id','name','description','visibility','created_by','updated_at'] },
    { name: 'boardMembers', table: 'wh_board_members', endpoint: '/board-members', store: 'board_members', hashFields: ['id','board_id','member_type','member_id','role','updated_at'] },
    { name: 'boardMessages', table: 'wh_board_messages', endpoint: '/board-messages', store: 'board_messages', hashFields: ['id','board_id','created_by','title','content','is_pinned','starts_at','ends_at','metadata','source_type','source_id','updated_at'] },

    // Job Positions
    { name: 'jobPositions', table: 'wh_job_positions', endpoint: '/job-positions', store: 'job_positions', hashFields: ['id','code','title','level','is_leadership','is_active','description','updated_at'] },

    // Compliance Module
    { name: 'complianceStandards', table: 'wh_compliance_standards', endpoint: '/compliance-standards', store: 'compliance_standards', hashFields: ['id','name','code','version','description','authority','active','created_by','updated_at'] },
    { name: 'complianceRequirements', table: 'wh_compliance_requirements', endpoint: '/compliance-requirements', store: 'compliance_requirements', hashFields: ['id','standard_id','clause_number','title','description','implementation_guidance','mandatory','parent_id','updated_at'] },
    { name: 'complianceMappings', table: 'wh_compliance_mappings', endpoint: '/compliance-mappings', store: 'compliance_mappings', hashFields: ['id','requirement_id','mapped_entity_type','mapped_entity_id','justification','created_by','updated_at'] },
    { name: 'complianceAudits', table: 'wh_compliance_audits', endpoint: '/compliance-audits', store: 'compliance_audits', hashFields: ['id','standard_id','name','type','status','scheduled_start_date','scheduled_end_date','actual_start_date','completed_date','auditor_id','external_auditor_name','scope','summary_findings','score','created_by','updated_at'] },

    // Plugin System
    { name: 'plugins', table: 'wh_plugins', endpoint: '/plugins', store: 'plugins', hashFields: ['id','slug','name','description','version','is_enabled','updated_at'] },
    { name: 'pluginRoutes', table: 'wh_plugin_routes', endpoint: '/plugin-routes', store: 'plugin_routes', hashFields: ['id','plugin_id','method','path','controller','action','updated_at'] },
];

// Create all generic slices at once
export const genericSlices = createGenericSlices(genericSliceConfigs);

// Export individual slices for easy access
export const {
    spotCustomFields,
    templateCustomFields,
    taskCustomFieldValues,
    spotCustomFieldValues,
    forms,
    formFields,
    formVersions,
    taskForms,
    fieldOptions,
    users,
    roles,
    permissions,
    userTeams,
    userPermissions,
    rolePermissions,
    taskUsers,
    taskTags,
    taskLogs,
    statusTransitionLogs,
    statuses,
    priorities,
    spots,
    tags,
    spotTypes,
    statusTransitions,
    statusTransitionGroups,
    slas,
    slaPolicies,
    slaAlerts,
    approvals,
    approvalApprovers,
    taskApprovalInstances,
    broadcasts,
    broadcastAcknowledgments,
    categoryPriorities,
    invitations,
    sessionLogs,
    configLogs,
    taskAttachments,
    taskNotes,
    taskRecurrences,
    workspaceChat,
    exceptions,
    // Core entities (converted from custom)
    categories,
    categoryCustomFields,
    customFields,
    teams,
    templates,
    messages,
    workflows,
    workspaces,
    // Boards
    boards,
    boardMembers,
    boardMessages,
    jobPositions,
    complianceStandards,
    complianceRequirements,
    complianceMappings,
    complianceAudits,
    plugins,
    pluginRoutes,
} = genericSlices.slices;

// Export individual caches for CacheRegistry
export const genericCaches = genericSlices.caches;

// Combine all reducers
export const genericReducers = combineReducers(genericSlices.reducers);

// Export event system for generic slices
export { GenericEvents as genericEvents } from './genericSliceFactory';

// Export event names for each slice
export const genericEventNames = {
    spotCustomFields: genericSlices.slices.spotCustomFields.eventNames,
    templateCustomFields: genericSlices.slices.templateCustomFields.eventNames,
    taskCustomFieldValues: genericSlices.slices.taskCustomFieldValues.eventNames,
    spotCustomFieldValues: genericSlices.slices.spotCustomFieldValues.eventNames,
    forms: genericSlices.slices.forms.eventNames,
    formFields: genericSlices.slices.formFields.eventNames,
    formVersions: genericSlices.slices.formVersions.eventNames,
    taskForms: genericSlices.slices.taskForms.eventNames,
    fieldOptions: genericSlices.slices.fieldOptions.eventNames,
    users: genericSlices.slices.users.eventNames,
    roles: genericSlices.slices.roles.eventNames,
    permissions: genericSlices.slices.permissions.eventNames,
    userTeams: genericSlices.slices.userTeams.eventNames,
    userPermissions: genericSlices.slices.userPermissions.eventNames,
    rolePermissions: genericSlices.slices.rolePermissions.eventNames,
    taskUsers: genericSlices.slices.taskUsers.eventNames,
    taskTags: genericSlices.slices.taskTags.eventNames,
    taskLogs: genericSlices.slices.taskLogs.eventNames,
    statusTransitionLogs: genericSlices.slices.statusTransitionLogs.eventNames,
    statuses: genericSlices.slices.statuses.eventNames,
    priorities: genericSlices.slices.priorities.eventNames,
    spots: genericSlices.slices.spots.eventNames,
    tags: genericSlices.slices.tags.eventNames,
    spotTypes: genericSlices.slices.spotTypes.eventNames,
    statusTransitions: genericSlices.slices.statusTransitions.eventNames,
    statusTransitionGroups: genericSlices.slices.statusTransitionGroups.eventNames,
    slas: genericSlices.slices.slas.eventNames,
    slaPolicies: genericSlices.slices.slaPolicies.eventNames,
    slaAlerts: genericSlices.slices.slaAlerts.eventNames,
    approvals: genericSlices.slices.approvals.eventNames,
    approvalApprovers: genericSlices.slices.approvalApprovers.eventNames,
    taskApprovalInstances: genericSlices.slices.taskApprovalInstances.eventNames,
    broadcasts: genericSlices.slices.broadcasts.eventNames,
    broadcastAcknowledgments: genericSlices.slices.broadcastAcknowledgments.eventNames,
    categoryPriorities: genericSlices.slices.categoryPriorities.eventNames,
    invitations: genericSlices.slices.invitations.eventNames,
    sessionLogs: genericSlices.slices.sessionLogs.eventNames,
    configLogs: genericSlices.slices.configLogs.eventNames,
    taskAttachments: genericSlices.slices.taskAttachments.eventNames,
    taskNotes: genericSlices.slices.taskNotes.eventNames,
    taskRecurrences: genericSlices.slices.taskRecurrences.eventNames,
    workspaceChat: genericSlices.slices.workspaceChat.eventNames,
    exceptions: genericSlices.slices.exceptions.eventNames,
    // Core entities (converted from custom)
    categories: genericSlices.slices.categories.eventNames,
    categoryCustomFields: genericSlices.slices.categoryCustomFields.eventNames,
    customFields: genericSlices.slices.customFields.eventNames,
    teams: genericSlices.slices.teams.eventNames,
    templates: genericSlices.slices.templates.eventNames,
    messages: genericSlices.slices.messages.eventNames,
    workflows: genericSlices.slices.workflows.eventNames,
    workspaces: genericSlices.slices.workspaces.eventNames,
    // Boards
    boards: genericSlices.slices.boards.eventNames,
    boardMembers: genericSlices.slices.boardMembers.eventNames,
    boardMessages: genericSlices.slices.boardMessages.eventNames,
    jobPositions: genericSlices.slices.jobPositions.eventNames,
    complianceStandards: genericSlices.slices.complianceStandards.eventNames,
    complianceRequirements: genericSlices.slices.complianceRequirements.eventNames,
    complianceMappings: genericSlices.slices.complianceMappings.eventNames,
    complianceAudits: genericSlices.slices.complianceAudits.eventNames,
    plugins: genericSlices.slices.plugins.eventNames,
    pluginRoutes: genericSlices.slices.pluginRoutes.eventNames,
} as const;

// Export actions for each slice with proper typing
export const genericActions = {
    spotCustomFields: genericSlices.slices.spotCustomFields.actions,
    templateCustomFields: genericSlices.slices.templateCustomFields.actions,
    taskCustomFieldValues: genericSlices.slices.taskCustomFieldValues.actions,
    spotCustomFieldValues: genericSlices.slices.spotCustomFieldValues.actions,
    forms: genericSlices.slices.forms.actions,
    formFields: genericSlices.slices.formFields.actions,
    formVersions: genericSlices.slices.formVersions.actions,
    taskForms: genericSlices.slices.taskForms.actions,
    fieldOptions: genericSlices.slices.fieldOptions.actions,
    users: genericSlices.slices.users.actions,
    roles: genericSlices.slices.roles.actions,
    permissions: genericSlices.slices.permissions.actions,
    userTeams: genericSlices.slices.userTeams.actions,
    userPermissions: genericSlices.slices.userPermissions.actions,
    rolePermissions: genericSlices.slices.rolePermissions.actions,
    taskUsers: genericSlices.slices.taskUsers.actions,
    taskTags: genericSlices.slices.taskTags.actions,
    taskLogs: genericSlices.slices.taskLogs.actions,
    statusTransitionLogs: genericSlices.slices.statusTransitionLogs.actions,
    statuses: genericSlices.slices.statuses.actions,
    priorities: genericSlices.slices.priorities.actions,
    spots: genericSlices.slices.spots.actions,
    tags: genericSlices.slices.tags.actions,
    spotTypes: genericSlices.slices.spotTypes.actions,
    statusTransitions: genericSlices.slices.statusTransitions.actions,
    statusTransitionGroups: genericSlices.slices.statusTransitionGroups.actions,
    slas: genericSlices.slices.slas.actions,
    slaPolicies: genericSlices.slices.slaPolicies.actions,
    slaAlerts: genericSlices.slices.slaAlerts.actions,
    approvals: genericSlices.slices.approvals.actions,
    approvalApprovers: genericSlices.slices.approvalApprovers.actions,
    taskApprovalInstances: genericSlices.slices.taskApprovalInstances.actions,
    broadcasts: genericSlices.slices.broadcasts.actions,
    broadcastAcknowledgments: genericSlices.slices.broadcastAcknowledgments.actions,
    categoryPriorities: genericSlices.slices.categoryPriorities.actions,
    invitations: genericSlices.slices.invitations.actions,
    sessionLogs: genericSlices.slices.sessionLogs.actions,
    configLogs: genericSlices.slices.configLogs.actions,
    taskAttachments: genericSlices.slices.taskAttachments.actions,
    taskNotes: genericSlices.slices.taskNotes.actions,
    taskRecurrences: genericSlices.slices.taskRecurrences.actions,
    workspaceChat: genericSlices.slices.workspaceChat.actions,
    exceptions: genericSlices.slices.exceptions.actions,
    // Core entities (converted from custom)
    categories: genericSlices.slices.categories.actions,
    categoryCustomFields: genericSlices.slices.categoryCustomFields.actions,
    customFields: genericSlices.slices.customFields.actions,
    teams: genericSlices.slices.teams.actions,
    templates: genericSlices.slices.templates.actions,
    messages: genericSlices.slices.messages.actions,
    workflows: genericSlices.slices.workflows.actions,
    workspaces: genericSlices.slices.workspaces.actions,
    // Boards
    boards: genericSlices.slices.boards.actions,
    boardMembers: genericSlices.slices.boardMembers.actions,
    boardMessages: genericSlices.slices.boardMessages.actions,
    jobPositions: genericSlices.slices.jobPositions.actions,
    complianceStandards: genericSlices.slices.complianceStandards.actions,
    complianceRequirements: genericSlices.slices.complianceRequirements.actions,
    complianceMappings: genericSlices.slices.complianceMappings.actions,
    complianceAudits: genericSlices.slices.complianceAudits.actions,
    plugins: genericSlices.slices.plugins.actions,
    pluginRoutes: genericSlices.slices.pluginRoutes.actions,
} as const;
