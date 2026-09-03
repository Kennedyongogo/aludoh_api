const { SiteSetting } = require("../models");
const { uploadedPath } = require("../utils/filePath");

exports.list = async (req, res) => {
  try {
    const rows = await SiteSetting.findAll({
      order: [["createdAt", "DESC"]],
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("siteSetting list error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list site settings" });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await SiteSetting.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Site setting not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("siteSetting get error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch site setting" });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      company_name,
      phone,
      email,
      address,
      whatsapp,
      facebook,
      instagram,
      twitter,
      youtube,
      logo,
      footer_text,
      maps_latitude,
      maps_longitude,
    } = req.body;
    if (!company_name)
      return res
        .status(400)
        .json({ success: false, message: "company_name is required" });

    const row = await SiteSetting.create({
      company_name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      whatsapp: whatsapp || null,
      facebook: facebook || null,
      instagram: instagram || null,
      twitter: twitter || null,
      youtube: youtube || null,
      logo: uploadedPath(req.file) || logo || null,
      footer_text: footer_text || null,
      maps_latitude: maps_latitude || null,
      maps_longitude: maps_longitude || null,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error("siteSetting create error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create site setting" });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await SiteSetting.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Site setting not found" });

    const allowed = [
      "company_name",
      "phone",
      "email",
      "address",
      "whatsapp",
      "facebook",
      "instagram",
      "twitter",
      "youtube",
      "logo",
      "footer_text",
      "maps_latitude",
      "maps_longitude",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.file) updates.logo = uploadedPath(req.file);

    await row.update(updates);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("siteSetting update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update site setting" });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await SiteSetting.findByPk(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Site setting not found" });
    await row.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("siteSetting delete error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete site setting" });
  }
};
