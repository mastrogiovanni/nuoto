# Nuoto iPhone App

iOS WKWebView wrapper for the Nuoto swimmer app hosted at `https://mastrogiovanni.ddns.net`.

## Requirements

- [Xcode](https://developer.apple.com/xcode/) 15 or newer (macOS only)
- iOS 16.0+ deployment target
- An Apple Developer account (free account works for device testing via USB)

## Project Structure

```
iphone/
├── Nuoto.xcodeproj/
│   └── project.pbxproj          # Xcode project configuration
├── Nuoto/
│   ├── NuotoApp.swift            # App entry point (@main)
│   ├── ContentView.swift         # Root SwiftUI view
│   ├── WebView.swift             # WKWebView UIViewRepresentable wrapper
│   ├── Info.plist                # App metadata & permissions
│   └── Assets.xcassets/          # App icon & accent colour
└── README.md
```

## Build Instructions

### 1. Open the project in Xcode

```bash
open iphone/Nuoto.xcodeproj
```

Or launch Xcode, choose **File > Open**, and navigate to `iphone/Nuoto.xcodeproj`.

### 2. Set your Development Team

1. Select the **Nuoto** project in the navigator.
2. Select the **Nuoto** target → **Signing & Capabilities**.
3. Choose your personal or organisation team from the **Team** dropdown.
   - A free Apple ID is sufficient for running on a physical device via USB.

### 3. Run on a physical device

1. Connect your iPhone via USB and trust the computer when prompted.
2. Select your device from the scheme/device picker in the Xcode toolbar.
3. Press **▶ Run** (⌘R).

### 4. Run on the Simulator

1. Select any iPhone simulator from the toolbar.
2. Press **▶ Run** (⌘R).

### 5. Build a release IPA (App Store / Ad Hoc)

1. **Product > Archive** (requires a paid Apple Developer account for distribution).
2. In the Organiser, click **Distribute App** and follow the wizard.

## App Behaviour

- Opens `https://mastrogiovanni.ddns.net` in a full-screen WKWebView on launch.
- **Pull down** to refresh the current page.
- **Swipe left/right** to navigate back/forward within WebView history (native gesture).
- JavaScript and inline media playback are enabled so the web app works fully.
- Only HTTPS traffic is permitted (`NSAllowsArbitraryLoads = false`).
- A friendly Italian error page is shown if the network is unreachable.

## Troubleshooting

| Problem | Solution |
|---|---|
| "No account for team" error | Add your Apple ID in **Xcode > Settings > Accounts** |
| Device not trusted | Tap **Trust** on the device when prompted; on iOS 16+ go to **Settings > General > VPN & Device Management** |
| Page does not load | Ensure the device has internet access and `https://mastrogiovanni.ddns.net` is reachable |
| Build error: missing Info.plist | Confirm `INFOPLIST_FILE = Nuoto/Info.plist` in Build Settings and the file exists |
