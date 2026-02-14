import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  FaPaperPlane, FaComments, FaSearch, FaArrowLeft,
  FaCircle, FaUsers, FaUserFriends, FaSyncAlt,
  FaImage, FaTimes, FaPlay
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import './Messages.css';

const Messages = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableUsers, setAvailableUsers] = useState({ followers: [], following: [], all: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('following');
  const [refreshingUsers, setRefreshingUsers] = useState(false);

  // Media upload states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewMedia, setPreviewMedia] = useState(null);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConversations(res.data?.conversations || res.data || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
    setLoading(false);
  }, []);

  // Fetch messages with a specific user
  const fetchMessages = useCallback(async (recipientId) => {
    try {
      const res = await api.get(`/messages/${recipientId}`);
      setMessages(res.data || []);
      scrollToBottom();
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, []);

  // Fetch user details
  const fetchUserDetails = useCallback(async (recipientId) => {
    try {
      const res = await api.get(`/users/${recipientId}`);
      setSelectedUser(res.data.user);
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  }, []);

  // Fetch available users (followers + following)
  const fetchAvailableUsers = useCallback(async (showLoading = false) => {
    if (showLoading) setRefreshingUsers(true);
    try {
      const [followersRes, followingRes] = await Promise.all([
        api.get(`/users/${user._id}/followers`),
        api.get(`/users/${user._id}/following`)
      ]);

      const followers = followersRes.data || [];
      const following = followingRes.data || [];

      const allUsers = [...followers, ...following];
      const uniqueUsers = allUsers.filter((u, index, self) =>
        index === self.findIndex(t => t._id === u._id)
      );

      setAvailableUsers({
        followers: followers,
        following: following,
        all: uniqueUsers
      });
    } catch (err) {
      console.error('Error fetching available users:', err);
    }
    if (showLoading) setRefreshingUsers(false);
  }, [user?._id]);

  // Initial load
  useEffect(() => {
    if (user?._id) {
      fetchConversations();
      fetchAvailableUsers();
    }
  }, [fetchConversations, fetchAvailableUsers, user?._id]);

  // Refresh available users when opening the new chat panel
  useEffect(() => {
    if (showNewChat && user?._id) {
      fetchAvailableUsers(true);
    }
  }, [showNewChat, fetchAvailableUsers, user?._id]);

  // Load selected user's messages
  useEffect(() => {
    if (userId) {
      fetchUserDetails(userId);
      fetchMessages(userId);
    }
  }, [userId, fetchUserDetails, fetchMessages]);

  // Listen for new messages via socket
  useEffect(() => {
    if (socket) {
      socket.on('receiveMessage', (message) => {
        if (message.sender._id === selectedUser?._id || message.sender === selectedUser?._id) {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        }
        fetchConversations();
      });

      socket.on('followUpdate', (data) => {
        console.log('Follow update received:', data);
        fetchAvailableUsers();
        refreshUser();
      });

      return () => {
        socket.off('receiveMessage');
        socket.off('followUpdate');
      };
    }
  }, [socket, selectedUser, fetchConversations, fetchAvailableUsers, refreshUser]);

  // Refresh when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      if (showNewChat) {
        fetchAvailableUsers();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [showNewChat, fetchAvailableUsers]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSelectConversation = (otherUser) => {
    setSelectedUser(otherUser);
    setShowNewChat(false);
    navigate(`/messages/${otherUser._id}`);
  };

  const startNewConversation = (userToMessage) => {
    setSelectedUser(userToMessage);
    setMessages([]);
    setShowNewChat(false);
    setSearchQuery('');
    navigate(`/messages/${userToMessage._id}`);
  };

  const handleRefreshUsers = () => {
    fetchAvailableUsers(true);
    refreshUser();
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 5) {
      alert('Maximum 5 files allowed per message');
      return;
    }

    // Validate file sizes
    const maxSize = 25 * 1024 * 1024; // 25MB
    const oversized = files.find(f => f.size > maxSize);
    if (oversized) {
      alert(`File "${oversized.name}" is too large. Maximum size is 25MB.`);
      return;
    }

    // Create previews
    const previews = files.map(file => ({
      file,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      preview: URL.createObjectURL(file)
    }));

    setSelectedFiles(prev => [...prev, ...previews].slice(0, 5));
  };

  // Remove selected file
  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // Send message (text or media)
  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedUser) return;

    setSendingMessage(true);
    setUploadProgress(0);

    try {
      let res;

      if (selectedFiles.length > 0) {
        // Send with media
        const formData = new FormData();
        selectedFiles.forEach(item => {
          formData.append('media', item.file);
        });
        if (newMessage.trim()) {
          formData.append('content', newMessage.trim());
        }

        res = await api.post(`/messages/${selectedUser._id}/media`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        });

        // Cleanup previews
        selectedFiles.forEach(item => URL.revokeObjectURL(item.preview));
        setSelectedFiles([]);
      } else {
        // Send text only
        res = await api.post(`/messages/${selectedUser._id}`, {
          content: newMessage.trim()
        });
      }

      setMessages(prev => [...prev, res.data]);
      setNewMessage('');
      setUploadProgress(0);
      scrollToBottom();

      if (socket) {
        socket.emit('sendMessage', {
          ...res.data,
          receiverId: selectedUser._id
        });
      }

      fetchConversations();
    } catch (err) {
      console.error('Send message error:', err);
      alert(err.response?.data?.message || 'Failed to send message');
    }
    setSendingMessage(false);
  };

  const isUserOnline = (usrId) => onlineUsers.includes(usrId);

  // Filter users based on search and active tab
  const getFilteredUsers = () => {
    if (!availableUsers[activeTab]) return [];

    let filtered = availableUsers[activeTab];

    if (searchQuery.trim()) {
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  // Render message content with attachments
  const renderMessageContent = (msg) => {
    const hasAttachments = msg.attachments && msg.attachments.length > 0;

    return (
      <div className="message-content">
        {hasAttachments && (
          <div className={`message-attachments ${msg.attachments.length > 1 ? 'grid' : ''}`}>
            {msg.attachments.map((attachment, idx) => (
              <div key={idx} className="attachment-item" onClick={() => setPreviewMedia(attachment)}>
                {attachment.type === 'image' ? (
                  <img
                    src={`${API_URL}${attachment.url}`}
                    alt="Shared"
                    className="attachment-image"
                  />
                ) : (
                  <div className="attachment-video">
                    <video src={`${API_URL}${attachment.url}`} />
                    <div className="video-play-overlay">
                      <FaPlay />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {msg.content && <p>{msg.content}</p>}
        <span className="message-time">
          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
        </span>
      </div>
    );
  };

  return (
    <div className="messages-page">
      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="media-preview-modal" onClick={() => setPreviewMedia(null)}>
          <button className="close-preview" onClick={() => setPreviewMedia(null)}>
            <FaTimes />
          </button>
          {previewMedia.type === 'image' ? (
            <img src={`${API_URL}${previewMedia.url}`} alt="Preview" />
          ) : (
            <video src={`${API_URL}${previewMedia.url}`} controls autoPlay />
          )}
        </div>
      )}

      {/* Sidebar - Conversations List */}
      <div className={`conversations-sidebar ${selectedUser ? 'hide-mobile' : ''}`}>
        <div className="sidebar-header">
          <h2><FaComments /> Messages</h2>
          <button
            className={`new-chat-btn ${showNewChat ? 'active' : ''}`}
            onClick={() => setShowNewChat(!showNewChat)}
            title={showNewChat ? "Back to conversations" : "New conversation"}
          >
            {showNewChat ? <FaArrowLeft /> : <FaUserFriends />}
          </button>
        </div>

        {/* New Chat Panel */}
        {showNewChat && (
          <div className="new-chat-panel">
            <div className="new-chat-header">
              <div>
                <h3>Start a Conversation</h3>
                <p className="hint">Message people you follow or who follow you</p>
              </div>
              <button
                className="refresh-btn"
                onClick={handleRefreshUsers}
                disabled={refreshingUsers}
                title="Refresh list"
              >
                <FaSyncAlt className={refreshingUsers ? 'spinning' : ''} />
              </button>
            </div>

            {/* Tabs for Following/Followers */}
            <div className="user-tabs">
              <button
                className={`tab ${activeTab === 'following' ? 'active' : ''}`}
                onClick={() => setActiveTab('following')}
              >
                <FaUserFriends /> Following ({availableUsers.following?.length || 0})
              </button>
              <button
                className={`tab ${activeTab === 'followers' ? 'active' : ''}`}
                onClick={() => setActiveTab('followers')}
              >
                <FaUsers /> Followers ({availableUsers.followers?.length || 0})
              </button>
            </div>

            {/* Search */}
            <div className="search-input-wrapper">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Users List */}
            <div className="available-users-list">
              {refreshingUsers ? (
                <div className="loading-users">
                  <FaSyncAlt className="spinning" />
                  <span>Refreshing...</span>
                </div>
              ) : getFilteredUsers().length === 0 ? (
                <div className="no-users">
                  <p>
                    {activeTab === 'following'
                      ? "You're not following anyone yet"
                      : "No one is following you yet"}
                  </p>
                  <small>Explore and connect with other moms!</small>
                </div>
              ) : (
                getFilteredUsers().map(u => (
                  <div
                    key={u._id}
                    className="available-user-item"
                    onClick={() => startNewConversation(u)}
                  >
                    <div className="avatar-wrapper">
                      <img
                        src={u.avatar ? `${API_URL}/uploads/avatars/${u.avatar}` : 'https://via.placeholder.com/45'}
                        alt=""
                        className="avatar"
                      />
                      {isUserOnline(u._id) && (
                        <span className="online-indicator"><FaCircle /></span>
                      )}
                    </div>
                    <div className="user-info">
                      <span className="name">{u.name}</span>
                      {u.location && <span className="location">{u.location}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Conversations List */}
        {!showNewChat && (
          <div className="conversations-list">
            {loading ? (
              <div className="loading-conversations">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="no-conversations">
                <FaComments className="empty-icon" />
                <p>No conversations yet</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowNewChat(true)}
                >
                  <FaUserFriends /> Start a conversation
                </button>
              </div>
            ) : (
              conversations.map(conv => {
                const otherUser = conv.participants?.find(p => p._id !== user._id);
                if (!otherUser) return null;

                // Show different preview for media messages
                let lastMsgPreview = '';
                if (conv.lastMessage) {
                  if (conv.lastMessage.messageType === 'image') {
                    lastMsgPreview = '📷 Photo';
                  } else if (conv.lastMessage.messageType === 'video') {
                    lastMsgPreview = '🎥 Video';
                  } else if (conv.lastMessage.messageType === 'mixed') {
                    lastMsgPreview = conv.lastMessage.content?.slice(0, 25) || '📎 Media';
                  } else {
                    lastMsgPreview = conv.lastMessage.content?.slice(0, 25);
                    if (conv.lastMessage.content?.length > 25) lastMsgPreview += '...';
                  }
                }

                return (
                  <div
                    key={conv._id}
                    className={`conversation-item ${selectedUser?._id === otherUser._id ? 'active' : ''}`}
                    onClick={() => handleSelectConversation(otherUser)}
                  >
                    <div className="avatar-wrapper">
                      <img
                        src={otherUser.avatar ? `${API_URL}/uploads/avatars/${otherUser.avatar}` : 'https://via.placeholder.com/50'}
                        alt=""
                        className="avatar"
                      />
                      {isUserOnline(otherUser._id) && (
                        <span className="online-indicator"><FaCircle /></span>
                      )}
                    </div>
                    <div className="conversation-info">
                      <span className="name">{otherUser.name}</span>
                      {conv.lastMessage && (
                        <span className="last-message">
                          {conv.lastMessage.sender === user._id && 'You: '}
                          {lastMsgPreview}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <span className="time">
                        {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className={`chat-area ${!selectedUser ? 'hide-mobile' : ''}`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <button
                className="back-btn"
                onClick={() => {
                  setSelectedUser(null);
                  navigate('/messages');
                }}
              >
                <FaArrowLeft />
              </button>
              <div className="avatar-wrapper" onClick={() => navigate(`/profile/${selectedUser._id}`)} style={{ cursor: 'pointer' }}>
                <img
                  src={selectedUser.avatar ? `${API_URL}/uploads/avatars/${selectedUser.avatar}` : 'https://via.placeholder.com/40'}
                  alt=""
                  className="avatar"
                />
                {isUserOnline(selectedUser._id) && (
                  <span className="online-indicator"><FaCircle /></span>
                )}
              </div>
              <div className="header-info" onClick={() => navigate(`/profile/${selectedUser._id}`)} style={{ cursor: 'pointer' }}>
                <h3>{selectedUser.name}</h3>
                <span className="status">
                  {isUserOnline(selectedUser._id) ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet</p>
                  <span>Say hello to {selectedUser.name}! 👋</span>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMine = (msg.sender?._id || msg.sender) === user._id;
                  return (
                    <div
                      key={msg._id || index}
                      className={`message ${isMine ? 'sent' : 'received'}`}
                    >
                      {!isMine && (
                        <img
                          src={selectedUser.avatar ? `${API_URL}/uploads/avatars/${selectedUser.avatar}` : 'https://via.placeholder.com/32'}
                          alt=""
                          className="message-avatar"
                        />
                      )}
                      {renderMessageContent(msg)}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="selected-files-preview">
                {selectedFiles.map((item, idx) => (
                  <div key={idx} className="preview-item">
                    {item.type === 'image' ? (
                      <img src={item.preview} alt="Preview" />
                    ) : (
                      <video src={item.preview} />
                    )}
                    <button className="remove-preview" onClick={() => removeSelectedFile(idx)}>
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="upload-progress">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                <span>{uploadProgress}%</span>
              </div>
            )}

            {/* Message Input */}
            <form className="message-input-form" onSubmit={sendMessage}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                multiple
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="media-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={sendingMessage}
                title="Attach photo or video"
              >
                <FaImage />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sendingMessage}
              />
              <button
                type="submit"
                className="send-btn"
                disabled={(!newMessage.trim() && selectedFiles.length === 0) || sendingMessage}
              >
                <FaPaperPlane />
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <FaComments className="empty-icon" />
            <h3>Your Messages</h3>
            <p>Select a conversation or start a new one</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowNewChat(true)}
            >
              <FaUserFriends /> New Conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;