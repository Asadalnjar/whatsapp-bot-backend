// services/sessionService.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserSession = require('../models/UserSession');
const UAParser = require('ua-parser-js');

class SessionService {
  constructor() {
    // بدء تنظيف الجلسات التلقائي
    UserSession.scheduleCleanup();
  }

  /**
   * إنشاء جلسة جديدة
   */
  async createSession(userId, req, refreshTokenExpiry = '7d') {
    try {
      // إنشاء معرف جلسة فريد
      const sessionId = crypto.randomBytes(32).toString('hex');
      
      // إنشاء refresh token
      const refreshToken = jwt.sign(
        { userId, sessionId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: refreshTokenExpiry }
      );

      // تحليل معلومات الجهاز
      const deviceInfo = this.parseDeviceInfo(req);
      
      // حساب تاريخ انتهاء الصلاحية
      const expiresAt = new Date();
      if (refreshTokenExpiry === '7d') {
        expiresAt.setDate(expiresAt.getDate() + 7);
      } else if (refreshTokenExpiry === '30d') {
        expiresAt.setDate(expiresAt.getDate() + 30);
      } else {
        expiresAt.setHours(expiresAt.getHours() + 24); // افتراضي 24 ساعة
      }

      // إنشاء الجلسة في قاعدة البيانات
      const session = new UserSession({
        userId,
        sessionId,
        refreshToken: this.hashToken(refreshToken),
        deviceInfo,
        expiresAt,
        isSecure: req.secure || req.headers['x-forwarded-proto'] === 'https'
      });

      await session.save();

      console.log(`✅ تم إنشاء جلسة جديدة للمستخدم ${userId}`);
      
      return {
        sessionId,
        refreshToken,
        expiresAt
      };
    } catch (error) {
      console.error('❌ خطأ في إنشاء الجلسة:', error);
      throw new Error('فشل في إنشاء الجلسة');
    }
  }

  /**
   * التحقق من صحة الجلسة
   */
  async validateSession(refreshToken) {
    try {
      // فك تشفير الـ token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // البحث عن الجلسة
      const session = await UserSession.findOne({
        sessionId: decoded.sessionId,
        userId: decoded.userId,
        status: 'active'
      }).populate('userId', 'name email phone role status');

      if (!session) {
        throw new Error('الجلسة غير موجودة');
      }

      // التحقق من انتهاء الصلاحية
      if (session.isExpired()) {
        await session.revoke('timeout');
        throw new Error('انتهت صلاحية الجلسة');
      }

      // التحقق من تطابق الـ token
      if (session.refreshToken !== this.hashToken(refreshToken)) {
        await session.markSuspicious();
        throw new Error('رمز الجلسة غير صحيح');
      }

      // تحديث آخر نشاط
      await session.updateActivity();

      return {
        session,
        user: session.userId
      };
    } catch (error) {
      console.error('❌ خطأ في التحقق من الجلسة:', error.message);
      throw error;
    }
  }

  /**
   * تحديث الجلسة
   */
  async updateSession(sessionId, req) {
    try {
      const session = await UserSession.findOne({
        sessionId,
        status: 'active'
      });

      if (session) {
        // تحديث معلومات الجهاز إذا تغيرت
        const newDeviceInfo = this.parseDeviceInfo(req);
        
        // فحص إذا كان هناك تغيير مشبوه في الجهاز
        if (this.isDeviceChanged(session.deviceInfo, newDeviceInfo)) {
          console.warn(`⚠️ تغيير مشبوه في الجهاز للجلسة ${sessionId}`);
          await session.markSuspicious();
        }

        session.deviceInfo = newDeviceInfo;
        await session.updateActivity();
      }
    } catch (error) {
      console.error('❌ خطأ في تحديث الجلسة:', error);
    }
  }

  /**
   * إبطال جلسة واحدة
   */
  async revokeSession(sessionId, reason = 'logout') {
    try {
      const session = await UserSession.findOne({ sessionId });
      if (session) {
        await session.revoke(reason);
        console.log(`✅ تم إبطال الجلسة ${sessionId} - السبب: ${reason}`);
      }
    } catch (error) {
      console.error('❌ خطأ في إبطال الجلسة:', error);
    }
  }

  /**
   * إبطال جميع جلسات المستخدم
   */
  async revokeAllUserSessions(userId, reason = 'security', excludeSessionId = null) {
    try {
      const query = { userId, status: 'active' };
      if (excludeSessionId) {
        query.sessionId = { $ne: excludeSessionId };
      }

      const result = await UserSession.updateMany(query, {
        status: 'revoked',
        revokedReason: reason,
        revokedAt: new Date()
      });

      console.log(`✅ تم إبطال ${result.modifiedCount} جلسة للمستخدم ${userId}`);
      return result.modifiedCount;
    } catch (error) {
      console.error('❌ خطأ في إبطال جلسات المستخدم:', error);
      throw error;
    }
  }

  /**
   * الحصول على الجلسات النشطة للمستخدم
   */
  async getUserActiveSessions(userId) {
    try {
      return await UserSession.findActiveByUser(userId);
    } catch (error) {
      console.error('❌ خطأ في جلب الجلسات النشطة:', error);
      return [];
    }
  }

  /**
   * تحليل معلومات الجهاز
   */
  parseDeviceInfo(req) {
    const parser = new UAParser(req.headers['user-agent']);
    const result = parser.getResult();
    
    return {
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip || req.connection.remoteAddress || '',
      browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
      os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
      device: result.device.type || 'desktop'
    };
  }

  /**
   * فحص تغيير الجهاز
   */
  isDeviceChanged(oldDevice, newDevice) {
    return (
      oldDevice.browser !== newDevice.browser ||
      oldDevice.os !== newDevice.os ||
      oldDevice.ip !== newDevice.ip
    );
  }

  /**
   * تشفير الـ token
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * تنظيف الجلسات المنتهية الصلاحية
   */
  async cleanupExpiredSessions() {
    try {
      const result = await UserSession.cleanupExpired();
      console.log(`🧹 تم حذف ${result.deletedCount} جلسة منتهية الصلاحية`);
      return result.deletedCount;
    } catch (error) {
      console.error('❌ خطأ في تنظيف الجلسات:', error);
      return 0;
    }
  }

  /**
   * إحصائيات الجلسات
   */
  async getSessionStats() {
    try {
      const stats = await UserSession.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalActive = await UserSession.countDocuments({
        status: 'active',
        expiresAt: { $gt: new Date() }
      });

      return {
        byStatus: stats,
        totalActive,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ خطأ في جلب إحصائيات الجلسات:', error);
      return null;
    }
  }
}

module.exports = new SessionService();
