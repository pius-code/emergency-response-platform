const express = require('express');
const router = express.Router();
const { getResponseTimes, getIncidentsByRegion, getResourceUtilization, getIncidentsSummary } = require('../controllers/analytics.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/response-times', getResponseTimes);
router.get('/incidents-by-region', getIncidentsByRegion);
router.get('/resource-utilization', getResourceUtilization);
router.get('/incidents/summary', getIncidentsSummary);

module.exports = router;
