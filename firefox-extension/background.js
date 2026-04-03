let ws = null;
let previousTabId = null;
const RECONNECT_DELAY = 3000;

// ---- WebSocket Connection ----

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log("[Extension] Attempting WebSocket connection...");

  try {
    ws = new WebSocket("ws://localhost:8080");
  } catch (e) {
    console.error("[Extension] Failed to create WebSocket:", e);
    setTimeout(connect, RECONNECT_DELAY);
    return;
  }

  ws.onopen = () => {
    console.log("[Extension] Connected to WebSocket server");
    ws.send(JSON.stringify({ client: "extension" }));
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
    console.log("[Extension] Disconnected. Reconnecting...");
    ws = null;
    setTimeout(connect, RECONNECT_DELAY);
  };

  ws.onerror = () => {
    console.error("[Extension] WebSocket error");
    // onclose will fire after this, which handles reconnection
  };
}

// ---- Command Handler ----

async function handleCommand(payload) {
  console.log("[Extension] Received command:", payload);

  if (payload === "EMERGENCY") {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const activeTab = tabs[0];
    if (activeTab) {
      previousTabId = activeTab.id;
      try {
        await browser.tabs.sendMessage(activeTab.id, {
          type: "COMMAND",
          payload: "PLAY_PAUSE",
        });
      } catch (e) {
        console.warn("[Extension] Could not send pause:", e.message);
      }
    }
    browser.tabs.create({ url: "about:blank" });
    return;
  }

  if (payload === "EMERGENCY_RESET") {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const currentTab = tabs[0];
    if (currentTab) {
      browser.tabs.remove(currentTab.id);
    }
    if (previousTabId !== null) {
      try {
        await browser.tabs.update(previousTabId, { active: true });
        setTimeout(async () => {
          try {
            await browser.tabs.sendMessage(previousTabId, {
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
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const activeTab = tabs[0];
    if (activeTab) {
      try {
        const win = await browser.windows.get(activeTab.windowId);
        const newState = win.state === "fullscreen" ? "maximized" : "fullscreen";
        await browser.windows.update(activeTab.windowId, { state: newState });
      } catch (e) {
        console.warn("[Extension] Could not toggle browser fullscreen:", e.message);
      }
    }
    // We intentionally do not return here! We want this payload ALSO forwarded to the content script
    // so it can stretch the video to match the new F11 window size using CSS.
  }

  // For all other commands, find active tab and forward to content script
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const activeTab = tabs[0];

  if (!activeTab) {
    console.warn("[Extension] No active tab found");
    return;
  }

  try {
    await browser.tabs.sendMessage(activeTab.id, {
      type: "COMMAND",
      payload: payload,
    });
    console.log("[Extension] Command sent to tab:", activeTab.id);
  } catch (e) {
    console.warn("[Extension] Could not send message to content script:", e.message);
  }
}

// ---- Start ----
connect();
