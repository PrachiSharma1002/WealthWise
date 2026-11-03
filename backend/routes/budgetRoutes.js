const express = require('express');
const {
  getBudgets,
  setBudget,
  deleteBudget,
  getRecommendations,
  updateSplit,
  getUnbudgeted,
  getGroupSummary,
} = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Every route in this file needs a valid token
router.use(protect);

router.route('/').get(getBudgets).post(setBudget);
router.get('/recommendations', getRecommendations);
router.get('/unbudgeted', getUnbudgeted);
router.get('/groups', getGroupSummary);
router.put('/split', updateSplit);
router.delete('/:id', deleteBudget);

module.exports = router;