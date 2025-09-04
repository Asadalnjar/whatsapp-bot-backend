// controllers/broadcastController.js
const Broadcast = require("../models/Broadcast");

/**
 * @desc   عرض جميع الرسائل المرسلة
 * @route  GET /admin/broadcast
 * @access Admin
 */
const getAllBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .populate("sentBy", "name phone")
      .sort({ sentAt: -1 });

    res.json(broadcasts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   إرسال رسالة جماعية جديدة
 * @route  POST /admin/broadcast
 * @access Admin
 */
const sendBroadcast = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "❌ لا يمكن إرسال رسالة فارغة" });
    }

    // حفظ الرسالة في قاعدة البيانات
    const newBroadcast = await Broadcast.create({
      message,
      sentBy: req.user._id
    });

    // لاحقًا هنا يمكن إضافة منطق الإرسال الفعلي عبر البوتات
    res.status(201).json({ message: "✅ تم إرسال التنبيه بنجاح", broadcast: newBroadcast });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = {
  getAllBroadcasts,
  sendBroadcast
};
