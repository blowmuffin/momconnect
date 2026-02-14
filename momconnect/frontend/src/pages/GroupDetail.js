import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../services/api';
import Post from '../components/Post';
import CreatePost from '../components/CreatePost';
import {
  FaUsers, FaLock, FaGlobe, FaCog, FaUserPlus,
  FaCheck, FaClock, FaSignOutAlt, FaStar, FaArrowDown,
  FaTimes, FaUserMinus
} from 'react-icons/fa';
import './GroupDetail.css';

const GroupDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [joinLoading, setJoinLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const fetchGroup = useCallback(async () => {
    try {
      const res = await api.get(`/groups/${id}`);
      setGroup(res.data.group);
      setPosts(res.data.posts || []);
      setIsMember(res.data.isMember);
      setIsPending(res.data.group.pendingRequests?.some(r =>
        (typeof r === 'string' ? r : r._id) === user?._id
      ));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [id, user?._id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const handleJoinLeave = async () => {
    setJoinLoading(true);
    try {
      const res = await api.put(`/groups/${id}/join`);
      if (res.data.pending) {
        setIsPending(true);
      } else {
        setIsMember(res.data.isMember);
        fetchGroup();
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Action failed');
    }
    setJoinLoading(false);
  };

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  const handlePostDelete = (postId) => {
    setPosts(posts.filter(p => p._id !== postId));
  };

  // Admin actions
  const handlePromote = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'promote' }));
    try {
      await api.put(`/groups/${id}/members/${userId}/promote`);
      fetchGroup();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to promote');
    }
    setActionLoading(prev => ({ ...prev, [userId]: null }));
  };

  const handleDemote = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'demote' }));
    try {
      await api.put(`/groups/${id}/members/${userId}/demote`);
      fetchGroup();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to demote');
    }
    setActionLoading(prev => ({ ...prev, [userId]: null }));
  };

  const handleKick = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    setActionLoading(prev => ({ ...prev, [userId]: 'kick' }));
    try {
      await api.delete(`/groups/${id}/members/${userId}`);
      fetchGroup();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
    setActionLoading(prev => ({ ...prev, [userId]: null }));
  };

  const handleApproveRequest = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'approve' }));
    try {
      await api.put(`/groups/${id}/requests/${userId}/approve`);
      fetchGroup();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    }
    setActionLoading(prev => ({ ...prev, [userId]: null }));
  };

  const handleRejectRequest = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'reject' }));
    try {
      await api.delete(`/groups/${id}/requests/${userId}`);
      fetchGroup();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject');
    }
    setActionLoading(prev => ({ ...prev, [userId]: null }));
  };

  const isAdmin = group?.admin?._id === user?._id;
  const currentMember = group?.members?.find(m => m.user?._id === user?._id);
  const isAdminOrMod = currentMember?.role === 'admin' || currentMember?.role === 'moderator';

  const getAvatarUrl = (member) => {
    if (member?.avatar) {
      return `${API_URL}/uploads/avatars/${member.avatar}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(member?.name || 'User')}&background=e91e63&color=fff&size=40`;
  };

  if (loading) {
    return <div className="loading-message">Loading group...</div>;
  }

  if (!group) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Group not found</h2>
        <Link to="/groups" className="btn btn-primary" style={{ marginTop: '20px' }}>
          Back to Groups
        </Link>
      </div>
    );
  }

  return (
    <div className="group-detail-page">
      {/* Group Header */}
      <div className="group-header card">
        <div className="group-cover">
          <img
            src={group.image ? `${API_URL}/uploads/groups/${group.image}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=9c27b0&color=fff&size=400&font-size=0.33`}
            alt={group.name}
            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=9c27b0&color=fff&size=400&font-size=0.33`; }}
          />
          <div className="group-overlay">
            <div className="group-header-info">
              <h1>{group.name}</h1>
              <div className="group-meta">
                {group.isPrivate ? (
                  <span className="privacy"><FaLock /> Private Group</span>
                ) : (
                  <span className="privacy"><FaGlobe /> Public Group</span>
                )}
                <span className="members"><FaUsers /> {group.members?.length || 0} members</span>
                <span className="category">{group.category}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="group-actions">
          {isAdmin ? (
            <button className="btn btn-secondary">
              <FaCog /> Manage Group
            </button>
          ) : isMember ? (
            <button
              className="btn btn-secondary"
              onClick={handleJoinLeave}
              disabled={joinLoading}
            >
              <FaSignOutAlt /> {joinLoading ? 'Leaving...' : 'Leave Group'}
            </button>
          ) : isPending ? (
            <button className="btn btn-secondary" disabled>
              <FaClock /> Request Pending
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleJoinLeave}
              disabled={joinLoading}
            >
              <FaUserPlus /> {joinLoading ? 'Joining...' : 'Join Group'}
            </button>
          )}
        </div>

        {group.description && (
          <p className="group-description">{group.description}</p>
        )}

        {/* Admin Info */}
        <div className="group-admin">
          <span>Created by:</span>
          <Link to={`/profile/${group.admin?._id}`} className="admin-link">
            <img
              src={getAvatarUrl(group.admin)}
              alt=""
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(group.admin?.name || 'Admin')}&background=e91e63&color=fff&size=30`; }}
            />
            {group.admin?.name}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="group-tabs">
        <button
          className={`tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button
          className={`tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members ({group.members?.length || 0})
        </button>
        {isAdminOrMod && group.isPrivate && group.pendingRequests?.length > 0 && (
          <button
            className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Requests ({group.pendingRequests.length})
          </button>
        )}
        {group.rules?.length > 0 && (
          <button
            className={`tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            Rules
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="group-content">
        {activeTab === 'posts' && (
          <div className="posts-section">
            {isMember && (
              <CreatePost onPostCreated={handlePostCreated} groupId={id} />
            )}

            {!isMember && !group.isPrivate && posts.length === 0 && (
              <div className="card join-prompt">
                <FaUsers className="join-icon" />
                <h3>Join this group to participate</h3>
                <p>See posts, share your thoughts, and connect with other moms</p>
                <button className="btn btn-primary" onClick={handleJoinLeave}>
                  <FaUserPlus /> Join Group
                </button>
              </div>
            )}

            {group.isPrivate && !isMember ? (
              <div className="card private-message">
                <FaLock className="lock-icon" />
                <h3>This is a private group</h3>
                <p>Join this group to see posts and participate in discussions</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="card empty-posts">
                <p>No posts yet. {isMember ? 'Be the first to share something!' : ''}</p>
              </div>
            ) : (
              posts.map(post => (
                <Post key={post._id} post={post} onDelete={handlePostDelete} />
              ))
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="members-section card">
            <h3>Members</h3>
            <div className="members-list">
              {group.members?.map(member => (
                <div key={member.user?._id} className="member-item">
                  <Link to={`/profile/${member.user?._id}`} className="member-link">
                    <img
                      src={getAvatarUrl(member.user)}
                      alt=""
                      className="avatar"
                      onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user?.name || 'User')}&background=e91e63&color=fff&size=40`; }}
                    />
                    <div className="member-info">
                      <span className="member-name">{member.user?.name}</span>
                      <span className="member-role">
                        {member.role === 'admin' && '👑 Admin'}
                        {member.role === 'moderator' && '⭐ Moderator'}
                        {member.role === 'member' && 'Member'}
                      </span>
                    </div>
                  </Link>

                  {/* Admin Controls */}
                  {isAdmin && member.role !== 'admin' && (
                    <div className="admin-controls">
                      {member.role === 'member' ? (
                        <button
                          className="admin-btn promote"
                          onClick={() => handlePromote(member.user?._id)}
                          disabled={actionLoading[member.user?._id]}
                          title="Promote to Moderator"
                        >
                          <FaStar />
                        </button>
                      ) : (
                        <button
                          className="admin-btn demote"
                          onClick={() => handleDemote(member.user?._id)}
                          disabled={actionLoading[member.user?._id]}
                          title="Demote to Member"
                        >
                          <FaArrowDown />
                        </button>
                      )}
                      <button
                        className="admin-btn kick"
                        onClick={() => handleKick(member.user?._id)}
                        disabled={actionLoading[member.user?._id]}
                        title="Remove from Group"
                      >
                        <FaUserMinus />
                      </button>
                    </div>
                  )}

                  {/* Mod Controls - only kick regular members */}
                  {!isAdmin && currentMember?.role === 'moderator' && member.role === 'member' && (
                    <div className="admin-controls">
                      <button
                        className="admin-btn kick"
                        onClick={() => handleKick(member.user?._id)}
                        disabled={actionLoading[member.user?._id]}
                        title="Remove from Group"
                      >
                        <FaUserMinus />
                      </button>
                    </div>
                  )}

                  {member.role === 'admin' && <FaCheck className="admin-badge" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'requests' && isAdminOrMod && (
          <div className="requests-section card">
            <h3>Pending Requests</h3>
            <div className="requests-list">
              {group.pendingRequests?.map(request => {
                const reqUser = typeof request === 'object' ? request : null;
                const reqId = typeof request === 'string' ? request : request._id;
                return (
                  <div key={reqId} className="request-item">
                    <Link to={`/profile/${reqId}`} className="member-link">
                      <img
                        src={getAvatarUrl(reqUser)}
                        alt=""
                        className="avatar"
                      />
                      <div className="member-info">
                        <span className="member-name">{reqUser?.name || 'User'}</span>
                      </div>
                    </Link>
                    <div className="request-actions">
                      <button
                        className="admin-btn approve"
                        onClick={() => handleApproveRequest(reqId)}
                        disabled={actionLoading[reqId]}
                      >
                        <FaCheck /> Approve
                      </button>
                      <button
                        className="admin-btn reject"
                        onClick={() => handleRejectRequest(reqId)}
                        disabled={actionLoading[reqId]}
                      >
                        <FaTimes /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="rules-section card">
            <h3>Group Rules</h3>
            <ol className="rules-list">
              {group.rules?.map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDetail;