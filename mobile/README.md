# Native app shells (Capacitor)

Thin native wrappers for Google Play and Apple App Store. Each shell loads your **production** web app in a full-screen WebView — no duplicate business logic.

## Projects

| Folder | Store name | Production URL |
|--------|------------|----------------|
| `wayfinder-pro/` | Wayfinder Pro | `https://wayfinder-pro.thejoshuatree.org` |
| `wayfinder-client/` | Wayfinder | `https://wayfinder.thejoshuatree.org` |
| `joshua-tree-reports/` | Joshua Tree Reports | `https://wayfinder-reports.thejoshuatree.org` |

Adjust URLs in each `capacitor.config.ts` if your domains differ.

## Prerequisites

- Node.js 20+
- **Android:** Android Studio, JDK 17, Android SDK
- **iOS (macOS only):** Xcode 15+, Apple Developer account
- Google Play Console and/or Apple Developer Program enrollment

## First-time setup (per app)

```bash
cd mobile/wayfinder-pro
npm install
npx cap add android
npx cap add ios
```

Repeat for `wayfinder-client` and `joshua-tree-reports`.

## Sync and open native IDEs

```bash
npm run sync
npm run open:android   # Android Studio
npm run open:ios       # Xcode (macOS only)
```

## Building for stores

### Google Play

1. In Android Studio: **Build → Generate Signed Bundle / APK** → Android App Bundle (AAB).
2. Create app in Play Console, upload AAB, complete store listing and privacy policy.
3. Enable **Play App Signing**.
4. For Digital Asset Links (optional TWA-style verification), host `assetlinks.json` on your web origin.

### Apple App Store

1. In Xcode: set **Bundle Identifier**, team, and signing.
2. **Product → Archive** → Distribute to App Store Connect.
3. Complete App Store Connect metadata and privacy nutrition labels.
4. Consider **Associated Domains** for universal links if you use magic-link email on iOS.

## Remote URL mode notes

- `server.url` in `capacitor.config.ts` points the WebView at production. For local dev, comment out `server` and use `webDir` with a static export (not required for this monorepo’s Next.js apps).
- OAuth and magic links: test on device; you may need `@capacitor/app` `appUrlOpen` listener for deep links.
- Update store apps when web deploys — no store release needed for most web-only changes.

## Icons and splash screens

Replace placeholder assets in `android/` and `ios/` after `cap add`:

- Use each app’s `public/favicon.png` (512×512) as source.
- [Capacitor Assets](https://github.com/ionic-team/capacitor-assets): `npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#1a1a1a'`

## Versioning

Bump `version` in `package.json` and native `versionCode` / `CFBundleShortVersionString` together for each store submission.
