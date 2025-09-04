const User = require("../models/User");
const Group = require("../models/Group");
const Broadcast = require("../models/Broadcast");
const SubscriptionRequest = require("../models/SubscriptionRequest");

const getAdminDashboardStats = async (req, res) => {
  try {
    // تنفيذ جميع الاستعلامات بشكل متوازي لتحسين الأداء
    const [
      totalUsers,
      activeUsers,
      pendingRequests,
      totalGroups,
      totalBroadcasts,
      // إضافة بيانات إضافية في نفس الطلب
      pendingSubscriptions,
      allSubscriptionRequests
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }), // تصحيح: استخدام "active" بدلاً من "نشط"
      SubscriptionRequest.countDocuments({ status: "قيد المراجعة" }),
      Group.countDocuments(),
      Broadcast.countDocuments(),
      // إضافة الاشتراكات المعلقة
      require('../models/Subscription').countDocuments({ status: "pending" }),
      // إضافة جميع طلبات الاشتراك
      SubscriptionRequest.find({ status: "قيد المراجعة" }).lean()
    ]);

    res.json({
      totalUsers,
      activeUsers,
      pendingRequests,
      totalGroups,
      totalBroadcasts,
      // إضافة البيانات الإضافية
      pendingSubscriptions,
      subscriptionRequests: allSubscriptionRequests
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = { getAdminDashboardStats };
