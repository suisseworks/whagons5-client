# Broadcast Plugin Setup Guide

## 🔌 Making Broadcasts a Full Plugin

The broadcast system is now fully integrated as a plugin in your WHagons system. This means it can be enabled/disabled, managed through the Plugin Management interface, and controlled just like other plugins (TeamConnect, Compliance, etc.).

---

## 📋 Setup Steps

### 1. Run the Plugin Seeder

The first step is to add the broadcast plugin to your database with all its routes and configuration:

```bash
cd whagons5-api
php artisan db:seed --class=BroadcastPluginSeeder
```

This will:
- Create the `broadcasts` plugin entry in `wh_plugins` table
- Register all 10 broadcast API routes in `wh_plugin_routes` table
- Enable the plugin by default
- Set up default settings (reminder intervals, icon, color, etc.)

### 2. Verify Plugin Registration

Check that the plugin was created successfully:

```bash
php artisan tinker
>>> App\Models\Plugin\Plugin::where('slug', 'broadcasts')->first();
```

You should see the plugin with:
- **Slug**: `broadcasts`
- **Name**: Broadcasts
- **Version**: 1.0.0
- **is_enabled**: true

### 3. Frontend Changes (Already Done ✅)

The frontend has been updated to:
- Show broadcasts in the Plugin cards UI (`/plugins`)
- Include it in the AppSidebar plugin configuration
- Display it with the Bell icon (🔔) and amber color

---

## 🎯 What This Gives You

### Plugin Management

#### As an Admin:
1. **Go to** `/plugins` to see all plugins
2. **Broadcast Card** now appears with:
   - 🔔 Bell icon in amber color
   - Description: "Send messages and track acknowledgments"
   - Enabled/disabled badge
   - Click to configure settings

3. **Enable/Disable** from Plugin Management:
   - Admins can toggle the plugin on/off
   - When disabled, the sidebar item is hidden
   - Routes are still protected by authentication

#### Plugin Features Shown:
- ✓ Send messages to multiple recipients (manual, role-based, or team-based)
- ✓ Track acknowledgments in real-time with progress bars
- ✓ Set priority levels (Low, Normal, High, Urgent)
- ✓ Automated reminders for pending acknowledgments
- ✓ Detailed reporting on who acknowledged and when

#### Plugin Benefits Shown:
- ✓ Ensure important messages reach everyone
- ✓ Track compliance with communication requirements
- ✓ Save time with automated acknowledgment tracking
- ✓ Get real-time visibility into message status

---

## 🗄️ Database Structure

### `wh_plugins` Table Entry

```sql
INSERT INTO wh_plugins (slug, name, description, version, is_enabled, settings)
VALUES (
  'broadcasts',
  'Broadcasts',
  'Send messages to multiple recipients and track acknowledgments in real-time',
  '1.0.0',
  true,
  '{
    "icon": "Bell",
    "icon_color": "#f59e0b",
    "default_reminder_interval_hours": 24,
    "max_recipients_per_broadcast": 1000,
    "enable_comments": true,
    "enable_reminders": true
  }'
);
```

### `wh_plugin_routes` Table Entries

All 10 broadcast endpoints are registered:

| Method | Path | Controller | Action |
|--------|------|------------|--------|
| GET | /broadcasts | BroadcastController | index |
| POST | /broadcasts | BroadcastController | store |
| GET | /broadcasts/{id} | BroadcastController | show |
| PATCH | /broadcasts/{id} | BroadcastController | update |
| DELETE | /broadcasts/{id} | BroadcastController | destroy |
| GET | /broadcasts/pending-for-me | BroadcastController | pendingForMe |
| GET | /broadcasts/my-broadcasts | BroadcastController | myBroadcasts |
| POST | /broadcasts/{id}/acknowledge | BroadcastController | acknowledge |
| GET | /broadcasts/{broadcastId}/acknowledgments | BroadcastAcknowledgmentController | index |
| GET | /broadcasts/{broadcastId}/acknowledgments/{userId} | BroadcastAcknowledgmentController | show |

---

## 🔧 Plugin Configuration

### Default Settings

The plugin comes with these configurable settings:

```json
{
  "icon": "Bell",
  "icon_color": "#f59e0b",
  "default_reminder_interval_hours": 24,
  "max_recipients_per_broadcast": 1000,
  "enable_comments": true,
  "enable_reminders": true
}
```

### Updating Plugin Settings

#### Via API:
```http
PATCH /api/plugins/broadcasts/settings
{
  "default_reminder_interval_hours": 48,
  "max_recipients_per_broadcast": 500
}
```

#### Via Tinker:
```php
$plugin = App\Models\Plugin\Plugin::where('slug', 'broadcasts')->first();
$plugin->updateSettings([
    'default_reminder_interval_hours' => 48,
    'max_recipients_per_broadcast' => 500
]);
```

---

## 🎛️ Plugin Management UI

### Plugin Card Display

When users visit `/plugins`, they'll see the Broadcast plugin card:

```
┌────────────────────────────────────┐
│   🔔  Broadcasts                   │
│                                    │
│   Send messages and track          │
│   acknowledgments                  │
│                                    │
│   [ENABLED]  [⚙️ Settings]         │
└────────────────────────────────────┘
```

### Click Behavior

- **If Enabled**: Clicking opens the plugin settings page (`/plugins/broadcasts/settings`)
- **If Disabled**: Clicking opens a modal with:
  - Full feature list
  - Benefits
  - "Contact Sales" button (if needed)

### Pin to Sidebar

Users can:
- Pin/unpin the broadcast plugin in the sidebar
- Reorder it among other pinned plugins
- Enable/disable it entirely

---

## 📊 Plugin Statistics

Track plugin usage via the database:

```sql
-- Get total broadcasts sent
SELECT COUNT(*) FROM wh_broadcasts WHERE created_at > NOW() - INTERVAL '30 days';

-- Get acknowledgment rate
SELECT 
  AVG(total_acknowledged::float / NULLIF(total_recipients, 0) * 100) as avg_acknowledgment_rate
FROM wh_broadcasts
WHERE status = 'active';

-- Get plugin info
SELECT * FROM wh_plugins WHERE slug = 'broadcasts';
```

---

## 🔐 Permissions

By default, the broadcast plugin has no special permission requirements (`required_permissions: []`).

To restrict access:

```php
$plugin = Plugin::where('slug', 'broadcasts')->first();
$plugin->required_permissions = ['send-broadcasts', 'view-broadcasts'];
$plugin->save();
```

Then only users with those permissions can use the plugin.

---

## 🚀 Testing the Plugin System

### 1. Verify Plugin Shows in UI

```bash
# Start your app
cd whagons5-client
npm run dev

# Navigate to http://localhost:3000/plugins
# You should see the Broadcast card
```

### 2. Test Enable/Disable

```sql
-- Disable the plugin
UPDATE wh_plugins SET is_enabled = false WHERE slug = 'broadcasts';

-- Refresh the plugins page
-- The broadcast card should show [DISABLED]
-- The sidebar item should be hidden
```

### 3. Test Route Registration

```bash
# Check registered routes
php artisan route:list --path=broadcasts

# You should see all 10 broadcast routes
```

---

## 🎨 Customization

### Change Plugin Icon or Color

```php
$plugin = Plugin::where('slug', 'broadcasts')->first();
$plugin->updateSettings([
    'icon' => 'Megaphone',  // Any Lucide icon name
    'icon_color' => '#3b82f6'  // Any hex color
]);
```

### Add Custom Plugin Settings

```php
$plugin->updateSettings([
    'enable_attachments' => true,
    'max_attachment_size_mb' => 10,
    'allowed_file_types' => ['pdf', 'doc', 'docx', 'jpg', 'png']
]);
```

---

## 🔄 Migration to Plugin System

### What Changed:

**Before**: Broadcast was a standalone feature with routes in `api.php`

**After**: Broadcast is a registered plugin with:
- Database entry in `wh_plugins`
- Routes in `wh_plugin_routes`
- Visible in Plugin Management UI
- Can be enabled/disabled by admins
- Settings managed through plugin system

### Backwards Compatibility:

✅ **All existing functionality works exactly the same**
- API endpoints unchanged
- Frontend components unchanged
- Database tables unchanged
- Real-time sync unchanged

🆕 **New capabilities added**:
- Admin control over enabling/disabling
- Plugin settings management
- Visibility in Plugin Management UI
- Integration with permission system

---

## 📝 Summary

Run this one command to complete the plugin integration:

```bash
php artisan db:seed --class=BroadcastPluginSeeder
```

That's it! The broadcast system is now a full-fledged plugin that can be:
- ✅ Seen in the Plugins page
- ✅ Enabled/disabled by admins
- ✅ Configured through settings
- ✅ Pinned/unpinned in sidebar
- ✅ Tracked and monitored like other plugins

---

## 🆘 Troubleshooting

### Plugin not showing in UI?

1. **Check database**: `SELECT * FROM wh_plugins WHERE slug = 'broadcasts';`
2. **Clear frontend cache**: Hard refresh (Ctrl+Shift+R)
3. **Check console**: Look for errors in browser console

### Routes not working?

1. **Verify routes**: `php artisan route:list --path=broadcasts`
2. **Check plugin enabled**: `SELECT is_enabled FROM wh_plugins WHERE slug = 'broadcasts';`
3. **Clear route cache**: `php artisan route:clear`

### Sidebar item not appearing?

1. **Check AppSidebar config**: Should have `broadcasts` entry with `Bell` icon
2. **Verify plugin is enabled**: Check in database
3. **Clear localStorage**: Application > Storage > Local Storage > Clear

---

For more details, see the main [BROADCAST_SYSTEM_GUIDE.md](./BROADCAST_SYSTEM_GUIDE.md)
