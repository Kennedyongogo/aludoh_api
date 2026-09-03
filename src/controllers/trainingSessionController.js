const { TrainingSession, TrainingCourse, TrainingRegistration } = require("../models");

const sessionInclude = [
  { model: TrainingCourse, as: "course" },
  { model: TrainingRegistration, as: "registrations" },
];

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      course_id,
      sortBy = "start_date",
      sortOrder = "ASC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (course_id) where.course_id = course_id;

    const { count, rows } = await TrainingSession.findAndCountAll({
      where,
      include: sessionInclude,
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
    console.error("trainingSession list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list training sessions" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await TrainingSession.findByPk(req.params.id, {
      include: sessionInclude,
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Training session not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("trainingSession get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch training session" });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      course_id,
      start_date,
      end_date,
      location,
      capacity,
      fee,
      status,
    } = req.body;
    if (!course_id || !start_date || !end_date)
      return res.status(400).json({
        success: false,
        message: "course_id, start_date, and end_date are required",
      });

    const row = await TrainingSession.create({
      course_id,
      start_date,
      end_date,
      location: location || null,
      capacity: capacity || null,
      fee: fee || null,
      status: status || "upcoming",
    });

    const created = await TrainingSession.findByPk(row.id, {
      include: sessionInclude,
    });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("trainingSession create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create training session" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await TrainingSession.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Training session not found" });

    const allowed = [
      "course_id",
      "start_date",
      "end_date",
      "location",
      "capacity",
      "fee",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await row.update(updates);
    const updated = await TrainingSession.findByPk(row.id, {
      include: sessionInclude,
    });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("trainingSession update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update training session" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await TrainingSession.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Training session not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("trainingSession delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete training session" });
  }
};
