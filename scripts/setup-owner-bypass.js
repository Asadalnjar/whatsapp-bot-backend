// scripts/setup-owner-bypass.js
// إعداد استثناء صاحب البوت تلقائياً

const mongoose = require('mongoose');
require('dotenv').config();

// استيراد النماذج
const User = require('../models/User');
const WaSession = require('../models/WaSession');
const AdminSettings = require('../models/AdminSettings');

async function setupOwnerBypass() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // البحث عن جميع المستخدمين
    const users = await User.find({});
    console.log(`📊 تم العثور على ${users.length} مستخدم`);

    for (const user of users) {
      console.log(`\n🔧 معالجة المستخدم: ${user.email}`);

      // التحقق من وجود WaSession
      let waSession = await WaSession.findOne({ user: user._id });
      
      if (!waSession) {
        console.log('  ⚠️ لا توجد جلسة WhatsApp');
        continue;
      }

      // تفعيل allowOwnerBypass
      let updated = false;
      
      if (!waSession.protectionSettings) {
        waSession.protectionSettings = {};
        updated = true;
      }
      
      if (!waSession.protectionSettings.allowOwnerBypass) {
        waSession.protectionSettings.allowOwnerBypass = true;
        updated = true;
        console.log('  ✅ تم تفعيل استثناء صاحب البوت');
      }
      
      if (updated) {
        await waSession.save();
        console.log('  ✅ تم تحديث إعدادات الحماية');
      } else {
        console.log('  ℹ️ الإعدادات محدثة بالفعل');
      }
    }

    // التحقق من إعدادات المشرف
    console.log('\n🔍 فحص إعدادات المشرف...');
    const adminSettings = await AdminSettings.findOne({});
    
    if (adminSettings) {
      console.log(`📱 رقم صاحب البوت: ${adminSettings.ownerNumber || 'غير محدد'}`);
      console.log(`📋 قائمة الأرقام المسموحة: ${adminSettings.whitelistNumbers?.length || 0} رقم`);
      
      if (adminSettings.whitelistNumbers && adminSettings.whitelistNumbers.length > 0) {
        adminSettings.whitelistNumbers.forEach((number, index) => {
          console.log(`   ${index + 1}. ${number}`);
        });
      }
    } else {
      console.log('⚠️ لا توجد إعدادات مشرف');
    }

    console.log('\n🎉 تم إعداد استثناء صاحب البوت بنجاح!');
    
    console.log('\n💡 ملاحظات مهمة:');
    console.log('   1. تأكد من ربط جلسة WhatsApp لتحديد رقم صاحب البوت تلقائياً');
    console.log('   2. صاحب البوت (الذي مسح QR Code) سيتم استثناؤه تلقائياً');
    console.log('   3. مشرفو القروبات سيتم استثناؤهم تلقائياً');
    console.log('   4. يمكن إضافة مستخدمين آخرين للاستثناءات من واجهة إدارة القروبات');

  } catch (error) {
    console.error('❌ خطأ في إعداد النظام:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ تم قطع الاتصال بقاعدة البيانات');
    process.exit(0);
  }
}

// تشغيل الإعداد
setupOwnerBypass();
