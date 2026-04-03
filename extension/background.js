let ws = null;
let previousTabId = null;

const RECONNECT_ALARM = "ws-reconnect";
const KEEPALIVE_ALARM = "ws-keepalive";

// ---- WebSocket Connection ----

function connect() {
  // Don't create duplicate connections
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log("[Extension] Attempting WebSocket connection...");

  try {
    ws = new WebSocket("ws://localhost:8080");
  } catch (e) {
    console.error("[Extension] Failed to create WebSocket:", e);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log("[Extension] Connected to WebSocket server");
    ws.send(JSON.stringify({ client: "extension" }));
    // Clear any pending reconnect alarm
    chrome.alarms.clear(RECONNECT_ALARM);
  };

  ws.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (err) {
      console.error("[Extension] Invalid JSON:", event.data);
      return;
    }

    if (message.type === "COMMAND") {
      handleCommand(message.payload);
    }
  };

  ws.onclose = () => {
    console.log("[Extension] Disconnected.");
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    console.error("[Extension] WebSocket error");
    // onclose will fire after this, which handles reconnection
  };
}

function scheduleReconnect() {
  // Use chrome.alarms — survives service worker termination
  chrome.alarms.create(RECONNECT_ALARM, { delayInMinutes: 0.05 }); // ~3 seconds
  console.log("[Extension] Reconnect scheduled via alarm");
}

// ---- Alarm Listener (reconnect & keepalive) ----

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM || alarm.name === KEEPALIVE_ALARM) {
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connect();
    }
  }
});

// ---- MV3 Lifecycle Events ----

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Extension] Installed / Updated — connecting");
  // Keepalive alarm: wakes the service worker periodically to maintain the connection
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.25 });
  connect();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[Extension] Browser started — connecting");
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.25 });
  connect();
});

// ---- Command Handler ----

async function handleCommand(payload) {
  console.log("[Extension] Received command:", payload);

  if (payload === "EMERGENCY") {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab) {
      previousTabId = activeTab.id;
      try {
        await chrome.tabs.sendMessage(activeTab.id, {
          type: "COMMAND",
          payload: "PLAY_PAUSE",
        });
      } catch (e) {
        console.warn("[Extension] Could not send pause:", e.message);
      }
    }
    chrome.tabs.create({ url: "about:blank" });
    return;
  }

  if (payload === "EMERGENCY_RESET") {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentTab) {
      chrome.tabs.remove(currentTab.id);
    }
    if (previousTabId !== null) {
      try {
        await chrome.tabs.update(previousTabId, { active: true });
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(previousTabId, {
              type: "COMMAND",
              payload: "PLAY_PAUSE",
            });
          } catch (e) {
            console.warn("[Extension] Could not send play:", e.message);
          }
          previousTabId = null;
        }, 300);
      } catch (e) {
        console.warn("[Extension] Could not activate previous tab:", e.message);
        previousTabId = null;
      }
    }
    return;
  }

  if (payload === "TOGGLE_FULLSCREEN") {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab) {
      try {
        const win = await chrome.windows.get(activeTab.windowId);
        const newState = win.state === "fullscreen" ? "maximized" : "fullscreen";
        await chrome.windows.update(activeTab.windowId, { state: newState });
      } catch (e) {
        console.warn("[Extension] Could not toggle browser fullscreen:", e.message);
      }
    }
    // We intentionally do not return here! We want this payload ALSO forwarded to the content script
    // so it can stretch the video to match the new F11 window size using CSS.
  }

  // For all other commands, find active tab and forward to content script
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab) {
    console.warn("[Extension] No active tab found");
    return;
  }

  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      type: "COMMAND",
      payload: payload,
    });
    console.log("[Extension] Command sent to tab:", activeTab.id);
  } catch (e) {
    console.warn("[Extension] Could not send message to content script:", e.message);
  }
}

// ---- Initial Connection ----
// This runs every time the service worker starts
connect();
