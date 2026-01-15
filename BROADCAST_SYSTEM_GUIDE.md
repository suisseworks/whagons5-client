# Broadcast Acknowledgment System - Usage Guide

## 🚀 Quick Start

### 1. Run Database Migrations

First, run the migrations to create the new tables:

```bash
cd whagons5-api
php artisan migrate
```

This will create:
- `wh_broadcasts` table
- `wh_broadcast_acknowledgments` table
- PostgreSQL publications and NOTIFY triggers for real-time sync

### 2. Start Your Application

The frontend will automatically:
- Initialize IndexedDB stores for broadcasts and acknowledgments
- Set up Redux state management
- Configure real-time WebSocket synchronization

## 📋 How to Use

### For Administrators/Communications Team

#### Creating a Broadcast

1. **Navigate to Broadcasts**
   - Click the "Broadcasts" item in the sidebar (🔔 bell icon)
   - Or visit `/broadcasts`

2. **Click "Create Broadcast"**

3. **Fill in the Form**:
   - **Title** (required): Short descriptive title
   - **Message** (required): The full message content
   - **Priority**: Choose from Low, Normal, High, or Urgent
   - **Recipients**: Select one of three methods:
     - **Manual**: Select specific users
     - **Roles**: Select users by their roles
     - **Teams**: Select all members of specific teams
   - **Due Date** (optional): When acknowledgment is required by
   - **Reminder Interval**: How often to send reminders (in hours, default 24)

4. **Click "Create"**
   - The broadcast is immediately sent to all selected recipients
   - Acknowledgment records are created for each recipient
   - Recipients see it in their "Pending Acknowledgments" widget

#### Monitoring Broadcasts

1. **View All Broadcasts**
   - Use the tabs to filter: All, My Broadcasts, Pending, Completed

2. **Click on Any Broadcast** to see:
   - Full message details
   - Progress bar showing acknowledgment percentage
   - Detailed table of all recipients
   - Who has acknowledged (with timestamp and comment)
   - Who is still pending
   - Number of reminders sent to each person

3. **Filter Acknowledgments**
   - Click "All", "Acknowledged", or "Pending" buttons in the detail view

### For Regular Users (Recipients)

#### Acknowledging Broadcasts

1. **See Pending Broadcasts**
   - A "Pending Acknowledgments" widget appears on your dashboard
   - Shows a badge with the count of pending broadcasts

2. **Click on a Broadcast or "Acknowledge" Button**

3. **In the Acknowledge Dialog**:
   - Review the full message
   - Optionally add a comment (max 500 characters)
   - Click "Confirm Acknowledgment"

4. **Done!**
   - The broadcast disappears from your pending list
   - The creator sees your acknowledgment in real-time
   - The progress bar updates automatically

## 🔌 API Endpoints

### For Custom Integrations

All endpoints are prefixed with your API base URL (e.g., `/api/broadcasts`)

#### Broadcast Management

```http
# List all broadcasts
GET /broadcasts?status=active&priority=high

# Create a broadcast
POST /broadcasts
{
  "title": "System Maintenance",
  "message": "Server will be down...",
  "priority": "urgent",
  "recipient_selection_type": "manual",
  "recipient_config": {
    "manual_user_ids": [1, 2, 3]
  },
  "due_date": "2026-01-20T10:00:00Z",
  "reminder_interval_hours": 24
}

# Get specific broadcast
GET /broadcasts/{id}

# Update broadcast
PATCH /broadcasts/{id}
{
  "status": "completed"
}

# Delete broadcast
DELETE /broadcasts/{id}
```

#### User-Specific Endpoints

```http
# Get broadcasts created by current user
GET /broadcasts/my-broadcasts?status=active

# Get broadcasts pending acknowledgment for current user
GET /broadcasts/pending-for-me

# Acknowledge a broadcast
POST /broadcasts/{id}/acknowledge
{
  "comment": "Read and understood"
}
```

#### Acknowledgment Tracking

```http
# List all acknowledgments for a broadcast
GET /broadcasts/{broadcastId}/acknowledgments?status=pending

# Get specific user's acknowledgment status
GET /broadcasts/{broadcastId}/acknowledgments/{userId}
```

## 💾 Redux State Usage

### In Your Components

```typescript
import { useSelector, useDispatch } from 'react-redux';
import { genericActions } from '@/store/genericSlices';

// Access broadcasts state
const { value: broadcasts, loading, error } = useSelector(
  (state: RootState) => (state as any).broadcasts || { value: [], loading: false, error: null }
);

// Access acknowledgments state
const { value: acknowledgments } = useSelector(
  (state: RootState) => (state as any).broadcastAcknowledgments || { value: [] }
);

// Load data
dispatch(genericActions.broadcasts.getFromIndexedDB()); // Load from local cache (fast)
dispatch(genericActions.broadcasts.fetchFromAPI()); // Fetch from server (updates cache)

// Create a broadcast
dispatch(genericActions.broadcasts.addAsync({
  title: 'Important Update',
  message: '...',
  priority: 'high',
  recipient_selection_type: 'role_based',
  recipient_config: { roles: ['manager'] }
}));

// Update a broadcast
dispatch(genericActions.broadcasts.updateAsync({
  id: 123,
  status: 'completed'
}));

// Delete a broadcast
dispatch(genericActions.broadcasts.removeAsync(123));
```

## 🔄 Real-Time Updates

The system automatically syncs changes in real-time via WebSocket:

1. **When a broadcast is created**: All recipients see it immediately
2. **When someone acknowledges**: The creator sees the progress update instantly
3. **When a broadcast is updated**: All users see the changes
4. **Offline support**: Changes queue locally and sync when connection returns

## 🎨 UI Components

### Add the Widget to Your Dashboard

```tsx
import PendingAcknowledgmentsWidget from '@/pages/broadcasts/PendingAcknowledgmentsWidget';

function Dashboard() {
  return (
    <div className="grid gap-4">
      <PendingAcknowledgmentsWidget />
      {/* other widgets */}
    </div>
  );
}
```

### Custom Broadcast List

```tsx
import { useSelector } from 'react-redux';
import { Broadcast } from '@/types/broadcast';

function MyBroadcastList() {
  const { value: broadcasts } = useSelector(
    (state: RootState) => (state as any).broadcasts || { value: [] }
  );

  const urgentBroadcasts = broadcasts.filter(
    (b: Broadcast) => b.priority === 'urgent' && b.status === 'active'
  );

  return (
    <div>
      {urgentBroadcasts.map(broadcast => (
        <div key={broadcast.id}>
          <h3>{broadcast.title}</h3>
          <p>Progress: {broadcast.progress_percentage}%</p>
        </div>
      ))}
    </div>
  );
}
```

## 🔧 Advanced Features

### Scheduled Reminders

The system includes an automated reminder job:

```bash
# Add to your Laravel scheduler (app/Console/Kernel.php)
$schedule->command('broadcasts:send-reminders')->hourly();
```

The job automatically:
- Finds pending acknowledgments older than the reminder interval
- Sends notifications to users
- Tracks reminder count and timestamps
- Respects the broadcast's `reminder_interval_hours` setting

### Recipient Resolution

The system supports multiple recipient selection methods:

1. **Manual Selection**: Specific user IDs
   ```json
   {
     "recipient_selection_type": "manual",
     "recipient_config": {
       "manual_user_ids": [1, 2, 3]
     }
   }
   ```

2. **Role-Based**: All users with specific roles
   ```json
   {
     "recipient_selection_type": "role_based",
     "recipient_config": {
       "roles": ["manager", "team_lead"]
     }
   }
   ```

3. **Team-Based**: All members of specific teams
   ```json
   {
     "recipient_selection_type": "team_based",
     "recipient_config": {
       "teams": [5, 7, 9]
     }
   }
   ```

4. **Mixed**: Combine multiple methods
   ```json
   {
     "recipient_selection_type": "mixed",
     "recipient_config": {
       "manual_user_ids": [1],
       "roles": ["manager"],
       "teams": [5]
     }
   }
   ```

## 🐛 Troubleshooting

### "No broadcasts showing up"

1. Check browser console for errors
2. Verify migrations ran successfully
3. Check API endpoint: `GET /api/broadcasts`
4. Check IndexedDB: Application > Storage > IndexedDB > your-user-id > broadcasts

### "Real-time updates not working"

1. Check WebSocket connection in Network tab
2. Verify PostgreSQL publications exist:
   ```sql
   SELECT * FROM pg_publication WHERE pubname LIKE '%broadcast%';
   ```
3. Check Laravel logs for publication errors

### "Can't acknowledge broadcast"

1. Verify user is in the recipient list
2. Check API response for specific error
3. Ensure broadcast status is 'active'

## 📊 Database Schema

```sql
-- Broadcasts table
wh_broadcasts
  - id
  - title
  - message
  - priority (low/normal/high/urgent)
  - recipient_selection_type
  - recipient_config (JSON)
  - total_recipients
  - total_acknowledged
  - due_date
  - reminder_interval_hours
  - status (draft/active/completed/cancelled)
  - created_by
  - workspace_id
  - timestamps

-- Acknowledgments table
wh_broadcast_acknowledgments
  - id
  - broadcast_id
  - user_id
  - status (pending/acknowledged/dismissed)
  - acknowledged_at
  - comment
  - notified_at
  - reminder_count
  - last_reminded_at
  - timestamps
```

## 🎯 Best Practices

1. **Use Priority Wisely**: Reserve "urgent" for truly critical messages
2. **Set Due Dates**: For time-sensitive communications
3. **Monitor Progress**: Check acknowledgment rates regularly
4. **Clear Messages**: Be concise and specific in broadcast content
5. **Reasonable Reminders**: Don't set reminder intervals too short (recommended: 24-48 hours)

## 🚦 Next Steps

1. **Test the System**: Create a test broadcast to a small group
2. **Customize Styling**: Adjust colors and layout to match your brand
3. **Add Notifications**: Integrate with your notification system (email, push, etc.)
4. **Analytics**: Track acknowledgment rates and response times
5. **Templates**: Create broadcast templates for common messages

---

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review Laravel logs: `storage/logs/laravel.log`
3. Check browser console for frontend errors
4. Verify database migrations completed successfully
