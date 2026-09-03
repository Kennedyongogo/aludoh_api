const { ProjectImage, Project } = require("../models");
const { uploadedPath } = require("../utils/filePath");

exports.list = async (req, res) => {
  try {
    const { project_id } = req.query;
    const where = {};
    if (project_id) where.project_id = project_id;

    const rows = await ProjectImage.findAll({
      where,
      include: [{ model: Project, as: "project" }],
      order: [
        ["sort_order", "ASC"],
        ["createdAt", "DESC"],
      ],
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("projectImage list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list project images" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await ProjectImage.findByPk(req.params.id, {
      include: [{ model: Project, as: "project" }],
    });
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Project image not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("projectImage get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch project image" });
  }
};

exports.create = async (req, res) => {
  try {
    const { project_id, image_url, caption, sort_order } = req.body;
    const resolvedUrl = uploadedPath(req.file) || image_url;
    if (!project_id || !resolvedUrl)
      return res.status(400).json({
        success: false,
        message: "project_id and image_url are required",
      });

    const row = await ProjectImage.create({
      project_id,
      image_url: resolvedUrl,
      caption: caption || null,
      sort_order: sort_order || 0,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("projectImage create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create project image" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await ProjectImage.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Project image not found" });

    const allowed = ["project_id", "image_url", "caption", "sort_order"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.file) updates.image_url = uploadedPath(req.file);

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("projectImage update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update project image" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await ProjectImage.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Project image not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("projectImage delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete project image" });
  }
};
