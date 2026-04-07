const SERVER_WS = 'ws://localhost:5001/ws';
const RECONNECT_DELAY = 3000;

let ws = null;
let reconnectTimer = null;

// ── WebSocket lifecycle ───────────────────────────────────────────────────────
function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  console.log('[StyleInspector] Connecting to server…');
  ws = new WebSocket(SERVER_WS);

  ws.onopen = () => {
    console.log('[StyleInspector] Connected to server');
    clearTimeout(reconnectTimer);
  };

  ws.onclose = () => {
    console.log('[StyleInspector] Disconnected – reconnecting in', RECONNECT_DELAY, 'ms');
    ws = null;
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
  };

  ws.onerror = (err) => {
    console.warn('[StyleInspector] WS error', err);
  };

  ws.onmessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === 'inspect') await handleInspect(msg);
    if (msg.type === 'execute') await handleExecute(msg);
    if (msg.type === 'reload') await handleReload(msg);
  };
}

// ── Keep service worker alive via alarms ──────────────────────────────────────
chrome.alarms.create('keep-alive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') connect();
});

// ── Handle inspect request from server ───────────────────────────────────────
async function handleInspect({ requestId, url, selector }) {
  const send = (payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ requestId, ...payload }));
    }
  };

  try {
    const tab = await getOrOpenTab(url);

    // Ensure content script is ready, retry up to 5×
    let result = null;
    let lastErr = null;
    for (let i = 0; i < 5; i++) {
      try {
        result = await chrome.tabs.sendMessage(tab.id, { type: 'inspectSelector', selector });
        break;
      } catch (err) {
        lastErr = err;
        await sleep(600);
      }
    }

    if (result === null) {
      send({ type: 'error', error: `Content script not reachable: ${lastErr?.message}` });
      return;
    }

    if (result.error) {
      send({ type: 'error', error: result.error });
    } else {
      send({ type: 'result', data: result });
    }
  } catch (err) {
    send({ type: 'error', error: err.message });
  }
}

// ── Handle execute request from server ───────────────────────────────────────
async function handleExecute({ requestId, url, script }) {
  const send = (payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ requestId, ...payload }));
    }
  };

  try {
    const tab = await getOrOpenTab(url);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: (code) => {
        const logs = [];
        const methods = ['log', 'warn', 'error', 'info'];
        const originals = {};

        const serialize = (args) => args.map(a => {
          try { return typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a); }
          catch { return String(a); }
        }).join(' ');

        methods.forEach(m => {
          originals[m] = console[m];
          console[m] = (...args) => {
            logs.push({ level: m, message: serialize(args) });
            originals[m].apply(console, args);
          };
        });

        try {
          // eslint-disable-next-line no-eval
          const value = eval(code);
          return { value: value === undefined ? null : String(value), logs };
        } catch (err) {
          return { error: err.message, logs };
        } finally {
          methods.forEach(m => { console[m] = originals[m]; });
        }
      },
      args: [script],
    });

    const result = results?.[0]?.result ?? { error: 'No result returned', logs: [] };
    if (result.error) {
      send({ type: 'error', error: result.error, logs: result.logs ?? [] });
    } else {
      send({ type: 'result', data: result });
    }
  } catch (err) {
    send({ type: 'error', error: err.message });
  }
}

// ── Handle reload request from server ────────────────────────────────────────
async function handleReload({ requestId, url }) {
  const send = (payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ requestId, ...payload }));
    }
  };

  try {
    const tab = await getOrOpenTab(url);
    const title = await Promise.race([
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => document.title,
      }).then(r => r?.[0]?.result || '').catch(() => ''),
      sleep(3000).then(() => chrome.tabs.get(tab.id).then(t => t.title || '').catch(() => '')),
    ]);
    send({ type: 'result', title });
  } catch (err) {
    send({ type: 'error', error: err.message });
  }
}

// ── Tab helpers ───────────────────────────────────────────────────────────────

/** Normalise a URL for comparison: lowercase origin + pathname, strip trailing slash, ignore search/hash */
function normaliseUrl(raw) {
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return (u.origin + path).toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/\/+$/, '');
  }
}

async function getOrOpenTab(url) {
  const target = normaliseUrl(url);

  // Look for an existing tab whose normalised URL matches
  const allTabs = await chrome.tabs.query({});
  const existing = allTabs.find(t => t.url && normaliseUrl(t.url) === target);
  if (existing) {
    console.log(`[StyleInspector] Found tab ${existing.id} → refreshing before inspect`);
    // Register listener BEFORE reload to avoid missing the 'complete' event on fast loads
    const loadPromise = waitForLoad(existing.id);
    await chrome.tabs.reload(existing.id);
    await loadPromise;
    await sleep(400);
    return existing;
  }

  // No match – open a new background tab and wait for it to load
  console.log(`[StyleInspector] Opening new tab → ${url}`);
  const tab = await chrome.tabs.create({ url, active: false });
  await waitForLoad(tab.id);
  // Give the content script a moment to initialise after load
  await sleep(400);
  return tab;
}

function waitForLoad(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      // 30 s elapsed — resolve immediately then stop in the background
      chrome.tabs.onUpdated.removeListener(listener);
      console.log(`[StyleInspector] Tab ${tabId} still loading after 30 s — stopping page`);
      resolve();
      // fire-and-forget: don't await so we never block on a mid-load tab
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => window.stop(),
      }).catch(() => {});
    }, 30000);

    function done() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') done();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Boot ──────────────────────────────────────────────────────────────────────
connect();
