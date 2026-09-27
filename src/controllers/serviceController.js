const { Op } = require("sequelize");
const { Service, ServiceGoal, Project, Testimonial, User, sequelize } = require("../models");
const v = require("../utils/validation");
const { resolveSlug, nextSortOrder, reorder } = require("../utils/content");
const {
  PROJECT_CARD_ATTRIBUTES,
  TESTIMONIAL_PUBLIC_ATTRIBUTES,
  testimonialPublicIncludes,
  toPublicTestimonial,
} = require("../services/contentViews");

const { STATUSES, ICONS, BENEFIT_ICONS, PACKAGE_UNITS } = Service;

const PUBLIC_EXCLUDE = ["created_by", "updated_by", "deletedAt"];
const SEARCH_FIELDS = ["name", "slug", "short_name", "tagline", "short_description"];
const ORDER = [
  ["sort_order", "ASC"],
  ["name", "ASC"],
];

const projectCount = [
  sequelize.literal(
    `(SELECT COUNT(*)::int FROM projects p
      WHERE p.service_id = "Service".id AND p.is_published AND p."deletedAt" IS NULL)`
  ),
  "project_count",
];
const testimonialCount = [
  sequelize.literal(
    `(SELECT COUNT(*)::int FROM testimonials t
      WHERE t.service_id = "Service".id AND t.status = 'approved' AND t."deletedAt" IS NULL)`
  ),
  "testimonial_count",
];

const imageList = (value, label, maxItems) =>
  v
    .stringList(value, label, { maxItems, maxLength: 500 })
    .map((path, i) => v.imagePath(path, `${label} ${i + 1}`));

const BENEFIT_SHAPE = {
  icon: (value, label) => v.oneOf(value, label, BENEFIT_ICONS) || "leaf",
  title: (value, label) => v.text(value, label, { max: 80, required: true }),
  text: (value, label) => v.text(value, label, { max: 300 }),
};

const STEP_SHAPE = {
  title: (value, label) => v.text(value, label, { max: 80, required: true }),
  text: (value, label) => v.text(value, label, { max: 300 }),
};

const PACKAGE_SHAPE = {
  name: (value, label) => v.text(value, label, { max: 60, required: true }),
  price: (value, label) => v.integer(value, label, { min: 0, max: 1000000000 }),
  unit: (value, label) => v.oneOf(value, label, PACKAGE_UNITS) || "from",
  popular: (value) => v.boolean(value) === true,
  features: (value, label) => v.stringList(value, label, { maxItems: 12, maxLength: 120 }),
};

const FAQ_SHAPE = {
  question: (value, label) => v.text(value, label, { max: 200, required: true }),
  answer: (value, label) => v.text(value, label, { max: 1000, required: true }),
};

// "custom" means priced on request, so it never carries a price, and a package without a price is custom
const cleanPackages = (value) =>
  v.objectList(value, "Package", PACKAGE_SHAPE, { maxItems: 6 }).map((pkg) =>
    pkg.price === null || pkg.unit === "custom" ? { ...pkg, price: null, unit: "custom" } : pkg
  );

const FIELDS = {
  name: (x) => v.text(x, "Name", { max: 150, required: true }),
  short_name: (x) => v.text(x, "Short name", { max: 40 }),
  icon: (x) => v.oneOf(x, "Icon", ICONS),
  tagline: (x) => v.text(x, "Tagline", { max: 200 }),
  short_description: (x) => v.text(x, "Short description", { max: 300 }),
  description: (x) => v.text(x, "Description", { max: 10000 }),
  image: (x) => v.imagePath(x, "Main image"),
  gallery: (x) => imageList(x, "Gallery image", 12),
  offerings: (x) => v.stringList(x, "Offerings", { maxItems: 30, maxLength: 120 }),
  ideal_for: (x) => v.stringList(x, "Ideal for", { maxItems: 12, maxLength: 80 }),
  timeline: (x) => v.text(x, "Timeline", { max: 80 }),
  stat_value: (x) => v.text(x, "Stat value", { max: 20 }),
  stat_label: (x) => v.text(x, "Stat label", { max: 160 }),
  benefits: (x) => v.objectList(x, "Benefit", BENEFIT_SHAPE, { maxItems: 6 }),
  process_steps: (x) => v.objectList(x, "Step", STEP_SHAPE, { maxItems: 8 }),
  packages: cleanPackages,
  faqs: (x) => v.objectList(x, "FAQ", FAQ_SHAPE, { maxItems: 20 }),
  sort_order: (x) => v.integer(x, "Sort order", { min: 0, max: 100000 }),
  status: (x) => v.oneOf(x, "Status", STATUSES),
  seo_title: (x) => v.text(x, "SEO title", { max: 70 }),
  seo_description: (x) => v.text(x, "SEO description", { max: 170 }),
};

// Left out when empty so the column default (or a computed value) applies
const DEFAULTED = ["icon", "status", "sort_order"];

const cleanFields = (body, { partial }) => {
  const data = {};
  for (const [key, clean] of Object.entries(FIELDS)) {
    if (partial && body[key] === undefined) continue;
    const value = clean(body[key]);
    if (value === null && DEFAULTED.includes(key)) continue;
    data[key] = value;
  }
  return data;
};

const assertNameFree = async (name, excludeId) => {
  const sameName = sequelize.where(sequelize.fn("lower", sequelize.col("name")), name.toLowerCase());
  const where = excludeId ? { [Op.and]: [sameName, { id: { [Op.ne]: excludeId } }] } : sameName;
  if (await Service.findOne({ where, attributes: ["id"] })) {
    throw new v.ValidationError(`A service called "${name}" already exists`);
  }
};

const findForAdmin = (id) =>
  Service.findByPk(id, {
    attributes: { include: [projectCount, testimonialCount] },
    include: [
      { model: User, as: "creator", attributes: ["id", "name"] },
      { model: User, as: "updater", attributes: ["id", "name"] },
    ],
  });

const notFound = (res) => res.status(404).json({ success: false, message: "Service not found" });

/* ----------------------------- Public ----------------------------- */

// Published services in display order, each with how many case studies it has
exports.list = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const rows = await Service.findAll({
      where: { status: "active" },
      attributes: { exclude: PUBLIC_EXCLUDE, include: [projectCount] },
      order: ORDER,
      limit,
    });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return v.sendError(res, "fetching services", error);
  }
};

// Everything the service page shows: details, its case studies and client quotes
exports.getBySlug = async (req, res) => {
  try {
    const service = await Service.findOne({
      where: { slug: String(req.params.slug).toLowerCase(), status: "active" },
      attributes: { exclude: PUBLIC_EXCLUDE },
    });
    if (!service) return notFound(res);

    const [projects, testimonials] = await Promise.all([
      Project.findAll({
        where: { service_id: service.id, is_published: true },
        attributes: PROJECT_CARD_ATTRIBUTES,
        order: [
          ["is_featured", "DESC"],
          ["sort_order", "ASC"],
        ],
      }),
      Testimonial.findAll({
        where: { service_id: service.id, status: "approved" },
        attributes: TESTIMONIAL_PUBLIC_ATTRIBUTES,
        include: testimonialPublicIncludes(),
        order: [
          ["is_featured", "DESC"],
          ["sort_order", "ASC"],
          ["createdAt", "DESC"],
        ],
        limit: 12,
      }),
    ]);

    const brief = { id: service.id, name: service.name, slug: service.slug, short_name: service.short_name, icon: service.icon };

    return res.status(200).json({
      success: true,
      data: {
        ...service.toJSON(),
        project_count: projects.length,
        projects: projects.map((project) => ({ ...project.toJSON(), service: brief })),
        testimonials: testimonials.map(toPublicTestimonial),
      },
    });
  } catch (error) {
    return v.sendError(res, "fetching service", error);
  }
};

/* ------------------------------ Admin ------------------------------ */

// Choices for the admin form's dropdowns
exports.options = (req, res) =>
  res.status(200).json({
    success: true,
    data: { statuses: STATUSES, icons: ICONS, benefit_icons: BENEFIT_ICONS, package_units: PACKAGE_UNITS },
  });

exports.adminList = async (req, res) => {
  try {
    const { search, status } = req.query;
    const where = {};
    if (STATUSES.includes(status)) where.status = status;
    if (search) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = SEARCH_FIELDS.map((field) => ({ [field]: { [Op.iLike]: term } }));
    }

    const [rows, counts] = await Promise.all([
      Service.findAll({ where, attributes: { include: [projectCount, testimonialCount] }, order: ORDER }),
      Service.count({ group: ["status"] }),
    ]);

    const summary = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    counts.forEach(({ status: s, count }) => {
      summary[s] = Number(count);
    });
    summary.total = Object.values(summary).reduce((sum, n) => sum + n, 0);

    return res.status(200).json({ success: true, data: rows, summary });
  } catch (error) {
    return v.sendError(res, "fetching services", error);
  }
};

exports.adminGet = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const service = await findForAdmin(req.params.id);
    if (!service) return notFound(res);
    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    return v.sendError(res, "fetching service", error);
  }
};

exports.create = async (req, res) => {
  try {
    const data = cleanFields(req.body, { partial: false });
    await assertNameFree(data.name);
    data.slug = await resolveSlug(Service, {
      slug: v.text(req.body.slug, "Slug", { max: 160 }),
      name: data.name,
    });
    if (!data.icon) data.icon = ICONS.includes(data.slug) ? data.slug : "generic";
    if (data.sort_order === undefined) data.sort_order = await nextSortOrder(Service);
    data.created_by = req.userId;
    data.updated_by = req.userId;

    const service = await Service.create(data);
    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: await findForAdmin(service.id),
    });
  } catch (error) {
    return v.sendError(res, "creating service", error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const service = await Service.findByPk(req.params.id);
    if (!service) return notFound(res);

    const data = cleanFields(req.body, { partial: true });
    if (data.name && data.name.toLowerCase() !== service.name.toLowerCase()) {
      await assertNameFree(data.name, service.id);
    }
    const slug = v.text(req.body.slug, "Slug", { max: 160 });
    if (slug && slug !== service.slug) {
      data.slug = await resolveSlug(Service, { slug, excludeId: service.id });
    }
    if (!Object.keys(data).length) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    await service.update({ ...data, updated_by: req.userId });
    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: await findForAdmin(service.id),
    });
  } catch (error) {
    return v.sendError(res, "updating service", error);
  }
};

exports.reorder = async (req, res) => {
  try {
    await reorder(Service, req.body.ids);
    return res.status(200).json({ success: true, message: "Order saved" });
  } catch (error) {
    return v.sendError(res, "reordering services", error);
  }
};

// Soft delete: linked projects and testimonials keep their service_id but stop showing the service
exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const service = await Service.findByPk(req.params.id);
    if (!service) return notFound(res);

    await sequelize.transaction(async (transaction) => {
      await ServiceGoal.update(
        { service_ids: sequelize.fn("array_remove", sequelize.col("service_ids"), service.id) },
        { where: { service_ids: { [Op.contains]: [service.id] } }, transaction }
      );
      await service.update({ updated_by: req.userId }, { transaction });
      await service.destroy({ transaction });
    });

    return res.status(200).json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    return v.sendError(res, "deleting service", error);
  }
};
