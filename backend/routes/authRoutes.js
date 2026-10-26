const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

// A private route: only works with a valid token
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

module.exports = router;