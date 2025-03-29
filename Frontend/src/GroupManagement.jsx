  import React, { useState } from "react";
  import axios from "axios";
  import { FaPhone } from 'react-icons/fa';
  import { FaEnvelope } from "react-icons/fa";
  import groupsic from "./assets/group-icons.jpg";

  const safeRender = (value, fallback = "Unknown") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "object" && value.name) return value.name;
    return JSON.stringify(value);
  };

  const GroupManagement = ({
    token,
    users,
    groups,
    setGroups,
    setSelectedChat,
    setChatType,
    currentUserId,
    showUserProfile,
    showOnlyGroups,
    setShowOnlyGroups,
    showOnlyContacts,
    setShowOnlyContacts,
    lastMessageTimes,
    socket,
    unreadMessages,
  }) => {
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const defaultAvatar = "https://static.vecteezy.com/system/resources/previews/005/544/718/non_2x/profile-icon-design-free-vector.jpg";

    const currentUser = users.find((user) => user._id === currentUserId);

    const isGroupAdmin = (groupId) => groups.find((g) => g._id === groupId)?.creator?._id === currentUserId || groups.find((g) => g._id === groupId)?.creator === currentUserId;

    const handleCreateGroup = async () => {
      if (!groupName.trim() || selectedMembers.length === 0) return alert(!groupName.trim() ? "Please enter a group name." : "Please select at least one member.");
      try {
        const createResponse = await axios.post("https://kyadari-tarun-internal-chatbox.onrender.com/api/groups", { name: groupName }, { headers: { Authorization: `Bearer ${token}` } });
        const groupId = createResponse.data._id;
        await Promise.all(selectedMembers.filter((userId) => userId !== currentUserId).map((userId) => axios.put(`https://kyadari-tarun-internal-chatbox.onrender.com/api/groups/${groupId}/members`, { userId, canSendMessages: true, canCall: true }, { headers: { Authorization: `Bearer ${token}` } })));
        setGroups((prev) => [...prev, createResponse.data]);
        setGroupName(""); setSelectedMembers([]); setShowCreateGroup(false);
        console.log("Group created successfully:", createResponse.data);
      } catch (err) {
        alert(err.response?.data?.error || "Failed to create group.");
        console.error("Error creating group:", err.response?.data || err.message);
      }
    };

    const addMemberToGroup = async (groupId, userId) => {
      if (!userId || !groupId) return;
      const canSendMessages = window.confirm(`Allow ${safeRender(users.find((u) => u._id === userId)?.name, userId)} to send messages?`);
      const canCall = window.confirm(`Allow ${safeRender(users.find((u) => u._id === userId)?.name, userId)} to make calls?`);
      try { const response = await axios.put(`https://kyadari-tarun-internal-chatbox.onrender.com/api/groups/${groupId}/members`, { userId, canSendMessages, canCall }, { headers: { Authorization: `Bearer ${token}` } }); setGroups((prev) => prev.map((g) => (g._id === groupId ? response.data : g))); } catch (error) { console.error("Error adding member:", error); }
    };

    const updateGroupPermissions = async (groupId, userId, canSendMessages, canCall) => {
      if (!groupId || !userId) return;
      try { const response = await axios.put(`https://kyadari-tarun-internal-chatbox.onrender.com/api/groups/${groupId}/permissions`, { userId, canSendMessages, canCall }, { headers: { Authorization: `Bearer ${token}` } }); setGroups((prev) => prev.map((g) => (g._id === groupId ? response.data : g))); } catch (error) { console.error("Error updating permissions:", error); }
    };

    const removeMemberFromGroup = async (groupId, userId) => {
      if (!window.confirm(`Remove ${safeRender(users.find((u) => u._id === userId)?.name, userId)} from the group?`)) return;
      try { const response = await axios.delete(`https://kyadari-tarun-internal-chatbox.onrender.com/api/groups/${groupId}/members/${userId}`, { headers: { Authorization: `Bearer ${token}` } }); setGroups((prev) => prev.map((g) => (g._id === groupId ? response.data : g))); } catch (error) { console.error("Error removing member:", error); }
    };

    const deleteGroup = async (groupId) => {
      if (!window.confirm("Delete this group? This cannot be undone.")) return;
      try { await axios.delete(`https://kyadari-tarun-internal-chatbox.onrender.com/api/groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` } }); setGroups((prev) => prev.filter((g) => g._id !== groupId)); setEditingGroupId(null); setSelectedChat(null); setChatType(null); } catch (error) { console.error("Error deleting group:", error); }
    };

    const toggleEditGroup = (groupId) => setEditingGroupId((prev) => (prev === groupId ? null : groupId));
    const getLastMessageTime = (userId) => lastMessageTimes.find((lm) => lm.userId === userId)?.lastMessageTime ? new Date(lastMessageTimes.find((lm) => lm.userId === userId).lastMessageTime).toLocaleTimeString() : "No messages yet";
    const filteredGroups = groups.filter((group) => safeRender(group.name).toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredUsers = users.filter((user) => user._id !== currentUserId && safeRender(user.name).toLowerCase().includes(searchQuery.toLowerCase()));

   return (
      <>
        <div className="flex flex-col h-full">
          <div className="p-2 border-b border-gray-200 flex items-center space-x-2">
            <input
              type="text"
              placeholder={showOnlyGroups ? "Search groups..." : showOnlyContacts ? "Search contacts..." : "Search..."}
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {!showOnlyGroups && !showOnlyContacts && (
              <button onClick={() => setShowCreateGroup(true)} className="p-2 text-blue-500 hover:text-blue-600" title="Create New Group">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            )}
          </div>
  
          <div className="overflow-y-auto flex-1 h-[calc(100vh-100px)]">
            {(showOnlyGroups || (!showOnlyGroups && !showOnlyContacts)) && filteredGroups.length > 0 && (
              <div className="p-2">
                <h2 className="text-xs font-semibold text-gray-500 px-2 mb-1">Groups</h2>
                {filteredGroups.map((group) => (
                  <div key={group._id} className="p-2 relative">
                    <div
                      className="flex items-center hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedChat(group._id);
                        setChatType("group");
                        setShowOnlyGroups(false);
                        setShowOnlyContacts(false);
                      }}
                    >
                      <img src={groupsic} alt={`${safeRender(group.name)} avatar`} className="w-8 h-8 rounded-full mr-2 object-cover" onClick={(e) => { e.stopPropagation(); if (isGroupAdmin(group._id) && !showOnlyGroups) toggleEditGroup(group._id); }} />
                      <div className="flex-1"><p className="text-gray-800 font-medium text-sm">{safeRender(group.name)}</p><p className="text-xs text-gray-500">{group.members.length} members</p></div>
                    </div>
                    {editingGroupId === group._id && isGroupAdmin(group._id) && !showOnlyGroups && (
                      <div className="fixed inset-0 bg-gray-500 bg-opacity-30 backdrop-blur-sm flex justify-center items-center z-[100] p-2">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img src={groupsic} alt={`${safeRender(group.name)} avatar`} className="w-10 h-10 rounded-full object-cover" />
                              <div><h3 className="text-lg font-bold text-gray-800">Group Name</h3><p className="text-xs text-gray-500">{safeRender(group.name)}</p></div>
                            </div>
                            <button onClick={() => setEditingGroupId(null)} className="p-1 hover:bg-gray-100 rounded-full"><svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                          <div className="p-4 max-h-[50vh] overflow-y-auto">
                            <div className="space-y-2 mb-4">
                              <h4 className="text-xs font-semibold text-gray-700 mb-1">Group Members</h4>
                              {group.members.map((member, index) => (
                                <div key={`${safeRender(member.userId?._id || member.userId)}-${index}`} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <span className="text-xs font-medium text-gray-700 truncate max-w-[40%]">{safeRender(users.find((u) => u._id === safeRender(member.userId?._id || member.userId))?.name, member.userId)}</span>
                                  <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={member.canSendMessages || false} onChange={(e) => updateGroupPermissions(group._id, safeRender(member.userId?._id || member.userId), e.target.checked, member.canCall || false)} disabled={safeRender(member.userId?._id || member.userId) === currentUserId} className="rounded text-blue-500 h-3 w-3" /><p><FaEnvelope /></p>
                                    <input type="checkbox" checked={member.canCall || false} onChange={(e) => updateGroupPermissions(group._id, safeRender(member.userId?._id || member.userId), member.canSendMessages || false, e.target.checked)} disabled={safeRender(member.userId?._id || member.userId) === currentUserId} className="rounded text-blue-500 h-3 w-3" /><p><FaPhone /></p>
                                    {safeRender(member.userId?._id || member.userId) !== currentUserId && <button onClick={() => removeMemberFromGroup(group._id, safeRender(member.userId?._id || member.userId))} className="p-1 hover:bg-red-100 rounded-full"><svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mb-4">
                              <h4 className="text-xs font-semibold text-gray-700 mb-1">Add Member</h4>
                              <select onChange={(e) => { if (e.target.value) { addMemberToGroup(group._id, e.target.value); e.target.value = ""; } }} className="w-full p-2 border border-gray-200 rounded-lg text-xs bg-gray-50" defaultValue=""><option value="">Select a user</option>{users.filter((u) => !group.members.some((m) => safeRender(m.userId?._id || m.userId) === u._id)).map((user) => (<option key={user._id} value={user._id}>{safeRender(user.name)}</option>))}</select>
                            </div>
                          </div>
                          <div className="p-4 border-t border-gray-100 flex justify-between">
                            <button onClick={() => deleteGroup(group._id)} className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M9 7v12m6-12v12" /></svg>Delete</button>
                            <button onClick={() => setEditingGroupId(null)} className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">Done</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(showOnlyContacts || (!showOnlyGroups && !showOnlyContacts)) && (
              <div className="p-2">
                <h2 className="text-xs font-semibold text-gray-500 px-2 mb-1">Direct Messages</h2>
                {filteredUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedChat(user._id);
                      setChatType("user");
                      setShowOnlyContacts(false);
                      setShowOnlyGroups(false);
                    }}
                  >
                    <div className="relative">
                      <img
                        src={user.image ? `https://kyadari-tarun-internal-chatbox.onrender.com/uploads/${user.image}` : defaultAvatar}
                        alt={`${safeRender(user.name)} avatar`}
                        className="w-8 h-8 rounded-full mr-2 object-cover"
                        onClick={(e) => { e.stopPropagation(); showUserProfile(user._id); }}
                      />
                      {unreadMessages[user._id] > 0 && (
                        <span className="absolute top-2 left-75 translate-x-2 w-2.5 h-2.5 bg-green-500 rounded-full"></span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium text-sm">{safeRender(user.name)}</p>
                      <p className="text-xs text-gray-500">{getLastMessageTime(user._id)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
  
        {showCreateGroup && !showOnlyGroups && !showOnlyContacts && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-30 backdrop-blur-sm flex justify-center items-center z-[100] p-2" onClick={() => setShowCreateGroup(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-2">Create New Group</h2>
              <input type="text" placeholder="Group Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mb-2 text-sm" />
              <div className="mb-2">
                <h3 className="text-xs font-semibold mb-1">Select Members</h3>
                <div className="max-h-32 overflow-y-auto">{users.map((user) => (<div key={user._id} className="flex items-center p-1 text-xs"><input type="checkbox" id={`user-${user._id}`} checked={selectedMembers.includes(user._id)} onChange={() => setSelectedMembers((prev) => prev.includes(user._id) ? prev.filter((id) => id !== user._id) : [...prev, user._id])} className="mr-1" /><label htmlFor={`user-${user._id}`}>{safeRender(user.name)}</label></div>))}</div>
              </div>
              <div className="flex justify-end space-x-2">
                <button onClick={() => setShowCreateGroup(false)} className="px-2 py-1 text-gray-600 hover:text-gray-800 text-xs">Cancel</button>
                <button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length === 0} className={`px-2 py-1 text-white rounded-lg text-xs ${!groupName.trim() || selectedMembers.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`}>Create</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };
  
  export default GroupManagement;
  

