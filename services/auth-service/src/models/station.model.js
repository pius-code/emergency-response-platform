const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Station = sequelize.define('Station', {
  station_id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('hospital', 'police', 'fire'),
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  // Hospital-only capacity fields
  total_capacity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  available_capacity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: 'stations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Station;
