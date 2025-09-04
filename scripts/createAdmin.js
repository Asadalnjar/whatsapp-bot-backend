// scripts/createAdmin.js
require('dotenv').config();
const User = require('../models/User');
const connectDB = require('../config/db');

// ✅ دالة لتوحيد صيغة رقم الهاتف
const formatPhoneNumber = (phone) => {
  let formatted = phone.trim().replace(/\s+/g, ''); // إزالة المسافات

  // إذا كان الرقم يبدأ بـ 7 (يمني محلي)
  if (/^7\d{8,9}$/.test(formatted)) {
    formatted = `+967${formatted}`;
  }
  // إذا كان الرقم يبدأ بـ 05 (سعودي محلي)
  else if (/^05\d{8}$/.test(formatted)) {
    formatted = `+966${formatted.substring(1)}`;
  }
  // إذا كان الرقم يبدأ بـ 967 (يمني بدون +)
  else if (/^967\d{9}$/.test(formatted)) {
    formatted = `+${formatted}`;
  }
  // إذا كان الرقم يبدأ بـ 966 (سعودي بدون +)
  else if (/^966\d{9}$/.test(formatted)) {
    formatted = `+${formatted}`;
  }
  // إذا كان الرقم يبدأ بـ +967 أو +966 (صيغة دولية صحيحة)
  else if (/^\+967\d{9}$/.test(formatted) || /^\+966\d{9}$/.test(formatted)) {
    formatted = formatted; // لا تغيير
  }

  return formatted;
};

(async () => {
  try {
    // اتصال بقاعدة البيانات
    await connectDB();

    // بيانات المشرف
    const adminData = {
      name: "مدير النظام",
      phone: "776689245", // ممكن تكتبها محلي أو دولي
      password: "secret", // كلمة المرور العادية
      role: "admin"
    };

    console.log("📥 الرقم المدخل:", adminData.phone);
    console.log("📥 كلمة المرور العادية:", adminData.password);

    // توحيد صيغة الرقم
    adminData.phone = formatPhoneNumber(adminData.phone);
    console.log("🔄 الرقم بعد التحويل للصيغة الدولية:", adminData.phone);

    // التحقق من صحة الرقم
    const phoneRegex = /^(\+9677\d{8,9}|\+9665\d{8})$/;
    if (!phoneRegex.test(adminData.phone)) {
      console.log("❌ رقم الجوال غير صالح (يجب أن يكون رقم يمني أو سعودي)");
      process.exit(1);
    }

    // التحقق إذا المشرف موجود مسبقًا
    const existingAdmin = await User.findOne({ phone: adminData.phone });
    if (existingAdmin) {
      console.log("⚠️ يوجد مشرف بهذا الرقم مسبقًا");
      process.exit(0);
    }

    // إنشاء وحفظ المشرف (التشفير يتم تلقائيًا من الميدل وير في User.js)
    const newAdmin = new User(adminData);
    await newAdmin.save();

    console.log("✅ تم إنشاء حساب المشرف بنجاح");
    process.exit(0);

  } catch (error) {
    console.error("❌ خطأ أثناء إنشاء المشرف:", error.message);
    process.exit(1);
  }
})();
