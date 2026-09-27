const { Op } = require("sequelize");
const { Article, User, sequelize } = require("../models");
const v = require("../utils/validation");
const { resolveSlug, cleanWith, searchWhere } = require("../utils/content");

const { STATUSES } = Article;
const SEARCH_FIELDS = ["title", "slug", "category", "excerpt", "author_name"];
const RELATED_COUNT = 3;
const PUBLIC_ORDER = [
  ["published_at", "DESC"],
  ["createdAt", "DESC"],
];
const CARD_ATTRIBUTES = [
  "id",
  "slug",
  "title",
  "category",
  "excerpt",
  "featured_image",
  "author_name",
  "author_role",
  "is_featured",
  "published_at",
  "content",
];

const FIELDS = {
  title: (x) => v.text(x, "Title", { max: 200, required: true }),
  category: (x) => v.text(x, "Category", { max: 80 }),
  excerpt: (x) => v.text(x, "Summary", { max: 400 }),
  content: (x) => v.text(x, "Article text", { max: 100000 }),
  featured_image: (x) => v.imagePath(x, "Cover image"),
  author_name: (x) => v.text(x, "Author", { max: 120 }),
  author_role: (x) => v.text(x, "Author role", { max: 120 }),
  is_featured: (x) => v.boolean(x),
  status: (x) => v.oneOf(x, "Status", STATUSES),
  published_at: (x) => v.dateTime(x, "Publish date"),
  seo_title: (x) => v.text(x, "SEO title", { max: 70 }),
  seo_description: (x) => v.text(x, "SEO description", { max: 170 }),
};
const DEFAULTED = ["status", "is_featured"];

const livePublic = () => ({ status: "published", published_at: { [Op.lte]: new Date() } });

const readingMinutes = (text = "") => Math.max(1, Math.round(String(text).split(/\s+/).filter(Boolean).length / 200));

// Matches the public site's article shape: category and author are objects
const toPublicArticle = (row, { withContent = false } = {}) => {
  const a = row.get ? row.get({ plain: true }) : row;
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category ? { name: a.category } : null,
    excerpt: a.excerpt,
    featured_image: a.featured_image,
    published_at: a.published_at,
    author: a.author_name ? { name: a.author_name, role: a.author_role } : null,
    featured: a.is_featured,
    reading_minutes: readingMinutes(a.content),
    ...(withContent ? { content: a.content || "", seo_title: a.seo_title, seo_description: a.seo_description } : {}),
  };
};

// Publishing without a date means "now"
const stampPublishDate = (data, current) => {
  const status = data.status || current?.status;
  if (status === "published" && !data.published_at && !current?.published_at) data.published_at = new Date();
};

const findForAdmin = (id) =>
  Article.findByPk(id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "name"] },
      { model: User, as: "updater", attributes: ["id", "name"] },
    ],
  });

const categoryList = async (where) => {
  const rows = await Article.findAll({
    where: { ...where, category: { [Op.ne]: null } },
    attributes: ["category", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    group: ["category"],
    raw: true,
  });
  return rows
    .map((row) => ({ name: row.category, count: Number(row.count) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const notFound = (res) => res.status(404).json({ success: false, message: "Article not found" });

/* ----------------------------- Public ----------------------------- */

// Query: category, featured=true, search, page, limit
exports.list = async (req, res) => {
  try {
    const { category, featured, search } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 24, maxLimit: 100 });
    const where = livePublic();
    if (category) where.category = String(category).slice(0, 80);
    if (featured === "true") where.is_featured = true;
    if (search) Object.assign(where, searchWhere(["title", "excerpt", "category", "content"], search));

    const [{ count, rows }, categories] = await Promise.all([
      Article.findAndCountAll({
        where,
        attributes: CARD_ATTRIBUTES,
        order: PUBLIC_ORDER,
        limit: paging.limit,
        offset: paging.offset,
      }),
      categoryList(livePublic()),
    ]);

    return res.status(200).json({
      success: true,
      data: rows.map((row) => toPublicArticle(row)),
      categories,
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching articles", error);
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const row = await Article.findOne({ where: { ...livePublic(), slug: String(req.params.slug).toLowerCase() } });
    if (!row) return notFound(res);

    const others = await Article.findAll({
      where: { ...livePublic(), id: { [Op.ne]: row.id } },
      attributes: CARD_ATTRIBUTES,
      order: PUBLIC_ORDER,
      limit: 50,
    });
    const related = [
      ...others.filter((a) => row.category && a.category === row.category),
      ...others.filter((a) => !row.category || a.category !== row.category),
    ]
      .slice(0, RELATED_COUNT)
      .map((a) => toPublicArticle(a));

    return res.status(200).json({ success: true, data: { ...toPublicArticle(row, { withContent: true }), related } });
  } catch (error) {
    return v.sendError(res, "fetching article", error);
  }
};

/* ------------------------------ Admin ------------------------------ */

exports.options = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: { statuses: STATUSES, categories: (await categoryList({})).map((c) => c.name) },
    });
  } catch (error) {
    return v.sendError(res, "fetching article options", error);
  }
};

// Query: search, status=draft|published|scheduled, category, featured=true, page, limit
exports.adminList = async (req, res) => {
  try {
    const { search, status, category, featured } = req.query;
    const paging = v.pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const now = new Date();
    const where = {};
    if (status === "scheduled") Object.assign(where, { status: "published", published_at: { [Op.gt]: now } });
    else if (status === "published") Object.assign(where, livePublic());
    else if (status === "draft") where.status = "draft";
    if (category) where.category = String(category).slice(0, 80);
    if (featured === "true") where.is_featured = true;
    if (search) Object.assign(where, searchWhere(SEARCH_FIELDS, search));

    const [{ count, rows }, total, live, scheduled, drafts, featuredCount] = await Promise.all([
      Article.findAndCountAll({
        where,
        attributes: { exclude: ["content"] },
        order: [
          ["updatedAt", "DESC"],
          ["title", "ASC"],
        ],
        limit: paging.limit,
        offset: paging.offset,
      }),
      Article.count(),
      Article.count({ where: livePublic() }),
      Article.count({ where: { status: "published", published_at: { [Op.gt]: now } } }),
      Article.count({ where: { status: "draft" } }),
      Article.count({ where: { is_featured: true } }),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      summary: { total, published: live, scheduled, drafts, featured: featuredCount },
      pagination: v.paginationMeta(count, paging),
    });
  } catch (error) {
    return v.sendError(res, "fetching articles", error);
  }
};

exports.adminGet = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const article = await findForAdmin(req.params.id);
    if (!article) return notFound(res);
    return res.status(200).json({ success: true, data: article });
  } catch (error) {
    return v.sendError(res, "fetching article", error);
  }
};

exports.create = async (req, res) => {
  try {
    const data = cleanWith(FIELDS, req.body, { defaulted: DEFAULTED });
    data.slug = await resolveSlug(Article, { slug: v.text(req.body.slug, "Slug", { max: 160 }), name: data.title });
    stampPublishDate(data);
    data.created_by = req.userId;
    data.updated_by = req.userId;

    const article = await Article.create(data);
    return res.status(201).json({ success: true, message: "Article created", data: await findForAdmin(article.id) });
  } catch (error) {
    return v.sendError(res, "creating article", error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const article = await Article.findByPk(req.params.id);
    if (!article) return notFound(res);

    const data = cleanWith(FIELDS, req.body, { partial: true, defaulted: DEFAULTED });
    const slug = v.text(req.body.slug, "Slug", { max: 160 });
    if (slug && slug !== article.slug) data.slug = await resolveSlug(Article, { slug, excludeId: article.id });
    if (!Object.keys(data).length) return res.status(400).json({ success: false, message: "Nothing to update" });
    stampPublishDate(data, { status: article.status, published_at: data.published_at === null ? null : article.published_at });

    await article.update({ ...data, updated_by: req.userId });
    return res.status(200).json({ success: true, message: "Article updated", data: await findForAdmin(article.id) });
  } catch (error) {
    return v.sendError(res, "updating article", error);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!v.UUID_REGEX.test(req.params.id)) return notFound(res);
    const article = await Article.findByPk(req.params.id);
    if (!article) return notFound(res);
    await article.update({ updated_by: req.userId });
    await article.destroy();
    return res.status(200).json({ success: true, message: "Article deleted" });
  } catch (error) {
    return v.sendError(res, "deleting article", error);
  }
};
