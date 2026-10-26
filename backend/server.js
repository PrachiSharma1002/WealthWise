const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

// 1. Bring in the tools we installed
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// 2. Create the server
const app = express();

// 3. Middleware: lets the server read JSON and accept requests from the frontend
app.use(cors());
app.use(express.json());

// Auth routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// 4. A test route to check the server is alive
app.get('/', (req, res) => {
  res.send('WealthWise backend is running!');
});

// 5. Connect to MongoDB using the secret from .env
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.log('❌ MongoDB connection error:', err.message));

// 6. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});