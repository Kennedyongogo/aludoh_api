const {
  User,
  Client,
  Service,
  ServiceRequest,
  Project,
  TrainingCourse,
  TrainingSession,
  TrainingRegistration,
  Certificate,
  Article,
  ContactMessage,
  Testimonial,
} = require("../models");

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalClients,
      totalServices,
      totalProjects,
      totalCourses,
      totalSessions,
      totalRegistrations,
      totalCertificates,
      totalArticles,
      unreadMessages,
      newRequests,
      approvedTestimonials,
    ] = await Promise.all([
      User.count(),
      Client.count(),
      Service.count({ where: { status: "active" } }),
      Project.count(),
      TrainingCourse.count({ where: { status: "active" } }),
      TrainingSession.count(),
      TrainingRegistration.count(),
      Certificate.count({ where: { status: "issued" } }),
      Article.count({ where: { status: "published" } }),
      ContactMessage.count({ where: { status: "unread" } }),
      ServiceRequest.count({ where: { status: "new" } }),
      Testimonial.count({ where: { status: "approved" } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalClients,
          totalServices,
          totalProjects,
          totalCourses,
          totalSessions,
          totalRegistrations,
          totalCertificates,
          totalArticles,
          unreadMessages,
          newRequests,
          approvedTestimonials,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};
