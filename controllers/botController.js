// controllers/botController.js
const Bot = require("../models/Bot");

/**
 * @desc   عرض جميع البوتات
 * @route  GET /admin/bots
 * @access Admin
 */
const getAllBots = async (req, res) => {
  try {
    const bots = await Bot.find().populate("user", "name phone");
    res.json(bots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   إعادة تشغيل بوت
 * @route  POST /admin/bots/restart/:id
 * @access Admin
 */
const restartBot = async (req, res) => {
  try {
    const { id } = req.params;
    const bot = await Bot.findById(id);

    if (!bot) {
      return res.status(404).json({ message: "❌ البوت غير موجود" });
    }

    // منطق إعادة التشغيل (هنا فقط تحديث الحالة كمثال)
    bot.status = "متصل";
    bot.lastSeen = "الآن";
    await bot.save();

    res.json({ message: "✅ تم إعادة تشغيل البوت بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   إيقاف بوت
 * @route  POST /admin/bots/stop/:id
 * @access Admin
 */
const stopBot = async (req, res) => {
  try {
    const { id } = req.params;
    const bot = await Bot.findById(id);

    if (!bot) {
      return res.status(404).json({ message: "❌ البوت غير موجود" });
    }

    // منطق الإيقاف (هنا فقط تحديث الحالة كمثال)
    bot.status = "متوقف";
    bot.lastSeen = new Date().toLocaleString("ar-EG");
    await bot.save();

    res.json({ message: "✅ تم إيقاف البوت بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = {
  getAllBots,
  restartBot,
  stopBot
};
