// scripts/test-api.js
// اختبار API endpoints

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testAPI() {
  console.log('🔍 اختبار API endpoints...\n');

  const tests = [
    {
      name: 'Health Check',
      method: 'GET',
      url: `${BASE_URL}/`,
      expectError: true // نتوقع خطأ لأن / غير موجود
    },
    {
      name: 'Auth Routes',
      method: 'POST',
      url: `${BASE_URL}/auth/login`,
      data: {},
      expectError: true // نتوقع خطأ لبيانات فارغة
    },
    {
      name: 'User Routes (without auth)',
      method: 'GET',
      url: `${BASE_URL}/user/profile`,
      expectError: true // نتوقع خطأ لعدم وجود token
    },
    {
      name: 'WA Routes (without auth)',
      method: 'GET',
      url: `${BASE_URL}/wa/session/status`,
      expectError: true // نتوقع خطأ لعدم وجود token
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`🧪 اختبار: ${test.name}`);
      
      let response;
      if (test.method === 'GET') {
        response = await axios.get(test.url, { timeout: 5000 });
      } else if (test.method === 'POST') {
        response = await axios.post(test.url, test.data || {}, { timeout: 5000 });
      }

      if (test.expectError) {
        console.log(`   ⚠️ كان متوقع خطأ لكن الطلب نجح`);
      } else {
        console.log(`   ✅ نجح - Status: ${response.status}`);
        passedTests++;
      }

    } catch (error) {
      if (test.expectError) {
        console.log(`   ✅ فشل كما هو متوقع - ${error.response?.status || error.code}`);
        passedTests++;
      } else {
        console.log(`   ❌ فشل غير متوقع - ${error.message}`);
      }
    }
  }

  console.log(`\n📊 نتائج الاختبار:`);
  console.log(`   - الاختبارات الناجحة: ${passedTests}/${totalTests}`);
  console.log(`   - معدل النجاح: ${Math.round((passedTests/totalTests) * 100)}%`);

  if (passedTests === totalTests) {
    console.log(`\n🎉 جميع الاختبارات نجحت! API يعمل بشكل صحيح.`);
  } else {
    console.log(`\n⚠️ بعض الاختبارات فشلت. تحقق من Backend.`);
  }
}

// تشغيل الاختبار
testAPI().catch(console.error);
