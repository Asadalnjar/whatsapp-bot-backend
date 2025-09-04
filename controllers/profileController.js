const User = require("../models/User");
const bcrypt = require("bcryptjs");

/**
 * @desc   عرض الملف الشخصي
 * @route  GET /user/profile أو /admin/profile
 * @access Logged in users (user/admin)
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "❌ المستخدم غير موجود" });
    }

    res.json({
      id: user._id || "",
      name: user.name || "",
      phone: user.phone || "",
      email: user.email || "",
      role: user.role || "",
      status: user.status || "",
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null
    });
  } catch (error) {
    console.error("getProfile error:", error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   تحديث الملف الشخصي
 * @route  PUT /user/profile أو /admin/profile
 * @access Logged in users (user/admin)
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "❌ المستخدم غير موجود" });
    }

    if (name?.trim()) user.name = name.trim();
    if (phone?.trim()) user.phone = phone.trim();
    if (email?.trim()) user.email = email.trim().toLowerCase();

    if (password?.trim()) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    res.json({ message: "✅ تم تحديث الملف الشخصي بنجاح" });
  } catch (error) {
    console.error("updateProfile error:", error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
