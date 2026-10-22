// The 3D atlas is code-split and arrives after first paint. Everything else
// talks to it through this late-bound API, so a click on "Open full map"
// before it has loaded is queued instead of lost.
let pending = null;

export const mapApi = {
  ready: false,
  open: null,
  close: null,
  highlightSite() {},
  syncURL() {},
};

export function openMap(opts = {}) {
  if (mapApi.ready && mapApi.open) mapApi.open(opts);
  else pending = opts;
}

export function closeMap() {
  if (mapApi.close) mapApi.close();
}

export function registerMap(api) {
  Object.assign(mapApi, api, { ready: true });
  if (pending) {
    const p = pending;
    pending = null;
    mapApi.open(p);
  }
}

/** No WebGL: drop any queued request (the map buttons are hidden). */
export function cancelPendingMap() {
  pending = null;
}
