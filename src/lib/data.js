// Every number and sentence on the page comes from the JSON files in /data.
// This module loads them once and builds the lookups the sections share.
import sitesData from '../../data/sites.json';
import networkData from '../../data/network.json';
import contractsData from '../../data/contracts.json';
import watchlistData from '../../data/watchlist.json';
import geographyData from '../../data/geography.json';
import moneyData from '../../data/money.json';
import metaData from '../../data/meta.json';

export const SITES = sitesData.sites;
export const siteById = {};
export const NODES = [];
for (const s of SITES) {
  siteById[s.id] = s;
  for (const m of s.members) {
    m.siteId = s.id;
    NODES.push(m);
  }
}
export const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const NETWORK = networkData;
export const CONTRACTS = contractsData;
export const WATCHLIST = watchlistData.items;
export const GEOGRAPHY = geographyData;
export const CITIES = geographyData.cities;
export const HIGHWAYS = geographyData.highways;
export const PRESETS = geographyData.presets;
export const cityByName = Object.fromEntries(CITIES.map((c) => [c.name, c]));
export const MONEY = moneyData;
export const META = metaData;
