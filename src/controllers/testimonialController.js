const { Op } = require("sequelize");
const { Testimonial, Service, Project, User, sequelize } = require("../models");
const v = require("../utils/validation");
const { validatePhoneNumber } = require("../utils/phone");
const { nextSortOrder, reorder } = require("../utils/content");
const {
  SERVICE_BRIEF_ATTRIBUTES,
  TESTIMONIAL_PUBLIC_ATTRIBUTES,
  testimonialPublicIncludes,
  toPublicTestimonial,
} = require("../services/contentViews");

const { STATUSES, SOURCES } = Testimonial;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_CONTENT_MIN = 20;
const PUBLIC_CONTENT_MAX = 1500;
const SEARCH_FIELDS = ["client_name", "organization", "role", "content", "email", "phone"];

// Featured quotes lead (the testimonials page carousel takes the first few), then the admin's order
const DISPLAY_ORDER = [
  ["is_featured", "DESC"],
  ["sort_order", "ASC"],
  ["reviewed_at", "DESC NULLS LAST"],
  ["createdAt", "DESC"],
];

const cleanEmail = (value) => {
  const email = v.text(value, "Email", { max: 160 });
  if (!email) return null;
  if (!EMAIL_REGEX.test(email)) throw new v.ValidationError("Please enter a valid email address");
  return email.toLowerCase();
};

const cleanPhone = (value) => {
  if (v.isBlank(value)) return null;
  const result = validatePhoneNumber(value);
  if (!result.valid) throw new v.ValidationError(result.message);
  return result.normalized;
};

const FIELDS = {
  client_name: (x) => v.text(x, "Client name", { max: 120, required: true }),
  organization: (x) => v.text(x, "Organisation", { max: 160 }),
  role: (x) => v.text(x, "Role", { max: 120 }),
  rating: (x) => v.integer(x, "Rating", { min: 1, max: 5 }),
  content: (x) => v.text(x, "Testimonial", { max: 5000, required: true }),
  photo: (x) => v.imagePath(x, "Photo"),
  status: (x) => v.oneOf(x, "Status", STATUSES),
  is_featured: (x) => v.boolean(x),
  sort_order: (x) => v.integer(x, "Sort order", { min: 0, max: 100000 }),
  source: (x) => v.oneOf(x, "Source", SOURCES),
  email: cleanEmail,
  phone: cleanPhone,
  admin_note: (x) => v.text(x, "Note", { max: 5000 }),
};

// Left out when empty so the column default (or a computed value) applies
const DEFAULTED = ["status", "is_featured", "sort_order", "source"];

// A quote linked to a case study takes that project's service unless one is chosen explicitly
const cleanLinks = async (body, { partial }, data) => {
  const serviceGiven = !partial || body.service_id !== undefined;
  const projectGiven = !partial || body.project_id !== undefined;

  if (projectGiven) {
    const projectId = v.uuid(body.project_id, "Project");
    const project = projectId
      ? await Project.findByPk(projectId, { attributes: ["id", "service_id"] })
      : null;
    if (projectId && !project) throw new v.ValidationError("The chosen project no longer exists");
    data.project_id = project?.id || null;
    if (project?.service_id && v.isBlank(body.service_id)) data.service_id = project.service_id;
  }

  if (serviceGiven && data.service_id === undefined) {
    const serviceId = v.uuid(body.service_id, "Service");
    if (serviceId && !(await Service.count({ where: { id: serviceId } }))) {
      throw new v.ValidationError("The chosen service no longer exists");
    }
    data.service_id = serviceId;
  }
};

const cleanFields = async (body, { partial }) => {
  const data = {};
  for (const [key, clean] of Object.entries(FIELDS)) {
    if (partial && body[key] === undefined) continue;
    const value = clean(body[key]);
    if (value === null && DEFAULTED.includes(key)) continue;
    data[key] = value;
  }
  await cleanLinks(body, { partial }, data);
  return data;
};

const reviewStamp = (status, userId) =>
  status === "pending"
    ? { reviewed_by: null, reviewed_at: null }
    : { reviewed_by: userId, reviewed_at: new Date() };

const ratingSummary = async (where) => {
  const [row] = await Testimonial.findAll({
    where,
    attributes: [
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      [sequelize.fn("COUNT", sequelize.col("rating")), "rated"],
      [sequelize.fn("AVG", sequelize.col("rating")), "average"],
      [sequelize.literal("COUNT(*) FILTER (WHERE rating >= 4)"), "happy"],
    ],
    raw: true,
  });
  const rated = Number(row?.rated || 0);
  return {
    count: Number(row?.count || 0),
    rated,
    average: rated ? Math.round(Number(row.average) * 10) / 10 : null,
    happy_percent: rated ? Math.round((Number(row.happy) / rated) * 100) : null,
  };
};

const ADMIN_INCLUDES = [
  { model: Service, as: "service", attributes: [...SERVICE_BRIEF_ATTRIBUTES, "status"] },
  { model: Project, as: "project", attributes: ["id", "name", "slug", "client", "is_published"] },
  { model: User, as: "reviewer", attributes: ["id", "name"] },
];

const findForAdmin = (id) => Testimonial.findByPk(id, { include: ADMIN_INCLUDES });

const notFound = (res) => res.status(404).json({ success: false, message: "Testimonial not found" });

/* ----------------------------- Public ----------------------------- */

// Approved testimonials only, whatever status is asked for.
// Query: featured=true, service=<slug>, project=<slug>, page, limit
exports.list = async (req, res) => {
  try {
    const { featured, service, project } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 24, maxLimit: 100 });
    const where = { status: "approved" };
    const empty = () =>
      res.status(200).json({
        success: true,
        data: [],
        summary: { count: 0, rated: 0, average: null, happy_percent: null },
        pagination: v.paginationMeta(0, paging),
      });

    if (featured === "true") where.is_featured = true;
    if (service) {
      const match = await Service.findOne({
        where: { slug: String(service).toLowerCase(), status: "active" },
        attributes: ["id"],
      });
      if (!match) return empty();
      where.service_id = match.id;
    }
    if (project) {
      const match = await Project.findOne({
        where: { slug: String(project).toLowerCase(), is_published: true },
        attributes: ["id"],
      });
      if (!match) return empty();
      where.project_id = match.id;
    }

    const [{ count, rows }, summary] = await Promise.all([
      Testimonial.findAndCountAll({
        where,
        attributes: TESTIMONIAL_PUBLIC_ATTRIBUTES,
        include: testimonialPublicIncludes(),
        order: DISPLAY_ORDER,
        limit: paging.limit,
        offset: paging.offset,
        distinct: true,
      }),
      ratingSummary(where),
    ]);

    return res.status(200).json({
      success: true,
      data: rows.map(toPublicTestimonial),
      summary,
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching testimonials", error);
  }
};

// Public form on /testimonials. Always saved as pending; status, featuring and links are the admin's call.
exports.submit = async (req, res) => {
  try {
    const body = req.body || {};
    const thanks = {
      success: true,
      message: "Thank you! Your testimonial will appear once our team has reviewed it.",
    };

    // Hidden "website" field: real visitors never fill it in, bots usually do
    if (!v.isBlank(body.website)) return res.status(201).json(thanks);

    const clientName = v.text(body.client_name, "Your name", { max: 120, required: true });
    if (clientName.length < 2) throw new v.ValidationError("Please enter your name");
    const content = v.text(body.content, "Your testimonial", { max: PUBLIC_CONTENT_MAX, required: true });
    if (content.length < PUBLIC_CONTENT_MIN) {
      throw new v.ValidationError(`Please write at least ${PUBLIC_CONTENT_MIN} characters`);
    }

    let serviceId = null;
    if (!v.isBlank(body.service)) {
      const match = await Service.findOne({
        where: { slug: String(body.service).toLowerCase(), status: "active" },
        attributes: ["id"],
      });
      serviceId = match?.id || null;
    }

    const testimonial = await Testimonial.create({
      client_name: clientName,
      organization: v.text(body.organization, "Farm / organisation", { max: 160 }),
      role: v.text(body.role, "Role", { max: 120 }),
      rating: v.integer(body.rating, "Rating", { min: 1, max: 5, required: true }),
      content,
      email: cleanEmail(body.email),
      phone: cleanPhone(body.phone),
      service_id: serviceId,
      status: "pending",
      source: "website",
      ip_address: String(req.ip || "").slice(0, 64) || null,
    });

    return res.status(201).json({ ...thanks, data: { id: testimonial.id } });
  } catch (error) {
    return v.sendError(res, "submitting testimonial", error);
  }
};

/* ------------------------------ Admin ------------------------------ */

exports.options = (req, res) =>
  res.status(200).json({ success: true, data: { statuses: STATUSES, sources: SOURCES } });

// Query: status, search, service_id, project_id, featured=true, source, order=display, page, limit
exports.adminList = async (req, res) => {
  try {
    const { status, search, service_id: serviceId, project_id: projectId, featured, source, order } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const where = {};

    if (STATUSES.includes(status)) where.status = status;
    if (SOURCES.includes(source)) where.source = source;
    if (featured === "true") where.is_featured = true;
    if (serviceId === "none") where.service_id = null;
    else if (serviceId && v.UUID_REGEX.test(serviceId)) where.service_id = serviceId;
    if (projectId === "none") where.project_id = null;
    else if (projectId && v.UUID_REGEX.test(projectId)) where.project_id = projectId;
    if (search) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = SEARCH_FIELDS.map((field) => ({ [field]: { [Op.iLike]: term } }));
    }

    const [{ count, rows }, statusCounts, ratings] = await Promise.all([
      Testimonial.findAndCountAll({
        where,
        include: ADMIN_INCLUDES,
        order: order === "display" ? DISPLAY_ORDER : [["createdAt", "DESC"]],
        limit: paging.limit,
        offset: paging.offset,
        distinct: true,
      }),
      Testimonial.count({ group: ["status"] }),
      ratingSummary({ status: "approved" }),
    ]);

    const summary = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    statusCounts.forEach(({ status: s, count: n }) => {
      summary[s] = Number(n);
    });
    summary.total = Object.values(summary).reduce((sum, n) => sum + n, 0);

    return res.status(200).json({
      success: true,
      data: rows,
      summary: { ...summary, ratings },
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching testimonials", error);
  }
};

exports.adminGet = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const testimonial = await findForAdmin(req.params.id);
    if (!testimonial) return notFound(res);
    return res.status(200).json({ success: true, data: testimonial });
  } catch (error) {
    return v.sendError(res, "fetching testimonial", error);
  }
};

// Quotes an admin types in (from WhatsApp, a call or a visit) are published straight away unless marked pending
exports.create = async (req, res) => {
  try {
    const data = await cleanFields(req.body, { partial: false });
    data.status = data.status || "approved";
    data.source = data.source || "admin";
    if (data.sort_order === undefined) data.sort_order = await nextSortOrder(Testimonial);
    Object.assign(data, reviewStamp(data.status, req.userId));

    const testimonial = await Testimonial.create(data);
    return res.status(201).json({
      success: true,
      message: "Testimonial added successfully",
      data: await findForAdmin(testimonial.id),
    });
  } catch (error) {
    return v.sendError(res, "adding testimonial", error);
  }
};

// Approve / reject / feature, edit wording, link to a service or project
exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const testimonial = await Testimonial.findByPk(req.params.id);
    if (!testimonial) return notFound(res);

    const data = await cleanFields(req.body, { partial: true });
    if (!Object.keys(data).length) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }
    if (data.status && data.status !== testimonial.status) {
      Object.assign(data, reviewStamp(data.status, req.userId));
    }

    await testimonial.update(data);
    return res.status(200).json({
      success: true,
      message: "Testimonial updated successfully",
      data: await findForAdmin(testimonial.id),
    });
  } catch (error) {
    return v.sendError(res, "updating testimonial", error);
  }
};

exports.reorder = async (req, res) => {
  try {
    await reorder(Testimonial, req.body.ids);
    return res.status(200).json({ success: true, message: "Order saved" });
  } catch (error) {
    return v.sendError(res, "reordering testimonials", error);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const removed = await Testimonial.destroy({ where: { id: req.params.id } });
    if (!removed) return notFound(res);
    return res.status(200).json({ success: true, message: "Testimonial deleted successfully" });
  } catch (error) {
    return v.sendError(res, "deleting testimonial", error);
  }
};
