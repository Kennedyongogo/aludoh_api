const { Media, Gallery, User } = require("../models");
const { uploadedPath } = require("../utils/filePath");

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      gallery_id,
      file_type,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    if (gallery_id) where.gallery_id = gallery_id;
    if (file_type) where.file_type = file_type;

    const { count, rows } = await Media.findAndCountAll({
      where,
      include: [
        { model: Gallery, as: "gallery" },
        { model: User, as: "uploader", attributes: { exclude: ["password"] } },
      ],
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
    console.error("media list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list media" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await Media.findByPk(req.params.id, {
      include: [
        { model: Gallery, as: "gallery" },
        { model: User, as: "uploader", attributes: { exclude: ["password"] } },
      ],
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("media get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch media" });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      gallery_id,
      uploaded_by,
      file_name,
      file_url,
      file_type,
      caption,
      alt_text,
    } = req.body;
    const resolvedUrl = uploadedPath(req.file) || file_url;
    const resolvedName = file_name || req.file?.originalname;
    if (!resolvedName || !resolvedUrl)
      return res.status(400).json({
        success: false,
        message: "file_name and file_url are required",
      });

    const row = await Media.create({
      gallery_id: gallery_id || null,
      uploaded_by: uploaded_by || req.userId || null,
      file_name: resolvedName,
      file_url: resolvedUrl,
      file_type: file_type || "image",
      caption: caption || null,
      alt_text: alt_text || null,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("media create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create media" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Media.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });

    const allowed = [
      "gallery_id",
      "uploaded_by",
      "file_name",
      "file_url",
      "file_type",
      "caption",
      "alt_text",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.file) {
      updates.file_url = uploadedPath(req.file);
      if (!updates.file_name) updates.file_name = req.file.originalname;
    }

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("media update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update media" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Media.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("media delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete media" });
  }
};
