const { GalleryAlbum, User } = require("../models");
const v = require("../utils/validation");
const { resolveSlug, nextSortOrder, reorder, cleanWith, searchWhere } = require("../utils/content");

const MAX_PHOTOS = 60;
const ORDER = [
  ["sort_order", "ASC"],
  ["name", "ASC"],
];

const FIELDS = {
  name: (x) => v.text(x, "Album name", { max: 120, required: true }),
  description: (x) => v.text(x, "Description", { max: 500 }),
  cover_image: (x) => v.imagePath(x, "Cover image"),
  photos: (x) => v.photoList(x, "Photo", { maxItems: MAX_PHOTOS }),
  is_published: (x) => v.boolean(x),
  sort_order: (x) => v.integer(x, "Sort order", { min: 0, max: 100000 }),
};
const DEFAULTED = ["is_published", "sort_order"];

// The public gallery reads albums as { name, slug, media: [{ id, file_url, caption, alt_text }] }
const toPublicAlbum = (row) => {
  const album = row.get({ plain: true });
  const photos = album.photos || [];
  return {
    id: album.id,
    name: album.name,
    slug: album.slug,
    description: album.description,
    cover_image: album.cover_image || photos[0]?.url || null,
    media: photos.map((photo, index) => ({
      id: `${album.id}-${index}`,
      file_url: photo.url,
      caption: photo.caption,
      alt_text: photo.caption || album.name,
    })),
  };
};

const findForAdmin = (id) =>
  GalleryAlbum.findByPk(id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "name"] },
      { model: User, as: "updater", attributes: ["id", "name"] },
    ],
  });

const notFound = (res) => res.status(404).json({ success: false, message: "Album not found" });

/* ----------------------------- Public ----------------------------- */

exports.list = async (req, res) => {
  try {
    const rows = await GalleryAlbum.findAll({ where: { is_published: true }, order: ORDER });
    const albums = rows.map(toPublicAlbum).filter((album) => album.media.length);
    return res.status(200).json({
      success: true,
      data: albums,
      summary: { albums: albums.length, photos: albums.reduce((sum, a) => sum + a.media.length, 0) },
    });
  } catch (error) {
    return v.sendError(res, "fetching gallery", error);
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const row = await GalleryAlbum.findOne({
      where: { slug: String(req.params.slug).toLowerCase(), is_published: true },
    });
    if (!row) return notFound(res);
    return res.status(200).json({ success: true, data: toPublicAlbum(row) });
  } catch (error) {
    return v.sendError(res, "fetching album", error);
  }
};

/* ------------------------------ Admin ------------------------------ */

// Query: search, published=true|false, page, limit
exports.adminList = async (req, res) => {
  try {
    const { search, published } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const where = {};
    if (published === "true" || published === "false") where.is_published = published === "true";
    if (search) Object.assign(where, searchWhere(["name", "slug", "description"], search));

    const [{ count, rows }, all] = await Promise.all([
      GalleryAlbum.findAndCountAll({ where, order: ORDER, limit: paging.limit, offset: paging.offset }),
      GalleryAlbum.findAll({ attributes: ["is_published", "photos"], raw: true }),
    ]);

    const publishedCount = all.filter((a) => a.is_published).length;
    return res.status(200).json({
      success: true,
      data: rows,
      summary: {
        total: all.length,
        published: publishedCount,
        hidden: all.length - publishedCount,
        photos: all.reduce((sum, a) => sum + (a.photos?.length || 0), 0),
      },
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching albums", error);
  }
};

exports.adminGet = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const album = await findForAdmin(req.params.id);
    if (!album) return notFound(res);
    return res.status(200).json({ success: true, data: album });
  } catch (error) {
    return v.sendError(res, "fetching album", error);
  }
};

exports.create = async (req, res) => {
  try {
    const data = cleanWith(FIELDS, req.body, { defaulted: DEFAULTED });
    data.slug = await resolveSlug(GalleryAlbum, { slug: v.text(req.body.slug, "Slug", { max: 160 }), name: data.name });
    if (data.sort_order === undefined) data.sort_order = await nextSortOrder(GalleryAlbum);
    data.created_by = req.userId;
    data.updated_by = req.userId;

    const album = await GalleryAlbum.create(data);
    return res.status(201).json({ success: true, message: "Album created", data: await findForAdmin(album.id) });
  } catch (error) {
    return v.sendError(res, "creating album", error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const album = await GalleryAlbum.findByPk(req.params.id);
    if (!album) return notFound(res);

    const data = cleanWith(FIELDS, req.body, { partial: true, defaulted: DEFAULTED });
    const slug = v.text(req.body.slug, "Slug", { max: 160 });
    if (slug && slug !== album.slug) data.slug = await resolveSlug(GalleryAlbum, { slug, excludeId: album.id });
    if (!Object.keys(data).length) return res.status(400).json({ success: false, message: "Nothing to update" });

    await album.update({ ...data, updated_by: req.userId });
    return res.status(200).json({ success: true, message: "Album updated", data: await findForAdmin(album.id) });
  } catch (error) {
    return v.sendError(res, "updating album", error);
  }
};

exports.reorder = async (req, res) => {
  try {
    await reorder(GalleryAlbum, req.body.ids);
    return res.status(200).json({ success: true, message: "Order saved" });
  } catch (error) {
    return v.sendError(res, "reordering albums", error);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const album = await GalleryAlbum.findByPk(req.params.id);
    if (!album) return notFound(res);
    await album.update({ updated_by: req.userId });
    await album.destroy();
    return res.status(200).json({ success: true, message: "Album deleted" });
  } catch (error) {
    return v.sendError(res, "deleting album", error);
  }
};
