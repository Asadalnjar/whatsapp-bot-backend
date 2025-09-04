// scripts/activate-users.js
// تفعيل جميع المستخدمين

const mongoose = require('mongoose');
require('dotenv').config();

// استيراد النماذج
const User = require('../models/User');
const Subscription = require('../models/Subscription');

async function activateUsers() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // البحث عن جميع المستخدمين
    const users = await User.find({});
    console.log(`📊 تم العثور على ${users.length} مستخدم`);

    let activatedCount = 0;

    for (const user of users) {
      console.log(`\n🔧 معالجة المستخدم: ${user.email || user.name}`);
      console.log(`   الحالة الحالية: ${user.status}`);

      let updated = false;

      // تفعيل المستخدم إذا لم يكن نشطاً
      if (user.status !== 'active') {
        user.status = 'active';
        updated = true;
        activatedCount++;
        console.log('   ✅ تم تفعيل المستخدم');
      }

      // التأكد من وجود اشتراك نشط
      let subscription = await Subscription.findOne({ userId: user._id });
      
      if (!subscription) {
        // إنشاء اشتراك جديد
        subscription = new Subscription({
          userId: user._id,
          plan: 'شهري',
          status: 'active',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 يوم
          amount: 0 // مجاني للاختبار
        });
        
        await subscription.save();
        console.log('   ✅ تم إنشاء اشتراك جديد');
      } else if (subscription.status !== 'active') {
        // تفعيل الاشتراك الموجود
        subscription.status = 'active';
        subscription.startedAt = new Date();
        subscription.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        await subscription.save();
        console.log('   ✅ تم تفعيل الاشتراك');
      } else {
        console.log('   ℹ️ الاشتراك نشط بالفعل');
      }

      if (updated) {
        await user.save();
        console.log('   ✅ تم حفظ التحديثات');
      } else {
        console.log('   ℹ️ المستخدم نشط بالفعل');
      }
    }

    console.log('\n🎉 تم الانتهاء من تفعيل المستخدمين!');
    console.log(`📊 إحصائيات:`);
    console.log(`   - إجمالي المستخدمين: ${users.length}`);
    console.log(`   - المستخدمين المفعلين: ${activatedCount}`);

    // عرض الحالة النهائية
    const activeUsers = await User.find({ status: 'active' });
    const activeSubscriptions = await Subscription.find({ status: 'active' });
    
    console.log(`\n✅ الحالة النهائية:`);
    console.log(`   - المستخدمين النشطين: ${activeUsers.length}`);
    console.log(`   - الاشتراكات النشطة: ${activeSubscriptions.length}`);

  } catch (error) {
    console.error('❌ خطأ في تفعيل المستخدمين:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ تم قطع الاتصال بقاعدة البيانات');
    process.exit(0);
  }
}

// تشغيل التفعيل
activateUsers();
