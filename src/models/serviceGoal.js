const { DataTypes } = require("sequelize");

// A visitor goal on the services page ("Improve my yields") pointing to the services that help,
// best match first.
module.exports = (sequelize) => {
  const ServiceGoal = sequelize.define(
    "ServiceGoal",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      label: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      // Ordered; ids of deleted or draft services are skipped when read
      service_ids: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: [],
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "service_goals",
      timestamps: true,
      indexes: [{ fields: ["is_active", "sort_order"] }],
    }
  );

  return ServiceGoal;
};
