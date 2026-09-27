const { sequelize } = require("../config/database");

const keyOf = (name = "") =>
  String(name)
    .toLowerCase()
    .replace(/\bcounty\b/g, "")
    .replace(/[^a-z]/g, "");

let namesByKey = null;

const loadNames = async () => {
  if (!namesByKey) {
    const rows = await sequelize.query('SELECT "COUNTY" AS name FROM counties', { type: "SELECT" });
    namesByKey = new Map(rows.map(({ name }) => [keyOf(name), name]));
  }
  return namesByKey;
};

// "nairobi county" -> "Nairobi", so filters and counts group the same county together.
// Names the boundary table doesn't know (e.g. "Elgeyo-Marakwet" vs "Keiyo-Marakwet") are kept as typed.
const canonicalCounty = async (input) => {
  if (!input) return null;
  const typed = String(input).replace(/\s+county\s*$/i, "").trim();
  if (!typed) return null;
  try {
    const names = await loadNames();
    return names.get(keyOf(typed)) || typed;
  } catch (error) {
    console.warn("County list unavailable:", error.parent?.message || error.message);
    return typed;
  }
};

module.exports = { canonicalCounty };
