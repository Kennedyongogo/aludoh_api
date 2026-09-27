const { sequelize } = require("../models");

// Degrees (~200 m). Keeps borders accurate at country/county zoom while cutting the
// payload from ~183k to ~12k points.
const SIMPLIFY_TOLERANCE = 0.002;

// Boundaries rarely change, so build the GeoJSON once per process
let cachedResponse = null;

exports.geojson = async (req, res) => {
  try {
    if (!cachedResponse) {
      const [[row]] = await sequelize.query(
        `SELECT json_build_object(
           'type', 'FeatureCollection',
           'features', COALESCE(json_agg(json_build_object(
             'type', 'Feature',
             'id', id,
             'properties', json_build_object('id', id, 'name', "COUNTY"),
             'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, :tolerance), 5)::json
           ) ORDER BY "COUNTY"), '[]'::json)
         ) AS geojson
         FROM counties`,
        { replacements: { tolerance: SIMPLIFY_TOLERANCE } }
      );
      cachedResponse = JSON.stringify({ success: true, data: row.geojson });
    }

    res.set("Cache-Control", "private, max-age=86400");
    res.type("application/json").send(cachedResponse);
  } catch (error) {
    console.error("Failed to load county boundaries:", error.parent?.message || error.message);
    res.status(500).json({ success: false, message: "Failed to load county boundaries" });
  }
};
