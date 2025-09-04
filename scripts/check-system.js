// scripts/check-system.js
// فحص حالة نظام الحماية

const mongoose = require('mongoose');
require('dotenv').config();

// استيراد النماذج
const User = require('../models/User');
const WaSession = require('../models/WaSession');
const BannedWord = require('../models/BannedWord');
const Group = require('../models/Group');

async function checkSystemStatus() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // البحث عن المستخدم الحالي (أول مستخدم مع بريد إلكتروني)
    const user = await User.findOne({ email: { $exists: true, $ne: null } });
    
    if (!user) {
      console.log('❌ لم يتم العثور على مستخدم');
      return;
    }

    console.log(`\n👤 المستخدم: ${user.email}`);
    console.log(`   ID: ${user._id}`);

    // فحص WaSession
    const waSession = await WaSession.findOne({ user: user._id });
    console.log(`\n📱 جلسة WhatsApp:`);
    if (waSession) {
      console.log(`   ✅ موجودة`);
      console.log(`   📊 الحالة: ${waSession.state}`);
      console.log(`   🛡️ الحماية: ${waSession.protectionEnabled ? 'مفعلة' : 'غير مفعلة'}`);
      console.log(`   📅 آخر نشاط: ${waSession.lastSeenAt || 'غير محدد'}`);
      
      if (waSession.protectionSettings) {
        console.log(`   ⚙️ إعدادات الحماية:`);
        console.log(`      - حذف تلقائي: ${waSession.protectionSettings.autoDelete ? 'مفعل' : 'غير مفعل'}`);
        console.log(`      - طرد تلقائي: ${waSession.protectionSettings.autoKick ? 'مفعل' : 'غير مفعل'}`);
      }
      
      if (waSession.stats) {
        console.log(`   📈 الإحصائيات:`);
        console.log(`      - رسائل معالجة: ${waSession.stats.messagesProcessed}`);
        console.log(`      - انتهاكات مكتشفة: ${waSession.stats.violationsDetected}`);
        console.log(`      - رسائل محذوفة: ${waSession.stats.messagesDeleted}`);
        console.log(`      - مستخدمين مطرودين: ${waSession.stats.usersKicked}`);
      }
    } else {
      console.log(`   ❌ غير موجودة`);
    }

    // فحص الكلمات المحظورة
    const bannedWords = await BannedWord.find({ userId: user._id });
    console.log(`\n📝 الكلمات المحظورة: ${bannedWords.length}`);
    bannedWords.forEach((word, index) => {
      console.log(`   ${index + 1}. "${word.word}" (${word.type}) - ${word.severity} - ${word.action}`);
    });

    // فحص القروبات
    const groups = await Group.find({ user: user._id });
    const protectedGroups = groups.filter(g => g.isProtected);
    console.log(`\n👥 القروبات:`);
    console.log(`   📊 إجمالي: ${groups.length}`);
    console.log(`   🛡️ محمية: ${protectedGroups.length}`);
    
    if (protectedGroups.length > 0) {
      console.log(`   📋 القروبات المحمية:`);
      protectedGroups.forEach((group, index) => {
        console.log(`      ${index + 1}. ${group.name || 'بدون اسم'} (${group.jid})`);
      });
    }

    // فحص شامل للنظام
    console.log(`\n🔍 تشخيص النظام:`);
    
    const issues = [];
    
    if (!waSession) {
      issues.push('❌ جلسة WhatsApp غير موجودة');
    } else {
      if (waSession.state !== 'connected') {
        issues.push(`⚠️ جلسة WhatsApp غير متصلة (${waSession.state})`);
      }
      if (!waSession.protectionEnabled) {
        issues.push('⚠️ الحماية غير مفعلة');
      }
    }
    
    if (bannedWords.length === 0) {
      issues.push('⚠️ لا توجد كلمات محظورة');
    }
    
    if (protectedGroups.length === 0) {
      issues.push('⚠️ لا توجد قروبات محمية');
    }
    
    if (issues.length === 0) {
      console.log('   ✅ النظام يعمل بشكل صحيح!');
    } else {
      console.log('   🚨 مشاكل مكتشفة:');
      issues.forEach(issue => console.log(`      ${issue}`));
    }

    // توصيات
    console.log(`\n💡 التوصيات:`);
    if (!waSession || waSession.state !== 'connected') {
      console.log('   1. اذهب إلى صفحة ربط الجلسة وامسح QR Code');
    }
    if (bannedWords.length === 0) {
      console.log('   2. أضف كلمات محظورة في صفحة الحماية والفلترة');
    }
    if (protectedGroups.length === 0) {
      console.log('   3. فعل الحماية للقروبات في صفحة إدارة القروبات');
    }

  } catch (error) {
    console.error('❌ خطأ في فحص النظام:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ تم قطع الاتصال بقاعدة البيانات');
    process.exit(0);
  }
}

// تشغيل الفحص
checkSystemStatus();
