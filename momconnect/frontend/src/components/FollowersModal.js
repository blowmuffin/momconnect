import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FaTimes, FaUserPlus, FaUserCheck, FaEnvelope, FaUsers } from 'react-icons/fa';
import './FollowersModal.css';

const FollowersModal = ({ userId, type, onClose }) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingStatus, setFollowingStatus] = useState({});

  useEffect(() => {
    fetchUsers();
  }, [userId, type]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const endpoint = type === 'followers'
        ? `/users/${userId}/followers`
        : `/users/${userId}/following`;

      const res = await api.get(endpoint);
      setUsers(res.data || []);

      // Check follow status for each user
      const statusMap = {};
      res.data.forEach(u => {
        statusMap[u._id] = currentUser?.following?.includes(u._id);
      });
      setFollowingStatus(statusMap);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
    setLoading(false);
  };

  const handleFollow = async (targetUserId) => {
    try {
      const res = await api.put(`/users/follow/${targetUserId}`);
      setFollowingStatus(prev => ({
        ...prev,
        [targetUserId]: res.data.isFollowing
      }));
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  const handleMessage = (targetUserId) => {
    onClose();
    navigate(`/messages/${targetUserId}`);
  };

  const canMessage = (targetUser) => {
    // Can message if:
    // 1. Current user follows them, OR
    // 2. They follow current user
    const iFollowThem = currentUser?.following?.includes(targetUser._id) || followingStatus[targetUser._id];
    const theyFollowMe = currentUser?.followers?.includes(targetUser._id);
    return iFollowThem || theyFollowMe;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FaUsers /> {type === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <FaUsers className="empty-icon" />
              <p>
                {type === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
              </p>
            </div>
          ) : (
            <div className="users-list">
              {users.map(u => (
                <div key={u._id} className="user-item">
                  <Link
                    to={`/profile/${u._id}`}
                    className="user-info"
                    onClick={onClose}
                  >
                    <img
                      src={u.avatar ? `${API_URL}/uploads/avatars/${u.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e91e63&color=fff&size=50`}
                      alt={u.name}
                      className="avatar"
                      onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e91e63&color=fff&size=50`; }}
                    />
                    <div className="user-details">
                      <span className="name">{u.name}</span>
                      {u.bio && <span className="bio">{u.bio.slice(0, 50)}{u.bio.length > 50 ? '...' : ''}</span>}
                      {u.location && <span className="location">{u.location}</span>}
                    </div>
                  </Link>

                  <div className="user-actions">
                    {u._id !== currentUser?._id && (
                      <>
                        {/* Follow/Unfollow Button */}
                        <button
                          className={`action-btn ${followingStatus[u._id] ? 'following' : 'follow'}`}
                          onClick={() => handleFollow(u._id)}
                        >
                          {followingStatus[u._id] ? <FaUserCheck /> : <FaUserPlus />}
                        </button>

                        {/* Message Button - only show if can message */}
                        {canMessage(u) && (
                          <button
                            className="action-btn message"
                            onClick={() => handleMessage(u._id)}
                            title="Send message"
                          >
                            <FaEnvelope />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersModal;