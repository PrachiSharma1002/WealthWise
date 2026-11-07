const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // Which user this notification belongs to
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // A unique name for the situation, like "budget:<category>:2026-11:80".
    // It stops the same alert from being created twice.
    key: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['budget', 'goal', 'bill'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'danger'],
      default: 'info',
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    // Which page the notification points to
    link: {
      type: String,
      default: '',
    },
    read: {
      type: Boolean,
      default: false,
    },
    // "Deleted" notifications are only hidden. The record stays, so the same
    // alert is not created again by the next check.
    dismissed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One notification per situation for each user
notificationSchema.index({ user: 1, key: 1 }, { unique: true });
// Fast lookups for the list
notificationSchema.index({ user: 1, dismissed: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);