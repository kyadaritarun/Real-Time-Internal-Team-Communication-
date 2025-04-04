import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import axios from "axios";
import forge from "node-forge";
import { UserIcon, UsersIcon, PhoneIcon, BellIcon, CogIcon, PaperClipIcon, AdjustmentsHorizontalIcon, PhoneXMarkIcon } from "@heroicons/react/24/outline";
import GroupManagement from "./GroupManagement";
import CallHandler from "./CallHandler";
import Settings from "./Settings";
import logo from "./assets/logo.png";
import { motion } from "framer-motion";

// Notification sound (ensure Notification.mp3 is in public/)
const notificationSound = new Audio('/Notification.mp3');

const safeRender = (value, fallback = "Unknown") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.name) return value.name;
  return JSON.stringify(value);
};

const Message = ({ token, privateKey }) => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatType, setChatType] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [lastMessageTimes, setLastMessageTimes] = useState([]);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showOnlyGroups, setShowOnlyGroups] = useState(false);
  const [showOnlyContacts, setShowOnlyContacts] = useState(false);
  const [showOnlyNotifications, setShowOnlyNotifications] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false); // Track notification permission
  const socket = useRef(null);
  const fileInputRef = useRef(null);

  const defaultBackground = "";
  const fallbackBackground = "";
  const defaultAvatar = "https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg?semt=ais_hybrid";

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setHasNotificationPermission(permission === "granted");
        if (permission === "granted") {
          console.log("Notification permission granted");
        } else {
          console.log("Notification permission denied");
        }
      }).catch((err) => {
        console.error("Error requesting notification permission:", err);
      });
    } else {
      console.warn("Notifications not supported in this browser");
    }
  }, []);

  const decryptMessage = (encryptedContent, plaintextContent, isPrivate, senderId, currentUserId) => {
    if (!isPrivate || senderId === currentUserId) return safeRender(plaintextContent);
    if (!privateKey || !encryptedContent) return safeRender(encryptedContent || plaintextContent);
    try {
      const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);
      const encryptedBytes = forge.util.decode64(encryptedContent);
      const decrypted = privateKeyObj.decrypt(encryptedBytes, "RSA-OAEP");
      return forge.util.decodeUtf8(decrypted);
    } catch (error) {
      console.error("Decryption error:", error.message);
      return "[Decryption Failed]";
    }
  };

  const canSendInGroup = (groupId) => {
    const group = groups.find((g) => g._id === groupId);
    if (!group) return false;
    const creatorId = safeRender(group.creator?._id || group.creator);
    if (creatorId === currentUserId) return true;
    const member = group.members.find((m) => safeRender(m.userId?._id || m.userId) === currentUserId);
    return member?.canSendMessages === true;
  };

  const canCallInGroup = (groupId) => {
    const group = groups.find((g) => g._id === groupId);
    if (!group) return false;
    const creatorId = safeRender(group.creator?._id || group.creator);
    if (creatorId === currentUserId) return true;
    const member = group.members.find((m) => safeRender(m.userId?._id || m.userId) === currentUserId);
    return member?.canCall === true;
  };

  const showPermissionDeniedNotification = (action) => {
    setNotifications((prev) => [
      { id: Date.now(), text: `Permission denied: You cannot ${action}`, read: false, senderName: "System" },
      ...prev,
    ]);
  };

  const showUserProfile = async (userId) => {
    try {
      const response = await axios.get(`https://hyperchat-t.onrender.com/api/users/${userId}`, { headers: { Authorization: token } });
      setSelectedUser(response.data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const closeProfile = () => setSelectedUser(null);

  const isGroupAdmin = (groupId) => {
    const group = groups.find((g) => g._id === groupId);
    return group && safeRender(group.creator?._id || group.creator) === currentUserId;
  };

  const startGroupCall = () => {
    if (!socket.current || !selectedChat || chatType !== "group") return;
    if (!canCallInGroup(selectedChat)) {
      showPermissionDeniedNotification("start calls in this group");
      return;
    }
    console.log("Starting group call for:", selectedChat);
    socket.current.emit("startGroupCall", { groupId: selectedChat, callerId: currentUserId });
  };

  const acceptCall = (groupId, notificationId) => {
    if (!socket.current) return;
    socket.current.emit("acceptGroupCall", { groupId, userId: currentUserId });
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const rejectCall = (groupId, notificationId) => {
    if (!socket.current) return;
    socket.current.emit("rejectGroupCall", { groupId, userId: currentUserId });
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const toggleSettings = () => setShowSettings((prev) => !prev);

  useEffect(() => {
    if (!token || socket.current) return;

    socket.current = io("https://hyperchat-t.onrender.com", { auth: { token }, forceNew: true });

    socket.current.on("connect", () => console.log("Connected:", socket.current.id));

    socket.current.on("userId", (userId) => {
      setCurrentUserId(userId);
      socket.current.userId = userId;
      console.log("Current user ID set:", userId);
    });

    socket.current.on("userUpdated", (updatedUser) => {
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user._id === updatedUser._id ? { ...user, ...updatedUser } : user))
      );
      if (updatedUser._id === currentUserId) {
        setCurrentUser(updatedUser);
      }
    });

    socket.current.on("groupUpdated", (updatedGroup) => {
      setGroups((prevGroups) =>
        prevGroups.map((group) => (group._id === updatedGroup._id ? { ...group, ...updatedGroup } : group))
      );
    });

    socket.current.on("chatMessage", (msg) => {
      const isPrivate = !!msg.recipient;
      const content = msg.file
        ? { type: "file", ...msg.file }
        : decryptMessage(msg.encryptedContent, msg.content, isPrivate, safeRender(msg.sender?._id || msg.sender), socket.current.userId);

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.tempId !== msg.tempId && m._id !== msg._id);
        return [...filtered, { ...msg, content }];
      });

      if (isPrivate && !msg.file && safeRender(msg.sender?._id || msg.sender) !== currentUserId) {
        setLastMessageTimes((prev) => {
          const updated = prev.filter((lm) => lm.userId !== safeRender(msg.sender?._id || msg.sender));
          return [...updated, { userId: safeRender(msg.sender?._id || msg.sender), lastMessageTime: msg.timestamp }];
        });
      }
    });

    // Updated newMessageNotification handler with permission-based sound
    socket.current.on("newMessageNotification", ({ senderId, messageId, timestamp }) => {
      console.log(`New message notification: Sender=${senderId}, Message=${messageId}, Time=${timestamp}`);
      if (selectedChat !== senderId) {
        setUnreadMessages((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1,
        }));
        if (hasNotificationPermission) {
          notificationSound.play()
            .then(() => console.log("Notification sound played successfully"))
            .catch((err) => console.error("Sound play error:", err));
          new Notification("New Message", {
            body: `You have a new message from ${safeRender(users.find((u) => u._id === senderId)?.name, "Someone")}`,
            icon: {logo}, // Optional: Add an icon for the notification
          });
        } else {
          console.log("Notification sound skipped: Permission not granted");
        }
      }
    });

    socket.current.on("startGroupCall", ({ groupId, callerId }) => {
      if (callerId !== currentUserId) {
        const caller = users.find((u) => u._id === callerId);
        const senderName = safeRender(caller?.name, "Someone");
        setNotifications((prev) => [
          { id: Date.now(), text: `@${senderName} is calling you`, read: false, senderName, groupId, isCall: true },
          ...prev,
        ]);
        if (hasNotificationPermission) {
          notificationSound.play().catch((err) => console.error("Sound play error:", err));
        }
      }
    });

    socket.current.on("callRejected", ({ groupId, userId }) => {
      if (userId !== currentUserId) {
        const rejector = users.find((u) => u._id === userId);
        const rejectorName = safeRender(rejector?.name, "Someone");
        setNotifications((prev) => [
          { id: Date.now(), text: `@${rejectorName} rejected the call`, read: false, senderName: rejectorName },
          ...prev,
        ]);
      }
    });

    socket.current.on("error", (error) => console.error("Socket error:", error.message));

    Promise.all([
      axios.get("https://hyperchat-t.onrender.com/api/users", { headers: { Authorization: token } }),
      axios.get("https://hyperchat-t.onrender.com/api/groups", { headers: { Authorization: token } }),
      axios.get("https://hyperchat-t.onrender.com/api/messages/last-messages", { headers: { Authorization: token } }),
      axios.get(`https://hyperchat-t.onrender.com/api/users/${socket.current?.userId || currentUserId}`, { headers: { Authorization: token } }),
    ])
      .then(([usersRes, groupsRes, lastMessagesRes, currentUserRes]) => {
        setUsers(usersRes.data);
        setGroups(groupsRes.data);
        setCurrentUser(currentUserRes.data);
        const formattedTimes = lastMessagesRes.data.map((msg) => ({
          userId: msg.userId.toString(),
          lastMessageTime: msg.lastMessageTime,
        }));
        setLastMessageTimes(formattedTimes);

        if (socket.current && socket.current.userId) {
          groupsRes.data.forEach((group) => {
            socket.current.emit("joinGroup", group._id);
            console.log(`User ${socket.current.userId} joined group ${group._id}`);
          });
        }
      })
      .catch((err) => console.error("Error fetching initial data:", err));

    return () => {
      if (socket.current) {
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, [token, privateKey, currentUserId, hasNotificationPermission]);

  useEffect(() => {
    if (token && selectedChat && currentUserId) {
      const fetchMessages = async () => {
        try {
          const url =
            chatType === "user"
              ? `https://hyperchat-t.onrender.com/api/messages/private/${selectedChat}`
              : `https://hyperchat-t.onrender.com/api/messages/group/${selectedChat}`;
          const res = await axios.get(url, { headers: { Authorization: token } });
          const processedMessages = res.data.map((msg) => ({
            ...msg,
            content: msg.file
              ? { type: "file", ...msg.file }
              : decryptMessage(msg.encryptedContent, msg.content, !!msg.recipient, safeRender(msg.sender?._id || msg.sender), currentUserId),
          }));
          setMessages(processedMessages);
          setUnreadMessages((prev) => {
            const updated = { ...prev };
            delete updated[selectedChat];
            return updated;
          });
        } catch (error) {
          console.error("Error fetching messages:", error);
        }
      };
      fetchMessages();
    }
  }, [selectedChat, chatType, token, privateKey, currentUserId]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setMessage(`Uploading: ${file.name}`);
    }
  };

  const sendMessage = async () => {
    if (!socket.current || (!message.trim() && !selectedFile)) return;

    if (chatType === "group" && !canSendInGroup(selectedChat)) {
      showPermissionDeniedNotification("send messages in this group");
      return;
    }

    const tempId = Date.now().toString();
    let newMessage;

    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (chatType === "user") formData.append("recipient", selectedChat);
      if (chatType === "group") formData.append("group", selectedChat);
      formData.append("tempId", tempId);

      try {
        const response = await axios.post("https://hyperchat-t.onrender.com/api/upload", formData, {
          headers: { Authorization: token, "Content-Type": "multipart/form-data" },
        });
        newMessage = {
          sender: { _id: currentUserId, name: "You" },
          content: { type: "file", ...response.data },
          recipient: chatType === "user" ? selectedChat : null,
          group: chatType === "group" ? selectedChat : null,
          tempId,
          timestamp: new Date(),
        };
        socket.current.emit("chatMessage", {
          recipient: chatType === "user" ? selectedChat : null,
          group: chatType === "group" ? selectedChat : null,
          file: response.data,
          tempId,
        });
      } catch (error) {
        console.error("File upload failed:", error);
        return;
      }
    } else {
      newMessage = {
        sender: { _id: currentUserId, name: "You" },
        content: message,
        recipient: chatType === "user" ? selectedChat : null,
        group: chatType === "group" ? selectedChat : null,
        tempId,
        timestamp: new Date(),
      };
      socket.current.emit("chatMessage", {
        recipient: chatType === "user" ? selectedChat : null,
        group: chatType === "group" ? selectedChat : null,
        content: message,
        tempId,
      });
    }

    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const markNotificationAsRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setShowOnlyNotifications(false);
  };

  const renderMessageContent = (msg) => {
    if (!msg || !msg.content) return <div>[Invalid Message]</div>;
    if (msg.content.type === "file") {
      const { name, url, size, mimeType } = msg.content;
      const isImage = mimeType?.startsWith("image/");
      return (
        <div className="flex flex-col">
          {isImage ? (
            <img src={url} alt={name} className="max-w-[200px] rounded-lg" />
          ) : (
            <a href={url} download={name} className="text-blue-500 hover:underline">
              📎 {name} ({(size / 1024).toFixed(2)} KB)
            </a>
          )}
        </div>
      );
    }
    return <p>{safeRender(msg.content)}</p>;
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="h-screen bg-gray-50 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-4/4 sm:w-1/2 md:w-1/4 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-4 sm:p-4 bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-between sticky top-0 z-10">
          {currentUser ? (
            <div className="flex items-center space-x-3">
              <img
                src={currentUser.image ? `https://hyperchat-t.onrender.com/uploads/${currentUser.image}` : defaultAvatar}
                alt={`${safeRender(currentUser.name)} avatar`}
                className="w-13 h-13 rounded-full object-cover cursor-pointer"
                onClick={() => showUserProfile(currentUserId)}
              />
              <div className="flex-1">
                <p className="text-white font-medium text-lg">{safeRender(currentUser.name)}</p>
                <p className="text-xs text-gray-200">Online</p>
              </div>
            </div>
          ) : (
            <p className="text-white text-sm">Loading...</p>
          )}
          <div className="flex items-center space-x-2">
            <button onClick={toggleSettings} className="text-white hover:text-gray-200 focus:outline-none" title="Settings">
              <AdjustmentsHorizontalIcon className="h-6 w-6" />
            </button>
            <button className="text-white md:hidden" onClick={() => setIsSidebarOpen(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-row justify-between overflow-x-auto bg-white border-b border-gray-200 px-4 py-2 sticky top-[72px] sm:top-[84px] z-10">
          <button
            className="flex flex-col items-center text-gray-700 font-semibold hover:text-blue-600"
            onClick={() => {
              setShowOnlyGroups(false);
              setShowOnlyContacts(false);
              setShowOnlyNotifications(false);
            }}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-xs">All</span>
          </button>
          <button
            className="flex flex-col items-center text-gray-700 font-semibold hover:text-blue-600"
            onClick={() => {
              setShowOnlyGroups(true);
              setShowOnlyContacts(false);
              setShowOnlyNotifications(false);
            }}
          >
            <UsersIcon className="w-6 h-5" />
            <span className="text-xs">Groups</span>
          </button>
          <button
            className="flex flex-col items-center text-gray-700 font-semibold hover:text-blue-600"
            onClick={() => {
              setShowOnlyContacts(true);
              setShowOnlyGroups(false);
              setShowOnlyNotifications(false);
            }}
          >
            <PhoneIcon className="w-6 h-5" />
            <span className="text-xs">Contacts</span>
          </button>
          <button
            className="relative flex flex-col items-center text-gray-700 font-semibold hover:text-blue-600"
            onClick={() => {
              setShowOnlyNotifications(true);
              setShowOnlyGroups(false);
              setShowOnlyContacts(false);
            }}
          >
            <BellIcon className="w-6 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
            <span className="text-xs">Notifications</span>
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-144px)] sm:h-[calc(100vh-168px)]">
          {showOnlyNotifications ? (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Notifications</h3>
                <button onClick={clearAllNotifications} className="text-sm text-red-500 hover:text-red-700">Clear All</button>
              </div>
              {notifications.length === 0 ? (
                <p className="text-gray-500 text-sm">No notifications</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 mb-2 rounded-lg shadow-sm ${notification.read ? "bg-gray-100" : "bg-white"}`}
                  >
                    <p className={notification.read ? "text-gray-600" : "text-gray-800 font-medium"}>{notification.text}</p>
                    <p className="text-xs text-gray-500 mt-1">{notification.senderName}</p>
                    {!notification.read && notification.isCall ? (
                      <div className="flex space-x-2 mt-2">
                        <button
                          onClick={() => acceptCall(notification.groupId, notification.id)}
                          className="text-green-500 hover:text-green-700"
                          title="Accept Call"
                        >
                          <PhoneIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => rejectCall(notification.groupId, notification.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Reject Call"
                        >
                          <PhoneXMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : !notification.read && !notification.isCall ? (
                      <button
                        onClick={() => markNotificationAsRead(notification.id)}
                        className="text-blue-500 hover:text-blue-700 text-xs mt-1"
                      >
                        Mark as Read
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : (
            <GroupManagement
              token={token}
              users={users}
              groups={groups}
              setGroups={setGroups}
              setSelectedChat={setSelectedChat}
              setChatType={setChatType}
              currentUserId={currentUserId}
              showUserProfile={showUserProfile}
              showOnlyGroups={showOnlyGroups}
              setShowOnlyGroups={setShowOnlyGroups}
              showOnlyContacts={showOnlyContacts}
              setShowOnlyContacts={setShowOnlyContacts}
              lastMessageTimes={lastMessageTimes}
              socket={socket}
              unreadMessages={unreadMessages}
            />
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen">
        <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-between h-16 sm:h-20 shrink-0">
          <div className="flex items-center">
            <button className="text-white mr-4 md:hidden" onClick={() => setIsSidebarOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
            <div className="flex items-center">
              {selectedChat && chatType === "user" && (
                <img
                  src={
                    users.find((u) => u._id === selectedChat)?.image
                      ? `https://hyperchat-t.onrender.com/uploads/${users.find((u) => u._id === selectedChat).image}`
                      : "https://static.vecteezy.com/system/resources/previews/005/544/718/non_2x/profile-icon-design-free-vector.jpg"
                  }
                  alt="Chat user avatar"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full mr-2 sm:mr-3 object-cover"
                  onError={(e) => {
                    e.target.src = "https://static.vecteezy.com/system/resources/previews/005/544/718/non_2x/profile-icon-design-free-vector.jpg";
                  }}
                />
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {selectedChat
                  ? chatType === "user"
                    ? safeRender(users.find((u) => u._id === selectedChat)?.name)
                    : safeRender(groups.find((g) => g._id === selectedChat)?.name)
                  : "Select a Chat"}
              </h1>
            </div>
          </div>
          {selectedChat && (
            <div className="flex items-center space-x-4">
              {chatType === "group" && (
                <button
                  onClick={startGroupCall}
                  className={`text-white hover:text-gray-200 ${!canCallInGroup(selectedChat) ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={!canCallInGroup(selectedChat)}
                  title={!canCallInGroup(selectedChat) ? "You don't have permission to call" : "Start group call"}
                >
                  <PhoneIcon className="h-6 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 relative h-[calc(100vh-136px)] sm:h-[calc(100vh-152px)]"
          style={{
            backgroundImage: `url(${defaultBackground}), url(${fallbackBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundAttachment: "fixed",
          }}
          onError={(e) => {
            console.error("Primary background image failed to load, using fallback.");
            e.target.style.backgroundImage = `url(${fallbackBackground})`;
          }}
        >
          <div className="absolute inset-0 opacity-20"></div>
          <div className="relative z-10">
            {selectedChat ? (
              messages
                .filter((msg) =>
                  chatType === "user"
                    ? (msg.recipient === selectedChat && msg.sender._id === currentUserId) || (msg.recipient === currentUserId && msg.sender._id === selectedChat)
                    : msg.group === selectedChat
                )
                .map((msg, index) => {
                  const senderName = chatType === "group" ? safeRender(users.find((u) => u._id === msg.sender._id)?.name, "Unknown") : null;
                  return (
                    <div
                      key={msg._id || msg.tempId || `msg-${index}`}
                      className={`flex mb-4 ${msg.sender._id === currentUserId ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex flex-col ${msg.sender._id === currentUserId ? "items-end" : "items-start"} max-w-[80%] sm:max-w-[60%]`}
                      >
                        {senderName && chatType === "group" && (
                          <p className={`text-xs font-semibold mb-1 ${msg.sender._id === currentUserId ? "text-blue-600" : "text-gray-600"}`}>
                            {senderName}
                          </p>
                        )}
                        <div
                          className={`p-3 rounded-lg shadow bg-opacity-90 ${msg.sender._id === currentUserId ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white" : "bg-white text-gray-800"}`}
                        >
                          {renderMessageContent(msg)}
                          <p className={`text-xs mt-1 ${msg.sender._id === currentUserId ? "text-white opacity-80" : "text-gray-500"}`}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm sm:text-base">
                <motion.img
                  src={logo}
                  alt="Select a chat"
                  className="w-32 h-32 sm:w-70 sm:h-75 mt-10"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />
                <p>"We Don’t Just Promise, We Deliver!"</p>
              </div>
            )}
          </div>
        </div>

        {selectedChat && (
          <div className="p-2 bg-white border-t border-gray-200 h-14 sm:h-14 shrink-0">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={chatType === "group" && !canSendInGroup(selectedChat)}
                />
                <label
                  className={`flex items-center justify-center p-1 sm:p-2 rounded-lg border border-gray-300 cursor-pointer ${chatType === "group" && !canSendInGroup(selectedChat) ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"}`}
                >
                  <PaperClipIcon className="h-5 w-5 text-gray-500" />
                </label>
              </div>
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 p-1 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
                disabled={selectedFile !== null || (chatType === "group" && !canSendInGroup(selectedChat))}
              />
              <button
                onClick={sendMessage}
                className={`bg-gradient-to-r from-blue-500 to-blue-600 text-white p-1 sm:p-2 rounded-lg hover:from-blue-600 hover:to-blue-700 flex justify-center ${chatType === "group" && !canSendInGroup(selectedChat) ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={chatType === "group" && !canSendInGroup(selectedChat)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 8-16 8 4-8-4-8z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <CallHandler
        socket={socket}
        token={token}
        users={users}
        groups={groups}
        selectedChat={selectedChat}
        setSelectedChat={setSelectedChat}
        chatType={chatType}
        setChatType={setChatType}
        setNotifications={setNotifications}
      />

      {selectedUser && (
        <div className="fixed inset-0 bg-opacity-30 backdrop-blur-sm flex justify-center items-center z-[100] p-2">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-center" style={{ color: "#8533ff" }}>User Profile</h3>
            {selectedUser.image && (
              <img
                src={`https://hyperchat-t.onrender.com/uploads/${selectedUser.image}`}
                alt={`${safeRender(selectedUser.name)}'s profile`}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mb-4 object-cover mx-auto"
              />
            )}
            <p className="text-sm sm:text-base"><strong>Name:</strong> {safeRender(selectedUser.name)}</p>
            <p className="text-sm sm:text-base"><strong>Email:</strong> {safeRender(selectedUser.email)}</p>
            <p className="text-sm sm:text-base"><strong>Location:</strong> {safeRender(selectedUser.location, "Not specified")}</p>
            <p className="text-sm sm:text-base"><strong>Designation:</strong> {safeRender(selectedUser.designation, "Not specified")}</p>
            <button onClick={closeProfile} className="mt-4 w-full bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 text-sm sm:text-base">Close</button>
          </div>
        </div>
      )}

      {showSettings && <Settings token={token} isOpen={showSettings} onClose={toggleSettings} />}
    </div>
  );
};

export default Message;