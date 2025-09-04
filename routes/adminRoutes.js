// routes/adminRoutes.js
const express = require("express");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// 📌 ميدل وير لرفع ملفات الفواتير
const uploadBillingProof = require("../middleware/uploadBillingProof");

const {
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getPendingSubscriptions,
  approveSubscription,
  rejectSubscription
} = require("../controllers/adminController");

const {
  getAllBots,
  restartBot,
  stopBot
} = require("../controllers/botController");

const { 
  getAllBillings, 
  createBilling, 
  updateBillingStatus 
} = require("../controllers/billingController");

const { 
  getAdminSettings, 
  updateAdminSettings,
  // ✅ جديدة لإدارة الحماية/الكلمات المحظورة
  addBannedWord,
  removeBannedWord
} = require("../controllers/adminSettingsController");

const { 
  getAllBroadcasts, 
  sendBroadcast 
} = require("../controllers/broadcastController");

const {
  getPendingUsers,
  approveUser,
  rejectUser
} = require("../controllers/newSubscribersController");

const {
  createSubscriptionRequest,
  getAllSubscriptionRequests,
  approveSubscriptionRequest,
  rejectSubscriptionRequest
} = require("../controllers/subscriptionRequestController");

const { 
  getProfile, 
  updateProfile 
} = require("../controllers/profileController");

const { 
  getAdminDashboardStats 
} = require("../controllers/adminDashboardController");

const router = express.Router();

/**
 * =========================================================
 * 📌 إدارة المشتركين (Users Management) - مشرف فقط
 * =========================================================
 */
router.get("/users", protect, authorizeRoles("admin"), getAllUsers);
router.put("/users/:id/status", protect, authorizeRoles("admin"), updateUserStatus);
router.delete("/users/:id", protect, authorizeRoles("admin"), deleteUser);

/**
 * =========================================================
 * 📌 إدارة البوتات والجلسات (Bots & Sessions) - مشرف فقط
 * =========================================================
 */
router.get("/bots", protect, authorizeRoles("admin"), getAllBots);
router.post("/bots/restart/:id", protect, authorizeRoles("admin"), restartBot);
router.post("/bots/stop/:id", protect, authorizeRoles("admin"), stopBot);

/**
 * =========================================================
 * 📌 إدارة الفواتير (Billing) - مشرف فقط
 * =========================================================
 */
router.get("/billing", protect, authorizeRoles("admin"), getAllBillings);
router.post(
  "/billing",
  protect,
  authorizeRoles("admin"),
  uploadBillingProof.single("proofFile"), // ⬅️ دعم رفع ملف إثبات الدفع
  createBilling
);
router.put("/billing/:id/status", protect, authorizeRoles("admin"), updateBillingStatus);

/**
 * =========================================================
 * 📌 إدارة الإعدادات العامة (Admin Settings) - مشرف فقط
 * =========================================================
 * ملاحظة: هذه تُرجع/تعدّل كل الإعدادات العامة بما فيها مفاتيح الخدمات والدعم.
 */
router.get("/settings", protect, authorizeRoles("admin"), getAdminSettings);
router.put("/settings", protect, authorizeRoles("admin"), updateAdminSettings);

/**
 * =========================================================
 * 📌 إدارة الحماية والكلمات المحظورة (Protection)
 * =========================================================
 * - قراءة/تحديث خيارات الحماية (autoKickEnabled, autoReplyEnabled, bannedWords ...)
 * - إضافة/حذف كلمة محظورة منفردة
 */
router.get(
  "/protection/settings",
  protect,
  authorizeRoles("admin"),
  getAdminSettings
);

router.put(
  "/protection/settings",
  protect,
  authorizeRoles("admin"),
  updateAdminSettings
);

router.post(
  "/protection/words",
  protect,
  authorizeRoles("admin"),
  addBannedWord
);

router.delete(
  "/protection/words/:word",
  protect,
  authorizeRoles("admin"),
  removeBannedWord
);

/**
 * =========================================================
 * 📌 الإرسال الجماعي (Broadcast) - مشرف فقط
 * =========================================================
 */
router.get("/broadcast", protect, authorizeRoles("admin"), getAllBroadcasts);
router.post("/broadcast", protect, authorizeRoles("admin"), sendBroadcast);

/**
 * =========================================================
 * 📌 إدارة الاشتراكات (Subscriptions Management) - مشرف فقط
 * =========================================================
 */
router.get("/subscriptions/pending", protect, authorizeRoles("admin"), getPendingSubscriptions);
router.patch("/subscriptions/:id/approve", protect, authorizeRoles("admin"), approveSubscription);
router.patch("/subscriptions/:id/reject", protect, authorizeRoles("admin"), rejectSubscription);

/**
 * =========================================================
 * 📌 طلبات الاشتراك الجديدة (New Subscribers) - مشرف فقط
 * =========================================================
 */
router.get("/new-subscribers", protect, authorizeRoles("admin"), getPendingUsers);
router.put("/new-subscribers/approve/:id", protect, authorizeRoles("admin"), approveUser);
router.put("/new-subscribers/reject/:id", protect, authorizeRoles("admin"), rejectUser);

/**
 * =========================================================
 * 📌 الملف الشخصي للمشرف (Admin Profile)
 * =========================================================
 */
router.get("/profile", protect, authorizeRoles("admin"), getProfile);
router.put("/profile", protect, authorizeRoles("admin"), updateProfile);

// 📊 إحصائيات لوحة التحكم
router.get("/dashboard-stats", protect, authorizeRoles("admin"), getAdminDashboardStats);

/**
 * =========================================================
 * 📌 إدارة طلبات الاشتراك (Subscription Requests)
 * =========================================================
 */
router.get("/subscription-requests", protect, authorizeRoles("admin"), getAllSubscriptionRequests);
router.post("/subscription-requests/:id/approve", protect, authorizeRoles("admin"), approveSubscriptionRequest);
router.post("/subscription-requests/:id/reject", protect, authorizeRoles("admin"), rejectSubscriptionRequest);

module.exports = router;
