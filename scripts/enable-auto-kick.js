// scripts/enable-auto-kick.js
// تفعيل الطرد التلقائي للمخالفين

const mongoose = require('mongoose');
require('dotenv').config();

// استيراد النماذج
const User = require('../models/User');
const WaSession = require('../models/WaSession');
const BannedWord = require('../models/BannedWord');

async function enableAutoKick() {
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

      // تفعيل الطرد التلقائي
      let updated = false;
      
      if (!waSession.protectionSettings) {
        waSession.protectionSettings = {};
        updated = true;
      }
      
      if (!waSession.protectionSettings.autoKick) {
        waSession.protectionSettings.autoKick = true;
        updated = true;
        console.log('  ✅ تم تفعيل الطرد التلقائي');
      }
      
      // تأكد من تفعيل الحذف التلقائي أيضاً
      if (!waSession.protectionSettings.autoDelete) {
        waSession.protectionSettings.autoDelete = true;
        updated = true;
        console.log('  ✅ تم تفعيل الحذف التلقائي');
      }
      
      if (updated) {
        await waSession.save();
        console.log('  ✅ تم تحديث إعدادات الحماية');
      } else {
        console.log('  ℹ️ الإعدادات محدثة بالفعل');
      }

      // تحديث الكلمات المحظورة لتشمل إجراء الطرد
      const bannedWords = await BannedWord.find({ userId: user._id });
      console.log(`  📝 عدد الكلمات المحظورة: ${bannedWords.length}`);

      for (const word of bannedWords) {
        if (word.action === 'delete') {
          word.action = 'kick'; // تغيير من حذف إلى طرد
          await word.save();
          console.log(`    🔄 تم تحديث "${word.word}" من حذف إلى طرد`);
        }
      }
    }

    console.log('\n🎉 تم تفعيل الطرد التلقائي بنجاح!');
    
    console.log('\n💡 ملاحظات مهمة:');
    console.log('   1. الآن سيتم طرد المخالفين تلقائياً');
    console.log('   2. تم تحديث جميع الكلمات المحظورة لتطرد بدلاً من الحذف فقط');
    console.log('   3. يمكن تعديل إجراءات الكلمات المحظورة من صفحة الحماية والفلترة');
    console.log('   4. تأكد من أن البوت مشرف في القروب ليتمكن من الطرد');

  } catch (error) {
    console.error('❌ خطأ في تفعيل الطرد التلقائي:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ تم قطع الاتصال بقاعدة البيانات');
    process.exit(0);
  }
}

// تشغيل التفعيل
enableAutoKick();
