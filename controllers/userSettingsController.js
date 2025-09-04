// controllers/userSettingsController.js
const UserSettings = require("../models/UserSettings");

// عرض إعدادات المستخدم
const getUserSettings = async (req, res) => {
  try {
    let settings = await UserSettings.findOne({ user: req.user._id });
    if (!settings) {
      settings = await UserSettings.create({ user: req.user._id });
    }
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

// تعديل إعدادات المستخدم
const updateUserSettings = async (req, res) => {
  try {
    const { bannedWords, autoKick, autoReply } = req.body;

    let settings = await UserSettings.findOne({ user: req.user._id });
    if (!settings) {
      settings = await UserSettings.create({ user: req.user._id });
    }

    settings.bannedWords = bannedWords || settings.bannedWords;
    settings.autoKick = autoKick !== undefined ? autoKick : settings.autoKick;
    settings.autoReply = autoReply !== undefined ? autoReply : settings.autoReply;

    await settings.save();
    res.json({ message: "✅ تم حفظ الإعدادات بنجاح", settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = {
  getUserSettings,
  updateUserSettings
};
