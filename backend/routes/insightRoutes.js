const express = require('express');
const {
  getAnalysis,
  getPrediction,
  getRecurring,
  getHealth,
  getTrends,
} = require('../controllers/insightController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Every route in this file needs a valid token
router.use(protect);

router.get('/analysis', getAnalysis);
router.get('/prediction', getPrediction);
router.get('/recurring', getRecurring);
router.get('/health', getHealth);
router.get('/trends', getTrends);

module.exports = router;