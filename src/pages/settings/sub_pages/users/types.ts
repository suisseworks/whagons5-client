// Local types for the Users Settings subpage (UI + view models).

export type TranslateFn = (key: string, fallback: string) => string;

// Extended User type based on actual API data structure
export interface UserData {
  id: number;
  name: string;
  email: string;
  teams?:
    | Array<{
        id: number;
        name: string;
        description?: string;
        color?: string;
        // role_id comes from wh_user_team pivot table (userTeams slice), not from user response
      }>
    | null;
  role_id?: number | null;
  job_position_id?: number | null;
  job_position?: { id: number; title: string } | null;
  organization_name?: string | null;
  is_admin?: boolean;
  has_active_subscription?: boolean;
  url_picture?: string | null;
  color?: string | null;
  global_roles?: Array<{ id: number; name: string }> | string[] | null; // Can be objects (from API) or strings (for update)
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

// Local types for this Settings subpage.
// Keep this file UI-focused (forms, derived view models, etc.).
