// scripts/fixAdminSubscription.js
require('dotenv').config();
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const connectDB = require('../config/db');

(async () => {
  try {
    // اتصال بقاعدة البيانات
    await connectDB();

    // البحث عن المدير
    const admin = await User.findOne({ phone: '+967776689245' });
    
    if (!admin) {
      console.log('❌ المدير غير موجود');
      process.exit(1);
    }

    console.log('📥 المدير:', admin.name, admin.phone);

    // البحث عن الاشتراك
    let subscription = await Subscription.findOne({ userId: admin._id });
    
    if (!subscription) {
      // إنشاء اشتراك جديد للمدير (بدون تاريخ انتهاء)
      subscription = new Subscription({
        userId: admin._id,
        plan: 'سنوي', // خطة سنوية للمدير
        status: 'active',
        startedAt: new Date(),
        expiresAt: null // لا يوجد تاريخ انتهاء للمدير
      });
      console.log('✅ تم إنشاء اشتراك جديد للمدير');
    } else {
      // تحديث الاشتراك الموجود
      subscription.plan = 'سنوي';
      subscription.status = 'active';
      subscription.startedAt = new Date();
      subscription.expiresAt = null; // إزالة تاريخ الانتهاء
      console.log('✅ تم تحديث اشتراك المدير');
    }
    
    await subscription.save();

    console.log('📊 تفاصيل الاشتراك:', {
      plan: subscription.plan,
      status: subscription.status,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt || 'مدى الحياة'
    });

    console.log('🎉 تم إصلاح اشتراك المدير بنجاح!');
    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error);
    process.exit(1);
  }
})();
