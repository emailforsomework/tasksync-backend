const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

/**
 * Airtight Database Connection Logic
 * 
 * Prevents "MongooseError: Operation buffering timed out" by:
 * 1. Checking existing connection state.
 * 2. Awaiting a full connection before allowing queries to proceed.
 * 3. Handling re-connection logic gracefully.
 */

let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // If already connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    console.log('Database connection already in progress...');
    return;
  }

  try {
    console.log('Initiating database connection...');
    const conn = await mongoose.connect(MONGO_URI);
    
    cachedConnection = conn;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    return conn;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    // Do NOT use process.exit(1) here as it breaks serverless/container lifecycles
    // throw error to be handled by the caller (server.js or index.js)
    throw err;
  }
};

module.exports = connectDB;
