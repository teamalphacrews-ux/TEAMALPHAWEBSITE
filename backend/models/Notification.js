const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    eventKey: { type: String, unique: true, sparse: true, select: false },
    description: { type: String },
    type: { type: String, enum: ['Lead', 'Event', 'Task', 'Finance', 'System', 'Gallery', 'Chat', 'Invoice', 'Message'], default: 'System' },
    isRead: { type: Boolean, default: false },
    readBy: [{ type: mongoose.Schema.Types.ObjectId }],
    hiddenBy: [{ type: mongoose.Schema.Types.ObjectId }],
    link: { type: String },
    createdAt: { type: Date, default: Date.now }
});

NotificationSchema.pre('save',function(){this.$locals.pushCreated=this.isNew;});
NotificationSchema.post('save',function(doc){if(this.$locals.pushCreated)void require('../services/studioPush').deliverNotification(doc).catch(()=>{});});
module.exports = mongoose.model('Notification', NotificationSchema);
