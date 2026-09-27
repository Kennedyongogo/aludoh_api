// Turns the free-text location on a service request ("Kitengela", "Juja, near JKUAT") into an
// approximate map position and county. Uses OpenStreetMap's Nominatim search, restricted to
// Kenya, and the PostGIS `counties` table for the county. No device location is involved.
const { Op } = require("sequelize");
const { ServiceRequest, sequelize } = require("../models");

const SEARCH_URL = process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
// Nominatim's usage policy requires an identifying User-Agent and at most one request per second
const USER_AGENT = process.env.GEOCODER_USER_AGENT || "Mcaludoh-Consultancy-Admin/1.0";
const CONTACT_EMAIL = process.env.GEOCODER_EMAIL;
const MIN_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 10000;

const PRECISE_RADIUS_M = 10000;
// Regions like "Rift Valley" span many counties; the polygon under their centre means nothing
const BROAD_RADIUS_M = 60000;
const MIN_RADIUS_M = 300;
const MAX_RADIUS_M = 150000;
// Only towns, villages, wards etc. count as competing matches; roads and shops that share a
// name elsewhere would otherwise make most lookups look ambiguous
const AREA_CATEGORIES = new Set(["place", "boundary"]);
const MAX_ALTERNATIVES = 3;
// Tolerance (degrees, ~5 km) for points that fall just outside a county polygon, e.g. on the coast
const COUNTY_SNAP_DEGREES = 0.05;
// Near a border (~22 km) the county named in the OpenStreetMap address wins over the polygon:
// the county shapes are coarse in places (they put Litein ~10 km inside Bomet, not Kericho)
const COUNTY_BORDER_DEGREES = 0.2;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let queue = Promise.resolve();
let lastCallAt = 0;

const throttled = (task) => {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastCallAt = Date.now();
    }
  });
  queue = run.catch(() => {});
  return run;
};

const cache = new Map();

const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

const cacheSet = (key, value) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, { value, at: Date.now() });
};

const normalize = (text) => text.replace(/\s+/g, " ").trim();

// "Juja, near JKUAT" -> ["Juja, near JKUAT", "Juja", "JKUAT"]. The word "County" is dropped:
// "Naivasha, Nakuru County" otherwise matches "Naivasha County Referral Hospital" first.
const queryVariants = (text) => {
  const base = normalize(text.replace(/\bcounty\b/gi, " ").replace(/\s+,/g, ",")).replace(/,\s*$/, "");
  const parts = base
    .split(/[,;/|]|\b(?:near|along|off|opposite|behind|next to)\b/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  return [...new Set([base, ...parts])].filter(Boolean).slice(0, 3);
};

const searchPlaces = async (query) => {
  const params = new URLSearchParams({
    q: query,
    countrycodes: "ke",
    format: "jsonv2",
    limit: "5",
  });
  if (CONTACT_EMAIL) params.set("email", CONTACT_EMAIL);

  const response = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Geocoder responded with HTTP ${response.status}`);
  return response.json();
};

const toRadians = (deg) => (deg * Math.PI) / 180;

const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Half the diagonal of the place's bounding box: roughly how far the pin may be off
const radiusFromBox = (box) => {
  const [south, north, west, east] = (box || []).map(Number);
  if ([south, north, west, east].some(Number.isNaN)) return MIN_RADIUS_M;
  const radius = distanceMeters(south, west, north, east) / 2;
  return Math.round(Math.min(Math.max(radius, MIN_RADIUS_M), MAX_RADIUS_M));
};

// "Juja, Kiambu, 01001, Kenya" -> "Juja, Kiambu"
const cleanPlaceName = (displayName = "") =>
  displayName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && part !== "Kenya" && !/^\d{5}$/.test(part))
    .join(", ");

// "Murang'a County" / "Elgeyo-Marakwet" -> "muranga" / "elgeyomarakwet"
const countyKey = (name = "") =>
  name
    .toLowerCase()
    .replace(/\bcounty\b/g, "")
    .replace(/[^a-z]/g, "");

// Prefers an explicit "... County" part, otherwise the last part that names a nearby county
const statedCounty = (place, nearby) => {
  const byKey = new Map(nearby.map((name) => [countyKey(name), name]));
  const parts = place.split(",").map((part) => part.trim()).reverse();
  const explicit = parts.find((part) => /\bcounty\b/i.test(part) && byKey.has(countyKey(part)));
  const match = explicit || parts.find((part) => byKey.has(countyKey(part)));
  return match ? byKey.get(countyKey(match)) : null;
};

const toCandidate = (result) => ({
  place: cleanPlaceName(result.display_name).slice(0, 255),
  lat: Number(result.lat),
  lng: Number(result.lon),
  radius: radiusFromBox(result.boundingbox),
  category: result.category,
  importance: Number(result.importance) || 0,
  county: null,
});

const attachCounties = async (candidates) => {
  const [rows] = await sequelize.query(
    `SELECT t.idx::int AS idx, c.county, n.nearby
     FROM unnest(ARRAY[:lngs]::float8[], ARRAY[:lats]::float8[]) WITH ORDINALITY AS t(lng, lat, idx)
     LEFT JOIN LATERAL (
       SELECT "COUNTY" AS county
       FROM counties
       WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326), :snap)
       ORDER BY ST_Distance(geom, ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326))
       LIMIT 1
     ) c ON true
     LEFT JOIN LATERAL (
       SELECT array_agg("COUNTY") AS nearby
       FROM counties
       WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326), :border)
     ) n ON true`,
    {
      replacements: {
        lngs: candidates.map((c) => c.lng),
        lats: candidates.map((c) => c.lat),
        snap: COUNTY_SNAP_DEGREES,
        border: COUNTY_BORDER_DEGREES,
      },
    }
  );
  rows.forEach(({ idx, county, nearby }) => {
    const candidate = candidates[idx - 1];
    const stated = statedCounty(candidate.place, nearby || []);
    candidate.countyStated = Boolean(stated);
    candidate.county = stated || county || null;
  });
  return candidates;
};

const summarize = (candidates) => {
  const top = candidates[0];
  // Among towns/areas in the top county, pin the most specific (e.g. Juja town, not the
  // constituency); buildings like a hospital only win if nothing area-like matched
  const sameCounty = candidates.filter((c) => c.county === top.county);
  const areas = sameCounty.filter((c) => AREA_CATEGORIES.has(c.category));
  const pin = (areas.length ? areas : [top]).reduce((best, c) => (c.radius < best.radius ? c : best));

  const seenCounties = new Set([top.county]);
  const alternatives = candidates.filter((c) => {
    const competing =
      c.county &&
      !seenCounties.has(c.county) &&
      AREA_CATEGORIES.has(c.category) &&
      c.importance >= top.importance * 0.5;
    if (competing) seenCounties.add(c.county);
    return competing;
  });

  const precise = Boolean(top.county) && pin.radius <= PRECISE_RADIUS_M && !alternatives.length;
  const county = pin.radius > BROAD_RADIUS_M && !top.countyStated ? null : top.county;

  return {
    status: precise ? "found" : "approximate",
    place: pin.place,
    county,
    lat: pin.lat,
    lng: pin.lng,
    radius: pin.radius,
    alternatives: alternatives
      .slice(0, MAX_ALTERNATIVES)
      .map(({ place, county, lat, lng }) => ({ place, county, lat, lng })),
  };
};

const lookup = async (text) => {
  // Buildings/roads are only used if no wording matched an actual town or area
  let fallback = null;
  for (const variant of queryVariants(text)) {
    const results = await throttled(() => searchPlaces(variant));
    const candidates = (Array.isArray(results) ? results : [])
      .map(toCandidate)
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
    if (!candidates.length) continue;
    if (candidates.some((c) => AREA_CATEGORIES.has(c.category))) {
      return summarize(await attachCounties(candidates));
    }
    fallback = fallback || candidates;
  }
  if (!fallback) return { status: "not_found" };
  const result = summarize(await attachCounties(fallback));
  return { ...result, status: "approximate" };
};

// Another request with the same location text may already have been looked up
const findPreviousResult = async (text) => {
  const previous = await ServiceRequest.findOne({
    where: {
      [Op.and]: [
        sequelize.where(sequelize.fn("lower", sequelize.col("geo_query")), text.toLowerCase()),
        { geo_status: { [Op.in]: ["found", "approximate"] } },
      ],
    },
    order: [["geocoded_at", "DESC"]],
  });
  if (!previous) return null;
  return {
    status: previous.geo_status,
    place: previous.geo_place,
    county: previous.geo_county,
    lat: previous.geo_lat,
    lng: previous.geo_lng,
    radius: previous.geo_radius_m,
    alternatives: previous.geo_candidates || [],
  };
};

const resolveLocation = async (text, { fresh = false } = {}) => {
  const key = text.toLowerCase();
  if (!fresh) {
    const cached = cacheGet(key) || (await findPreviousResult(text));
    if (cached) return cached;
  }
  const result = await lookup(text);
  cacheSet(key, result);
  return result;
};

const EMPTY_GEO = {
  geo_status: null,
  geo_query: null,
  geo_place: null,
  geo_county: null,
  geo_lat: null,
  geo_lng: null,
  geo_radius_m: null,
  geo_candidates: null,
  geocoded_at: null,
};

const toColumns = (text, result) => ({
  ...EMPTY_GEO,
  geo_status: result.status,
  geo_query: text.slice(0, 160),
  geocoded_at: new Date(),
  ...(result.lat != null && {
    geo_place: result.place,
    geo_county: result.county,
    geo_lat: result.lat,
    geo_lng: result.lng,
    geo_radius_m: result.radius,
    geo_candidates: result.alternatives?.length ? result.alternatives : null,
  }),
});

// Looks up `query` (or the request's own location) and stores the result on the request
const geocodeRequest = async (id, { query, fresh = false } = {}) => {
  const request = await ServiceRequest.findByPk(id);
  if (!request) return null;

  // silent: lookups must not bump updatedAt, which the admin list shows as last activity
  const text = normalize(query || request.location || "");
  if (!text) {
    await request.update(EMPTY_GEO, { silent: true });
    return request;
  }

  let result;
  try {
    result = await resolveLocation(text, { fresh });
  } catch (error) {
    console.error(`Geocoding "${text}" for ${request.reference} failed:`, error.message);
    result = { status: "failed" };
  }

  await request.update(toColumns(text, result), { silent: true });
  return request;
};

const queueGeocode = (id) => {
  geocodeRequest(id).catch((error) =>
    console.error(`Geocoding request ${id} failed:`, error.message)
  );
};

// Picks up requests that were never looked up (older rows, or a restart mid-queue)
const resumePendingGeocodes = async () => {
  try {
    const pending = await ServiceRequest.findAll({
      attributes: ["id"],
      where: {
        location: { [Op.ne]: null },
        [Op.or]: [{ geo_status: null }, { geo_status: { [Op.in]: ["pending", "failed"] } }],
      },
      order: [["createdAt", "DESC"]],
    });
    if (!pending.length) return;
    console.log(`📍 Looking up ${pending.length} request location(s) in the background`);
    await ServiceRequest.update(
      { geo_status: "pending" },
      { where: { id: pending.map((r) => r.id) }, silent: true }
    );
    pending.forEach((r) => queueGeocode(r.id));
  } catch (error) {
    console.error("Could not resume pending geocodes:", error.message);
  }
};

module.exports = { geocodeRequest, queueGeocode, resumePendingGeocodes, EMPTY_GEO };
