// scripts/removeAdminSubscription.js
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

    console.log('📥 المدير:', admin.name, admin.phone, admin.role);

    // حذف أي اشتراكات للمدير
    const deletedSubscriptions = await Subscription.deleteMany({ userId: admin._id });
    
    console.log(`🗑️ تم حذف ${deletedSubscriptions.deletedCount} اشتراك للمدير`);
    
    console.log('✅ المدير الآن لا يحتاج لاشتراك - يمكنه الوصول لجميع الميزات مباشرة!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error);
    process.exit(1);
  }
})();
