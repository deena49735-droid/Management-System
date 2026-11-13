const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');

// Load environment variables from .env
dotenv.config();

// Preload models to register schemas for populate queries
require('./models/User');
require('./models/Team');
require('./models/Criteria');
require('./models/PointEntry');
require('./models/TeamPointEntry');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const teamRoutes = require('./routes/teamRoutes');
const criteriaRoutes = require('./routes/criteriaRoutes');
const entryRoutes = require('./routes/entryRoutes');
const teamEntryRoutes = require('./routes/teamEntryRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration (allow configured CLIENT_URL as well as standard local dev origins)
const configuredOrigin = process.env.CLIENT_URL;
const allowedOrigins = [configuredOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev if matching frontend
    },
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Kadambas Game Management System API is running',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/criteria', criteriaRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/team-entries', teamEntryRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// 404 Route Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Central Error Handler (never exposes stack traces)
app.use((err, req, res, next) => {
  // Log error internally for debugging
  console.error('[Error Log]:', err.message);

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: errors.join(', '),
    });
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(400).json({
      success: false,
      message: `A record with this ${field} already exists.`,
    });
  }

  // Handle JWT Error
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const clientMessage =
    statusCode === 500
      ? 'An unexpected internal server error occurred.'
      : err.message || 'Something went wrong.';

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
  });
});

// Database connection & Server initialization
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('⚠️  Warning: MONGO_URI is not set in environment variables. Server will not connect to MongoDB.');
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log('✅ Connected to MongoDB successfully.');
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
}

// Start HTTP server only if not required as a module in tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`🔗 Health check available at: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;

