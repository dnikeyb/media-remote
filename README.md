# Media Remote

A remote control system that allows you to control media playback (YouTube, Netflix, AniWorld) on your desktop browser from your smartphone.

## Features

- **Mobile Web Interface**: A clean browser-based UI for mobile devices.
- **Fullscreen API Support**: Combines standard `requestFullscreen()` and Chrome's `chrome.windows` API to handle fullscreen across different streaming sites.
- **Netflix Support**: Injects code to communicate with Netflix's internal video player API to support playback controls.
- **Iframe Support**: Uses `window.postMessage` to send commands to media players embedded in cross-origin iframes (e.g., VOE on AniWorld).
- **Episode Navigation**: Calculates URLs (`/staffel-X/episode-Y`) to navigate to the next episode on AniWorld.
- **Controls**:
  - Play / Pause
  - Next Episode 
  - Skip Intro (+85s)
  - Seek (-10s / +10s)
  - Volume (Up, Down, Mute)
  - Restart Video (0:00)
  - Panic Button (Pauses and hides media)

## Architecture

The project consists of three main parts:
1. **Server (`/server`)**: A Node.js server that serves the mobile frontend UI and runs a WebSocket server to pass commands between the phone and the browser extension.
2. **Frontend (`/frontend`)**: A web interface that runs on your smartphone, sending inputs to the WebSocket server.
3. **Extensions (`/extension` for Chrome/Edge, `/firefox-extension` for Firefox)**: Background worker and content scripts that listen to the WebSocket and execute changes on the web page.

## Installation & Setup

### 1. Start the Server
- **Windows**: Just double-click the `Start Server.vbs` file. This will safely start the Node.js server in the background without keeping a terminal window open.
- **Manual**: Alternatively, open a terminal in the `/server` folder and run `npm start` (or `node server.js`).

### 2. Load the Extension
**For Chrome / Edge / Brave (MV3):**
1. Go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.

**For Firefox (MV2):**
To keep the extension permanently installed:
1. Open `about:addons`.
2. Click the Gear Symbol **Tools for all Addons**.
3. Click **Install from Files**.
4. Go to **\firefox-extension\versions** and select **b874390525584760bedb-1.1.0.xpi**.

### 3. Connect the Remote
1. Ensure your smartphone is connected to the same local WiFi network as your PC.
2. Open your smartphone browser and navigate to: `http://<YOUR-PC-IP-ADDRESS>:8080`
   *(Example: `http://192.168.1.100:8080`. Find your PC's IP using `ipconfig` on Windows or `ifconfig` on Mac/Linux).*
3. The remote will load, and the dot in the top corner will turn green once connected.
