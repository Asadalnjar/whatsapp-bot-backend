// routes/authRoutes.js
const express = require('express');
const {
  registerUser,
  loginUser,
  refreshAccessToken,
  checkUserStatus,
  logoutUser,
  logoutAllDevices,
  getActiveSessions
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');
const { loginLimiter, registerLimiter } = require('../middleware/security');
const router = express.Router();

// 📌 تسجيل مستخدم جديد
// المسار: POST /auth/register
router.post('/register',
  registerLimiter,
  validate(schemas.register),
  registerUser
);

// 📌 تسجيل الدخول
// المسار: POST /auth/login
router.post('/login',
  loginLimiter,
  validate(schemas.login),
  loginUser
);

// 📌 تجديد التوكن (Access Token) باستخدام Refresh Token من الكوكي
// المسار: GET /auth/refresh
router.get('/refresh', refreshAccessToken);

// 📌 التحقق من حالة المستخدم (يتطلب تسجيل دخول)
// المسار: GET /auth/me
router.get('/me', protect, checkUserStatus);

// 📌 تسجيل الخروج
// المسار: POST /auth/logout
router.post('/logout', logoutUser);

// 📌 تسجيل الخروج من جميع الأجهزة
// المسار: POST /auth/logout-all
router.post('/logout-all', protect, logoutAllDevices);

// 📌 الحصول على الجلسات النشطة
// المسار: GET /auth/sessions
router.get('/sessions', protect, getActiveSessions);

module.exports = router;
