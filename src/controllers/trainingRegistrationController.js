const {
  TrainingRegistration,
  TrainingSession,
  TrainingCourse,
  Client,
  Certificate,
} = require("../models");
const { findOrCreateClient } = require("../services/clientService");

const registrationInclude = [
  { model: Client, as: "client" },
  {
    model: TrainingSession,
    as: "session",
    include: [{ model: TrainingCourse, as: "course" }],
  },
  { model: Certificate, as: "certificate" },
];

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      session_id,
      client_id,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (session_id) where.session_id = session_id;
    if (client_id) where.client_id = client_id;

    const { count, rows } = await TrainingRegistration.findAndCountAll({
      where,
      include: registrationInclude,
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
    console.error("trainingRegistration list error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to list training registrations",
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await TrainingRegistration.findByPk(req.params.id, {
      include: registrationInclude,
    });
    if (!row)
      return res.status(404).json({
        success: false,
        message: "Training registration not found",
      });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("trainingRegistration get error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch training registration",
    });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      session_id,
      client_id,
      status,
      name,
      phone,
      email,
      organization,
      location,
    } = req.body;

    if (!session_id)
      return res
        .status(400)
        .json({ success: false, message: "session_id is required" });

    let resolvedClientId = client_id;
    if (!resolvedClientId) {
      if (!name || !phone)
        return res.status(400).json({
          success: false,
          message: "client_id or name and phone are required",
        });

      const client = await findOrCreateClient({
        name,
        phone,
        email,
        organization,
        location,
      });
      resolvedClientId = client.id;
    }

    const existing = await TrainingRegistration.findOne({
      where: { session_id, client_id: resolvedClientId },
    });
    if (existing)
      return res.status(400).json({
        success: false,
        message: "This client is already registered for the session",
      });

    const row = await TrainingRegistration.create({
      session_id,
      client_id: resolvedClientId,
      status: status || "pending",
    });

    const created = await TrainingRegistration.findByPk(row.id, {
      include: registrationInclude,
    });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("trainingRegistration create error:", err);
    if (err.status === 400)
      return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({
      success: false,
      message: "Failed to create training registration",
    });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await TrainingRegistration.findByPk(req.params.id);
    if (!row)
      return res.status(404).json({
        success: false,
        message: "Training registration not found",
      });

    const allowed = ["session_id", "client_id", "status"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await row.update(updates);
    const updated = await TrainingRegistration.findByPk(row.id, {
      include: registrationInclude,
    });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("trainingRegistration update error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update training registration",
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await TrainingRegistration.findByPk(req.params.id);
    if (!row)
      return res.status(404).json({
        success: false,
        message: "Training registration not found",
      });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("trainingRegistration delete error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete training registration",
    });
  }
};
