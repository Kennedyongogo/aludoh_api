const { Op } = require("sequelize");
const { Project, Service, Testimonial, User, sequelize } = require("../models");
const v = require("../utils/validation");
const { resolveSlug, nextSortOrder, reorder } = require("../utils/content");
const { canonicalCounty } = require("../services/counties");
const {
  SERVICE_BRIEF_ATTRIBUTES,
  PROJECT_CARD_ATTRIBUTES,
  TESTIMONIAL_PUBLIC_ATTRIBUTES,
  serviceBriefInclude,
  toPublicTestimonial,
} = require("../services/contentViews");

const { STATUSES } = Project;

const PUBLIC_EXCLUDE = ["created_by", "updated_by", "deletedAt", "is_published", "sort_order"];
const SEARCH_FIELDS = ["name", "slug", "client", "location", "county", "summary"];
const ORDER = [
  ["sort_order", "ASC"],
  ["year", "DESC"],
  ["name", "ASC"],
];
const RELATED_COUNT = 3;

const testimonialCount = [
  sequelize.literal(
    `(SELECT COUNT(*)::int FROM testimonials t
      WHERE t.project_id = "Project".id AND t.status = 'approved' AND t."deletedAt" IS NULL)`
  ),
  "testimonial_count",
];

// Approved quotes for each project, loaded in one extra query for the whole page
const quotesInclude = () => ({
  model: Testimonial,
  as: "testimonials",
  where: { status: "approved" },
  required: false,
  separate: true,
  attributes: TESTIMONIAL_PUBLIC_ATTRIBUTES,
  order: [
    ["is_featured", "DESC"],
    ["sort_order", "ASC"],
    ["createdAt", "ASC"],
  ],
});

const RESULT_SHAPE = {
  value: (value, label) => v.text(value, label, { max: 20, required: true }),
  label: (value, label) => v.text(value, label, { max: 120, required: true }),
};

const FIELDS = {
  name: (x) => v.text(x, "Project name", { max: 200, required: true }),
  client: (x) => v.text(x, "Client", { max: 160 }),
  location: (x) => v.text(x, "Location", { max: 160 }),
  county: (x) => v.text(x, "County", { max: 60 }),
  year: (x) => v.integer(x, "Year", { min: 1990, max: new Date().getFullYear() + 1 }),
  status: (x) => v.oneOf(x, "Status", STATUSES),
  size: (x) => v.text(x, "Scale", { max: 120 }),
  duration: (x) => v.text(x, "Duration", { max: 80 }),
  summary: (x) => v.text(x, "Summary", { max: 500 }),
  challenge: (x) => v.text(x, "Challenge", { max: 10000 }),
  solution: (x) => v.text(x, "Solution", { max: 10000 }),
  scope: (x) => v.stringList(x, "Scope", { maxItems: 20, maxLength: 160 }),
  results: (x) => v.objectList(x, "Result", RESULT_SHAPE, { maxItems: 6 }),
  cover_image: (x) => v.imagePath(x, "Cover image"),
  before_image: (x) => v.imagePath(x, "Before image"),
  after_image: (x) => v.imagePath(x, "After image"),
  gallery: (x) => v.photoList(x, "Photo", { maxItems: 24 }),
  is_featured: (x) => v.boolean(x),
  is_published: (x) => v.boolean(x),
  sort_order: (x) => v.integer(x, "Sort order", { min: 0, max: 100000 }),
  seo_title: (x) => v.text(x, "SEO title", { max: 70 }),
  seo_description: (x) => v.text(x, "SEO description", { max: 170 }),
};

// Left out when empty so the column default (or a computed value) applies
const DEFAULTED = ["status", "sort_order", "is_featured", "is_published"];

const cleanFields = async (body, { partial }) => {
  const data = {};
  for (const [key, clean] of Object.entries(FIELDS)) {
    if (partial && body[key] === undefined) continue;
    const value = clean(body[key]);
    if (value === null && DEFAULTED.includes(key)) continue;
    data[key] = value;
  }

  if (data.county) data.county = await canonicalCounty(data.county);

  if (!partial || body.service_id !== undefined) {
    const serviceId = v.uuid(body.service_id, "Service");
    if (serviceId && !(await Service.count({ where: { id: serviceId } }))) {
      throw new v.ValidationError("The chosen service no longer exists");
    }
    data.service_id = serviceId;
  }
  return data;
};

const serviceIdFor = async (value) => {
  const key = String(value).trim().toLowerCase();
  const service = await Service.findOne({
    where: v.UUID_REGEX.test(key) ? { id: key } : { slug: key },
    attributes: ["id"],
  });
  return service?.id || null;
};

const toPublicProject = (row) => {
  const { testimonials = [], ...project } = row.get({ plain: true });
  const quote = testimonials[0];
  return {
    ...project,
    testimonial: quote
      ? {
          ...toPublicTestimonial(quote),
          organization: quote.organization || project.client,
          service: project.service?.name || null,
          service_slug: project.service?.slug || null,
          project: { name: project.name, slug: project.slug },
        }
      : null,
  };
};

// Counts behind the filter pills and the "Projects across Kenya" list, over all published projects
const publicFacets = async () => {
  const count = [sequelize.fn("COUNT", sequelize.col("id")), "count"];
  const published = { is_published: true };

  const [total, counties, statuses, perService, services] = await Promise.all([
    Project.count({ where: published }),
    Project.findAll({
      where: { ...published, county: { [Op.ne]: null } },
      attributes: ["county", count],
      group: ["county"],
      raw: true,
    }),
    Project.findAll({ where: published, attributes: ["status", count], group: ["status"], raw: true }),
    Project.findAll({ where: published, attributes: ["service_id", count], group: ["service_id"], raw: true }),
    Service.findAll({
      where: { status: "active" },
      attributes: SERVICE_BRIEF_ATTRIBUTES,
      order: [["sort_order", "ASC"]],
      raw: true,
    }),
  ]);

  const byService = new Map(perService.map((row) => [row.service_id, Number(row.count)]));

  return {
    total,
    counties: counties
      .map((row) => ({ name: row.county, count: Number(row.count) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    statuses: Object.fromEntries(
      STATUSES.map((s) => [s, Number(statuses.find((row) => row.status === s)?.count || 0)])
    ),
    services: services
      .map((service) => ({ ...service, count: byService.get(service.id) || 0 }))
      .filter((service) => service.count),
  };
};

const findForAdmin = (id) =>
  Project.findByPk(id, {
    attributes: { include: [testimonialCount] },
    include: [
      { model: Service, as: "service", attributes: [...SERVICE_BRIEF_ATTRIBUTES, "status"] },
      {
        model: Testimonial,
        as: "testimonials",
        attributes: ["id", "client_name", "role", "rating", "content", "status", "is_featured"],
      },
      { model: User, as: "creator", attributes: ["id", "name"] },
      { model: User, as: "updater", attributes: ["id", "name"] },
    ],
  });

const notFound = (res) => res.status(404).json({ success: false, message: "Project not found" });

/* ----------------------------- Public ----------------------------- */

// Query: featured=true, service=<slug|id>, status, county, search, page, limit, facets=false
exports.list = async (req, res) => {
  try {
    const { featured, service, status, county, search } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const where = { is_published: true };

    if (featured === "true") where.is_featured = true;
    if (STATUSES.includes(status)) where.status = status;
    if (county) where.county = await canonicalCounty(String(county).slice(0, 60));
    if (service) {
      const serviceId = await serviceIdFor(service);
      if (!serviceId) {
        return res.status(200).json({
          success: true,
          data: [],
          facets: req.query.facets === "false" ? null : await publicFacets(),
          pagination: v.paginationMeta(0, paging),
        });
      }
      where.service_id = serviceId;
    }
    if (search) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = SEARCH_FIELDS.map((field) => ({ [field]: { [Op.iLike]: term } }));
    }

    const [{ count, rows }, facets] = await Promise.all([
      Project.findAndCountAll({
        where,
        attributes: PROJECT_CARD_ATTRIBUTES,
        include: [serviceBriefInclude(), quotesInclude()],
        order: ORDER,
        limit: paging.limit,
        offset: paging.offset,
        distinct: true,
      }),
      req.query.facets === "false" ? null : publicFacets(),
    ]);

    return res.status(200).json({
      success: true,
      data: rows.map(toPublicProject),
      facets,
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching projects", error);
  }
};

// The case study page: full project, its quotes, previous/next and related case studies
exports.getBySlug = async (req, res) => {
  try {
    const row = await Project.findOne({
      where: { slug: String(req.params.slug).toLowerCase(), is_published: true },
      attributes: { exclude: PUBLIC_EXCLUDE },
      include: [serviceBriefInclude(), quotesInclude()],
    });
    if (!row) return notFound(res);

    const project = toPublicProject(row);
    project.testimonials = (row.testimonials || []).map((quote) => ({
      ...toPublicTestimonial(quote),
      organization: quote.organization || project.client,
      service: project.service?.name || null,
      service_slug: project.service?.slug || null,
      project: { name: project.name, slug: project.slug },
    }));

    const all = await Project.findAll({
      where: { is_published: true },
      attributes: PROJECT_CARD_ATTRIBUTES,
      include: [serviceBriefInclude()],
      order: ORDER,
      limit: 500,
    });
    const index = all.findIndex((p) => p.id === project.id);
    const brief = (p) => ({ id: p.id, name: p.name, slug: p.slug, cover_image: p.cover_image });
    const prev = all.length > 1 ? all[(index - 1 + all.length) % all.length] : null;
    const next = all.length > 1 ? all[(index + 1) % all.length] : null;
    const skip = new Set([project.id, prev?.id, next?.id]);
    const others = all.filter((p) => !skip.has(p.id));
    const related = [
      ...others.filter((p) => p.service_id && p.service_id === project.service_id),
      ...others.filter((p) => !p.service_id || p.service_id !== project.service_id),
    ].slice(0, RELATED_COUNT);

    return res.status(200).json({
      success: true,
      data: {
        ...project,
        prev: prev ? brief(prev) : null,
        next: next ? brief(next) : null,
        related,
      },
    });
  } catch (error) {
    return v.sendError(res, "fetching project", error);
  }
};

/* ------------------------------ Admin ------------------------------ */

exports.options = (req, res) =>
  res.status(200).json({ success: true, data: { statuses: STATUSES } });

// Query: search, service_id, status, published=true|false, featured=true, page, limit
exports.adminList = async (req, res) => {
  try {
    const { search, service_id: serviceId, status, published, featured } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const where = {};

    if (STATUSES.includes(status)) where.status = status;
    if (published === "true" || published === "false") where.is_published = published === "true";
    if (featured === "true") where.is_featured = true;
    if (serviceId === "none") where.service_id = null;
    else if (serviceId && v.UUID_REGEX.test(serviceId)) where.service_id = serviceId;
    if (search) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = SEARCH_FIELDS.map((field) => ({ [field]: { [Op.iLike]: term } }));
    }

    const [{ count, rows }, total, publishedCount, featuredCount, completed, ongoing] = await Promise.all([
      Project.findAndCountAll({
        where,
        attributes: { include: [testimonialCount] },
        include: [{ model: Service, as: "service", attributes: [...SERVICE_BRIEF_ATTRIBUTES, "status"] }],
        order: ORDER,
        limit: paging.limit,
        offset: paging.offset,
      }),
      Project.count(),
      Project.count({ where: { is_published: true } }),
      Project.count({ where: { is_featured: true } }),
      Project.count({ where: { status: "completed" } }),
      Project.count({ where: { status: "ongoing" } }),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      summary: {
        total,
        published: publishedCount,
        drafts: total - publishedCount,
        featured: featuredCount,
        completed,
        ongoing,
      },
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching projects", error);
  }
};

exports.adminGet = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const project = await findForAdmin(req.params.id);
    if (!project) return notFound(res);
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return v.sendError(res, "fetching project", error);
  }
};

exports.create = async (req, res) => {
  try {
    const data = await cleanFields(req.body, { partial: false });
    data.slug = await resolveSlug(Project, {
      slug: v.text(req.body.slug, "Slug", { max: 160 }),
      name: data.name,
    });
    if (data.sort_order === undefined) data.sort_order = await nextSortOrder(Project);
    data.created_by = req.userId;
    data.updated_by = req.userId;

    const project = await Project.create(data);
    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: await findForAdmin(project.id),
    });
  } catch (error) {
    return v.sendError(res, "creating project", error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const project = await Project.findByPk(req.params.id);
    if (!project) return notFound(res);

    const data = await cleanFields(req.body, { partial: true });
    const slug = v.text(req.body.slug, "Slug", { max: 160 });
    if (slug && slug !== project.slug) {
      data.slug = await resolveSlug(Project, { slug, excludeId: project.id });
    }
    if (!Object.keys(data).length) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    await sequelize.transaction(async (transaction) => {
      await project.update({ ...data, updated_by: req.userId }, { transaction });
      // Quotes on this case study follow it to its new service
      if (data.service_id !== undefined) {
        await Testimonial.update(
          { service_id: data.service_id },
          { where: { project_id: project.id }, transaction }
        );
      }
    });

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: await findForAdmin(project.id),
    });
  } catch (error) {
    return v.sendError(res, "updating project", error);
  }
};

exports.reorder = async (req, res) => {
  try {
    await reorder(Project, req.body.ids);
    return res.status(200).json({ success: true, message: "Order saved" });
  } catch (error) {
    return v.sendError(res, "reordering projects", error);
  }
};

// Soft delete: linked testimonials stay on the testimonials page, just without the project link
exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const project = await Project.findByPk(req.params.id);
    if (!project) return notFound(res);

    await project.update({ updated_by: req.userId });
    await project.destroy();
    return res.status(200).json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    return v.sendError(res, "deleting project", error);
  }
};
