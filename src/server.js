'use strict';

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSockets } = require('./sockets');
const { PORT } = require('./config/env');

const server = http.createServer(app);

// ─── Initialize Socket.io ─────────────────────────────────────────────────────
initSockets(server);

// ─── Start Server with Airtight DB Connection ─────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`TaskSync Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error('CRITICAL: Server failed to start due to database error:', err.message);
    // Exponential backoff or retry logic could go here
    setTimeout(startServer, 5000); 
  }
};

startServer();
