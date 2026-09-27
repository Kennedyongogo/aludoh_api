const { Op } = require("sequelize");
const { Certificate, TrainingBooking, Course, CourseSession, User, sequelize } = require("../models");
const v = require("../utils/validation");
const { cleanWith, searchWhere } = require("../utils/content");

const { STATUSES } = Certificate;
const SEARCH_FIELDS = ["certificate_number", "recipient_name", "recipient_email", "organization", "course_name"];

const FIELDS = {
  recipient_name: (x) => v.text(x, "Recipient name", { max: 160, required: true }),
  recipient_email: (x) => v.email(x, "Recipient email"),
  organization: (x) => v.text(x, "Organisation", { max: 160 }),
  course_name: (x) => v.text(x, "Course name", { max: 200 }),
  completed_on: (x) => v.dateOnly(x, "Completion date"),
  issued_at: (x) => v.dateTime(x, "Issue date"),
  status: (x) => v.oneOf(x, "Status", STATUSES),
  revoked_reason: (x) => v.text(x, "Reason", { max: 300 }),
  notes: (x) => v.text(x, "Notes", { max: 5000 }),
};
const DEFAULTED = ["status", "issued_at"];

const ADMIN_INCLUDES = [
  {
    model: TrainingBooking,
    as: "booking",
    attributes: ["id", "reference", "name", "phone", "email", "status", "session_id"],
    include: [{ model: CourseSession, as: "session", attributes: ["id", "start_date", "end_date", "location"] }],
  },
  { model: Course, as: "course", attributes: ["id", "name", "slug"], paranoid: false },
  { model: User, as: "issuer", attributes: ["id", "name"] },
];

const findForAdmin = (id) => Certificate.findByPk(id, { include: ADMIN_INCLUDES });

// MCA-CERT-<year>-<sequence>, counting deleted certificates too so a number is never reused
const nextNumber = async (transaction) => {
  const prefix = `MCA-CERT-${new Date().getFullYear()}-`;
  const [row] = await sequelize.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(certificate_number FROM :start) AS INTEGER)), 0) AS last
     FROM training_certificates WHERE certificate_number LIKE :pattern`,
    {
      replacements: { start: prefix.length + 1, pattern: `${prefix}%` },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );
  return `${prefix}${String(Number(row.last) + 1).padStart(4, "0")}`;
};

// Two admins issuing at the same moment can pick the same number; the unique index catches it
const createWithNumber = async (data, transaction) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await sequelize.transaction({ transaction }, async (t) =>
        Certificate.create({ ...data, certificate_number: await nextNumber(t) }, { transaction: t })
      );
    } catch (error) {
      if (error.name !== "SequelizeUniqueConstraintError" || attempt === 4) throw error;
    }
  }
  return null;
};

const revocationStamp = (status) =>
  status === "revoked" ? { revoked_at: new Date() } : { revoked_at: null, revoked_reason: null };

// Links a booking and course. On a new certificate, blank details are filled from them.
const applyLinks = async ({ body, data, certificate, transaction }) => {
  const fill = (key, value) => {
    if (!certificate && !data[key] && value) data[key] = value;
  };

  let courseId = body.course_id;
  if (body.booking_id !== undefined) {
    const bookingId = v.uuid(body.booking_id, "Booking");
    const booking = bookingId
      ? await TrainingBooking.findByPk(bookingId, {
          include: [{ model: CourseSession, as: "session", attributes: ["end_date"] }],
          transaction,
        })
      : null;
    if (bookingId && !booking) throw new v.ValidationError("The chosen booking no longer exists");
    data.booking_id = booking?.id || null;
    if (booking) {
      fill("recipient_name", booking.name);
      fill("recipient_email", booking.email);
      fill("organization", booking.organization);
      fill("completed_on", booking.session?.end_date);
      fill("course_name", booking.course_name);
      if (courseId === undefined) courseId = booking.course_id;
    }
  }

  if (courseId !== undefined) {
    const id = v.uuid(courseId, "Course");
    const course = id ? await Course.findByPk(id, { transaction, paranoid: false }) : null;
    if (id && !course) throw new v.ValidationError("The chosen course no longer exists");
    data.course_id = course?.id || null;
    if (course) fill("course_name", course.name);
  }

  const courseName = data.course_name !== undefined ? data.course_name : certificate?.course_name;
  if (!courseName) throw new v.ValidationError("Course name is required");
};

const notFound = (res) => res.status(404).json({ success: false, message: "Certificate not found" });

/* ----------------------------- Public ----------------------------- */

// /verify/:certificate_number on the website. Revoked certificates are shown as revoked, not hidden.
exports.verify = async (req, res) => {
  try {
    const number = String(req.params.number || "").trim().toUpperCase().slice(0, 40);
    const cert = number ? await Certificate.findOne({ where: { certificate_number: number } }) : null;
    if (!cert) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find a certificate with that number. Check it and try again.",
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        certificate_number: cert.certificate_number,
        status: cert.status,
        recipient_name: cert.recipient_name,
        organization: cert.organization,
        course_name: cert.course_name,
        completed_on: cert.completed_on,
        issued_at: cert.issued_at,
        revoked_at: cert.revoked_at,
        // Nested copy for the original verify page
        registration: {
          client: { name: cert.recipient_name },
          session: { course: { name: cert.course_name } },
        },
      },
    });
  } catch (error) {
    return v.sendError(res, "verifying certificate", error);
  }
};

/* ------------------------------ Admin ------------------------------ */

// Query: search, status, course_id, booking_id, page, limit
exports.adminList = async (req, res) => {
  try {
    const { search, status, course_id: courseId, booking_id: bookingId } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const where = {};
    if (STATUSES.includes(status)) where.status = status;
    if (courseId && v.UUID_REGEX.test(courseId)) where.course_id = courseId;
    if (bookingId && v.UUID_REGEX.test(bookingId)) where.booking_id = bookingId;
    if (search) Object.assign(where, searchWhere(SEARCH_FIELDS, search));

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const [{ count, rows }, total, valid, thisYear] = await Promise.all([
      Certificate.findAndCountAll({
        where,
        include: ADMIN_INCLUDES,
        order: [["issued_at", "DESC"]],
        limit: paging.limit,
        offset: paging.offset,
        distinct: true,
      }),
      Certificate.count(),
      Certificate.count({ where: { status: "valid" } }),
      Certificate.count({ where: { issued_at: { [Op.gte]: yearStart } } }),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      summary: { total, valid, revoked: total - valid, this_year: thisYear },
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching certificates", error);
  }
};

exports.adminGet = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const cert = await findForAdmin(req.params.id);
    if (!cert) return notFound(res);
    return res.status(200).json({ success: true, data: cert });
  } catch (error) {
    return v.sendError(res, "fetching certificate", error);
  }
};

exports.create = async (req, res) => {
  try {
    const data = cleanWith({ ...FIELDS, recipient_name: (x) => v.text(x, "Recipient name", { max: 160 }) }, req.body, {
      defaulted: DEFAULTED,
    });

    const cert = await sequelize.transaction(async (transaction) => {
      await applyLinks({ body: req.body, data, transaction });
      if (!data.recipient_name) throw new v.ValidationError("Recipient name is required");
      Object.assign(data, revocationStamp(data.status || "valid"), { issued_by: req.userId });
      return createWithNumber(data, transaction);
    });
    return res.status(201).json({ success: true, message: "Certificate issued", data: await findForAdmin(cert.id) });
  } catch (error) {
    return v.sendError(res, "issuing certificate", error);
  }
};

// One certificate for every attended booking in a session that doesn't have one yet
exports.issueForSession = async (req, res) => {
  try {
    const sessionId = v.uuid(req.body.session_id, "Session");
    if (!sessionId) throw new v.ValidationError("Choose a session");
    const session = await CourseSession.findByPk(sessionId, { include: [{ model: Course, as: "course", paranoid: false }] });
    if (!session) throw new v.ValidationError("The chosen session no longer exists");

    const bookings = await TrainingBooking.findAll({
      where: { session_id: session.id, status: "attended" },
      include: [{ model: Certificate, as: "certificates", attributes: ["id"] }],
      order: [["createdAt", "ASC"]],
    });
    const pending = bookings.filter((b) => !b.certificates.length);

    const issued = await sequelize.transaction(async (transaction) => {
      const created = [];
      for (const booking of pending) {
        created.push(
          await createWithNumber(
            {
              booking_id: booking.id,
              course_id: session.course_id,
              recipient_name: booking.name,
              recipient_email: booking.email,
              organization: booking.organization,
              course_name: session.course?.name || booking.course_name,
              completed_on: session.end_date,
              issued_by: req.userId,
            },
            transaction
          )
        );
      }
      return created;
    });

    return res.status(201).json({
      success: true,
      message: issued.length
        ? `${issued.length} certificate(s) issued`
        : "Everyone marked as attended already has a certificate",
      data: issued.map((c) => ({ id: c.id, certificate_number: c.certificate_number, recipient_name: c.recipient_name })),
    });
  } catch (error) {
    return v.sendError(res, "issuing certificates", error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const cert = await Certificate.findByPk(req.params.id);
    if (!cert) return notFound(res);

    const data = cleanWith(FIELDS, req.body, { partial: true, defaulted: DEFAULTED });
    if (!Object.keys(data).length && req.body.booking_id === undefined && req.body.course_id === undefined) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    await sequelize.transaction(async (transaction) => {
      await applyLinks({ body: req.body, data, certificate: cert, transaction });
      if (data.status && data.status !== cert.status) Object.assign(data, revocationStamp(data.status));
      await cert.update(data, { transaction });
    });
    return res.status(200).json({ success: true, message: "Certificate updated", data: await findForAdmin(cert.id) });
  } catch (error) {
    return v.sendError(res, "updating certificate", error);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const removed = await Certificate.destroy({ where: { id: req.params.id } });
    if (!removed) return notFound(res);
    return res.status(200).json({ success: true, message: "Certificate deleted" });
  } catch (error) {
    return v.sendError(res, "deleting certificate", error);
  }
};
