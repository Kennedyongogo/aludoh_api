const { Op } = require("sequelize");
const { slugify } = require("./slug");
const { ValidationError, UUID_REGEX } = require("./validation");

const SLUG_MAX = 150;
// Route segments that sit next to /:slug
const RESERVED_SLUGS = ["admin", "reorder"];

// Soft-deleted rows still hold their slug in the unique index, so they are checked too.
const slugTaken = async (model, slug, excludeId) => {
  if (RESERVED_SLUGS.includes(slug)) return true;
  const where = { slug };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return Boolean(await model.findOne({ where, paranoid: false, attributes: ["id"] }));
};

// A slug the admin typed must be free; one generated from the name gets -2, -3... instead
const resolveSlug = async (model, { slug, name, excludeId }) => {
  if (slug) {
    const wanted = slugify(slug).slice(0, SLUG_MAX);
    if (!wanted) throw new ValidationError("Slug must contain letters or numbers");
    if (await slugTaken(model, wanted, excludeId)) {
      throw new ValidationError(`The web address "${wanted}" is already used`);
    }
    return wanted;
  }

  const base = slugify(name).slice(0, SLUG_MAX) || "item";
  let candidate = base;
  for (let n = 2; await slugTaken(model, candidate, excludeId); n += 1) {
    candidate = `${base}-${n}`;
  }
  return candidate;
};

const nextSortOrder = async (model) => {
  const max = await model.max("sort_order", { paranoid: false });
  return Number.isFinite(max) ? max + 1 : 0;
};

// ids arrive in the order the admin arranged them
const reorder = async (model, ids) => {
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => !UUID_REGEX.test(String(id)))) {
    throw new ValidationError("Send the ids in the new order as a list");
  }
  if (new Set(ids).size !== ids.length) throw new ValidationError("The list contains duplicates");

  await model.sequelize.transaction(async (transaction) => {
    for (const [index, id] of ids.entries()) {
      await model.update({ sort_order: index }, { where: { id }, transaction });
    }
  });
};

// Runs each field's cleaner. On updates (partial) only the fields that were sent are touched;
// empty values for `defaulted` fields are dropped so the column default applies.
const cleanWith = (fields, body = {}, { partial = false, defaulted = [] } = {}) => {
  const data = {};
  for (const [key, clean] of Object.entries(fields)) {
    if (partial && body[key] === undefined) continue;
    const value = clean(body[key]);
    if (value === null && defaulted.includes(key)) continue;
    data[key] = value;
  }
  return data;
};

const searchWhere = (fields, search) => {
  const term = `%${String(search).trim()}%`;
  return { [Op.or]: fields.map((field) => ({ [field]: { [Op.iLike]: term } })) };
};

module.exports = { resolveSlug, nextSortOrder, reorder, cleanWith, searchWhere };
