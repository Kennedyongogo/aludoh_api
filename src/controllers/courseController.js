const { Op } = require("sequelize");
const { Course, CourseSession, TrainingBooking, User, sequelize } = require("../models");
const v = require("../utils/validation");
const { resolveSlug, nextSortOrder, reorder, cleanWith, searchWhere } = require("../utils/content");
const { seatsTaken, sessionView } = require("../services/training");

const { LEVELS, MODES } = Course;
const SESSION_STATUSES = CourseSession.STATUSES;
const SEARCH_FIELDS = ["name", "slug", "category", "short_description", "location"];
const RELATED_COUNT = 3;
const MAX_SESSIONS = 30;
const ORDER = [
  ["sort_order", "ASC"],
  ["name", "ASC"],
];
const PUBLIC_EXCLUDE = ["created_by", "updated_by", "deletedAt", "is_published", "sort_order"];

const money = (label) => (x) => v.integer(x, label, { min: 0, max: 10000000 });

const FIELDS = {
  name: (x) => v.text(x, "Course name", { max: 160, required: true }),
  category: (x) => v.text(x, "Category", { max: 80 }),
  level: (x) => v.oneOf(x, "Level", LEVELS),
  short_description: (x) => v.text(x, "Short description", { max: 200 }),
  description: (x) => v.text(x, "Description", { max: 10000 }),
  image: (x) => v.imagePath(x, "Image"),
  duration: (x) => v.text(x, "Duration", { max: 60 }),
  mode: (x) => v.oneOf(x, "Mode", MODES),
  location: (x) => v.text(x, "Location", { max: 120 }),
  fee: money("Fee"),
  outcomes: (x) => v.stringList(x, "What you'll learn", { maxItems: 15, maxLength: 200 }),
  audience: (x) => v.text(x, "Who it's for", { max: 300 }),
  is_featured: (x) => v.boolean(x),
  is_published: (x) => v.boolean(x),
  sort_order: (x) => v.integer(x, "Sort order", { min: 0, max: 100000 }),
  seo_title: (x) => v.text(x, "SEO title", { max: 70 }),
  seo_description: (x) => v.text(x, "SEO description", { max: 170 }),
};
const DEFAULTED = ["is_featured", "is_published", "sort_order"];

const SESSION_SHAPE = {
  id: (x, label) => v.uuid(x, label),
  start_date: (x, label) => v.dateOnly(x, label, { required: true }),
  end_date: (x, label) => v.dateOnly(x, label),
  location: (x, label) => v.text(x, label, { max: 160 }),
  fee: (x, label) => v.integer(x, label, { min: 0, max: 10000000 }),
  capacity: (x, label) => v.integer(x, label, { min: 1, max: 1000, required: true }),
  status: (x, label) => v.oneOf(x, label, SESSION_STATUSES),
};

const cleanSessions = (value) =>
  v.objectList(value, "Session", SESSION_SHAPE, { maxItems: MAX_SESSIONS }).map((s, i) => {
    const end = s.end_date || s.start_date;
    if (end < s.start_date) throw new v.ValidationError(`Session ${i + 1} ends before it starts`);
    return { ...s, end_date: end, status: s.status || "scheduled" };
  });

const dateLabel = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Creates, updates and removes a course's sessions to match the list sent from the admin form
const syncSessions = async (course, items, transaction) => {
  const existing = await CourseSession.findAll({ where: { course_id: course.id }, transaction });
  const byId = new Map(existing.map((s) => [s.id, s]));
  const taken = await seatsTaken(existing.map((s) => s.id), { transaction });

  for (const item of items) {
    if (item.id && !byId.has(item.id)) throw new v.ValidationError("A session no longer exists; reload the page and try again");
  }

  const keep = new Set(items.map((s) => s.id).filter(Boolean));
  for (const session of existing) {
    if (keep.has(session.id)) continue;
    const held = taken.get(session.id) || 0;
    if (held) {
      throw new v.ValidationError(
        `The ${dateLabel(session.start_date)} session has ${held} booked seat(s). Mark it cancelled instead of removing it.`
      );
    }
    await session.destroy({ transaction });
  }

  for (const { id, ...fields } of items) {
    if (id) {
      const held = taken.get(id) || 0;
      if (fields.capacity < held) {
        throw new v.ValidationError(`The ${dateLabel(fields.start_date)} session already has ${held} booked seats; capacity can't be lower`);
      }
      await byId.get(id).update(fields, { transaction });
    } else {
      await CourseSession.create({ ...fields, course_id: course.id }, { transaction });
    }
  }
};

const withSessionsView = async (rows, { upcomingOnly }) => {
  const plain = rows.map((row) => row.get({ plain: true }));
  const taken = await seatsTaken(plain.flatMap((c) => (c.sessions || []).map((s) => s.id)));
  return plain.map((course) => ({
    ...course,
    sessions: (course.sessions || [])
      .map((s) => sessionView(s, taken.get(s.id)))
      .map((s) => (upcomingOnly ? { ...s, status: "upcoming" } : s)),
  }));
};

const upcomingSessionsInclude = () => ({
  model: CourseSession,
  as: "sessions",
  where: { status: "scheduled", start_date: { [Op.gte]: v.todayInNairobi() } },
  required: false,
  separate: true,
  order: [["start_date", "ASC"]],
});

const categoryList = async (where) => {
  const rows = await Course.findAll({
    where: { ...where, category: { [Op.ne]: null } },
    attributes: ["category", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    group: ["category"],
    raw: true,
  });
  return rows
    .map((row) => ({ name: row.category, count: Number(row.count) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const findForAdmin = async (id) => {
  const course = await Course.findByPk(id, {
    include: [
      { model: CourseSession, as: "sessions", separate: true, order: [["start_date", "ASC"]] },
      { model: User, as: "creator", attributes: ["id", "name"] },
      { model: User, as: "updater", attributes: ["id", "name"] },
    ],
  });
  if (!course) return null;
  const [view] = await withSessionsView([course], { upcomingOnly: false });
  const [bookingCounts] = await sequelize.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
     FROM training_bookings WHERE course_id = :id AND "deletedAt" IS NULL`,
    { replacements: { id }, type: sequelize.QueryTypes.SELECT }
  );
  return { ...view, booking_counts: bookingCounts };
};

const notFound = (res) => res.status(404).json({ success: false, message: "Course not found" });

/* ----------------------------- Public ----------------------------- */

// Query: category, featured=true, search. Sessions are upcoming, scheduled dates only.
exports.list = async (req, res) => {
  try {
    const { category, featured, search } = req.query;
    const where = { is_published: true };
    if (category) where.category = String(category).slice(0, 80);
    if (featured === "true") where.is_featured = true;
    if (search) Object.assign(where, searchWhere(SEARCH_FIELDS, search));

    const [rows, categories] = await Promise.all([
      Course.findAll({
        where,
        attributes: { exclude: [...PUBLIC_EXCLUDE, "description", "seo_title", "seo_description"] },
        include: [upcomingSessionsInclude()],
        order: ORDER,
      }),
      categoryList({ is_published: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: await withSessionsView(rows, { upcomingOnly: true }),
      categories,
    });
  } catch (error) {
    return v.sendError(res, "fetching courses", error);
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const row = await Course.findOne({
      where: { slug: String(req.params.slug).toLowerCase(), is_published: true },
      attributes: { exclude: PUBLIC_EXCLUDE },
      include: [upcomingSessionsInclude()],
    });
    if (!row) return notFound(res);

    const others = await Course.findAll({
      where: { is_published: true, id: { [Op.ne]: row.id } },
      attributes: { exclude: [...PUBLIC_EXCLUDE, "description", "seo_title", "seo_description"] },
      include: [upcomingSessionsInclude()],
      order: ORDER,
      limit: 50,
    });
    const related = [
      ...others.filter((c) => row.category && c.category === row.category),
      ...others.filter((c) => !row.category || c.category !== row.category),
    ].slice(0, RELATED_COUNT);

    const [course] = await withSessionsView([row], { upcomingOnly: true });
    return res.status(200).json({
      success: true,
      data: { ...course, related: await withSessionsView(related, { upcomingOnly: true }) },
    });
  } catch (error) {
    return v.sendError(res, "fetching course", error);
  }
};

/* ------------------------------ Admin ------------------------------ */

exports.options = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        levels: LEVELS,
        modes: MODES,
        session_statuses: SESSION_STATUSES,
        categories: (await categoryList({})).map((c) => c.name),
      },
    });
  } catch (error) {
    return v.sendError(res, "fetching course options", error);
  }
};

// Query: search, category, published=true|false, featured=true, page, limit
exports.adminList = async (req, res) => {
  try {
    const { search, category, published, featured } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const where = {};
    if (category) where.category = String(category).slice(0, 80);
    if (published === "true" || published === "false") where.is_published = published === "true";
    if (featured === "true") where.is_featured = true;
    if (search) Object.assign(where, searchWhere(SEARCH_FIELDS, search));

    const today = v.todayInNairobi();
    const [{ count, rows }, total, publishedCount, featuredCount, upcoming, pendingBookings] = await Promise.all([
      Course.findAndCountAll({
        where,
        attributes: {
          exclude: ["description"],
          include: [
            [
              sequelize.literal(
                `(SELECT MIN(s.start_date) FROM course_sessions s
                  WHERE s.course_id = "Course".id AND s.status = 'scheduled' AND s.start_date >= '${today}')`
              ),
              "next_session",
            ],
            [
              sequelize.literal(
                `(SELECT COUNT(*)::int FROM course_sessions s
                  WHERE s.course_id = "Course".id AND s.status = 'scheduled' AND s.start_date >= '${today}')`
              ),
              "upcoming_sessions",
            ],
            [
              sequelize.literal(
                `(SELECT COUNT(*)::int FROM training_bookings b
                  WHERE b.course_id = "Course".id AND b.status = 'pending' AND b."deletedAt" IS NULL)`
              ),
              "pending_bookings",
            ],
          ],
        },
        order: ORDER,
        limit: paging.limit,
        offset: paging.offset,
      }),
      Course.count(),
      Course.count({ where: { is_published: true } }),
      Course.count({ where: { is_featured: true } }),
      CourseSession.count({
        where: { status: "scheduled", start_date: { [Op.gte]: today } },
        include: [{ model: Course, as: "course", attributes: [], required: true }],
      }),
      TrainingBooking.count({ where: { status: "pending" } }),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      summary: {
        total,
        published: publishedCount,
        hidden: total - publishedCount,
        featured: featuredCount,
        upcoming_sessions: upcoming,
        pending_bookings: pendingBookings,
      },
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching courses", error);
  }
};

exports.adminGet = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const course = await findForAdmin(req.params.id);
    if (!course) return notFound(res);
    return res.status(200).json({ success: true, data: course });
  } catch (error) {
    return v.sendError(res, "fetching course", error);
  }
};

// Sessions for the booking form's dropdown: every course with its scheduled dates
exports.sessionOptions = async (req, res) => {
  try {
    const rows = await Course.findAll({
      attributes: ["id", "name", "fee", "is_published"],
      include: [
        {
          model: CourseSession,
          as: "sessions",
          where: { status: "scheduled" },
          required: false,
          separate: true,
          order: [["start_date", "DESC"]],
        },
      ],
      order: [["name", "ASC"]],
    });
    return res.status(200).json({ success: true, data: await withSessionsView(rows, { upcomingOnly: false }) });
  } catch (error) {
    return v.sendError(res, "fetching sessions", error);
  }
};

exports.create = async (req, res) => {
  try {
    const data = cleanWith(FIELDS, req.body, { defaulted: DEFAULTED });
    const sessions = cleanSessions(req.body.sessions);
    if (sessions.some((s) => s.id)) throw new v.ValidationError("New courses can't include existing sessions");
    data.slug = await resolveSlug(Course, { slug: v.text(req.body.slug, "Slug", { max: 160 }), name: data.name });
    if (data.sort_order === undefined) data.sort_order = await nextSortOrder(Course);
    data.created_by = req.userId;
    data.updated_by = req.userId;

    const course = await sequelize.transaction(async (transaction) => {
      const created = await Course.create(data, { transaction });
      await syncSessions(created, sessions, transaction);
      return created;
    });
    return res.status(201).json({ success: true, message: "Course created", data: await findForAdmin(course.id) });
  } catch (error) {
    return v.sendError(res, "creating course", error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const course = await Course.findByPk(req.params.id);
    if (!course) return notFound(res);

    const data = cleanWith(FIELDS, req.body, { partial: true, defaulted: DEFAULTED });
    const slug = v.text(req.body.slug, "Slug", { max: 160 });
    if (slug && slug !== course.slug) data.slug = await resolveSlug(Course, { slug, excludeId: course.id });
    const sessions = req.body.sessions === undefined ? null : cleanSessions(req.body.sessions);
    if (!Object.keys(data).length && !sessions) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    await sequelize.transaction(async (transaction) => {
      await course.update({ ...data, updated_by: req.userId }, { transaction });
      if (sessions) await syncSessions(course, sessions, transaction);
      if (data.name) {
        await TrainingBooking.update(
          { course_name: data.name },
          { where: { course_id: course.id, status: { [Op.in]: ["pending", "confirmed"] } }, transaction }
        );
      }
    });
    return res.status(200).json({ success: true, message: "Course updated", data: await findForAdmin(course.id) });
  } catch (error) {
    return v.sendError(res, "updating course", error);
  }
};

exports.reorder = async (req, res) => {
  try {
    await reorder(Course, req.body.ids);
    return res.status(200).json({ success: true, message: "Order saved" });
  } catch (error) {
    return v.sendError(res, "reordering courses", error);
  }
};

// Soft delete: bookings and certificates keep the course name they were made with
exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const course = await Course.findByPk(req.params.id);
    if (!course) return notFound(res);
    const open = await TrainingBooking.count({ where: { course_id: course.id, status: { [Op.in]: ["pending", "confirmed"] } } });
    if (open) {
      return res.status(400).json({
        success: false,
        message: `This course has ${open} open booking(s). Confirm or cancel them first, or hide the course instead.`,
      });
    }
    await course.update({ updated_by: req.userId });
    await course.destroy();
    return res.status(200).json({ success: true, message: "Course deleted" });
  } catch (error) {
    return v.sendError(res, "deleting course", error);
  }
};
