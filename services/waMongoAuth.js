// services/waMongoAuth.js
// =======================
// تخزين حالة اعتماد Baileys في Mongo عبر موديل WaSession
// - revive للقيم الثنائية عند القراءة (BufferJSON.reviver)
// - sanitize (BufferJSON.replacer) عند الكتابة
// - resetMongoDBAuthState لمسح الاعتماد الفاسد أو بدء جلسة جديدة

const WaSession = require("../models/WaSession");
const { initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys");

// يحوّل الكائن إلى JSON جاهز للتخزين مع استبدال الـBuffer بأنماط قابلة للتسلسل
function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj, BufferJSON.replacer));
}

// يعيد إحياء الكائن القادم من Mongo إلى هياكل Baileys (Buffers...الخ)
function revive(obj) {
  if (!obj) return obj;
  // نعيد تشكيله عبر stringify/parse مع reviver لتحويل الـBuffer markers إلى Buffers
  return JSON.parse(JSON.stringify(obj), BufferJSON.reviver);
}

/**
 * يرجع state/saveCreds متوافقين مع Baileys، مع تخزين المفاتيح في وثيقة واحدة للمستخدم.
 * @param {string|number} userId
 * @returns {{ state: any, saveCreds: () => Promise<void> }}
 */
async function useMongoDBAuthState(userId) {
  const uid = String(userId);

  // ابحث/أنشئ الوثيقة
  let doc = await WaSession.findOne({ user: uid });
  if (!doc) doc = await WaSession.create({ user: uid });

  // حمّل الحالة من DB مع revive للقيم الثنائية
  let creds = revive(doc.auth?.creds) || initAuthCreds();
  let keys = revive(doc.auth?.keys) || {};

  const state = {
    creds,
    keys: {
      /**
       * get(type, ids) -> يعيد كائن مفاتيح حسب النوع والمعرّفات المطلوبة
       * Baileys يتوقع undefined/null لما لا يتوفر مفتاح
       */
      get: async (type, ids) => {
        const out = {};
        for (const id of ids) {
          out[id] = keys?.[type]?.[id] || null;
        }
        return out;
      },

      /**
       * set(data) -> يدمج مفاتيح جديدة/محدّثة في المخزن ويحفظها في Mongo
       */
      set: async (data) => {
        for (const type of Object.keys(data)) {
          keys[type] = keys[type] || {};
          Object.assign(keys[type], data[type]);
        }

        // خزّن creds/keys بعد sanitize
        await WaSession.updateOne(
          { _id: doc._id },
          {
            $set: {
              "auth.creds": sanitize(creds),
              "auth.keys": sanitize(keys),
            },
          }
        );
      },
    },
  };

  /**
   * حفظ الاعتماد (creds) فقط — تستدعى من Baileys عند "creds.update"
   */
  const saveCreds = async () => {
    await WaSession.updateOne(
      { _id: doc._id },
      { $set: { "auth.creds": sanitize(creds) } }
    );
  };

  return { state, saveCreds };
}

/**
 * إعادة تهيئة كاملة لحالة الاعتماد للمستخدم:
 * - تمسح الحقول auth.* أو تعيد كتابتها بقيم ابتدائية
 * - تُستخدم عندما تبدو المفاتيح تالفة (noiseKey/signedIdentityKey... إلخ)
 * @param {string|number} userId
 */
async function resetMongoDBAuthState(userId) {
  const uid = String(userId);
  let doc = await WaSession.findOne({ user: uid });

  // لو لا توجد وثيقة أنشئها
  if (!doc) {
    doc = await WaSession.create({
      user: uid,
      auth: { creds: sanitize(initAuthCreds()), keys: {} },
    });
    return;
  }

  await WaSession.updateOne(
    { _id: doc._id },
    {
      $set: {
        "auth.creds": sanitize(initAuthCreds()),
        "auth.keys": {},
      },
    }
  );
}

/**
 * (اختياري) حذف وثيقة الجلسة بالكامل لهذا المستخدم
 * قد تحتاجه في أدوات إدارية أو تنظيف شامل
 * @param {string|number} userId
 */
async function deleteMongoDBAuthState(userId) {
  const uid = String(userId);
  await WaSession.deleteOne({ user: uid });
}

module.exports = {
  useMongoDBAuthState,
  resetMongoDBAuthState,
  deleteMongoDBAuthState, // اختياري
};
