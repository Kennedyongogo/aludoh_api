// Input cleaning shared by the content controllers (services, projects, testimonials).
// Every cleaner returns null for "not provided" and throws ValidationError with a message
// that can be shown to the admin or visitor as-is.
const { validatePhoneNumber } = require("./phone");

class ValidationError extends Error {}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isBlank = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && !value.trim()) ||
  (Array.isArray(value) && !value.length);

const text = (value, label, { max, required = false } = {}) => {
  if (isBlank(value)) {
    if (required) throw new ValidationError(`${label} is required`);
    return null;
  }
  if (typeof value === "object") throw new ValidationError(`${label} must be text`);
  const out = String(value).trim();
  if (max && out.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer`);
  }
  return out;
};

const integer = (value, label, { min, max, required = false } = {}) => {
  if (isBlank(value)) {
    if (required) throw new ValidationError(`${label} is required`);
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number)) throw new ValidationError(`${label} must be a whole number`);
  if (min !== undefined && number < min) throw new ValidationError(`${label} must be at least ${min}`);
  if (max !== undefined && number > max) throw new ValidationError(`${label} must be at most ${max}`);
  return number;
};

// Multipart forms send booleans as strings
const boolean = (value) => {
  if (isBlank(value)) return null;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
};

const oneOf = (value, label, options, { required = false } = {}) => {
  if (isBlank(value)) {
    if (required) throw new ValidationError(`${label} is required`);
    return null;
  }
  const out = String(value).trim();
  if (!options.includes(out)) {
    throw new ValidationError(`${label} must be one of: ${options.join(", ")}`);
  }
  return out;
};

const uuid = (value, label) => {
  if (isBlank(value)) return null;
  if (!UUID_REGEX.test(String(value))) throw new ValidationError(`${label} is not valid`);
  return String(value);
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = (value, label = "Email", { required = false } = {}) => {
  const out = text(value, label, { max: 160, required });
  if (!out) return null;
  if (!EMAIL_REGEX.test(out)) throw new ValidationError("Please enter a valid email address");
  return out.toLowerCase();
};

const phone = (value, label = "Phone number", { required = false } = {}) => {
  if (isBlank(value)) {
    if (required) throw new ValidationError(`${label} is required`);
    return null;
  }
  const result = validatePhoneNumber(value);
  if (!result.valid) throw new ValidationError(result.message);
  return result.normalized;
};

// Calendar date as "YYYY-MM-DD" (what <input type="date"> sends)
const dateOnly = (value, label, { required = false } = {}) => {
  if (isBlank(value)) {
    if (required) throw new ValidationError(`${label} is required`);
    return null;
  }
  const out = String(value).trim().slice(0, 10);
  const parsed = new Date(`${out}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== out) {
    throw new ValidationError(`${label} must be a valid date`);
  }
  return out;
};

const dateTime = (value, label, { required = false } = {}) => {
  if (isBlank(value)) {
    if (required) throw new ValidationError(`${label} is required`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`${label} must be a valid date`);
  return parsed;
};

// Today in Kenya as "YYYY-MM-DD", for comparing with date-only columns
const todayInNairobi = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Uploaded files are stored as "/uploads/..." and seeded photos as full URLs; nothing else
// is accepted so a stored value can never become a javascript: or data: link.
const imagePath = (value, label) => {
  const out = text(value, label, { max: 500 });
  if (!out) return null;
  if (!/^(https?:\/\/|\/)/i.test(out) || out.startsWith("//")) {
    throw new ValidationError(`${label} must be an uploaded image or a web address`);
  }
  return out;
};

// Lists may arrive as arrays (JSON body) or as JSON strings (multipart forms)
const toArray = (value, label) => {
  if (isBlank(value)) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to the error below
    }
  }
  throw new ValidationError(`${label} must be a list`);
};

// Plain text lists also accept one item per line, which is handy for textareas
const stringList = (value, label, { maxItems = 30, maxLength = 200 } = {}) => {
  const items =
    typeof value === "string" && !value.trim().startsWith("[")
      ? value.split(/\r?\n/)
      : toArray(value, label);
  const cleaned = items
    .map((item, i) => text(item, `${label} item ${i + 1}`, { max: maxLength }))
    .filter(Boolean);
  if (cleaned.length > maxItems) {
    throw new ValidationError(`${label} can have at most ${maxItems} items`);
  }
  return cleaned;
};

// shape maps each key to a cleaner: (value, label) => cleanedValue
const objectList = (value, label, shape, { maxItems = 20 } = {}) => {
  const items = toArray(value, label).filter(
    (item) => !(item && typeof item === "object" && Object.values(item).every(isBlank))
  );
  if (items.length > maxItems) {
    throw new ValidationError(`${label} can have at most ${maxItems} items`);
  }
  return items.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationError(`${label} item ${i + 1} is not valid`);
    }
    return Object.fromEntries(
      Object.entries(shape).map(([key, clean]) => [key, clean(item[key], `${label} ${i + 1} ${key}`)])
    );
  });
};

const requiredImage = (value, label) => {
  const path = imagePath(value, label);
  if (!path) throw new ValidationError(`${label} is required`);
  return path;
};

const PHOTO_SHAPE = {
  url: requiredImage,
  caption: (value, label) => text(value, label, { max: 200 }),
};

// Photos may be sent as plain URLs or as { url, caption }
const photoList = (value, label = "Photo", { maxItems = 24 } = {}) => {
  let items = value;
  if (typeof items === "string" && items.trim().startsWith("[")) {
    try {
      items = JSON.parse(items);
    } catch {
      // objectList reports the bad value
    }
  }
  if (Array.isArray(items)) {
    items = items.map((item) => (typeof item === "string" ? { url: item } : item));
  }
  return objectList(items, label, PHOTO_SHAPE, { maxItems });
};

const pagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
};

const paginationMeta = (total, { page, limit }) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});

const sendError = (res, action, error) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    const field = error.errors?.[0]?.path || "value";
    return res.status(409).json({
      success: false,
      message: `Another record already uses this ${field.replace(/_/g, " ")}`,
    });
  }
  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({ success: false, message: error.errors?.[0]?.message || "Invalid data" });
  }
  console.error(`Error ${action}:`, error);
  return res.status(500).json({ success: false, message: `Error ${action}`, error: error.message });
};

module.exports = {
  ValidationError,
  UUID_REGEX,
  isBlank,
  text,
  integer,
  boolean,
  oneOf,
  uuid,
  email,
  phone,
  dateOnly,
  dateTime,
  todayInNairobi,
  imagePath,
  stringList,
  objectList,
  photoList,
  pagination,
  paginationMeta,
  sendError,
};
