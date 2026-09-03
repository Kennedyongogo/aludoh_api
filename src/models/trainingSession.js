const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TrainingSession = sequelize.define(
    "TrainingSession",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      course_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "training_courses", key: "id" },
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(
          "upcoming",
          "ongoing",
          "completed",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "upcoming",
      },
    },
    {
      tableName: "training_sessions",
      timestamps: true,
      indexes: [
        {
          fields: ["course_id"],
        },
        {
          fields: ["start_date"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  return TrainingSession;
};
