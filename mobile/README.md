# Servio Mobile App

Ionic/Capacitor app for iOS and Android.

## Setup

```bash
# Install dependencies
npm install

# Run in browser
npm start

# Build for production
npm run build
```

## Adding Native Platforms

```bash
# Add Android
npx cap add android

# Add iOS
npx cap add ios
```

## Building for Native

```bash
# Build web assets
npm run build

# Sync with native projects
npx cap sync

# Open in Android Studio
npx cap open android

# Open in Xcode
npx cap open ios
```

## Development

- Login page: `/login`
- My Events page: `/my-events` (requires authentication)