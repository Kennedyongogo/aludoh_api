const {
  Certificate,
  TrainingRegistration,
  TrainingSession,
  TrainingCourse,
  Client,
} = require("../models");

const certificateInclude = [
  {
    model: TrainingRegistration,
    as: "registration",
    include: [
      { model: Client, as: "client" },
      {
        model: TrainingSession,
        as: "session",
        include: [{ model: TrainingCourse, as: "course" }],
      },
    ],
  },
];

const nextCertificateNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Certificate.count();
  return `MCALUDOH-${year}-${String(count + 1).padStart(5, "0")}`;
};

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};
    if (status) where.status = status;

    const { count, rows } = await Certificate.findAndCountAll({
      where,
      include: certificateInclude,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
      order: [[sortBy, sortOrder]],
      distinct: true,
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    console.error("certificate list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list certificates" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await Certificate.findByPk(req.params.id, {
      include: certificateInclude,
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("certificate get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch certificate" });
  }
};

exports.verify = async (req, res) => {
  try {
    const row = await Certificate.findOne({
      where: { certificate_number: req.params.certificate_number },
      include: certificateInclude,
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("certificate verify error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to verify certificate" });
  }
};

exports.create = async (req, res) => {
  try {
    const { registration_id, certificate_number, issued_at, status } = req.body;
    if (!registration_id)
      return res
        .status(400)
        .json({ success: false, message: "registration_id is required" });

    const row = await Certificate.create({
      registration_id,
      certificate_number: certificate_number || (await nextCertificateNumber()),
      issued_at: issued_at || new Date(),
      status: status || "issued",
    });

    const created = await Certificate.findByPk(row.id, {
      include: certificateInclude,
    });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("certificate create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create certificate" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Certificate.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });

    const allowed = [
      "registration_id",
      "certificate_number",
      "issued_at",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await row.update(updates);
    const updated = await Certificate.findByPk(row.id, {
      include: certificateInclude,
    });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("certificate update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update certificate" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Certificate.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("certificate delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete certificate" });
  }
};
