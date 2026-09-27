const crypto = require("crypto");
const { Op } = require("sequelize");
const { ServiceRequest, User, sequelize } = require("../models");
const { validatePhoneNumber } = require("../utils/phone");
const { EMPTY_GEO, geocodeRequest, queueGeocode } = require("../services/geocoder");

const { STATUSES, PRIORITIES } = ServiceRequest;

const STATUS_LABELS = {
  pending: "Received",
  reviewing: "Under review",
  in_progress: "In progress",
  scheduled: "Visit scheduled",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

const FIELD_LIMITS = {
  service: 150,
  name: 120,
  email: 160,
  location: 160,
  organization: 160,
  farm_size: 80,
  crop: 120,
  farming_method: 160,
  service_required: 200,
  message: 5000,
  admin_response: 5000,
  admin_notes: 5000,
};

const OPTIONAL_FIELDS = [
  "location",
  "organization",
  "farm_size",
  "crop",
  "farming_method",
  "service_required",
  "message",
];

const SORTABLE_FIELDS = [
  "createdAt",
  "updatedAt",
  "status",
  "priority",
  "name",
  "reference",
  "responded_at",
];

const HANDLER_INCLUDE = {
  model: User,
  as: "handler",
  attributes: ["id", "name", "email"],
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// No 0/O or 1/I so references are easy to read out over the phone
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

class ValidationError extends Error {}

const cleanText = (value, field) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (FIELD_LIMITS[field] && text.length > FIELD_LIMITS[field]) {
    throw new ValidationError(
      `${field.replace(/_/g, " ")} must be ${FIELD_LIMITS[field]} characters or fewer`
    );
  }
  return text;
};

const requireText = (value, field, message) => {
  const text = cleanText(value, field);
  if (!text) throw new ValidationError(message);
  return text;
};

const cleanEmail = (value) => {
  const email = cleanText(value, "email");
  if (!email) return null;
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError("Please enter a valid email address");
  }
  return email.toLowerCase();
};

const cleanPhone = (value) => {
  const result = validatePhoneNumber(value);
  if (!result.valid) throw new ValidationError(result.message);
  return result.normalized;
};

const generateReference = () => {
  const code = Array.from(
    crypto.randomBytes(6),
    (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]
  ).join("");
  const year = String(new Date().getFullYear()).slice(-2);
  return `MC-${year}-${code}`;
};

const createWithUniqueReference = async (data) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await ServiceRequest.create({ ...data, reference: generateReference() });
    } catch (error) {
      const isReferenceClash =
        error.name === "SequelizeUniqueConstraintError" &&
        error.errors?.some((e) => e.path === "reference");
      if (!isReferenceClash) throw error;
    }
  }
  throw new Error("Could not generate a unique reference");
};

const withLabel = (status) => ({ status, status_label: STATUS_LABELS[status] });

// Only what the client is allowed to see: no internal notes or contact details
const toPublicView = (request) => ({
  reference: request.reference,
  service: request.service,
  ...withLabel(request.status),
  admin_response: request.admin_response,
  submitted_at: request.createdAt,
  updated_at: request.updatedAt,
  responded_at: request.responded_at,
  resolved_at: request.resolved_at,
});

const findDetailed = (id) =>
  ServiceRequest.findByPk(id, { include: [HANDLER_INCLUDE] });

const sendServerError = (res, action, error) => {
  console.error(`Error ${action}:`, error);
  return res.status(500).json({
    success: false,
    message: `Error ${action}`,
    error: error.message,
  });
};

const sendValidationOrServerError = (res, action, error) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return sendServerError(res, action, error);
};

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Service request not found" });

// Public: submit a new request (no token required)
exports.create = async (req, res) => {
  try {
    const data = {
      service: requireText(req.body.service, "service", "Please choose a service"),
      name: requireText(req.body.name, "name", "Name is required"),
      phone: cleanPhone(req.body.phone),
      email: cleanEmail(req.body.email),
      status: "pending",
    };
    OPTIONAL_FIELDS.forEach((field) => {
      data[field] = cleanText(req.body[field], field);
    });
    if (data.location) data.geo_status = "pending";

    const request = await createWithUniqueReference(data);
    // Runs after the response so the client never waits on the map lookup
    if (data.location) queueGeocode(request.id);

    return res.status(201).json({
      success: true,
      message: "Service request submitted successfully",
      data: toPublicView(request),
    });
  } catch (error) {
    return sendValidationOrServerError(res, "submitting service request", error);
  }
};

// Public: check progress using the reference plus the phone or email used on the request
exports.track = async (req, res) => {
  try {
    const reference = String(req.params.reference || "").trim().toUpperCase();
    const contact = String(req.query.contact || "").trim();

    if (!reference || !contact) {
      return res.status(400).json({
        success: false,
        message: "Reference and the phone number or email you used are required",
      });
    }

    const request = await ServiceRequest.findOne({ where: { reference } });

    const matches =
      request &&
      (contact.includes("@")
        ? Boolean(request.email) && request.email === contact.toLowerCase()
        : validatePhoneNumber(contact).normalized === request.phone);

    if (!matches) {
      return res.status(404).json({
        success: false,
        message:
          "We couldn't find a request with that reference and phone number or email",
      });
    }

    return res.status(200).json({ success: true, data: toPublicView(request) });
  } catch (error) {
    return sendServerError(res, "tracking service request", error);
  }
};

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      priority,
      handled_by,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    const orderField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : "createdAt";
    const orderDir = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";
    const whereClause = {};

    if (status && STATUSES.includes(status)) whereClause.status = status;
    if (priority && PRIORITIES.includes(priority)) whereClause.priority = priority;
    if (handled_by === "me") whereClause.handled_by = req.userId;
    else if (handled_by === "unassigned") whereClause.handled_by = null;
    else if (handled_by && UUID_REGEX.test(handled_by)) {
      whereClause.handled_by = handled_by;
    }

    if (search) {
      const term = `%${String(search).trim()}%`;
      whereClause[Op.or] = [
        "reference",
        "name",
        "phone",
        "email",
        "service",
        "location",
        "organization",
      ].map((field) => ({ [field]: { [Op.iLike]: term } }));
    }

    const [{ count, rows }, statusCounts] = await Promise.all([
      ServiceRequest.findAndCountAll({
        where: whereClause,
        include: [HANDLER_INCLUDE],
        limit: limitNum,
        offset,
        order: [[orderField, orderDir]],
      }),
      ServiceRequest.findAll({
        attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),
    ]);

    const summary = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    statusCounts.forEach((row) => {
      summary[row.status] = Number(row.count);
    });
    summary.total = Object.values(summary).reduce((sum, n) => sum + n, 0);

    return res.status(200).json({
      success: true,
      data: rows,
      summary,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    return sendServerError(res, "fetching service requests", error);
  }
};

exports.getById = async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) return notFound(res);
    const request = await findDetailed(req.params.id);
    if (!request) return notFound(res);
    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    return sendServerError(res, "fetching service request", error);
  }
};

// Admin: change status, reply to the client, keep notes, set priority/handler or fix details
exports.update = async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) return notFound(res);
    const request = await ServiceRequest.findByPk(req.params.id);
    if (!request) return notFound(res);

    const body = req.body;
    const changes = {};

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        throw new ValidationError(`Status must be one of: ${STATUSES.join(", ")}`);
      }
      if (body.status !== request.status) {
        changes.status = body.status;
        changes.resolved_at = body.status === "resolved" ? new Date() : null;
      }
    }

    if (body.admin_response !== undefined) {
      const response = cleanText(body.admin_response, "admin_response");
      if (response !== request.admin_response) {
        changes.admin_response = response;
        changes.responded_at = response ? new Date() : null;
      }
    }

    if (body.admin_notes !== undefined) {
      changes.admin_notes = cleanText(body.admin_notes, "admin_notes");
    }

    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority)) {
        throw new ValidationError(`Priority must be one of: ${PRIORITIES.join(", ")}`);
      }
      changes.priority = body.priority;
    }

    if (body.handled_by !== undefined) {
      if (body.handled_by === null || body.handled_by === "") {
        changes.handled_by = null;
      } else {
        const handler = UUID_REGEX.test(body.handled_by)
          ? await User.findByPk(body.handled_by, { attributes: ["id"] })
          : null;
        if (!handler) throw new ValidationError("Selected admin not found");
        changes.handled_by = handler.id;
      }
    } else if (
      !request.handled_by &&
      (changes.status !== undefined || changes.admin_response !== undefined)
    ) {
      // Whoever first acts on an unassigned request takes ownership of it
      changes.handled_by = req.userId;
    }

    if (body.service !== undefined) {
      changes.service = requireText(body.service, "service", "Service cannot be empty");
    }
    if (body.name !== undefined) {
      changes.name = requireText(body.name, "name", "Name cannot be empty");
    }
    if (body.phone !== undefined) changes.phone = cleanPhone(body.phone);
    if (body.email !== undefined) changes.email = cleanEmail(body.email);
    OPTIONAL_FIELDS.forEach((field) => {
      if (body[field] !== undefined) changes[field] = cleanText(body[field], field);
    });

    if (!Object.keys(changes).length) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    const locationChanged =
      changes.location !== undefined && changes.location !== request.location;
    if (locationChanged) {
      Object.assign(changes, EMPTY_GEO, { geo_status: changes.location ? "pending" : null });
    }

    await request.update(changes);
    if (locationChanged && changes.location) queueGeocode(request.id);

    return res.status(200).json({
      success: true,
      message: "Service request updated successfully",
      data: await findDetailed(request.id),
    });
  } catch (error) {
    return sendValidationOrServerError(res, "updating service request", error);
  }
};

// Admin: every request with a location, plus where it was estimated to be, for the map
exports.locations = async (req, res) => {
  try {
    const rows = await ServiceRequest.findAll({
      attributes: [
        "id",
        "reference",
        "name",
        "service",
        "status",
        "priority",
        "location",
        "geo_status",
        "geo_place",
        "geo_county",
        "geo_lat",
        "geo_lng",
        "geo_radius_m",
        "geo_candidates",
        "createdAt",
      ],
      where: { location: { [Op.ne]: null } },
      order: [["createdAt", "DESC"]],
      limit: 2000,
    });

    // Rows added outside the public form (imports, seeds) have never been looked up
    const unlooked = rows.filter((row) => !row.geo_status);
    if (unlooked.length) {
      await ServiceRequest.update(
        { geo_status: "pending" },
        { where: { id: unlooked.map((row) => row.id), geo_status: null }, silent: true }
      );
      unlooked.forEach((row) => {
        row.geo_status = "pending";
        queueGeocode(row.id);
      });
    }

    const summary = { total: rows.length, found: 0, approximate: 0, not_found: 0, pending: 0, failed: 0 };
    rows.forEach((row) => {
      summary[row.geo_status || "pending"] += 1;
    });

    return res.status(200).json({ success: true, data: rows, summary });
  } catch (error) {
    return sendServerError(res, "fetching request locations", error);
  }
};

// Admin: look the location up again, optionally searching a different place name
exports.geocode = async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) return notFound(res);
    const query = cleanText(req.body?.query, "location");
    const request = await geocodeRequest(req.params.id, { query, fresh: true });
    if (!request) return notFound(res);

    return res.status(200).json({ success: true, data: await findDetailed(request.id) });
  } catch (error) {
    return sendValidationOrServerError(res, "looking up request location", error);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) return notFound(res);
    const request = await ServiceRequest.findByPk(req.params.id);
    if (!request) return notFound(res);

    await request.destroy();

    return res.status(200).json({
      success: true,
      message: "Service request deleted successfully",
    });
  } catch (error) {
    return sendServerError(res, "deleting service request", error);
  }
};
