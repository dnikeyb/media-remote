(function () {
  "use strict";

  // ---- Configuration ----
  const SERVER_HOST = window.location.hostname || "localhost";
  const SERVER_PORT = 8080;
  const WS_URL = `ws://${SERVER_HOST}:${SERVER_PORT}`;
  const RECONNECT_DELAY = 2000;

  // ---- DOM Elements ----
  const statusIndicator = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const serverAddress = document.getElementById("serverAddress");
  const buttons = document.querySelectorAll(".btn[data-command]");

  // ---- State ----
  let ws = null;
  let reconnectTimer = null;

  // ---- UI Helpers ----
  function setOnline() {
    statusIndicator.classList.add("online");
    statusText.textContent = "Connected";
    statusText.style.color = "#00e676";
    serverAddress.textContent = `${SERVER_HOST}:${SERVER_PORT}`;
  }

  function setOffline() {
    statusIndicator.classList.remove("online");
    statusText.textContent = "Reconnecting...";
    statusText.style.color = "";
  }

  // ---- Ripple Effect ----
  function createRipple(event, button) {
    const circle = document.createElement("span");
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    let x, y;
    if (event.touches && event.touches.length > 0) {
      x = event.touches[0].clientX - rect.left - size / 2;
      y = event.touches[0].clientY - rect.top - size / 2;
    } else {
      x = event.clientX - rect.left - size / 2;
      y = event.clientY - rect.top - size / 2;
    }

    circle.style.width = circle.style.height = `${size}px`;
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.classList.add("ripple");

    // Remove existing ripple
    const existingRipple = button.querySelector(".ripple");
    if (existingRipple) existingRipple.remove();

    button.appendChild(circle);

    circle.addEventListener("animationend", () => circle.remove());
  }

  // ---- WebSocket ----
  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    ws = new WebSocket(WS_URL);

    ws.onopen = function () {
      console.log("[Frontend] Connected to", WS_URL);
      // Identify as frontend
      ws.send(JSON.stringify({ client: "frontend" }));
      setOnline();
    };

    ws.onclose = function () {
      console.log("[Frontend] Disconnected");
      setOffline();
      scheduleReconnect();
    };

    ws.onerror = function (err) {
      console.error("[Frontend] WebSocket error");
      ws.close();
    };

    ws.onmessage = function (event) {
      // Frontend doesn't expect messages, but log them
      console.log("[Frontend] Received:", event.data);
    };
  }

  function scheduleReconnect() {
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(function () {
        reconnectTimer = null;
        console.log("[Frontend] Reconnecting...");
        connect();
      }, RECONNECT_DELAY);
    }
  }

  function sendCommand(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[Frontend] Not connected. Command not sent:", payload);
      return;
    }

    const message = {
      client: "frontend",
      type: "COMMAND",
      payload: payload,
    };

    ws.send(JSON.stringify(message));
    console.log("[Frontend] Sent command:", payload);
  }

  // ---- Button Event Binding ----
  buttons.forEach(function (btn) {
    const command = btn.getAttribute("data-command");
    let touchFired = false;

    // On mobile: touchend fires the command (preventDefault stops the click)
    btn.addEventListener("touchend", function (e) {
      e.preventDefault();
      touchFired = true;
      createRipple(e, btn);
      sendCommand(command);
    });

    // On desktop: click fires the command (skip if touchend already handled it)
    btn.addEventListener("click", function (e) {
      if (touchFired) {
        touchFired = false;
        return;
      }
      createRipple(e, btn);
      sendCommand(command);
    });
  });

  // ---- Initialize ----
  serverAddress.textContent = `${SERVER_HOST}:${SERVER_PORT}`;
  connect();
})();
