const { User, Role } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const config = require("../config/config");
const { Op, Sequelize } = require("sequelize");
const userInclude = [{ model: Role, as: "role" }];

const sanitizeUser = (user) => {
  const data = user.toJSON ? user.toJSON() : user;
  delete data.password;
  return data;
};

const ensureSuperAdminRole = async () => {
  const [role] = await Role.findOrCreate({
    where: { slug: "super-admin" },
    defaults: {
      name: "Super Admin",
      slug: "super-admin",
      description: "Full access to the admin portal",
      status: "active",
    },
  });
  return role;
};

exports.setup = async (req, res) => {
  try {
    const userCount = await User.count();
    if (userCount > 0) {
      return res.status(403).json({
        success: false,
        message: "Setup already completed. Use the authenticated create route.",
      });
    }

    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const role = await ensureSuperAdminRole();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      role_id: role.id,
      status: "active",
    });

    const created = await User.findByPk(user.id, { include: userInclude });
    return res.status(201).json({
      success: true,
      message: "First admin created successfully",
      data: sanitizeUser(created),
    });
  } catch (error) {
    console.error("Error creating first user:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      where: { email },
      include: userInclude,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        type: "admin",
        role: user.role?.slug,
      },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: sanitizeUser(user),
        token,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const emailFromBody = req.body?.Email || req.body?.email;
    if (!emailFromBody || typeof emailFromBody !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Email is required" });
    }

    const normalizedEmail = emailFromBody.trim().toLowerCase();
    const user = await User.findOne({
      where: Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("email")),
        normalizedEmail
      ),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "No account found with this email address",
      });
    }

    const newPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    const emailConfig = config.emailService || {};
    if (emailConfig.user && emailConfig.pass) {
      const transporter = nodemailer.createTransport({
        service: emailConfig.provider || "gmail",
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass,
        },
      });

      try {
        await transporter.sendMail({
          from: emailConfig.user,
          to: normalizedEmail,
          subject: "Mcaludoh Admin Password Reset",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Mcaludoh Admin Password Reset</h2>
              <p>Hello ${user.name || "Admin"},</p>
              <p>Your admin portal password has been reset.</p>
              <p><strong>New Password:</strong> ${newPassword}</p>
              <p>Please log in and change your password immediately.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Password reset email error:", emailError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    console.error("forgot password error:", error);
    return res.status(500).json({
      success: false,
      error: "Error processing password reset",
    });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, email, password, phone, role_id, status } = req.body;
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and role_id are required",
      });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      role_id,
      status: status || "active",
    });

    const created = await User.findByPk(user.id, { include: userInclude });
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: sanitizeUser(created),
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role_id,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const whereClause = {};

    if (role_id) whereClause.role_id = role_id;
    if (status) whereClause.status = status;
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ["password"] },
      include: userInclude,
      limit: limitNum,
      offset,
      order: [[sortBy, sortOrder]],
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: userInclude,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { name, email, phone, role_id, status } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (role_id) updateData.role_id = role_id;
    if (status) updateData.status = status;

    await user.update(updateData);
    const updated = await User.findByPk(user.id, {
      attributes: { exclude: ["password"] },
      include: userInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.destroy();
    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

