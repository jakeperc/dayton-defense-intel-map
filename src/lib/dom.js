// Shared palette, type helpers and a tiny SVG element factory.
export const C = {
  brass: '#E8B44C', teal: '#5BA8A0', steel: '#7E8AA6', signal: '#D4593B',
  ink: '#9AA6C2', green: '#6FA96C', violet: '#9184C8',
};

/** Fill colour for an organization type (Guard has none: it renders as a dashed ring). */
export const colFor = (t) =>
  t === 'anchor' ? C.brass : t === 'intel' ? C.teal : t === 'eng' ? C.steel :
  t === 'reserve' ? C.green : t === 'network' ? C.violet : 'none';

/** Guard and Reserve are part-time components, drawn dashed everywhere. */
export const isMilComponent = (t) => t === 'guard' || t === 'reserve';

/** Same palette as numbers, for three.js materials. */
export const HEX = {
  anchor: 0xe8b44c, intel: 0x5ba8a0, eng: 0x7e8aa6, guard: 0x9aa6c2, reserve: 0x6fa96c, network: 0x9184c8,
};

export function el(tag, attrs, parent) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export const isFull = () => document.body.classList.contains('fullmap');
