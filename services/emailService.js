// services/emailService.js
// خدمة إرسال الإيميلات

const nodemailer = require('nodemailer');

// إعداد transporter
const createTransporter = () => {
  // يمكن استخدام Gmail أو أي خدمة إيميل أخرى
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  });
};

/**
 * إرسال إيميل عام
 * @param {string} to - المستقبل
 * @param {string} subject - الموضوع
 * @param {string} text - النص العادي
 * @param {string} html - HTML (اختياري)
 */
async function sendEmail(to, subject, text, html = null) {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'نظام حماية واتساب <noreply@whatsapp-protection.com>',
      to: to,
      subject: subject,
      text: text,
      html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ تم إرسال الإيميل بنجاح:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ خطأ في إرسال الإيميل:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * إرسال إشعار للمشرف عن طلب اشتراك جديد
 * @param {Object} subscriptionRequest - بيانات طلب الاشتراك
 */
async function notifyAdminNewSubscription(subscriptionRequest) {
  const adminEmail = process.env.ADMIN_EMAIL || 'asedalnajar198@gmail.com';
  
  const subject = '🔔 طلب اشتراك جديد يحتاج موافقة';
  
  const text = `
مرحباً،

تم استلام طلب اشتراك جديد يحتاج إلى مراجعتك:

📋 تفاصيل الطلب:
- الاسم: ${subscriptionRequest.name}
- رقم الجوال: ${subscriptionRequest.phone}
- نوع الباقة: ${subscriptionRequest.plan}
- طريقة الدفع: ${subscriptionRequest.method}
- المبلغ: ${subscriptionRequest.amount} ريال
- تاريخ الطلب: ${new Date(subscriptionRequest.requestedAt).toLocaleString('ar-SA')}

🔗 للمراجعة والموافقة:
${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/subscription-requests

تحياتي،
نظام حماية واتساب
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
      <h2 style="color: #2563eb;">🔔 طلب اشتراك جديد</h2>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>📋 تفاصيل الطلب:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>الاسم:</strong> ${subscriptionRequest.name}</li>
          <li><strong>رقم الجوال:</strong> ${subscriptionRequest.phone}</li>
          <li><strong>نوع الباقة:</strong> ${subscriptionRequest.plan}</li>
          <li><strong>طريقة الدفع:</strong> ${subscriptionRequest.method}</li>
          <li><strong>المبلغ:</strong> ${subscriptionRequest.amount} ريال</li>
          <li><strong>تاريخ الطلب:</strong> ${new Date(subscriptionRequest.requestedAt).toLocaleString('ar-SA')}</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/subscription-requests" 
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          🔗 مراجعة الطلب
        </a>
      </div>
      
      <hr style="margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px;">
        تحياتي،<br>
        نظام حماية واتساب
      </p>
    </div>
  `;

  return await sendEmail(adminEmail, subject, text, html);
}

/**
 * إرسال إشعار للمستخدم عند الموافقة على الاشتراك
 * @param {Object} user - بيانات المستخدم
 * @param {Object} subscription - بيانات الاشتراك
 */
async function notifyUserSubscriptionApproved(user, subscription) {
  const subject = '🎉 تم قبول طلب اشتراكك!';
  
  const text = `
مرحباً ${user.name},

🎉 نبارك لك! تم قبول طلب اشتراكك بنجاح.

📋 تفاصيل اشتراكك:
- نوع الباقة: ${subscription.plan}
- تاريخ البداية: ${new Date(subscription.startedAt).toLocaleDateString('ar-SA')}
- تاريخ الانتهاء: ${new Date(subscription.expiresAt).toLocaleDateString('ar-SA')}

🔗 يمكنك الآن تسجيل الدخول وبدء استخدام النظام:
${process.env.FRONTEND_URL || 'http://localhost:5173'}/login

💡 نصائح للبداية:
1. قم بربط حساب واتساب الخاص بك
2. أضف القروبات التي تريد حمايتها
3. اضبط الكلمات المحظورة
4. فعّل الحماية للقروبات

إذا كان لديك أي استفسار، لا تتردد في التواصل معنا.

تحياتي،
فريق نظام حماية واتساب
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
      <h2 style="color: #16a34a;">🎉 مبروك! تم قبول اشتراكك</h2>
      
      <p>مرحباً <strong>${user.name}</strong>,</p>
      
      <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #16a34a;">
        <h3>📋 تفاصيل اشتراكك:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>نوع الباقة:</strong> ${subscription.plan}</li>
          <li><strong>تاريخ البداية:</strong> ${new Date(subscription.startedAt).toLocaleDateString('ar-SA')}</li>
          <li><strong>تاريخ الانتهاء:</strong> ${new Date(subscription.expiresAt).toLocaleDateString('ar-SA')}</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" 
           style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          🚀 ابدأ الآن
        </a>
      </div>
      
      <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4>💡 نصائح للبداية:</h4>
        <ol>
          <li>قم بربط حساب واتساب الخاص بك</li>
          <li>أضف القروبات التي تريد حمايتها</li>
          <li>اضبط الكلمات المحظورة</li>
          <li>فعّل الحماية للقروبات</li>
        </ol>
      </div>
      
      <hr style="margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px;">
        تحياتي،<br>
        فريق نظام حماية واتساب
      </p>
    </div>
  `;

  return await sendEmail(user.email, subject, text, html);
}

/**
 * إرسال إشعار للمستخدم عند رفض الاشتراك
 * @param {Object} user - بيانات المستخدم
 * @param {string} reason - سبب الرفض
 */
async function notifyUserSubscriptionRejected(user, reason = '') {
  const subject = '❌ تم رفض طلب اشتراكك';
  
  const text = `
مرحباً ${user.name},

نأسف لإبلاغك أنه تم رفض طلب اشتراكك.

${reason ? `السبب: ${reason}` : ''}

يمكنك تقديم طلب جديد مع التأكد من:
- صحة بيانات الدفع
- وضوح إيصال الدفع
- اختيار الباقة المناسبة

للاستفسار أو المساعدة، يرجى التواصل معنا.

تحياتي،
فريق نظام حماية واتساب
  `;

  return await sendEmail(user.email, subject, text);
}

module.exports = {
  sendEmail,
  notifyAdminNewSubscription,
  notifyUserSubscriptionApproved,
  notifyUserSubscriptionRejected
};
