const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Incident = sequelize.define('Incident', {
  incident_id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
  },
  citizen_name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  citizen_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  incident_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  assigned_unit_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  assigned_unit_type: {
    type: DataTypes.ENUM('police', 'fire', 'ambulance'),
    allowNull: true,
  },
  assigned_hospital: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('created', 'dispatched', 'in_progress', 'resolved'),
    defaultValue: 'created',
  },
  dispatched_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'incidents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Incident;
