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


// A route that hosting services can call to check the server is alive
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'database not connected',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Category and transaction routes
const categoryRoutes = require('./routes/categoryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);

// Budget routes
const budgetRoutes = require('./routes/budgetRoutes');
app.use('/api/budgets', budgetRoutes);


// Goal routes
const goalRoutes = require('./routes/goalRoutes');
app.use('/api/goals', goalRoutes);


// Insight routes
const insightRoutes = require('./routes/insightRoutes');
app.use('/api/insights', insightRoutes);


// Notification routes
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);


// A URL that does not exist
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Anything that goes wrong without being caught, such as broken JSON
app.use((err, req, res, next) => {
  // The details stay in this terminal, and are not sent to the browser
  console.error('Unhandled error:', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({
    message: status === 400 ? 'Invalid request' : 'Something went wrong',
  });
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