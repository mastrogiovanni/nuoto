# Nuoto Android App

Android WebView wrapper for the Nuoto swimmer app hosted at `https://mastrogiovanni.ddns.net`.

## Requirements

- [Android Studio](https://developer.android.com/studio) Hedgehog (2023.1.1) or newer
- JDK 17 (bundled with Android Studio)
- Android SDK 34 (installed via Android Studio SDK Manager)
- A physical Android device (Android 7.0+) or an emulator

## Project Structure

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/net/mastrogiovanni/nuoto/
│   │   │   └── MainActivity.java       # WebView activity
│   │   ├── res/
│   │   │   ├── layout/activity_main.xml
│   │   │   ├── values/strings.xml
│   │   │   ├── values/themes.xml
│   │   │   └── drawable/               # App icon assets
│   │   └── AndroidManifest.xml
│   ├── build.gradle
│   └── proguard-rules.pro
├── gradle/wrapper/
│   └── gradle-wrapper.properties
├── build.gradle
├── settings.gradle
└── README.md
```

## Build Instructions

### 1. Open the project in Android Studio

1. Launch Android Studio.
2. Select **File > Open**.
3. Navigate to this `android/` directory and click **OK**.
4. Wait for the Gradle sync to complete (Android Studio will download all dependencies automatically).

### 2. Install required SDK components (first time only)

If Android Studio prompts about missing SDK components:

1. Go to **Tools > SDK Manager**.
2. Under **SDK Platforms**, install **Android 14 (API 34)**.
3. Under **SDK Tools**, ensure **Android SDK Build-Tools 34** is installed.
4. Click **Apply** and let the installation finish.

### 3. Run on a physical device

1. On your Android phone, enable **Developer Options**:
   - Go to **Settings > About phone**.
   - Tap **Build number** seven times.
2. Enable **USB Debugging** in **Settings > Developer Options**.
3. Connect the phone via USB and accept the debugging prompt on the device.
4. In Android Studio, select your device from the device dropdown in the toolbar.
5. Click the **Run** button (green triangle) or press `Shift+F10`.

### 4. Run on an emulator

1. In Android Studio, go to **Tools > Device Manager**.
2. Click **Create Device**.
3. Choose a hardware profile (e.g. Pixel 6) and click **Next**.
4. Download a system image for **API 34** and click **Next > Finish**.
5. Start the emulator from Device Manager, then click **Run** in the toolbar.

## Build a Release APK

To generate a release APK for distribution:

1. In Android Studio, go to **Build > Generate Signed Bundle / APK**.
2. Select **APK** and click **Next**.
3. Create or select a keystore file:
   - **New keystore**: fill in the path, password, alias, and certificate details, then click **OK**.
   - **Existing keystore**: browse to your `.jks` file and enter credentials.
4. Select the **release** build variant and click **Finish**.
5. The signed APK will be generated at:
   ```
   app/release/app-release.apk
   ```

### Build from the command line

```bash
# Debug APK
./gradlew assembleDebug

# Release APK (requires a configured keystore in app/build.gradle or via env vars)
./gradlew assembleRelease
```

The debug APK is output to `app/build/outputs/apk/debug/app-debug.apk`.

## Install APK directly on a device

If you have `adb` available (part of Android SDK platform-tools):

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## App Behaviour

- Opens `https://mastrogiovanni.ddns.net` in a full-screen WebView on launch.
- **Pull down** to refresh the current page.
- **Back button** navigates within the WebView history; exits the app when there is no history left.
- JavaScript and DOM storage are enabled so the web app works fully.
- Only HTTPS traffic is permitted (no cleartext).

## Troubleshooting

| Problem | Solution |
|---|---|
| Gradle sync fails | Check your internet connection; go to **File > Invalidate Caches > Invalidate and Restart** |
| Device not detected | Ensure USB Debugging is enabled and you accepted the RSA key prompt on the device |
| Page does not load | Confirm the device has internet access and `https://mastrogiovanni.ddns.net` is reachable |
| White screen on launch | Check that the `INTERNET` permission is present in `AndroidManifest.xml` |
