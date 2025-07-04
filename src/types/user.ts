export interface User {
  id: string;
  email: string;
  name?: string;
  team_name?: string;
  organization_name?: string;
  tenant_domain_prefix?: string;
  url_picture?: string;
  google_uuid?: string;
  email_verified_at?: string;
  spots?: string[];
  is_admin?: boolean;
  has_active_subscription?: boolean;
  initialization_stage: number; // 0: needs onboarding, 1: has name (google sso), -1: completed
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingData {
  email: string;
  name?: string;
  team_name?: string;
  organization_name?: string;
  tenant_domain_prefix?: string;
  url_picture?: string;
}

export enum InitializationStage {
  NEEDS_ONBOARDING = 0,
  HAS_NAME = 1,
  HAS_TENANT = 2,
  COMPLETED = -1
} 