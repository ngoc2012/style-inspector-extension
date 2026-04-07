import React, { useState, useCallback } from 'react';

const PANEL_STYLES = `
  :host {
    all: initial;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .si-panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 360px;
    max-height: calc(100vh - 32px);
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 2147483647;
    color: #c9d1d9;
    font-size: 11px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    resize: both;
    user-select: none;
  }
  .si-panel.dragging { opacity: 0.9; }

  .si-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #161b22;
    border-bottom: 1px solid #21262d;
    cursor: grab;
    flex-shrink: 0;
  }
  .si-header:active { cursor: grabbing; }
  .si-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .si-dot.active { background: #3fb950; box-shadow: 0 0 6px #3fb950; }
  .si-dot.inactive { background: #444c56; }
  .si-title {
    font-size: 11px;
    font-weight: 600;
    color: #8b949e;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex: 1;
  }
  .si-close {
    background: none;
    border: none;
    color: #6e7681;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }
  .si-close:hover { color: #c9d1d9; background: #21262d; }

  .si-path {
    padding: 8px 12px;
    background: #0d1117;
    border-bottom: 1px solid #21262d;
    color: #58a6ff;
    font-size: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .si-path span { color: #6e7681; }

  .si-tabs {
    display: flex;
    background: #161b22;
    border-bottom: 1px solid #21262d;
    flex-shrink: 0;
  }
  .si-tab {
    flex: 1;
    padding: 7px 4px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #6e7681;
    cursor: pointer;
    font-size: 10px;
    font-family: inherit;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: color 0.15s, border-color 0.15s;
  }
  .si-tab.active { color: #58a6ff; border-bottom-color: #58a6ff; }
  .si-tab:hover:not(.active) { color: #8b949e; }

  .si-body {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
  .si-body::-webkit-scrollbar { width: 4px; }
  .si-body::-webkit-scrollbar-track { background: transparent; }
  .si-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }

  /* Box Model Tab */
  .si-boxmodel {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .si-bm-diagram {
    position: relative;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 4px;
  }
  .si-bm-layer {
    border: 1px dashed;
    border-radius: 4px;
    padding: 0;
    position: relative;
  }
  .si-bm-margin { border-color: #f0883e; }
  .si-bm-border { border-color: #ffa657; margin: 8px; }
  .si-bm-padding { border-color: #3fb950; margin: 8px; }
  .si-bm-content {
    margin: 8px;
    background: #1a3a5c;
    border: 1px solid #58a6ff;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 8px;
  }
  .si-bm-label {
    position: absolute;
    top: 2px;
    left: 4px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .si-bm-margin .si-bm-label { color: #f0883e; }
  .si-bm-border .si-bm-label { color: #ffa657; }
  .si-bm-padding .si-bm-label { color: #3fb950; }
  .si-bm-size {
    color: #58a6ff;
    font-size: 12px;
    font-weight: 700;
  }
  .si-bm-edge {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    font-size: 10px;
    color: #8b949e;
  }
  .si-bm-edge span { color: #e6edf3; }
  .si-bm-vals {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px 8px;
  }
  .si-bm-val { display: flex; justify-content: space-between; font-size: 10px; color: #8b949e; padding: 2px 0; border-bottom: 1px solid #21262d; }
  .si-bm-val span { color: #e6edf3; }

  /* Computed Tab */
  .si-computed { padding: 8px 0; }
  .si-section { margin-bottom: 4px; }
  .si-section-title {
    padding: 4px 12px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6e7681;
    background: #161b22;
    border-top: 1px solid #21262d;
    border-bottom: 1px solid #21262d;
  }
  .si-prop {
    display: flex;
    padding: 3px 12px;
    gap: 8px;
    transition: background 0.1s;
  }
  .si-prop:hover { background: #161b22; }
  .si-prop-name { color: #79c0ff; flex-shrink: 0; width: 140px; overflow: hidden; text-overflow: ellipsis; }
  .si-prop-val { color: #a5d6ff; word-break: break-all; flex: 1; }
  .si-prop-val.color-swatch { display: flex; align-items: center; gap: 6px; }
  .si-swatch { width: 10px; height: 10px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; }

  /* Rules Tab */
  .si-rules { padding: 8px 0; }
  .si-rule { margin: 0 8px 8px; border: 1px solid #21262d; border-radius: 6px; overflow: hidden; }
  .si-rule-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: #161b22;
    border-bottom: 1px solid #21262d;
  }
  .si-rule-selector { color: #f0883e; font-size: 11px; font-weight: 600; }
  .si-rule-source { color: #6e7681; font-size: 9px; }
  .si-rule-decls { padding: 6px 0; }
  .si-decl {
    display: flex;
    padding: 2px 10px;
    gap: 6px;
    font-size: 10px;
  }
  .si-decl:hover { background: #161b22; }
  .si-decl-prop { color: #79c0ff; flex-shrink: 0; }
  .si-decl-colon { color: #6e7681; }
  .si-decl-val { color: #a5d6ff; }
  .si-decl-imp { color: #f85149; font-size: 9px; margin-left: 4px; }

  /* Footer */
  .si-footer {
    padding: 8px 12px;
    border-top: 1px solid #21262d;
    background: #161b22;
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .si-btn {
    flex: 1;
    padding: 5px 8px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 5px;
    color: #8b949e;
    cursor: pointer;
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: all 0.15s;
  }
  .si-btn:hover { background: #30363d; color: #c9d1d9; border-color: #58a6ff; }
  .si-btn.copied { background: #1a3a2a; color: #3fb950; border-color: #3fb950; }

  .si-empty {
    padding: 24px;
    text-align: center;
    color: #444c56;
    font-size: 11px;
  }

  .si-highlight-overlay {
    position: fixed;
    pointer-events: none;
    z-index: 2147483646;
    border: 2px solid #58a6ff;
    background: rgba(88, 166, 255, 0.08);
    border-radius: 2px;
    transition: all 0.08s ease;
  }
`;

const SECTIONS = {
  typography: ['font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-transform','text-decoration','color'],
  layout: ['display','position','top','right','bottom','left','float','z-index','overflow','overflow-x','overflow-y'],
  flex: ['flex','flex-direction','flex-wrap','justify-content','align-items','align-self'],
  grid: ['grid-template-columns','grid-template-rows','gap','grid-column','grid-row'],
  background: ['background','background-color','background-image','background-size','background-position'],
  effects: ['box-shadow','opacity','visibility','cursor','pointer-events','transform','transition','animation'],
};

function isColor(val) {
  return /^(#|rgb|rgba|hsl|hsla)/.test(val);
}

function PropRow({ name, val }) {
  const hasColor = isColor(val);
  return (
    <div className="si-prop">
      <span className="si-prop-name">{name}</span>
      <span className={`si-prop-val${hasColor ? ' color-swatch' : ''}`}>
        {hasColor && <span className="si-swatch" style={{ background: val }} />}
        {val}
      </span>
    </div>
  );
}

function BoxModelTab({ box }) {
  if (!box) return <div className="si-empty">Hover over an element</div>;
  const px = v => v;
  return (
    <div className="si-boxmodel">
      <div className="si-bm-diagram">
        <div className="si-bm-layer si-bm-margin">
          <span className="si-bm-label">margin</span>
          <div className="si-bm-edge">
            <span>{box.marginTop}</span>
          </div>
          <div className="si-bm-layer si-bm-border">
            <span className="si-bm-label">border</span>
            <div className="si-bm-layer si-bm-padding">
              <span className="si-bm-label">padding</span>
              <div className="si-bm-content">
                <span className="si-bm-size">{box.width} × {box.height}</span>
              </div>
            </div>
          </div>
          <div className="si-bm-edge">
            <span>{box.marginBottom}</span>
          </div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Margin</div>
        <div className="si-bm-vals">
          {[['Top',box.marginTop],['Right',box.marginRight],['Bottom',box.marginBottom],['Left',box.marginLeft]].map(([k,v]) => (
            <div className="si-bm-val" key={k}>{k}: <span>{v}</span></div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '8px 0 4px' }}>Padding</div>
        <div className="si-bm-vals">
          {[['Top',box.paddingTop],['Right',box.paddingRight],['Bottom',box.paddingBottom],['Left',box.paddingLeft]].map(([k,v]) => (
            <div className="si-bm-val" key={k}>{k}: <span>{v}</span></div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '8px 0 4px' }}>Border</div>
        <div className="si-bm-vals">
          {[['Top',box.borderTopWidth],['Right',box.borderRightWidth],['Bottom',box.borderBottomWidth],['Left',box.borderLeftWidth]].map(([k,v]) => (
            <div className="si-bm-val" key={k}>{k}: <span>{v}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComputedTab({ computed }) {
  if (!computed || Object.keys(computed).length === 0) return <div className="si-empty">Hover over an element</div>;
  const shown = new Set();
  return (
    <div className="si-computed">
      {Object.entries(SECTIONS).map(([section, props]) => {
        const rows = props.filter(p => computed[p]);
        if (!rows.length) return null;
        rows.forEach(p => shown.add(p));
        return (
          <div className="si-section" key={section}>
            <div className="si-section-title">{section}</div>
            {rows.map(p => <PropRow key={p} name={p} val={computed[p]} />)}
          </div>
        );
      })}
      {(() => {
        const extra = Object.entries(computed).filter(([k]) => !shown.has(k));
        if (!extra.length) return null;
        return (
          <div className="si-section">
            <div className="si-section-title">other</div>
            {extra.map(([k,v]) => <PropRow key={k} name={k} val={v} />)}
          </div>
        );
      })()}
    </div>
  );
}

function RulesTab({ rules }) {
  if (!rules || rules.length === 0) return <div className="si-empty">No matched CSS rules</div>;
  return (
    <div className="si-rules">
      {rules.map((rule, i) => (
        <div className="si-rule" key={i}>
          <div className="si-rule-header">
            <span className="si-rule-selector">{rule.selector}</span>
            <span className="si-rule-source">{rule.source}</span>
          </div>
          <div className="si-rule-decls">
            {rule.declarations.map((d, j) => (
              <div className="si-decl" key={j}>
                <span className="si-decl-prop">{d.property}</span>
                <span className="si-decl-colon">:</span>
                <span className="si-decl-val">{d.value}</span>
                {d.important && <span className="si-decl-imp">!important</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Panel({ data, onClose, onToggleActive, isActive }) {
  const [tab, setTab] = useState('box');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!data) return;
    const out = JSON.stringify({
      path: data.path,
      box: data.box,
      computed: data.computed,
      rules: data.rules,
    }, null, 2);
    navigator.clipboard.writeText(out).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [data]);

  return (
    <>
      <style>{PANEL_STYLES}</style>
      <div className="si-panel">
        <div className="si-header">
          <div className={`si-dot ${isActive ? 'active' : 'inactive'}`} />
          <span className="si-title">Style Inspector</span>
          <button className="si-close" onClick={onClose}>✕</button>
        </div>

        {data ? (
          <div className="si-path">
            <span>› </span>{data.path}
          </div>
        ) : (
          <div className="si-path"><span>Hover to inspect</span></div>
        )}

        <div className="si-tabs">
          {['box','computed','rules'].map(t => (
            <button
              key={t}
              className={`si-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'box' ? 'Box Model' : t === 'computed' ? 'Computed' : 'CSS Rules'}
            </button>
          ))}
        </div>

        <div className="si-body">
          {tab === 'box' && <BoxModelTab box={data?.box} />}
          {tab === 'computed' && <ComputedTab computed={data?.computed} />}
          {tab === 'rules' && <RulesTab rules={data?.rules} />}
        </div>

        <div className="si-footer">
          <button className="si-btn" onClick={onToggleActive}>
            {isActive ? 'Pause' : 'Resume'}
          </button>
          <button className={`si-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
        </div>
      </div>
    </>
  );
}
