# Activity Monitor - Real-Time Visualization System

## Overview

The Activity Monitor is a comprehensive real-time activity visualization system that displays what's happening across your WHagons application. It features **10 different visualization styles** that you can switch between to find the perfect view for monitoring your team's activities.

## Features

### 10 Visualization Styles

1. **Activity River** 🌊
   - Flowing cards showing live activity
   - Cards slide in from the right with smooth animations
   - Color-coded by priority (low/normal/high/urgent)
   - Hover effects and detailed information

2. **Animated Kanban** 📋
   - Activities organized into vertical lanes by type
   - Real-time counter badges showing activity per lane
   - Cards animate into their respective lanes
   - Compact, organized view perfect for monitoring

3. **Network Graph** 🕸️
   - Users displayed as nodes with force-directed layout
   - Connections show user interactions (assignments, approvals, etc.)
   - Animated particles flow along connection lines
   - Node size reflects activity level
   - Beautiful canvas-based rendering

4. **Timeline Swim Lanes** 🏊
   - Horizontal timeline with one lane per user
   - Activities positioned by time (last 5 minutes visible)
   - Hover tooltips with full details
   - Perfect for seeing who's doing what and when

5. **3D Card Carousel** 🎠
   - Beautiful 3D rotating carousel of activity cards
   - Center card is highlighted and enlarged
   - Auto-play with manual controls
   - Click center card to pause/resume
   - Stunning visual effect with depth perception

6. **Activity Heat Map** 🔥
   - Grid view showing activity intensity over time
   - 5-minute time slots for the last hour
   - Color intensity shows activity level
   - Includes breakdown by activity type
   - Great for identifying busy periods

7. **Particle Galaxy** 🌌
   - Space-themed particle visualization
   - Activities orbit around a central point
   - Particles connected by collaboration lines
   - Smooth physics simulation
   - Beautiful cosmic aesthetic

8. **Metro Map** 🚇
   - Transit-style visualization
   - Each user is a metro line with their own color
   - Activities are stations along the line
   - Animated train icons show current activity
   - Easy to follow individual user journeys

9. **Music Visualizer** 🎵
   - Audio-reactive style bar chart
   - Bar height represents activity count per user
   - Smooth pulsing animations
   - Colorful gradient bars
   - Hover for detailed breakdown

10. **Physics Card Wall** 🧱
    - Cards fall from above and stack by type
    - Physics-based animations
    - Organized into 8 columns by activity type
    - Hover to lift cards
    - Interactive and engaging

## How to Access

1. **Sidebar Icon**: Look for the Activity Monitor icon (⚡) in your sidebar
   - It's pinned by default for easy access
   - Click to open the Activity Monitor page

2. **Direct URL**: Navigate to `/activity`

## Using the Activity Monitor

### Switching Visualizations

At the top of the page, you'll find a dropdown selector labeled **"View Style"**. Click it to see all 10 visualization options with descriptions. Select any style to instantly switch views.

### Live Updates

- **Green pulse indicator**: Shows when connected to real-time updates
- **Activity counter**: Displays the number of recent activities
- Each visualization automatically updates as new activities occur

### Activity Types Tracked

The system monitors and displays these activity types:

- ✨ **Task Created**: New tasks added to the system
- 📝 **Task Updated**: Modifications to existing tasks
- 🔄 **Status Changed**: Task status transitions
- 💬 **Message Sent**: Team messages and communications
- ✋ **Approval Requested**: Approval requests sent
- ✅ **Approval Decided**: Approval decisions made
- 📢 **Broadcast Sent**: Broadcasts to teams
- 👤 **User Assigned**: Task assignments

## Technical Details

### Architecture

```
ActivityMonitor (Main Component)
├── Mock Data Generator (for demo)
├── Real-time Connection (TODO: integrate RTL)
└── 10 Visualization Components
    ├── ActivityRiver
    ├── AnimatedKanban
    ├── NetworkGraph
    ├── TimelineSwimLanes
    ├── CardCarousel3D
    ├── ActivityHeatMap
    ├── ParticleGalaxy
    ├── MetroMap
    ├── MusicVisualizer
    └── CardWallPhysics
```

### Technologies Used

- **React** + **TypeScript**: Core framework
- **Framer Motion**: Smooth animations and transitions
- **Canvas API**: For network graph and particle galaxy
- **Lucide React**: Icon library
- **Tailwind CSS**: Styling and responsive design

### Real-time Integration (TODO)

Currently, the Activity Monitor uses **mock data** that generates random activities every 3 seconds. To connect to your real-time WebSocket system:

1. Open `src/pages/activity/ActivityMonitor.tsx`
2. Uncomment the RTL integration code (lines ~130-140)
3. The system will automatically start listening to real database events

Example integration:

```typescript
useEffect(() => {
  const rtl = new RealTimeListener({ debug: true });
  
  rtl.on('publication:received', (data) => {
    // Convert publication data to ActivityEvent
    const activity = convertPublicationToActivity(data);
    setActivities(prev => [activity, ...prev].slice(0, 50));
  });
  
  rtl.connectAndHold();
  
  return () => rtl.disconnect();
}, []);
```

### Performance Considerations

- **Activity Limit**: Only the last 50 activities are kept in memory
- **Canvas Optimization**: Network graph and galaxy use requestAnimationFrame
- **Lazy Rendering**: Visualizations only render when selected
- **Efficient Animations**: Framer Motion uses GPU acceleration

## Customization

### Adding New Visualization Types

1. Create a new component in `src/pages/activity/visualizations/`
2. Import it in `ActivityMonitor.tsx`
3. Add to the `visualizationOptions` array
4. Add case in `renderVisualization()` switch statement

### Styling

All visualizations support dark/light mode automatically through Tailwind CSS theme variables.

### Activity Types

To add new activity types:

1. Update `ActivityEvent` type in `ActivityMonitor.tsx`
2. Add emoji/icon in visualization components
3. Update color mappings as needed

## Future Enhancements

Potential improvements:

- [ ] Connect to real WebSocket data
- [ ] Add filtering by user, workspace, or activity type
- [ ] Export activity data/screenshots
- [ ] Add time range selector (last hour, today, this week)
- [ ] User preferences for default visualization
- [ ] Sound notifications for urgent activities
- [ ] Full-screen mode
- [ ] Activity playback/replay feature
- [ ] Custom visualization builder

## Troubleshooting

### No Activities Showing

- Check the connection indicator (should be green and say "Live")
- Verify WebSocket connection in browser console
- Ensure activities are being generated/received

### Performance Issues

- Try simpler visualizations (River, Kanban, Timeline)
- Reduce activity history limit in code
- Check browser console for errors

### Animations Not Smooth

- Ensure hardware acceleration is enabled in browser
- Close other tabs/applications
- Try a different visualization style

## Credits

Created as part of the WHagons v5 Activity Monitoring System.

---

**Enjoy monitoring your team's activities in style!** 🎉
