const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    plaintextContent: { type: String, default: null },
    encryptedContent: { type: String, default: null },
    fileUrl: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, index: { expires: '10d' } },
    isRead: { type: Boolean, default: false }, // New field to track read status
});

module.exports = mongoose.model('Message', messageSchema);