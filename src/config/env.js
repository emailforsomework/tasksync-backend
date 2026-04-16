require('dotenv').config();

const requiredEnv = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CLIENT_ORIGIN'];

requiredEnv.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`Environment variable ${name} is missing.`);
  }
});

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  NODE_ENV: process.env.NODE_ENV || 'development',
};
