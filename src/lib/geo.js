// One projection for the 3D scene and the locator: equirectangular, longitude
// scaled by cos(latitude), so one world unit is the same distance in x and z.
import { GEOGRAPHY } from './data.js';

const P = GEOGRAPHY.projection;
export const GEO = {
  latC: P.lat_center,
  lonC: P.lon_center,
  S: P.units_per_degree,
  CL: Math.cos((P.lon_scale_lat * Math.PI) / 180),
  TW: P.terrain_width,
  TH: P.terrain_depth,
};

/** [x, z] world coordinates for a latitude/longitude. North is -z. */
export function geoXZ(lat, lon) {
  return [(lon - GEO.lonC) * GEO.S * GEO.CL, -(lat - GEO.latC) * GEO.S];
}

/** Statute miles per world unit (69 mi per degree of latitude). */
export const MI_PER_UNIT = 69 / GEO.S;
