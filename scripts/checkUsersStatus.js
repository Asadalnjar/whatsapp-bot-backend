// scripts/checkUsersStatus.js
require('dotenv').config();
const User = require('../models/User');
const connectDB = require('../config/db');

(async () => {
  try {
    // اتصال بقاعدة البيانات
    await connectDB();

    // جلب جميع المستخدمين
    const users = await User.find().select('name phone role status');
    
    console.log('📊 جميع المستخدمين:');
    console.log('='.repeat(50));
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`);
      console.log(`   📞 الهاتف: ${user.phone}`);
      console.log(`   🎭 الدور: ${user.role}`);
      console.log(`   📊 الحالة: ${user.status}`);
      console.log('   ' + '-'.repeat(30));
    });

    console.log(`\n📈 إجمالي المستخدمين: ${users.length}`);
    
    // إحصائيات الحالات
    const statusCounts = {};
    users.forEach(user => {
      statusCounts[user.status] = (statusCounts[user.status] || 0) + 1;
    });
    
    console.log('\n📊 إحصائيات الحالات:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} مستخدم`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error);
    process.exit(1);
  }
})();
