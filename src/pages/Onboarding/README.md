# Onboarding System

This directory contains the complete onboarding workflow for new users. The system handles different initialization stages based on how users sign up (email vs Google SSO).

## How it Works

### Initialization Stages

- **`0` (NEEDS_ONBOARDING)**: User needs full onboarding (email signup users)
- **`1` (HAS_NAME)**: User has name from Google SSO, skip to team name
- **`-1` (COMPLETED)**: Onboarding completed, redirect to main app

### Flow Logic

1. **Email Signup**: User creates account → email verification → name → team name → optional (photo)
2. **Google SSO with name**: User signs in → team name → optional (photo)
3. **Google SSO without name**: User signs in → name → team name → optional (photo)

## Components

### `OnboardingWrapper.tsx`
Main component that orchestrates the entire onboarding flow. Handles:
- Step navigation
- API calls to update user profile
- Progress tracking
- Initialization stage management

### Step Components

#### `EmailVerificationStep.tsx`
- Shows email verification instructions
- Allows resending verification emails
- Handles verification confirmation

#### `NameStep.tsx`
- Collects user's full name
- Validates input (min 2 characters)
- Updates initialization stage to `1` on completion

#### `TeamNameStep.tsx`
- Collects team/organization name
- Character limit validation (2-50 chars)
- Provides helpful tips and examples

#### `OptionalStep.tsx`
- Profile photo upload (optional)
- File validation (images only, max 5MB)
- Can be skipped
- Completes onboarding (sets stage to `-1`)

## Backend Integration

### Required API Endpoints

```typescript
// Login endpoint should return user object with initialization_stage
POST /api/login
Response: {
  token: string,
  user: {
    id: string,
    email: string,
    name?: string,
    team_name?: string,
    photo_url?: string,
    initialization_stage: number
  }
}

// Update user profile
PATCH /api/user/profile
Body: {
  name?: string,
  team_name?: string,
  photo_url?: string,
  initialization_stage?: number
}

// Get user profile
GET /api/user/profile
Response: { user: User }

// Resend email verification
POST /api/auth/resend-verification
Body: { email: string }

// Photo upload (optional)
POST /api/user/upload-photo
Body: FormData with 'photo' file
Response: { photo_url: string }
```

## Routing

- `/onboarding` - Protected route that shows onboarding flow
- Redirects to `/` if user has completed onboarding
- Redirects to `/auth/signin` if not authenticated

## Usage

The onboarding system is automatically triggered after successful authentication when:
- `user.initialization_stage !== InitializationStage.COMPLETED`

Users are redirected to `/onboarding` and guided through the appropriate steps based on their current initialization stage and available data.

## Customization

To modify the onboarding flow:
1. Add new step components in `steps/` directory
2. Update `OnboardingWrapper.tsx` to include new steps
3. Modify the step progression logic
4. Update backend to handle additional fields
5. Adjust initialization stage logic as needed 