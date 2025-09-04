// models/Broadcast.js
const mongoose = require("mongoose");

const broadcastSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const Broadcast = mongoose.model("Broadcast", broadcastSchema);
module.exports = Broadcast;
