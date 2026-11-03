const express = require('express');
const {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  removeContribution,
} = require('../controllers/goalController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Every route in this file needs a valid token
router.use(protect);

router.route('/').get(getGoals).post(createGoal);
router.route('/:id').put(updateGoal).delete(deleteGoal);
router.post('/:id/contributions', addContribution);
router.delete('/:id/contributions/:contributionId', removeContribution);

module.exports = router;