const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Creates the "wristband" (token) that proves who the user is
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all fields' });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashedPassword });

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Make sure nothing is missing
    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter email and password' });
    }

    // 2. Find the user by email
    const user = await User.findOne({ email });

    // 3. Compare the typed password with the scrambled one in the database
    const passwordMatches = user && (await bcrypt.compare(password, user.password));

    // 4. Same message for "no such email" and "wrong password" (see note below)
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 5. Success: send back the token
    res.json({
      message: 'Login successful',
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { registerUser, loginUser };