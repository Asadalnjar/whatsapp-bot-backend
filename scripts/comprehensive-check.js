// scripts/comprehensive-check.js
// فحص شامل لجميع جوانب النظام

const mongoose = require('mongoose');
require('dotenv').config();

// استيراد النماذج
const User = require('../models/User');
const WaSession = require('../models/WaSession');
const BannedWord = require('../models/BannedWord');
const Group = require('../models/Group');
const AdminSettings = require('../models/AdminSettings');
const Violation = require('../models/Violation');

async function comprehensiveCheck() {
  try {
    console.log('🔍 بدء الفحص الشامل للنظام...\n');
    
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    const issues = [];
    const warnings = [];
    const suggestions = [];

    // 1. فحص المستخدمين
    console.log('\n📊 فحص المستخدمين...');
    const users = await User.find({});
    console.log(`   - إجمالي المستخدمين: ${users.length}`);
    
    const activeUsers = users.filter(u => u.status === 'active');
    console.log(`   - المستخدمين النشطين: ${activeUsers.length}`);
    
    if (users.length === 0) {
      issues.push('❌ لا يوجد مستخدمين في النظام');
    }

    // 2. فحص جلسات WhatsApp
    console.log('\n📱 فحص جلسات WhatsApp...');
    const sessions = await WaSession.find({});
    const connectedSessions = sessions.filter(s => s.state === 'connected');
    const protectedSessions = sessions.filter(s => s.protectionEnabled);
    
    console.log(`   - إجمالي الجلسات: ${sessions.length}`);
    console.log(`   - الجلسات المتصلة: ${connectedSessions.length}`);
    console.log(`   - الجلسات المحمية: ${protectedSessions.length}`);
    
    if (sessions.length === 0) {
      issues.push('❌ لا توجد جلسات WhatsApp');
    }
    
    if (connectedSessions.length === 0) {
      warnings.push('⚠️ لا توجد جلسات متصلة حالياً');
    }

    // 3. فحص الكلمات المحظورة
    console.log('\n📝 فحص الكلمات المحظورة...');
    const bannedWords = await BannedWord.find({});
    const activeWords = bannedWords.filter(w => w.isActive);
    
    console.log(`   - إجمالي الكلمات المحظورة: ${bannedWords.length}`);
    console.log(`   - الكلمات النشطة: ${activeWords.length}`);
    
    // تجميع حسب الإجراء
    const actionCounts = {};
    activeWords.forEach(word => {
      actionCounts[word.action] = (actionCounts[word.action] || 0) + 1;
    });
    
    console.log('   - توزيع الإجراءات:');
    Object.entries(actionCounts).forEach(([action, count]) => {
      console.log(`     * ${action}: ${count}`);
    });
    
    if (activeWords.length === 0) {
      warnings.push('⚠️ لا توجد كلمات محظورة نشطة');
    }

    // 4. فحص القروبات
    console.log('\n👥 فحص القروبات...');
    const groups = await Group.find({});
    const protectedGroups = groups.filter(g => g.isProtected);
    
    console.log(`   - إجمالي القروبات: ${groups.length}`);
    console.log(`   - القروبات المحمية: ${protectedGroups.length}`);
    
    if (protectedGroups.length === 0) {
      warnings.push('⚠️ لا توجد قروبات محمية');
    }

    // 5. فحص المخالفات
    console.log('\n🚫 فحص المخالفات...');
    const violations = await Violation.find({});
    const recentViolations = await Violation.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    console.log(`   - إجمالي المخالفات: ${violations.length}`);
    console.log(`   - المخالفات خلال 24 ساعة: ${recentViolations.length}`);

    // 6. فحص إعدادات المشرف
    console.log('\n⚙️ فحص إعدادات المشرف...');
    const adminSettings = await AdminSettings.findOne({});
    
    if (adminSettings) {
      console.log(`   - رقم صاحب البوت: ${adminSettings.ownerNumber || 'غير محدد'}`);
      console.log(`   - قائمة الأرقام المسموحة: ${adminSettings.whitelistNumbers?.length || 0}`);
    } else {
      warnings.push('⚠️ لا توجد إعدادات مشرف');
    }

    // 7. فحص تناسق البيانات
    console.log('\n🔍 فحص تناسق البيانات...');
    
    // فحص الجلسات بدون مستخدمين
    const orphanSessions = await WaSession.find({
      user: { $nin: users.map(u => u._id) }
    });
    
    if (orphanSessions.length > 0) {
      issues.push(`❌ ${orphanSessions.length} جلسة بدون مستخدم`);
    }
    
    // فحص القروبات بدون مستخدمين
    const orphanGroups = await Group.find({
      user: { $nin: users.map(u => u._id) }
    });
    
    if (orphanGroups.length > 0) {
      issues.push(`❌ ${orphanGroups.length} قروب بدون مستخدم`);
    }

    // 8. فحص الأداء
    console.log('\n⚡ فحص الأداء...');
    
    // فحص الجلسات القديمة
    const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleSessions = sessions.filter(s => 
      s.lastSeenAt && s.lastSeenAt < staleDate
    );
    
    if (staleSessions.length > 0) {
      suggestions.push(`💡 ${staleSessions.length} جلسة لم تكن نشطة لأكثر من أسبوع`);
    }

    // 9. عرض النتائج
    console.log('\n' + '='.repeat(50));
    console.log('📋 ملخص الفحص:');
    console.log('='.repeat(50));
    
    if (issues.length === 0 && warnings.length === 0) {
      console.log('🎉 النظام يعمل بشكل مثالي!');
    } else {
      if (issues.length > 0) {
        console.log('\n🚨 مشاكل حرجة:');
        issues.forEach(issue => console.log(`   ${issue}`));
      }
      
      if (warnings.length > 0) {
        console.log('\n⚠️ تحذيرات:');
        warnings.forEach(warning => console.log(`   ${warning}`));
      }
    }
    
    if (suggestions.length > 0) {
      console.log('\n💡 اقتراحات للتحسين:');
      suggestions.forEach(suggestion => console.log(`   ${suggestion}`));
    }

    // 10. إحصائيات عامة
    console.log('\n📊 إحصائيات عامة:');
    console.log(`   - المستخدمين: ${users.length}`);
    console.log(`   - الجلسات المتصلة: ${connectedSessions.length}`);
    console.log(`   - القروبات المحمية: ${protectedGroups.length}`);
    console.log(`   - الكلمات المحظورة النشطة: ${activeWords.length}`);
    console.log(`   - المخالفات الكلية: ${violations.length}`);

  } catch (error) {
    console.error('❌ خطأ في الفحص الشامل:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ تم قطع الاتصال بقاعدة البيانات');
    process.exit(0);
  }
}

// تشغيل الفحص
comprehensiveCheck();
