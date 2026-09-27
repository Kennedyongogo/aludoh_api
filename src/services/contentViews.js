// Shapes shared by the public endpoints so a service, project or testimonial looks the same
// wherever it appears (its own page, a card on another page, the home page).
const { Service, Project } = require("../models");

const SERVICE_BRIEF_ATTRIBUTES = ["id", "name", "slug", "short_name", "icon"];

const PROJECT_CARD_ATTRIBUTES = [
  "id",
  "name",
  "slug",
  "service_id",
  "client",
  "location",
  "county",
  "year",
  "status",
  "size",
  "duration",
  "summary",
  "results",
  "cover_image",
  "before_image",
  "after_image",
  "is_featured",
];

const TESTIMONIAL_PUBLIC_ATTRIBUTES = [
  "id",
  "client_name",
  "organization",
  "role",
  "rating",
  "content",
  "photo",
  "is_featured",
  "service_id",
  "project_id",
  "reviewed_at",
  "createdAt",
];

// Deleted or draft services are left out rather than failing the whole row
const serviceBriefInclude = (options = {}) => ({
  model: Service,
  as: "service",
  attributes: SERVICE_BRIEF_ATTRIBUTES,
  where: { status: "active" },
  required: false,
  ...options,
});

const testimonialPublicIncludes = () => [
  serviceBriefInclude(),
  {
    model: Project,
    as: "project",
    attributes: ["id", "name", "slug", "client"],
    where: { is_published: true },
    required: false,
  },
];

// `service` is the display name because the testimonials page prints it next to the organisation
const toPublicTestimonial = (row) => {
  const item = row.get ? row.get({ plain: true }) : row;
  return {
    id: item.id,
    client_name: item.client_name,
    organization: item.organization || item.project?.client || null,
    role: item.role,
    rating: item.rating,
    content: item.content,
    photo: item.photo,
    is_featured: item.is_featured,
    service: item.service?.name || null,
    service_slug: item.service?.slug || null,
    project: item.project ? { name: item.project.name, slug: item.project.slug } : null,
    date: item.reviewed_at || item.createdAt,
  };
};

module.exports = {
  SERVICE_BRIEF_ATTRIBUTES,
  PROJECT_CARD_ATTRIBUTES,
  TESTIMONIAL_PUBLIC_ATTRIBUTES,
  serviceBriefInclude,
  testimonialPublicIncludes,
  toPublicTestimonial,
};
