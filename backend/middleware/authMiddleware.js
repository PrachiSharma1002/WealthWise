const jwt = require('jsonwebtoken');
const User = require('../models/User');

// The guard: checks the token before letting a request through
const protect = async (req, res, next) => {
  try {
    // 1. The token should arrive as: "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    const token = authHeader.split(' ')[1];

    // 2. Check the token is genuine and not expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find the user it belongs to (without the password)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    // 4. Attach the user to the request, then let it through
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };