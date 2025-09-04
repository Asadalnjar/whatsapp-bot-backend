const Group = require("../models/Group");
const Billing = require("../models/Billing");
const Broadcast = require("../models/Broadcast");

const getUserDashboardStats = async (req, res) => {
  try {
    const userGroups = await Group.countDocuments({ user: req.user._id });
    const activeGroups = await Group.countDocuments({ user: req.user._id, isProtected: true });

    const latestBilling = await Billing.findOne({ user: req.user._id }).sort({ date: -1 });
    const latestNotifications = await Broadcast.find().sort({ sentAt: -1 }).limit(5);

    res.json({
      userGroups,
      activeGroups,
      latestBilling,
      latestNotifications
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = { getUserDashboardStats };
