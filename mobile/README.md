# PentaProtocol — Mobile (Expo / React Native)

Native iOS + Android client for PentaProtocol. Talks to the same
FastAPI backend as the web app (`frontend/`) — no backend changes
required. This folder is part of the monorepo; install + run from
**inside** `mobile/`.

```
pentaprotocol/
├── backend/    # FastAPI (unchanged)
├── frontend/   # Next.js web (unchanged)
└── mobile/     # ← this folder
```

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Expo SDK 54 (React Native 0.81, New Architecture) | Best-in-class native DX, OTA-capable, EAS build/submit |
| Routing | Expo Router 6 (file-based) | Same mental model as Next.js app router |
| Styling | Tamagui + raw RN primitives | Optimizing compiler, native theme tokens |
| Animation | Reanimated 4 + Gesture Handler 2 | UI thread animations, 60/120 fps |
| State | Zustand + AsyncStorage persist | Same store API as the web app |
| Network | Axios | Same client surface as the web app |
| Secure storage | `expo-secure-store` (Keychain / KeyStore) | Hardware-backed JWT storage |
| Auth (Google) | `@react-native-google-signin/google-signin` | Native one-tap; backend already accepts ID-token JWTs |

---

## Quick start

```bash
cd mobile
npm install
cp .env.example .env  # then fill in EXPO_PUBLIC_API_URL etc.
npm run start
```

Then either:
- **Expo Go (fast, no native code):** scan the QR with the Expo Go
  app. Caveat: Google Sign-In + SecureStore plugins won't fully
  work in Expo Go (see below); everything else (login with
  email/password, navigation, theme) does.
- **Development build (recommended):** `npx expo run:android` or
  `npx expo run:ios` builds a local debug native app that includes
  all native modules. First build takes 3–10 minutes; subsequent
  runs are fast.

---

## Environment

Required for the auth flow:

| Key | Notes |
|---|---|
| `EXPO_PUBLIC_API_URL` | FastAPI origin (no trailing slash). For Android emulator → host machine, use `http://10.0.2.2:8000`. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | OAuth Web client ID from Google Cloud Console. The native lib uses this to mint the ID token the backend verifies via `POST /api/auth/google`. |

`EXPO_PUBLIC_*` values are **bundled into the JS** at build time and
visible in the APK/IPA — don't put secrets there. App-side secrets
live in EAS Secrets; backend secrets live on Railway.

---

## Project structure

```
mobile/
├── app/                       # Expo Router routes (file-based)
│   ├── _layout.tsx            # Root: providers, splash, hydration gate
│   ├── index.tsx              # Entry redirect (login vs tabs)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx          # Native login (View/Text/TextInput/Pressable)
│   └── (tabs)/
│       ├── _layout.tsx        # Bottom-tab navigator
│       └── index.tsx          # Home tab (stub)
├── lib/
│   ├── api.ts                 # Axios + auto-Authorization Bearer
│   ├── auth.ts                # signInWithPassword, signInWithGoogle, logout
│   ├── secureStore.ts         # JWT lifecycle on Keychain / KeyStore
│   ├── store.ts               # Zustand + AsyncStorage persist
│   └── types.ts               # User / LoginResponse types
├── theme/
│   ├── tokens.ts              # Colors, space, radii, type, motion
│   └── tamagui.config.ts      # Tamagui config wired to tokens
├── components/                # (carried from scaffold) HapticTab + IconSymbol
├── constants/                 # (carried) Fonts helper
├── hooks/                     # (carried) useColorScheme
├── assets/                    # Icon, splash, adaptive icon
├── app.json                   # Expo config (bundle ID, plugins)
├── babel.config.js            # Tamagui plugin + Reanimated/worklets plugin
└── tsconfig.json
```

---

## Auth model (how it differs from web)

Web stores the JWT in an **HttpOnly cookie** the browser sends
automatically. Mobile can't do that — there's no cookie jar by
default, and even if there were, secure cookie storage is weaker
than the OS keystore. So mobile uses the **bearer header** pattern:

1. `POST /api/auth/login` → backend returns `{ access_token, user }`.
2. We write `access_token` to `expo-secure-store` (Keychain on iOS,
   EncryptedSharedPreferences on Android).
3. The axios interceptor in `lib/api.ts` reads the token on every
   request and attaches `Authorization: Bearer <token>`.
4. The cached `user` profile lives in zustand + AsyncStorage so the
   home tab paints instantly on cold start.
5. Logout clears both.

**Backend changes required: zero.** `auth_dep.get_current_user`
already falls back to the bearer header when the cookie isn't
present.

---

## Native modules + Expo Go

Three of our dependencies are native modules (Java/Kotlin/ObjC):

- `expo-secure-store`
- `@react-native-async-storage/async-storage`
- `@react-native-google-signin/google-signin`

The first two are bundled into the Expo Go client, so they "just
work". **Google Sign-In is not** — it needs a development build. We
detect this at runtime in `app/(auth)/login.tsx` and show a clear
"needs dev build" message when the user taps the Google button in
Expo Go, rather than crashing.

To enable Google Sign-In end-to-end:
1. `npm install -g eas-cli` and `eas login`.
2. `eas build --profile development --platform android` (or `ios`).
3. Install the resulting APK / dev-client on your device.
4. Run `npx expo start --dev-client`.

---

## Path forward

Phase 0 (this scaffold) is complete. Next milestones, in order:

- **Phase 1 — auth foundation** (you are here): login + secure
  session + home stub.
- **Phase 2 — design system**: build the primitive components
  (`<Screen>`, `<Card>`, `<Btn>`, `<Title>`, etc.) on Tamagui so
  every future screen just composes them.
- **Phase 3 — training mode**: port `lib/winChecker7`,
  `lib/botEngine7`, `lib/patternsMetadata` from the web frontend;
  build the board renderer in React Native Skia.
- **Phase 4 — multiplayer**: lobby + match flow over the existing
  WebSocket endpoints.
- **Phase 5 — store listing**: feature graphic, screenshots, data
  safety form, content rating, closed test, production release.

See the full plan in the project root issue tracker.
