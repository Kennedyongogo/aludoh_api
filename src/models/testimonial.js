const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Testimonial = sequelize.define(
    "Testimonial",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      client_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "clients", key: "id" },
      },
      client_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      organization: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      photo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5,
          isInt: true,
        },
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "hidden"),
        allowNull: false,
        defaultValue: "pending",
      },
    },
    {
      tableName: "testimonials",
      timestamps: true,
      indexes: [
        {
          fields: ["client_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["rating"],
        },
      ],
    }
  );

  return Testimonial;
};
