const express = require('express');
const {
  getNotifications,
  markRead,
  markAllRead,
  dismissOne,
  dismissAll,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Every route in this file needs a valid token
router.use(protect);

router.route('/').get(getNotifications).delete(dismissAll);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
router.delete('/:id', dismissOne);

module.exports = router;