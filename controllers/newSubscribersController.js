const User = require("../models/User");
const nodemailer = require("nodemailer");

// 📌 إعداد النقل (SMTP)
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail", // افتراضي Gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 📌 دالة مساعدة لإرسال الإيميل
const sendEmail = async (to, subject, text) => {
  if (!to) {
    console.warn("⚠️ محاولة إرسال إيميل بدون عنوان بريد");
    return { success: false, error: "لا يوجد بريد إلكتروني" };
  }

  try {
    await transporter.sendMail({
      from: `"إدارة الاشتراكات" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    });
    return { success: true };
  } catch (error) {
    console.error("❌ فشل إرسال الإيميل:", error);
    return { success: false, error: error.message };
  }
};

/**
 * @desc   جلب جميع الطلبات قيد المراجعة
 * @route  GET /admin/new-subscribers
 * @access Admin
 */
const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: "قيد المراجعة" }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error("❌ خطأ في جلب الطلبات:", error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   الموافقة على طلب الاشتراك
 * @route  PUT /admin/new-subscribers/approve/:id
 * @access Admin
 */
const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "❌ المستخدم غير موجود" });
    }

    user.status = "نشط";
    await user.save();

    // إرسال إيميل الموافقة
    const emailResult = await sendEmail(
      user.email,
      "تم قبول طلب الاشتراك",
      `مرحباً ${user.name}،\n\n✅ تم قبول طلب اشتراكك، يمكنك الآن تسجيل الدخول إلى حسابك.\n\nتحياتنا.\nإدارة الاشتراكات`
    );

    res.json({
      message: "✅ تم تفعيل الاشتراك بنجاح",
      emailSent: emailResult.success,
      emailError: emailResult.error || null
    });
  } catch (error) {
    console.error("❌ خطأ أثناء الموافقة:", error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   رفض طلب الاشتراك
 * @route  PUT /admin/new-subscribers/reject/:id
 * @access Admin
 */
const rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "❌ المستخدم غير موجود" });
    }

    user.status = "مرفوض";
    await user.save();

    // إرسال إيميل الرفض
    const emailResult = await sendEmail(
      user.email,
      "تم رفض طلب الاشتراك",
      `مرحباً ${user.name}،\n\n❌ نأسف، تم رفض طلب اشتراكك.\n\nتحياتنا.\nإدارة الاشتراكات`
    );

    res.json({
      message: "❌ تم رفض الطلب",
      emailSent: emailResult.success,
      emailError: emailResult.error || null
    });
  } catch (error) {
    console.error("❌ خطأ أثناء الرفض:", error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = {
  getPendingUsers,
  approveUser,
  rejectUser
};
