const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET } = require('../config/env');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    return next(err);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (err) {
    const error = new Error('Invalid or expired token.');
    error.statusCode = 401;
    error.code = 'TOKEN_EXPIRED';
    next(error);
  }
};

module.exports = authenticate;
