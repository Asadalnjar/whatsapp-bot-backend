// scripts/fix-protection.js
// إصلاح مشاكل نظام الحماية

const mongoose = require('mongoose');
require('dotenv').config();

// استيراد النماذج
const User = require('../models/User');
const WaSession = require('../models/WaSession');
const BannedWord = require('../models/BannedWord');
const Group = require('../models/Group');

async function fixProtectionSystem() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // 1. البحث عن جميع المستخدمين
    const users = await User.find({});
    console.log(`📊 تم العثور على ${users.length} مستخدم`);

    for (const user of users) {
      console.log(`\n🔧 معالجة المستخدم: ${user.email}`);

      // 2. التحقق من وجود WaSession
      let waSession = await WaSession.findOne({ user: user._id });
      
      if (!waSession) {
        // إنشاء جلسة جديدة
        waSession = new WaSession({
          user: user._id,
          state: 'inactive',
          protectionEnabled: true, // تفعيل الحماية افتراضياً
          protectionSettings: {
            autoKick: false,
            autoDelete: true,
            allowOwnerBypass: true,
            warningBeforeKick: false
          },
          bannedWords: [],
          stats: {
            messagesProcessed: 0,
            violationsDetected: 0,
            usersKicked: 0,
            messagesDeleted: 0
          }
        });
        
        await waSession.save();
        console.log('  ✅ تم إنشاء WaSession جديدة');
      } else {
        // تحديث الجلسة الموجودة
        let updated = false;
        
        if (!waSession.protectionEnabled) {
          waSession.protectionEnabled = true;
          updated = true;
          console.log('  ✅ تم تفعيل الحماية');
        }
        
        if (!waSession.protectionSettings) {
          waSession.protectionSettings = {
            autoKick: false,
            autoDelete: true,
            allowOwnerBypass: true,
            warningBeforeKick: false
          };
          updated = true;
          console.log('  ✅ تم إضافة إعدادات الحماية');
        }
        
        if (!waSession.stats) {
          waSession.stats = {
            messagesProcessed: 0,
            violationsDetected: 0,
            usersKicked: 0,
            messagesDeleted: 0
          };
          updated = true;
          console.log('  ✅ تم إضافة الإحصائيات');
        }
        
        if (updated) {
          await waSession.save();
          console.log('  ✅ تم تحديث WaSession');
        } else {
          console.log('  ℹ️ WaSession محدثة بالفعل');
        }
      }

      // 3. التحقق من الكلمات المحظورة
      const bannedWordsCount = await BannedWord.countDocuments({ userId: user._id });
      console.log(`  📝 عدد الكلمات المحظورة: ${bannedWordsCount}`);

      // 4. التحقق من القروبات المحمية
      const protectedGroups = await Group.countDocuments({
        user: user._id,
        isProtected: true
      });
      console.log(`  🛡️ عدد القروبات المحمية: ${protectedGroups}`);

      // 5. إضافة كلمة تجريبية إذا لم توجد كلمات محظورة
      if (bannedWordsCount === 0) {
        const testWord = new BannedWord({
          userId: user._id,
          word: 'احبك',
          type: 'contains',
          severity: 'medium',
          action: 'delete',
          isActive: true,
          notes: 'كلمة تجريبية - تم إضافتها تلقائياً'
        });

        await testWord.save();
        console.log('  ✅ تم إضافة كلمة تجريبية: احبك');
      }
    }

    console.log('\n🎉 تم إصلاح نظام الحماية بنجاح!');
    
    // عرض ملخص
    const totalSessions = await WaSession.countDocuments({});
    const activeSessions = await WaSession.countDocuments({ protectionEnabled: true });
    const totalBannedWords = await BannedWord.countDocuments({});
    const totalGroups = await Group.countDocuments({ isProtected: true });
    
    console.log('\n📊 ملخص النظام:');
    console.log(`   - إجمالي الجلسات: ${totalSessions}`);
    console.log(`   - الجلسات المفعلة: ${activeSessions}`);
    console.log(`   - إجمالي الكلمات المحظورة: ${totalBannedWords}`);
    console.log(`   - إجمالي القروبات المحمية: ${totalGroups}`);

  } catch (error) {
    console.error('❌ خطأ في إصلاح النظام:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ تم قطع الاتصال بقاعدة البيانات');
    process.exit(0);
  }
}

// تشغيل الإصلاح
fixProtectionSystem();
