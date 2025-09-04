// routes/userRoutes.js
const express = require("express");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Controllers
const { getUserGroups, toggleGroupProtection, updateGroupProtection } = require("../controllers/groupController");
const { getUserSettings, updateUserSettings } = require("../controllers/userSettingsController");
const { getProfile, updateProfile } = require("../controllers/profileController");
const { getUserNotifications } = require("../controllers/notificationController");
const { getUserDashboardStats } = require("../controllers/userDashboardController");

// 📌 Middleware لرفع إيصال الدفع
const uploadSubscriptionProof = require("../middleware/uploadSubscriptionProof");

const router = express.Router();

/**
 * =========================================================
 * 📌 لوحة تحكم المستخدم - User Dashboard
 * =========================================================
 */
router.get("/dashboard", protect, authorizeRoles("user", "admin"), (req, res) => {
  res.json({ message: `👋 مرحباً ${req.user.name} في لوحة التحكم` });
});

/**
 * =========================================================
 * 📌 الملف الشخصي للمستخدم - User Profile
 * =========================================================
 */
router.get("/profile", protect, authorizeRoles("user", "admin"), getProfile);
router.put("/profile", protect, authorizeRoles("user", "admin"), updateProfile);

/**
 * =========================================================
 * 📌 إدارة القروبات - Groups Management
 * =========================================================
 */
router.get("/groups", protect, authorizeRoles("user", "admin"), getUserGroups);
router.put("/groups/:id/protection", protect, authorizeRoles("user", "admin"), toggleGroupProtection);
router.put("/groups/:gid/protection", protect, authorizeRoles("user", "admin"), updateGroupProtection);

/**
 * =========================================================
 * 📌 إدارة الاشتراك - Subscription Management
 * =========================================================
 */
// استخدام مسارات الاشتراك المنفصلة
const subscriptionRoutes = require('./subscriptionRoutes');
router.use('/subscription', subscriptionRoutes);

// استخدام مسارات الكلمات المحظورة والحماية
const bannedWordsRoutes = require('./bannedWordsRoutes');
router.use('/banned-words', bannedWordsRoutes);

/**
 * =========================================================
 * 📌 إدارة الإعدادات - Settings Management
 * =========================================================
 */
router.get("/settings", protect, authorizeRoles("user", "admin"), getUserSettings);
router.put("/settings", protect, authorizeRoles("user", "admin"), updateUserSettings);

/**
 * =========================================================
 * 📌 الإشعارات - Notifications
 * =========================================================
 */
router.get("/notifications", protect, authorizeRoles("user", "admin"), getUserNotifications);

/**
 * =========================================================
 * 📌 إحصائيات لوحة التحكم
 * =========================================================
 */
router.get("/dashboard-stats", protect, authorizeRoles("user", "admin"), getUserDashboardStats);

module.exports = router;
