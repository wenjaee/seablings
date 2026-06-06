# SEAblings iOS Share Extension Spike

This is a minimal native iOS spike for the hackathon capture proof point. The judged app remains the mobile web app; this folder is source-first material that can be copied into a small Xcode project quickly.

## What This Contains

- `SEAblingsApp/`: a tiny SwiftUI host app so iOS can install the share extension.
- `SEAblingsShareExtension/`: a `UIViewController` share extension that reads shared URLs, text, and images.
- `Shared/CaptureConfig.swift`: demo configuration for the API base URL, bearer token placeholder, and default user.

The share extension posts JSON to:

```text
POST /api/captures
```

Payload fields match the demo API contract:

```json
{
  "userId": "jeff",
  "sourceType": "tiktok",
  "sourceUrl": "https://...",
  "text": "optional text",
  "screenshotName": "optional image name",
  "screenshotBase64": "optional base64 image data"
}
```

## Xcode Setup

1. Open Xcode and create a new iOS App project.
   - Product name: `SEAblings`
   - Interface: `SwiftUI`
   - Language: `Swift`
   - Bundle ID example: `com.jeffcheng.seablings`

2. Add the app shell files to the app target:
   - `ios/SEAblingsApp/SEAblingsApp.swift`
   - `ios/SEAblingsApp/ContentView.swift`
   - `ios/Shared/CaptureConfig.swift`
   - Optional: copy values from `ios/SEAblingsApp/Info.plist` if your generated app target does not already have them.
   - If Xcode generated its own `App.swift`, replace it with `SEAblingsApp.swift` so there is only one `@main` app entry point.

3. Add a Share Extension target.
   - Xcode menu: `File > New > Target > Share Extension`
   - Product name: `SEAblingsShareExtension`
   - Bundle ID example: `com.jeffcheng.seablings.ShareExtension`
   - Host app: `SEAblings`

4. Add these files to the share extension target membership:
   - `ios/SEAblingsShareExtension/ShareViewController.swift`
   - `ios/SEAblingsShareExtension/CaptureClient.swift`
   - `ios/Shared/CaptureConfig.swift`

5. Replace the generated share extension plist settings with the values in:
   - `ios/SEAblingsShareExtension/Info.plist`

6. App Groups are not required for this spike because the extension posts directly to the API. Add an App Group only if the app and extension need to share local settings later, for example `group.com.jeffcheng.seablings`.

## API URL And Token

Edit `ios/Shared/CaptureConfig.swift` before running on Jeff's iPhone:

```swift
static let apiBaseURLString = "http://192.168.1.23:3000"
static let bearerToken = ""
static let userId = "jeff"
```

For a local Next.js API:

1. Start the web app so it listens on the LAN, not just localhost.
   - Example: `npm run dev -- -H 0.0.0.0`
2. Put the Mac and iPhone on the same Wi-Fi.
3. Find the Mac's Wi-Fi IP address.
   - Example command on macOS: `ipconfig getifaddr en0`
4. Set `apiBaseURLString` to `http://<mac-ip>:3000`.

If `SEA_CAPTURE_BEARER_TOKEN` is configured on the API, set `bearerToken` to the same value. Leave it blank for an unauthenticated local demo API. Do not commit a real token.

The provided extension plist allows HTTP for demo/local networking. Tighten App Transport Security settings before any production use.

## Test Path On Jeff's Device

1. In Xcode, select Jeff's iPhone as the run destination.
2. Run the `SEAblings` app once so the share extension is installed.
3. Open Safari, TikTok, Instagram, Notes, or Photos.
4. Use the iOS share sheet and select `SEAblingsShareExtension`.
5. Try these demo inputs:
   - Safari page URL
   - copied/shared text from Notes
   - TikTok or Instagram link when the app exposes one through the share sheet
   - screenshot from Photos
6. Watch the local Next.js server logs or capture UI for `/api/captures` requests.

The extension intentionally completes the share request after the POST response or failure, so it should not leave the share sheet hanging during the demo.
