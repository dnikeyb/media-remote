// Detect which site we are on
function detectSite() {
  const hostname = window.location.hostname;
  if (hostname.includes("youtube.com")) return "youtube";
  if (hostname.includes("netflix.com")) return "netflix";
  if (hostname.includes("aniworld") || hostname.includes("s.to")) return "aniworld";
  return "unknown";
}

// Dispatch a keyboard event to the document
function dispatchKey(key, options = {}) {
  const eventOptions = {
    key: key,
    code: options.code || "",
    keyCode: options.keyCode || 0,
    which: options.which || options.keyCode || 0,
    bubbles: true,
    cancelable: true,
    shiftKey: options.shiftKey || false,
    ctrlKey: options.ctrlKey || false,
    altKey: options.altKey || false,
    metaKey: options.metaKey || false,
  };

  const target = options.target || document.activeElement || document.body;

  target.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
  target.dispatchEvent(new KeyboardEvent("keypress", eventOptions));
  target.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
}

// Get the primary video element on the page
function getVideo() {
  return document.querySelector("video");
}

function randomDelay(min = 200, max = 500) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// ---- Netflix Helpers ----

function netflixInjectScript(code) {
  const script = document.createElement("script");
  script.textContent = code;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function netflixSeek(offsetSeconds) {
  netflixInjectScript(`
    try {
      const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
      const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
      const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
      player.seek(player.getCurrentTime() + (${offsetSeconds} * 1000));
    } catch(e) {
      console.warn('[Remote Control] Netflix API seek failed:', e);
    }
  `);
}

function netflixShowControls() {
  const playerContainer =
    document.querySelector(".watch-video") ||
    document.querySelector(".NFPlayer") ||
    document.querySelector("[data-uia='video-canvas']") ||
    document.querySelector("video");
  if (playerContainer) {
    playerContainer.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 100, clientY: 100 })
    );
  }
}

// ---- AniWorld / Cross-Origin Iframe Helpers ----

function findVoeIframe() {
  const iframes = Array.from(document.querySelectorAll("iframe"));
  return iframes.find((f) => f.src && (f.src.toLowerCase().includes("voe") || f.src.includes("redirect"))) || iframes[0];
}

function broadcastToIframes(commandPayload) {
  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((iframe) => {
    try {
      iframe.contentWindow.postMessage({ type: "VOE_COMMAND", payload: commandPayload }, "*");
    } catch (e) {
      console.warn("[Remote Control] Error posting message to iframe:", e);
    }
  });
}

const PLAY_SELECTORS = [
  '.plyr__control--overlaid',
  '.vjs-big-play-button',
  '.voe-play-button',
  '#play-button',
  '.play-btn',
  '.big-play-button',
  '.play-overlay',
  '.vp-controls-wrapper [aria-label="Play"]',
  '[class*="play-button"]'
];

function tryPlayOverlay(video) {
  // 1. Try specific known selectors
  for (const selector of PLAY_SELECTORS) {
    const btn = document.querySelector(selector);
    if (btn && typeof btn.click === 'function' && btn.offsetParent !== null) {
      const delay = randomDelay();
      console.log('[Remote-Auto] Clicking play overlay after ' + delay + 'ms:', selector);
      setTimeout(() => {
        if (btn && typeof btn.click === 'function') btn.click();
      }, delay);
      return true; 
    }
  }

  // 2. Brute Force Fallback: Click the exact center of the screen
  const delay = randomDelay(600, 1000);
  console.log('[Remote-Auto] Brute force: Clicking viewport center after ' + delay + 'ms');
  setTimeout(() => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const el = document.elementFromPoint(centerX, centerY);
    if (el && typeof el.click === 'function') {
      console.log('[Remote-Auto] Centered element found, clicking:', el.tagName);
      el.click();
    }
  }, delay);

  // 3. Direct Playback Fallback
  if (video && video.paused) {
    const playDelay = randomDelay(1200, 1600);
    setTimeout(() => {
      if (video && video.paused) {
        video.play().catch(() => {
          video.muted = true;
          video.play();
        });
      }
    }, playDelay);
    return true;
  }
  return false;
}

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "VOE_COMMAND") {
    const video = getVideo();
    
    // Commands other than Play/Pause still require a video element
    if (!video && event.data.payload !== "PLAY_PAUSE") return;

    switch (event.data.payload) {
      case "PLAY_PAUSE":
        console.log("[Content] VOE Iframe: Attempting PLAY_PAUSE");
        if (!video || video.paused) {
          tryPlayOverlay(video);
        } else if (video) {
          video.pause();
        }
        break;
      case "SEEK_BACK_10":
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case "SEEK_FORWARD_10":
        video.currentTime += 10;
        break;
      case "TOGGLE_FULLSCREEN":
        togglePseudoFullscreen(video);
        break;
      case "RESTART_VIDEO":
        video.currentTime = 0;
        video.play();
        break;
      case "VOLUME_UP":
        video.volume = Math.max(0, Math.min(1, video.volume + 0.1));
        break;
      case "VOLUME_DOWN":
        video.volume = Math.max(0, Math.min(1, video.volume - 0.1));
        break;
      case "MUTE_TOGGLE":
        video.muted = !video.muted;
        break;
      case "SKIP_INTRO":
        video.currentTime += 85;
        break;
    }
  }
});

function performAniWorldNextEpisode() {
  const path = window.location.pathname; // e.g., /anime/stream/name/staffel-1/episode-1
  const match = path.match(/\/staffel-(\d+)\/episode-(\d+)/i);
  
  if (match) {
    const currentSeason = parseInt(match[1], 10);
    const currentEpisode = parseInt(match[2], 10);
    
    // Attempt to find the next episode link directly
    const nextEpPath = path.replace(/\/episode-\d+/i, `/episode-${currentEpisode + 1}`);
    const nextEpLink = document.querySelector(`a[href$="${nextEpPath}"]`) || document.querySelector(`a[href="${nextEpPath}"]`);
    
    if (nextEpLink) {
      nextEpLink.click();
      return true;
    }
    
    // If next episode doesn't exist, check for the next season
    const nextSeasonPath = path.replace(/\/staffel-\d+\/episode-\d+/i, `/staffel-${currentSeason + 1}`);
    const nextSeasonLink = document.querySelector(`a[href$="${nextSeasonPath}"]`) || document.querySelector(`a[href^="${nextSeasonPath}"]`);
    
    if (nextSeasonLink) {
      // Navigate to the first episode of the next season
      const nextSeasonEp1 = path.replace(/\/staffel-\d+\/episode-\d+/i, `/staffel-${currentSeason + 1}/episode-1`);
      window.location.href = nextSeasonEp1;
      return true;
    }
  }

  // Fallback to text matching if URL parsing fails or is not applicable
  const keywords = ["next", "weiter", "nächste", "nachste", "episode"];
  const elements = document.querySelectorAll("a, button");
  for (const el of elements) {
    const text = (el.innerText || "").trim().toLowerCase();
    if (text && keywords.some((kw) => text === kw || text.includes(" " + kw) || text.includes(kw + " "))) {
      el.click();
      return true;
    }
  }
  return false;
}

function ensureVoeActive() {
  if (detectSite() !== "aniworld") return false;
  
  const hosterList = document.querySelector('.hosterSiteVideo ul') || document.querySelector('.hosterList');
  if (!hosterList) return false;

  const activeHoster = hosterList.querySelector('.active');
  if (activeHoster && activeHoster.innerText.includes('VOE')) return true;

  console.log('[Remote-Auto] VOE is not active. Attempting to switch to VOE...');
  const voeLink = Array.from(hosterList.querySelectorAll('li'))
                       .find(li => li.innerText.includes('VOE'));
  if (voeLink) {
    // Scroll player into view
    document.querySelector('.hosterSiteVideo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    const delay = randomDelay(400, 800);
    setTimeout(() => {
      console.log('[Remote-Auto] Clicking VOE hoster after ' + delay + 'ms');
      voeLink.click();
    }, delay);
    return true;
  }
  return false;
}

// ---- Command Handlers ----

function handlePlayPause(site) {
  if (site === "youtube") {
    dispatchKey("k", { code: "KeyK", keyCode: 75, target: document.body });
  } else if (site === "netflix") {
    const playPauseBtn =
      document.querySelector('[data-uia="control-play-pause-toggle"]') ||
      document.querySelector('[data-uia="control-play-pause-pause"]') ||
      document.querySelector('[data-uia="control-play-pause-play"]') ||
      document.querySelector(".button-nfplayerPause") ||
      document.querySelector(".button-nfplayerPlay");
    if (playPauseBtn) {
      playPauseBtn.click();
    } else {
      netflixInjectScript(`
        try {
          const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
          const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
          const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
          if (player.isPaused()) {
            player.play();
          } else {
            player.pause();
          }
        } catch(e) {
          const v = document.querySelector('video');
          if (v) { v.paused ? v.play() : v.pause(); }
        }
      `);
    }
  } else if (site === "aniworld") {
    // Check if we are on VOE hoster, if not, switch to it
    ensureVoeActive();
    
    // AniWorld has a parent-level overlay before the iframe is actually active sometimes.
    const parentOverlays = ['.inSiteWebStream', '.hosterSiteVideo', '.play-wrapper', '.play-btn-large', '.play-button'];
    parentOverlays.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) {
        const delay = randomDelay();
        setTimeout(() => {
          if (el && typeof el.click === 'function') el.click();
        }, delay);
      }
    });
    broadcastToIframes("PLAY_PAUSE");
  } else {
    // Fallback: directly toggle video play/pause
    const video = getVideo();
    if (video) {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  }
}

function handleSeekBack10(site) {
  if (site === "youtube") {
    dispatchKey("j", { code: "KeyJ", keyCode: 74, target: document.body });
  } else if (site === "netflix") {
    netflixSeek(10);
  } else if (site === "aniworld") {
    broadcastToIframes("SEEK_BACK_10");
  } else {
    const video = getVideo();
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - 10);
    }
  }
}

function handleSeekForward10(site) {
  if (site === "youtube") {
    dispatchKey("l", { code: "KeyL", keyCode: 76, target: document.body });
  } else if (site === "netflix") {
    netflixSeek(10);
  } else if (site === "aniworld") {
    broadcastToIframes("SEEK_FORWARD_10");
  } else {
    const video = getVideo();
    if (video) {
      video.currentTime += 10;
    }
  }
}

function handleRestart(site) {
  const video = getVideo();
  if (site === 'youtube') {
    dispatchKey("0", { code: "Digit0", keyCode: 48, target: document.body });
  } else if (site === 'netflix') {
    netflixInjectScript(`
      try {
        const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
        const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
        const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
        player.seek(0);
      } catch(e) {}
    `);
  } else if (site === 'aniworld') {
    broadcastToIframes("RESTART_VIDEO");
  } else {
    if (video) { video.currentTime = 0; video.play(); }
  }
}

function handleVolumeChange(site, up) {
  const video = getVideo();
  const dir = up ? 0.1 : -0.1;
  const key = up ? "ArrowUp" : "ArrowDown";
  const keyCode = up ? 38 : 40;
  
  if (site === 'youtube') {
    dispatchKey(key, { code: key, keyCode: keyCode, target: document.body });
  } else if (site === 'netflix') {
    netflixInjectScript(`
      try {
        const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
        const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
        const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
        player.setVolume(Math.max(0, Math.min(1, player.getVolume() + ${dir})));
      } catch(e) {}
    `);
  } else if (site === 'aniworld') {
    broadcastToIframes(up ? "VOLUME_UP" : "VOLUME_DOWN");
  } else {
    if (video) video.volume = Math.max(0, Math.min(1, video.volume + dir));
  }
}

function handleMute(site) {
  const video = getVideo();
  if (site === 'youtube') {
    dispatchKey("m", { code: "KeyM", keyCode: 77, target: document.body });
  } else if (site === 'netflix') {
    netflixInjectScript(`
      try {
        const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
        const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
        const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
        player.setMuted(!player.getMuted());
      } catch(e) {}
    `);
  } else if (site === 'aniworld') {
    broadcastToIframes("MUTE_TOGGLE");
  } else {
    if (video) video.muted = !video.muted;
  }
}

function handleSkipIntro(site) {
  if (site === 'youtube') {
    const video = getVideo();
    if (video) video.currentTime += 85;
  } else if (site === 'netflix') {
    netflixSeek(85);
  } else if (site === 'aniworld') {
    broadcastToIframes("SKIP_INTRO");
  } else {
    const video = getVideo();
    if (video) video.currentTime += 85;
  }
}

function handleNextEpisode(site) {
  if (site === "youtube") {
    dispatchKey("N", {
      code: "KeyN",
      keyCode: 78,
      shiftKey: true,
      target: document.body,
    });
  } else if (site === "netflix") {
    netflixShowControls();
    setTimeout(() => {
      const nextButton =
        document.querySelector('[data-uia="next-episode-seamless-button"]') ||
        document.querySelector('[data-uia="next-episode-seamless-button-dragonstone"]') ||
        document.querySelector('[data-uia="player-skip-credits"]') ||
        document.querySelector(".button-nfplayerNextEpisode") ||
        document.querySelector('[aria-label="Next Episode"]');
      if (nextButton) {
        nextButton.click();
      } else {
        netflixInjectScript(`
          try {
            const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
            const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
            const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
            player.nextEpisode();
          } catch(e) {
            console.warn('[Remote Control] Netflix next episode failed:', e);
          }
        `);
      }
    }, 500);
  } else if (site === "aniworld") {
    performAniWorldNextEpisode();
  }
}

let isPseudoFullscreen = false;
let modifiedAncestors = [];

function togglePseudoFullscreen(element) {
  if (!element) return;
  if (!isPseudoFullscreen) {
    element.setAttribute('data-fs-style', element.style.cssText);
    element.style.setProperty('position', 'fixed', 'important');
    element.style.setProperty('top', '0', 'important');
    element.style.setProperty('left', '0', 'important');
    element.style.setProperty('width', '100vw', 'important');
    element.style.setProperty('height', '100vh', 'important');
    element.style.setProperty('z-index', '2147483647', 'important');
    element.style.setProperty('background-color', 'black', 'important');
    element.style.setProperty('margin', '0', 'important');
    element.style.setProperty('padding', '0', 'important');
    element.style.setProperty('object-fit', 'contain', 'important');
    
    // Prevent ancestors from trapping fixed position inside a transform context
    let parent = element.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      if (style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none') {
        parent.setAttribute('data-fs-transform', parent.style.transform);
        parent.setAttribute('data-fs-filter', parent.style.filter);
        parent.style.setProperty('transform', 'none', 'important');
        parent.style.setProperty('filter', 'none', 'important');
        modifiedAncestors.push(parent);
      }
      parent = parent.parentElement;
    }
    
    document.body.style.setProperty('overflow', 'hidden', 'important');
    isPseudoFullscreen = true;
  } else {
    element.style.cssText = element.getAttribute('data-fs-style') || '';
    modifiedAncestors.forEach(parent => {
      parent.style.transform = parent.getAttribute('data-fs-transform') || '';
      parent.style.filter = parent.getAttribute('data-fs-filter') || '';
    });
    modifiedAncestors = [];
    document.body.style.overflow = '';
    isPseudoFullscreen = false;
  }
}

function handleToggleFullscreen(site) {
  const video = getVideo();

  if (site === "youtube") {
    const playerContainer = document.querySelector('#movie_player') || document.querySelector('#ytd-player') || video;
    togglePseudoFullscreen(playerContainer);
  } else if (site === "netflix") {
    const playerContainer = document.querySelector('.watch-video') || document.querySelector('.NFPlayer') || video;
    togglePseudoFullscreen(playerContainer);
  } else if (site === "aniworld") {
    // Crucial: pseudo-fullscreen the iframe ITSELF in the parent document so it fills the screen!
    const iframe = findVoeIframe();
    if (iframe) togglePseudoFullscreen(iframe);
    
    // Then send the command so the iframe pseudo-fullscreens its internal video element.
    broadcastToIframes("TOGGLE_FULLSCREEN");
  } else {
    togglePseudoFullscreen(video);
  }
}

// ---- Message Listener ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (window !== window.top) return;

  if (message.type === "COMMAND") {
    const site = detectSite();
    console.log(`[Content] Command: ${message.payload} | Site: ${site}`);

    switch (message.payload) {
      case "PLAY_PAUSE":
        handlePlayPause(site);
        break;
      case "SEEK_BACK_10":
        handleSeekBack10(site);
        break;
      case "SEEK_FORWARD_10":
        handleSeekForward10(site);
        break;
      case "NEXT_EPISODE":
        handleNextEpisode(site);
        break;
      case "TOGGLE_FULLSCREEN":
        handleToggleFullscreen(site);
        break;
      case "RESTART_VIDEO":
        handleRestart(site);
        break;
      case "VOLUME_UP":
        handleVolumeChange(site, true);
        break;
      case "VOLUME_DOWN":
        handleVolumeChange(site, false);
        break;
      case "MUTE_TOGGLE":
        handleMute(site);
        break;
      case "SKIP_INTRO":
        handleSkipIntro(site);
        break;
      default:
        console.warn(`[Content] Unknown command: ${message.payload}`);
    }
  }
});

console.log("[Content] Remote control content script loaded. Frame:", window === window.top ? "TOP" : "IFRAME", "Site:", detectSite());

// Top-level check to ensure VOE is selected for AniWorld
if (window === window.top && detectSite() === "aniworld") {
  setTimeout(() => ensureVoeActive(), 2000);
}

// Hybrid Auto-trigger play button for AniWorld iframes on load
if (window !== window.top && (detectSite() === "aniworld" || window.location.href.includes("voe"))) {
  console.log("[Content] VOE iframe detected. Starting hybrid auto-play monitoring...");
  
  let attempts = 0;
  const maxAttempts = 15; // Try for ~7.5 seconds (15 * 500ms)

  // A. Intersection/Mutation monitoring is implicitly handled by the polling loop below
  
  // B. Polling loop: clicks overlays and tries muted playback as fallback
  const autoPlayInterval = setInterval(() => {
    attempts++;
    const video = getVideo();

    // Kill interval if video starts playing
    if (video && !video.paused) {
      console.log("[Content] Video is playing, stopping monitoring.");
      clearInterval(autoPlayInterval);
      return;
    }

    // Try starting the video either via overlay click or fallback play()
    if (tryPlayOverlay(video)) {
        console.log("[Content] Auto-play action attempted (Attempt " + attempts + ")");
    }

    if (attempts >= maxAttempts) {
      console.log("[Content] Auto-play monitoring timed out.");
      clearInterval(autoPlayInterval);
    }
  }, 500);
}

