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
    sla_id: number;
    team_id: number;
    workspace_id: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export interface Task {
    id: number;
    name: string;
    description: string | null;
    workspace_id: number;
    category_id: number;
    team_id: number;
    template_id: number;
    spot_id: number;
    status_id: number;
    priority_id: number;
    start_date: string | null;
    due_date: string | null;
    expected_duration: number;
    response_date: string | null;
    resolution_date: string | null;
    work_duration: number;
    pause_duration: number;
    created_at: string;
    updated_at: string;
}

export interface Status {
    id: number;
    name: string;
    color?: string | null;
    position?: number | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface Priority {
    id: number;
    name: string;
    color?: string | null;
    level?: number | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface Spot {
    id: number;
    name: string;
    workspace_id?: number | null;
    description?: string | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface Tag {
    id: number;
    name: string;
    color?: string | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

