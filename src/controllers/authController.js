'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY,
  NODE_ENV
} = require('../config/env');

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: true, // Required for SameSite: None
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      const err = new Error('Email already taken.');
      err.statusCode = 409;
      return next(err);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    const accessToken = jwt.sign({ sub: user._id, email: user.email }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
    const refreshToken = jwt.sign({ sub: user._id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
    
    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.status(201).json({ success: true, accessToken, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      const err = new Error('Invalid credentials.');
      err.statusCode = 401;
      return next(err);
    }

    const accessToken = jwt.sign({ sub: user._id, email: user.email }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
    const refreshToken = jwt.sign({ sub: user._id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });

    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.json({ success: true, accessToken, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ success: false, code: 'NO_REFRESH_TOKEN' });

    let payload;
    try { payload = jwt.verify(token, JWT_REFRESH_SECRET); } catch { return res.status(401).json({ success: false, code: 'INVALID_REFRESH_TOKEN' }); }

    const user = await User.findById(payload.sub);
    if (!user || user.refreshToken !== token) return res.status(401).json({ success: false, code: 'TOKEN_REUSE' });

    const newAccess = jwt.sign({ sub: user._id, email: user.email }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
    const newRefresh = jwt.sign({ sub: user._id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });

    user.refreshToken = newRefresh;
    await user.save();

    setRefreshCookie(res, newRefresh);
    res.json({ success: true, accessToken: newAccess });
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const payload = jwt.decode(token);
      if (payload) await User.findByIdAndUpdate(payload.sub, { $unset: { refreshToken: 1 } });
    }
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'None', secure: true });
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash -refreshToken');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
};

module.exports = { register, login, refresh, logout, getMe };
