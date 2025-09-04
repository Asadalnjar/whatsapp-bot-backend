// controllers/notificationController.js
const Broadcast = require("../models/Broadcast");

/**
 * @desc   عرض التنبيهات للمستخدم
 * @route  GET /user/notifications
 * @access User/Admin
 */
const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Broadcast.find()
      .sort({ sentAt: -1 })
      .lean();

    res.json(
      notifications.map(n => ({
        id: n._id,
        message: n.message,
        date: new Date(n.sentAt).toLocaleString("ar-EG")
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = { getUserNotifications };
