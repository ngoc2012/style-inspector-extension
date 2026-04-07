import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Panel } from './Panel.jsx';
import {
  getComputedProps,
  getBoundingBox,
  getElementPath,
  getSheetRules,
  parseRulesWithCssTree,
} from './styleExtractor.js';

// ── Shadow DOM host ──────────────────────────────────────────────────────────
const host = document.createElement('div');
host.id = '__style-inspector-root__';
host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
document.documentElement.appendChild(host);

const shadow = host.attachShadow({ mode: 'open' });
const mountPoint = document.createElement('div');
mountPoint.style.cssText = 'pointer-events:auto;';
shadow.appendChild(mountPoint);

// ── Highlight overlay (outside shadow so it covers page) ─────────────────────
const overlay = document.createElement('div');
overlay.style.cssText = `
  position: fixed;
  pointer-events: none;
  z-index: 2147483646;
  border: 2px solid #58a6ff;
  background: rgba(88, 166, 255, 0.08);
  border-radius: 2px;
  transition: all 0.08s ease;
  display: none;
`;
document.documentElement.appendChild(overlay);

function updateOverlay(el) {
  const r = el.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.top = r.top + 'px';
  overlay.style.left = r.left + 'px';
  overlay.style.width = r.width + 'px';
  overlay.style.height = r.height + 'px';
}

// ── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  const [data, setData] = useState(null);
  const lockedRef = useRef(false);

  const inspect = useCallback((el) => {
    if (el === host || host.contains(el)) return;
    const rules = getSheetRules(el).map(r => ({
      ...r,
      declarations: parseRulesWithCssTree(r.text),
    }));
    setData({
      path: getElementPath(el),
      box: getBoundingBox(el),
      computed: getComputedProps(el),
      rules,
    });
    updateOverlay(el);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!active || lockedRef.current) return;
      inspect(e.target);
    };
    const onClick = (e) => {
      if (!active) return;
      if (e.target === host || host.contains(e.target)) return;
      lockedRef.current = !lockedRef.current;
      if (!lockedRef.current) inspect(e.target);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, inspect]);

  const handleClose = () => {
    setVisible(false);
    overlay.style.display = 'none';
  };
  const handleToggle = () => {
    setActive(v => {
      if (v) overlay.style.display = 'none';
      lockedRef.current = false;
      return !v;
    });
  };

  if (!visible) return null;
  return (
    <Panel
      data={data}
      onClose={handleClose}
      onToggleActive={handleToggle}
      isActive={active}
    />
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
const root = createRoot(mountPoint);
root.render(<App />);

// ── Remote inspection (called by background.js via chrome.tabs.sendMessage) ──
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'inspectSelector') return false;

  const el = document.querySelector(msg.selector);
  if (!el) {
    sendResponse({ error: `Element not found: ${msg.selector}` });
    return false;
  }

  const rules = getSheetRules(el).map(r => ({
    ...r,
    declarations: parseRulesWithCssTree(r.text),
  }));

  sendResponse({
    path: msg.selector,
    box: getBoundingBox(el),
    computed: getComputedProps(el),
    rules,
  });
  return false;
});
