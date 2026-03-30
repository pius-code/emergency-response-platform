const express = require('express');
const router = express.Router();
const {
  createIncident,
  getAllIncidents,
  getOpenIncidents,
  getIncidentById,
  updateStatus,
  assignUnit,
} = require('../controllers/incident.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

const allAdmins = ['system_admin', 'police_admin', 'fire_admin', 'hospital_admin', 'ambulance_driver'];

router.use(verifyToken);

const statusUpdaters = ['system_admin', 'police_admin', 'fire_admin', 'hospital_admin'];

// Write operations
router.post('/', requireRole('system_admin'), createIncident);
router.put('/:id/status', requireRole(statusUpdaters), updateStatus);
router.put('/:id/assign', requireRole('system_admin'), assignUnit);

// Read operations — all roles, filtered by role in controller
router.get('/', requireRole(allAdmins), getAllIncidents);
router.get('/open', requireRole(allAdmins), getOpenIncidents);
router.get('/:id', requireRole(allAdmins), getIncidentById);

module.exports = router;
