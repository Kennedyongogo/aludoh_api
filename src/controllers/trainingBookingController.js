const { TrainingBooking, Course, CourseSession, Certificate, User, sequelize } = require("../models");
const v = require("../utils/validation");
const { cleanWith, searchWhere } = require("../utils/content");
const { seatsTaken } = require("../services/training");

const { STATUSES, PAYMENT_STATUSES, SOURCES, SEAT_HOLDING } = TrainingBooking;
const MAX_PARTICIPANTS = 10;
const SEARCH_FIELDS = ["reference", "name", "phone", "email", "organization", "course_name"];

const FIELDS = {
  name: (x) => v.text(x, "Name", { max: 120, required: true }),
  phone: (x) => v.phone(x, "Phone number", { required: true }),
  email: (x) => v.email(x),
  organization: (x) => v.text(x, "Organisation", { max: 160 }),
  participants: (x) => v.integer(x, "Participants", { min: 1, max: 100, required: true }),
  preferred_date: (x) => v.dateOnly(x, "Preferred date"),
  unit_fee: (x) => v.integer(x, "Fee per participant", { min: 0, max: 10000000 }),
  status: (x) => v.oneOf(x, "Status", STATUSES),
  payment_status: (x) => v.oneOf(x, "Payment", PAYMENT_STATUSES),
  amount_paid: (x) => v.integer(x, "Amount paid", { min: 0, max: 100000000 }),
  source: (x) => v.oneOf(x, "Source", SOURCES),
  admin_note: (x) => v.text(x, "Note", { max: 5000 }),
};
const DEFAULTED = ["status", "payment_status", "amount_paid", "source"];

const ADMIN_INCLUDES = [
  { model: Course, as: "course", attributes: ["id", "name", "slug", "fee", "is_published"], paranoid: false },
  { model: CourseSession, as: "session", attributes: ["id", "start_date", "end_date", "location", "fee", "capacity", "status"] },
  { model: User, as: "handler", attributes: ["id", "name"] },
];

const findForAdmin = (id) =>
  TrainingBooking.findByPk(id, {
    include: [
      ...ADMIN_INCLUDES,
      {
        model: Certificate,
        as: "certificates",
        attributes: ["id", "certificate_number", "recipient_name", "status", "issued_at"],
      },
    ],
  });

const makeReference = async (transaction) => {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reference = `MCA-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
    const taken = await TrainingBooking.findOne({ where: { reference }, paranoid: false, attributes: ["id"], transaction });
    if (!taken) return reference;
  }
  throw new Error("Could not create a booking reference");
};

// Locks the session row so two people can't take the last seats at the same time
const checkSeats = async ({ session, participants, excludeBookingId, transaction }) => {
  await CourseSession.findByPk(session.id, { lock: transaction.LOCK.UPDATE, transaction });
  const taken = (await seatsTaken([session.id], { transaction, excludeBookingId })).get(session.id) || 0;
  const left = Math.max(0, session.capacity - taken);
  if (participants > left) {
    throw new v.ValidationError(
      left ? `Only ${left} seat${left === 1 ? " is" : "s are"} left in this session.` : "This session is fully booked."
    );
  }
};

const paymentStatusFor = (paid, total) => {
  if (!paid) return "unpaid";
  if (total && paid >= total) return "paid";
  return "partial";
};

const notFound = (res) => res.status(404).json({ success: false, message: "Booking not found" });

/* ----------------------------- Public ----------------------------- */

// Booking form on /training/:slug. Body: course (slug), session_id or preferred_date,
// name, phone, email, organization, participants
exports.submit = async (req, res) => {
  try {
    const body = req.body || {};
    // Hidden "website" field: real visitors never fill it in, bots usually do
    if (!v.isBlank(body.website)) {
      return res.status(201).json({ success: true, message: "Booking received", data: { reference: "MCA-RECEIVED" } });
    }

    const name = v.text(body.name, "Your name", { max: 120, required: true });
    if (name.length < 2) throw new v.ValidationError("Please enter your full name");
    const phone = v.phone(body.phone, "Phone number", { required: true });
    const email = v.email(body.email, "Email", { required: true });
    const organization = v.text(body.organization, "Organisation", { max: 160 });
    const participants = v.integer(body.participants ?? 1, "Participants", { min: 1, max: MAX_PARTICIPANTS, required: true });
    const sessionId = v.uuid(body.session_id, "Session");

    const course = await Course.findOne({
      where: { slug: String(body.course || "").toLowerCase(), is_published: true },
    });
    if (!course) throw new v.ValidationError("This course is no longer open for booking");

    const booking = await sequelize.transaction(async (transaction) => {
      let session = null;
      let preferredDate = null;
      if (sessionId) {
        session = await CourseSession.findOne({ where: { id: sessionId, course_id: course.id }, transaction });
        if (!session || session.status !== "scheduled" || session.start_date < v.todayInNairobi()) {
          throw new v.ValidationError("That session is no longer available. Please pick another date.");
        }
        await checkSeats({ session, participants, transaction });
      } else {
        preferredDate = v.dateOnly(body.preferred_date, "Preferred start date", { required: true });
        if (preferredDate < v.todayInNairobi()) throw new v.ValidationError("Pick a date in the future");
      }

      const unitFee = session?.fee ?? course.fee ?? null;
      return TrainingBooking.create(
        {
          reference: await makeReference(transaction),
          course_id: course.id,
          course_name: course.name,
          session_id: session?.id || null,
          preferred_date: preferredDate,
          name,
          phone,
          email,
          organization,
          participants,
          unit_fee: unitFee,
          total_fee: unitFee === null ? null : unitFee * participants,
          source: "website",
          ip_address: String(req.ip || "").slice(0, 64) || null,
        },
        { transaction }
      );
    });

    return res.status(201).json({
      success: true,
      message: "Booking received. Our team will call you to confirm.",
      data: { reference: booking.reference, total_fee: booking.total_fee },
    });
  } catch (error) {
    return v.sendError(res, "booking training", error);
  }
};

/* ------------------------------ Admin ------------------------------ */

exports.options = (req, res) =>
  res.status(200).json({
    success: true,
    data: { statuses: STATUSES, payment_statuses: PAYMENT_STATUSES, sources: SOURCES },
  });

// Query: search, status, payment_status, course_id, session_id, page, limit
exports.adminList = async (req, res) => {
  try {
    const { search, status, payment_status: paymentStatus, course_id: courseId, session_id: sessionId } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const where = {};
    if (STATUSES.includes(status)) where.status = status;
    if (PAYMENT_STATUSES.includes(paymentStatus)) where.payment_status = paymentStatus;
    if (courseId && v.UUID_REGEX.test(courseId)) where.course_id = courseId;
    if (sessionId === "none") where.session_id = null;
    else if (sessionId && v.UUID_REGEX.test(sessionId)) where.session_id = sessionId;
    if (search) Object.assign(where, searchWhere(SEARCH_FIELDS, search));

    const [{ count, rows }, statusCounts, [money]] = await Promise.all([
      TrainingBooking.findAndCountAll({
        where,
        include: ADMIN_INCLUDES,
        order: [["createdAt", "DESC"]],
        limit: paging.limit,
        offset: paging.offset,
        distinct: true,
      }),
      TrainingBooking.findAll({
        attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),
      sequelize.query(
        `SELECT COALESCE(SUM(amount_paid), 0)::bigint AS collected,
                COALESCE(SUM(GREATEST(COALESCE(total_fee, 0) - amount_paid, 0))
                  FILTER (WHERE status IN ('confirmed', 'attended')), 0)::bigint AS outstanding,
                COALESCE(SUM(participants) FILTER (WHERE status IN ('pending', 'confirmed')), 0)::int AS seats
         FROM training_bookings WHERE "deletedAt" IS NULL`,
        { type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    const summary = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    statusCounts.forEach((row) => {
      summary[row.status] = Number(row.count);
    });
    summary.total = Object.values(summary).reduce((sum, n) => sum + n, 0);

    return res.status(200).json({
      success: true,
      data: rows,
      summary: {
        ...summary,
        collected: Number(money.collected),
        outstanding: Number(money.outstanding),
        seats: money.seats,
      },
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching bookings", error);
  }
};

exports.adminGet = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const booking = await findForAdmin(req.params.id);
    if (!booking) return notFound(res);
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return v.sendError(res, "fetching booking", error);
  }
};

// Shared by create and update: resolves the course/session change and recomputes fees
const applyLinks = async ({ body, data, booking, transaction }) => {
  const courseGiven = body.course_id !== undefined;
  const sessionGiven = body.session_id !== undefined;

  let course = null;
  if (courseGiven) {
    const courseId = v.uuid(body.course_id, "Course");
    if (!courseId) throw new v.ValidationError("Choose a course");
    course = await Course.findByPk(courseId, { transaction });
    if (!course) throw new v.ValidationError("The chosen course no longer exists");
    data.course_id = course.id;
    data.course_name = course.name;
  } else if (booking?.course_id) {
    course = await Course.findByPk(booking.course_id, { transaction, paranoid: false });
  }

  let session;
  if (sessionGiven || courseGiven) {
    const courseChanged = courseGiven && data.course_id !== booking?.course_id;
    const sessionId = sessionGiven ? v.uuid(body.session_id, "Session") : courseChanged ? null : booking?.session_id || null;
    session = sessionId ? await CourseSession.findByPk(sessionId, { transaction }) : null;
    if (sessionId && !session) throw new v.ValidationError("The chosen session no longer exists");
    if (session && course && session.course_id !== course.id) throw new v.ValidationError("That session belongs to another course");
    data.session_id = session?.id || null;
  } else if (booking?.session_id) {
    session = await CourseSession.findByPk(booking.session_id, { transaction });
  }

  const linksChanged = (courseGiven && data.course_id !== booking?.course_id) || (sessionGiven && data.session_id !== booking?.session_id);
  if (data.unit_fee === undefined && (linksChanged || !booking)) {
    data.unit_fee = session?.fee ?? course?.fee ?? null;
  }

  const unitFee = data.unit_fee !== undefined ? data.unit_fee : booking?.unit_fee;
  const participants = data.participants ?? booking?.participants ?? 1;
  data.total_fee = unitFee === null || unitFee === undefined ? null : unitFee * participants;

  const status = data.status || booking?.status || "pending";
  const needsCheck =
    session &&
    SEAT_HOLDING.includes(status) &&
    (!booking || linksChanged || data.participants !== undefined || (data.status && !SEAT_HOLDING.includes(booking.status)));
  if (needsCheck) await checkSeats({ session, participants, excludeBookingId: booking?.id, transaction });

  if (data.amount_paid !== undefined && body.payment_status === undefined) {
    data.payment_status = paymentStatusFor(data.amount_paid, data.total_fee);
  }
};

// Bookings taken by phone, WhatsApp or at the office
exports.create = async (req, res) => {
  try {
    const data = cleanWith(FIELDS, req.body, { defaulted: DEFAULTED });
    if (req.body.course_id === undefined) throw new v.ValidationError("Choose a course");
    data.source = data.source || "admin";

    const booking = await sequelize.transaction(async (transaction) => {
      await applyLinks({ body: req.body, data, transaction });
      if (data.status === "confirmed") Object.assign(data, { confirmed_at: new Date(), handled_by: req.userId });
      return TrainingBooking.create({ ...data, reference: await makeReference(transaction) }, { transaction });
    });
    return res.status(201).json({ success: true, message: "Booking added", data: await findForAdmin(booking.id) });
  } catch (error) {
    return v.sendError(res, "adding booking", error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const booking = await TrainingBooking.findByPk(req.params.id);
    if (!booking) return notFound(res);

    const data = cleanWith(FIELDS, req.body, { partial: true, defaulted: DEFAULTED });
    if (!Object.keys(data).length && req.body.course_id === undefined && req.body.session_id === undefined) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    await sequelize.transaction(async (transaction) => {
      await applyLinks({ body: req.body, data, booking, transaction });
      if (data.status && data.status !== booking.status) {
        data.handled_by = req.userId;
        if (data.status === "confirmed" && !booking.confirmed_at) data.confirmed_at = new Date();
      }
      await booking.update(data, { transaction });
    });
    return res.status(200).json({ success: true, message: "Booking updated", data: await findForAdmin(booking.id) });
  } catch (error) {
    return v.sendError(res, "updating booking", error);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const removed = await TrainingBooking.destroy({ where: { id: req.params.id } });
    if (!removed) return notFound(res);
    return res.status(200).json({ success: true, message: "Booking deleted" });
  } catch (error) {
    return v.sendError(res, "deleting booking", error);
  }
};