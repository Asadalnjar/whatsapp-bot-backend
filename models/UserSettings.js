// models/UserSettings.js
const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    bannedWords: {
      type: [String],
      default: []
    },
    autoKick: {
      type: Boolean,
      default: true
    },
    autoReply: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);
module.exports = UserSettings;
