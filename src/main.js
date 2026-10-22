// Entry point. Everything except the 3D atlas renders immediately from the
// JSON in /data; the atlas (three.js) is a separate chunk fetched after first paint.
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';

import './styles/01-base.css';
import './styles/02-nav.css';
import './styles/03-story.css';
import './styles/04-atlas.css';
import './styles/05-sections.css';
import './styles/06-map-layers.css';
import './styles/07-print.css';

import { initInspector } from './modules/inspector.js';
import { initStory } from './modules/story.js';
import { buildNetwork } from './modules/network.js';
import { buildMoney } from './modules/money.js';
import { buildContracts } from './modules/contracts.js';
import { initWatchlist } from './modules/watchlist.js';
import { applyDeepLink } from './modules/deeplink.js';
import { showFallback } from './modules/fallback.js';

initInspector();
initStory();
buildNetwork();
buildMoney();
buildContracts();
initWatchlist();
applyDeepLink();

import('./modules/atlas.js')
  .then((m) => m.initAtlas())
  .catch((err) => {
    console.error('[atlas] 3D view unavailable:', err);
    showFallback();
  });
