const express = require('express');
const router = express.Router();
const {
  registerVehicle, getAllVehicles, getVehicleById,
  getVehicleLocation, updateLocation, updateVehicleStatus,
  getLocationHistory, trackIncident,
} = require('../controllers/vehicle.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

// Register vehicle — hospital/police/fire admins
router.post('/vehicles/register', verifyToken, requireRole(['hospital_admin', 'police_admin', 'fire_admin', 'system_admin']), registerVehicle);

// Get all vehicles — system admin
router.get('/vehicles', verifyToken, getAllVehicles);

// Get specific vehicle
router.get('/vehicles/:id', verifyToken, getVehicleById);

// Get vehicle location
router.get('/vehicles/:id/location', verifyToken, getVehicleLocation);

// Push GPS update — ambulance driver or admin
router.post('/vehicles/:id/location', verifyToken, updateLocation);

// Update vehicle status
router.put('/vehicles/:id/status', verifyToken, requireRole(['hospital_admin', 'police_admin', 'fire_admin', 'system_admin']), updateVehicleStatus);

// Get location history
router.get('/vehicles/:id/history', verifyToken, getLocationHistory);

// Track incident
router.get('/dispatch/:incidentId/track', verifyToken, trackIncident);

module.exports = router;
