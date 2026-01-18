# Videos Directory

This directory contains video files used throughout the application.

## Adding Your Own Video

To use a custom video on the login page:

1. Place your video file here (e.g., `demo.mp4`)
2. Update the video source in `src/pages/authentication/SignIn.tsx`:

```tsx
<source 
  src="/videos/demo.mp4" 
  type="video/mp4" 
/>
```

## Recommended Video Specifications

- **Format**: MP4 (H.264 codec)
- **Duration**: 10-30 seconds (looping)
- **Resolution**: 1080x1920 (vertical/portrait for phone mockup)
- **File Size**: Under 5MB for optimal loading
- **Frame Rate**: 30fps

## Current Video Sources

The login page currently uses external CDN videos:
- Primary: Local video (`/videos/demo.mp4`) if available
- Fallback 1: Young woman using phone (vertical, mobile-focused productivity)
- Fallback 2: Woman working with laptop and smartphone (multitasking workflow)
- Fallback 3: Business team collaboration in meeting room
- Fallback UI: Gradient background if all videos fail

These videos showcase productivity, task management, and team collaboration - aligned with Whagons' workspace management platform.

Replace the primary source with your own local video for better performance and reliability.
