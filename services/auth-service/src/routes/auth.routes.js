const express = require('express');
const router = express.Router();
const { register, login, refreshToken, getProfile, getAllUsers, editUser, updateRole } = require('../controllers/auth.controller');
const { createStation, getStations, updateCapacity } = require('../controllers/station.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

const allAdmins = ['system_admin', 'hospital_admin', 'police_admin', 'fire_admin'];

// Public routes
router.post('/login', login);
router.post('/refresh-token', refreshToken);

// Protected routes (require valid JWT)
router.get('/profile', verifyToken, getProfile);
router.post('/register', verifyToken, requireRole(allAdmins), register);
router.get('/users', verifyToken, requireRole(['system_admin', 'hospital_admin']), getAllUsers);
router.put('/users/:id', verifyToken, requireRole(allAdmins), editUser);
router.put('/users/:id/role', verifyToken, requireRole('system_admin'), updateRole);

// Station routes
router.post('/stations', verifyToken, requireRole(allAdmins), createStation);
router.get('/stations', verifyToken, requireRole(allAdmins), getStations);
router.put('/stations/:id/capacity', verifyToken, requireRole(['system_admin', 'hospital_admin']), updateCapacity);

module.exports = router;
