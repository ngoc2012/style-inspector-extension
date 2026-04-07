(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/background.js
  var require_background = __commonJS({
    "src/background.js"(exports, module) {
      var SERVER_WS = "ws://localhost:5001/ws";
      var RECONNECT_DELAY = 3e3;
      var ws = null;
      var reconnectTimer = null;
      function connect() {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
        console.log("[StyleInspector] Connecting to server\u2026");
        ws = new WebSocket(SERVER_WS);
        ws.onopen = () => {
          console.log("[StyleInspector] Connected to server");
          clearTimeout(reconnectTimer);
        };
        ws.onclose = () => {
          console.log("[StyleInspector] Disconnected \u2013 reconnecting in", RECONNECT_DELAY, "ms");
          ws = null;
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
        };
        ws.onerror = (err) => {
          console.warn("[StyleInspector] WS error", err);
        };
        ws.onmessage = async (event) => {
          let msg;
          try {
            msg = JSON.parse(event.data);
          } catch {
            return;
          }
          if (msg.type === "inspect") await handleInspect(msg);
          if (msg.type === "execute") await handleExecute(msg);
          if (msg.type === "reload") await handleReload(msg);
        };
      }
      chrome.alarms.create("keep-alive", { periodInMinutes: 0.4 });
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === "keep-alive") connect();
      });
      async function handleInspect({ requestId: requestId2, url: url2, selector }) {
        const send2 = (payload) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ requestId: requestId2, ...payload }));
          }
        };
        try {
          const tab2 = await getOrOpenTab(url2);
          let result2 = null;
          let lastErr = null;
          for (let i = 0; i < 5; i++) {
            try {
              result2 = await chrome.tabs.sendMessage(tab2.id, { type: "inspectSelector", selector });
              break;
            } catch (err) {
              lastErr = err;
              await sleep(600);
            }
          }
          if (result2 === null) {
            send2({ type: "error", error: `Content script not reachable: ${lastErr?.message}` });
            return;
          }
          if (result2.error) {
            send2({ type: "error", error: result2.error });
          } else {
            send2({ type: "result", data: result2 });
          }
        } catch (err) {
          send2({ type: "error", error: err.message });
        }
      }
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
            world: "MAIN",
            func: (code) => {
              const logs = [];
              const methods = ["log", "warn", "error", "info"];
              const originals = {};
              const serialize = (args) => args.map((a) => {
                try {
                  return typeof a === "object" && a !== null ? JSON.stringify(a) : String(a);
                } catch {
                  return String(a);
                }
              }).join(" ");
              methods.forEach((m) => {
                originals[m] = console[m];
                console[m] = (...args) => {
                  logs.push({ level: m, message: serialize(args) });
                  originals[m].apply(console, args);
                };
              });
              try {
                const value = eval(code);
                return { value: value === void 0 ? null : String(value), logs };
              } catch (err) {
                return { error: err.message, logs };
              } finally {
                methods.forEach((m) => {
                  console[m] = originals[m];
                });
              }
            },
            args: [script]
          });
          const result = results?.[0]?.result ?? { error: "No result returned", logs: [] };
          if (result.error) {
            send({ type: "error", error: result.error, logs: result.logs ?? [] });
          } else {
            send({ type: "result", data: result });
          }
        } catch (err) {
          send({ type: "error", error: err.message });
        }
      }
      async function handleReload({ requestId: requestId2, url: url2 }) {
        const send2 = (payload) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ requestId: requestId2, ...payload }));
          }
        };
        try {
          const tab2 = await getOrOpenTab(url2);
          const title = await Promise.race([
            chrome.scripting.executeScript({
              target: { tabId: tab2.id },
              world: "MAIN",
              func: () => document.title
            }).then((r) => r?.[0]?.result || "").catch(() => ""),
            sleep(3e3).then(() => chrome.tabs.get(tab2.id).then((t) => t.title || "").catch(() => ""))
          ]);
          send2({ type: "result", title });
        } catch (err) {
          send2({ type: "error", error: err.message });
        }
      }
      function normaliseUrl(raw) {
        try {
          const u = new URL(raw);
          const path = u.pathname.replace(/\/+$/, "") || "/";
          return (u.origin + path).toLowerCase();
        } catch {
          return raw.toLowerCase().replace(/\/+$/, "");
        }
      }
      async function getOrOpenTab(url2) {
        const target = normaliseUrl(url2);
        const allTabs = await chrome.tabs.query({});
        const existing = allTabs.find((t) => t.url && normaliseUrl(t.url) === target);
        if (existing) {
          console.log(`[StyleInspector] Found tab ${existing.id} \u2192 refreshing before inspect`);
          const loadPromise = waitForLoad(existing.id);
          await chrome.tabs.reload(existing.id);
          await loadPromise;
          await sleep(400);
          return existing;
        }
        console.log(`[StyleInspector] Opening new tab \u2192 ${url2}`);
        const tab2 = await chrome.tabs.create({ url: url2, active: false });
        await waitForLoad(tab2.id);
        await sleep(400);
        return tab2;
      }
      function waitForLoad(tabId) {
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            console.log(`[StyleInspector] Tab ${tabId} still loading after 30 s \u2014 stopping page`);
            resolve();
            chrome.scripting.executeScript({
              target: { tabId },
              world: "MAIN",
              func: () => window.stop()
            }).catch(() => {
            });
          }, 3e4);
          function done() {
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
          function listener(id, info) {
            if (id === tabId && info.status === "complete") done();
          }
          chrome.tabs.onUpdated.addListener(listener);
        });
      }
      function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
      }
      connect();
    }
  });
  require_background();
})();
