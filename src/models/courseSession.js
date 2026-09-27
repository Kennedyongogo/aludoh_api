const { DataTypes } = require("sequelize");

const STATUSES = ["scheduled", "cancelled"];

// One dated run of a course that people book seats on
module.exports = (sequelize) => {
  const CourseSession = sequelize.define(
    "CourseSession",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      course_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "courses", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      // e.g. "Nairobi training farm" or "Online (Zoom)"
      location: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      // Empty means the course fee applies
      fee: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "scheduled",
        validate: { isIn: [STATUSES] },
      },
    },
    {
      tableName: "course_sessions",
      timestamps: true,
      indexes: [{ fields: ["course_id", "start_date"] }],
    }
  );

  CourseSession.STATUSES = STATUSES;

  return CourseSession;
};
