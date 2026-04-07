import * as csstree from 'css-tree';
import postcss from 'postcss';

// Useful computed style properties for cross-page matching
const USEFUL_PROPS = [
  // Typography
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'text-decoration', 'color',
  // Box model
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-width', 'border-style', 'border-color', 'border-radius',
  // Layout
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self',
  'grid-template-columns', 'grid-template-rows', 'gap', 'grid-column', 'grid-row',
  'float', 'overflow', 'overflow-x', 'overflow-y', 'z-index',
  // Visual
  'background', 'background-color', 'background-image', 'background-size', 'background-position',
  'box-shadow', 'opacity', 'visibility', 'cursor', 'pointer-events',
  'transform', 'transition', 'animation',
];

export function getComputedProps(el) {
  const cs = window.getComputedStyle(el);
  const result = {};
  for (const prop of USEFUL_PROPS) {
    const val = cs.getPropertyValue(prop);
    if (val && val !== '' && val !== 'none' && val !== 'normal' && val !== 'auto') {
      result[prop] = val;
    }
  }
  return result;
}

export function getBoundingBox(el) {
  const r = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  return {
    width: Math.round(r.width),
    height: Math.round(r.height),
    top: Math.round(r.top + window.scrollY),
    left: Math.round(r.left + window.scrollX),
    marginTop: cs.marginTop,
    marginRight: cs.marginRight,
    marginBottom: cs.marginBottom,
    marginLeft: cs.marginLeft,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    borderTopWidth: cs.borderTopWidth,
    borderRightWidth: cs.borderRightWidth,
    borderBottomWidth: cs.borderBottomWidth,
    borderLeftWidth: cs.borderLeftWidth,
  };
}

export function getElementPath(el) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node.tagName !== 'HTML') {
    let selector = node.tagName.toLowerCase();
    if (node.id) {
      selector += `#${node.id}`;
    } else if (node.className) {
      const classes = Array.from(node.classList).slice(0, 2).join('.');
      if (classes) selector += `.${classes}`;
    }
    parts.unshift(selector);
    node = node.parentElement;
    if (parts.length >= 4) break;
  }
  return parts.join(' > ');
}

export function getSheetRules(el) {
  const matched = [];
  try {
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      for (const rule of rules) {
        if (rule.selectorText && el.matches(rule.selectorText)) {
          matched.push({
            selector: rule.selectorText,
            source: sheet.href ? new URL(sheet.href).pathname.split('/').pop() : 'inline',
            text: rule.style.cssText,
          });
        }
      }
    }
  } catch {}
  return matched;
}

export function parseRulesWithCssTree(cssText) {
  try {
    const ast = csstree.parse(cssText, { context: 'declarationList', parseValue: true });
    const declarations = [];
    csstree.walk(ast, (node) => {
      if (node.type === 'Declaration') {
        declarations.push({
          property: node.property,
          value: csstree.generate(node.value),
          important: node.important,
        });
      }
    });
    return declarations;
  } catch {
    return [];
  }
}

export async function normalizeWithPostcss(cssText) {
  try {
    const result = await postcss([]).process(cssText, { from: undefined });
    return result.css;
  } catch {
    return cssText;
  }
}
