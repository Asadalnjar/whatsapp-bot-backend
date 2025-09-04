// scripts/activateAdmin.js
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

    console.log('📥 المدير الحالي:', {
      name: admin.name,
      phone: admin.phone,
      role: admin.role,
      status: admin.status
    });

    // تفعيل المدير
    admin.status = 'active';
    await admin.save();

    // البحث عن الاشتراك وتفعيله
    let subscription = await Subscription.findOne({ userId: admin._id });
    
    if (!subscription) {
      // إنشاء اشتراك جديد إذا لم يكن موجود
      subscription = new Subscription({
        userId: admin._id,
        plan: 'شهري',
        status: 'active',
        startDate: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 يوم
      });
    } else {
      // تفعيل الاشتراك الموجود
      subscription.status = 'active';
      subscription.startDate = new Date();
      subscription.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    await subscription.save();

    console.log('✅ تم تفعيل المدير والاشتراك بنجاح!');
    console.log('📊 الحالة الجديدة:', {
      userStatus: admin.status,
      subscriptionStatus: subscription.status,
      expiresAt: subscription.expiresAt
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error);
    process.exit(1);
  }
})();
