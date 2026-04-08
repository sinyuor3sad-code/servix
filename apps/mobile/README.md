# SERVIX Mobile App

## Status: Planned for Next Phase

Native React Native app for salon owners (iOS + Android).

### Planned Features
- Login with Biometric authentication (Fingerprint/FaceID)
- Today's dashboard with real-time stats
- Appointment management (create/edit/cancel)
- Client management (view/search/add)
- Push Notifications via Firebase Cloud Messaging
- Offline-first with background sync
- Deep linking from notifications
- ZATCA invoice generation with QR codes
- Multi-language support (Arabic/English)

### Tech Stack
- React Native 0.76+ with TypeScript
- React Navigation (Stack + Bottom Tabs)
- TanStack React Query (server state)
- Zustand (client state)
- react-native-keychain (Biometric auth)
- @react-native-firebase/messaging (FCM)
- react-native-mmkv (Offline storage)
- react-native-reanimated (Animations)

### Architecture
```
src/
  app/App.tsx                    - Entry point with providers
  navigation/RootNavigator.tsx   - Auth + Main navigators  
  screens/
    LoginScreen.tsx              - Phone + password + biometric
    DashboardScreen.tsx          - Today stats + quick actions
    AppointmentsScreen.tsx       - Calendar + list view
    ClientsScreen.tsx            - Client directory
    ServicesScreen.tsx            - Service catalog
    ProfileScreen.tsx            - Owner profile + settings
  services/
    api.ts                       - Axios/fetch API client (same backend)
    auth.ts                      - Token management
  stores/
    auth.store.ts                - Zustand auth state
    settings.store.ts            - App settings
  hooks/
    useBiometric.ts              - Biometric auth hook
    useOfflineQueue.ts           - MMKV offline queue
  lib/
    mmkv.ts                      - MMKV instance
    queryClient.ts               - React Query config
```

### Getting Started
See ADR-006 (docs/adr/006-react-native-mobile.md) for architectural decisions.

### Prerequisites
- Node.js 20+
- React Native CLI
- Xcode 15+ (iOS)
- Android Studio (Android)
- CocoaPods (iOS)
