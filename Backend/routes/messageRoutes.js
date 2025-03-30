const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const File = require('../models/File');
const Group = require('../models/Group');
const { authenticate } = require('../middleware/auth');
const mongoose = require('mongoose');

router.get('/messages/private/:userId', authenticate, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.userId, recipient: req.params.userId },
                { sender: req.params.userId, recipient: req.userId },
            ],
        }).populate('sender', 'name').lean();

        const files = await File.find({
            $or: [
                { sender: req.userId, recipient: req.params.userId },
                { sender: req.params.userId, recipient: req.userId },
            ],
        }).populate('sender', 'name').lean();

        const formattedMessages = messages.map(msg => ({
            ...msg,
            sender: { _id: msg.sender._id, name: msg.sender.name },
            content: msg.sender._id.toString() === req.userId.toString() ? msg.plaintextContent : msg.encryptedContent,
        }));

        const formattedFiles = files.map(file => ({
            sender: { _id: file.sender._id, name: file.sender.name },
            file: {
                name: file.originalName,
                url: `https://kyadari-tarun-internal-chatbox.onrender.com${file.path}`,
                size: file.size,
                mimeType: file.mimeType,
                _id: file._id
            },
            recipient: file.recipient,
            timestamp: file.createdAt
        }));

        // Mark messages as read when fetched
        await Message.updateMany(
            { recipient: req.userId, sender: req.params.userId, isRead: false },
            { $set: { isRead: true } }
        );

        res.json([...formattedMessages, ...formattedFiles].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    } catch (error) {
        console.error('Error fetching private messages:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/messages/group/:groupId', authenticate, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group || !group.members.some(m => m.userId.toString() === req.userId)) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }

        const messages = await Message.find({ group: req.params.groupId }).populate('sender', 'name').lean();
        const files = await File.find({ group: req.params.groupId }).populate('sender', 'name').lean();

        const formattedMessages = messages.map(msg => ({
            ...msg,
            sender: { _id: msg.sender._id, name: msg.sender.name },
            content: msg.plaintextContent,
        }));

        const formattedFiles = files.map(file => ({
            sender: { _id: file.sender._id, name: file.sender.name },
            file: {
                name: file.originalName,
                url: `https://kyadari-tarun-internal-chatbox.onrender.com${file.path}`,
                size: file.size,
                mimeType: file.mimeType,
                _id: file._id
            },
            group: file.group,
            timestamp: file.createdAt
        }));

        res.json([...formattedMessages, ...formattedFiles].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    } catch (error) {
        console.error('Error fetching group messages:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get("/messages/last-messages", authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        console.log("Fetching last messages received by userId:", userId);

        const lastMessages = await Message.aggregate([
            {
                $match: {
                    recipient: userId,
                    sender: { $ne: userId },
                    recipient: { $ne: null },
                    fileUrl: null
                }
            },
            {
                $group: {
                    _id: "$sender",
                    lastMessageTime: { $max: "$timestamp" }
                }
            },
            {
                $project: {
                    userId: "$_id",
                    lastMessageTime: 1,
                    _id: 0
                }
            }
        ]);

        console.log("Last messages received result:", lastMessages);
        res.json(lastMessages);
    } catch (error) {
        console.error("Error fetching last messages:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// New endpoint for unread message counts
router.get('/unread-counts', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const unreadCounts = await Message.aggregate([
            {
                $match: {
                    recipient: new mongoose.Types.ObjectId(userId),
                    isRead: false
                }
            },
            {
                $group: {
                    _id: "$sender",
                    count: { $sum: 1 }
                }
            }
        ]);

        const counts = {};
        unreadCounts.forEach(({ _id, count }) => {
            counts[_id.toString()] = count;
        });
        res.json(counts);
    } catch (error) {
        console.error('Error fetching unread counts:', error.message);
        res.status(500).json({ error: 'Failed to fetch unread counts' });
    }
});

module.exports = router;                                                        