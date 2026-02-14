import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../services/api';
import Post from '../components/Post';
import FollowersModal from '../components/FollowersModal';
import {
  FaMapMarkerAlt, FaUserPlus, FaUserCheck, FaEdit,
  FaEnvelope, FaBaby, FaHeart
} from 'react-icons/fa';
import './Profile.css';

const Profile = () => {
  const { id } = useParams();
  const { user: currentUser, updateUser } = useAuth();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showModal, setShowModal] = useState(null); // 'followers' or 'following'
  const [followLoading, setFollowLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get(`/users/${id}`);
      setUser(res.data.user);
      setPosts(res.data.posts || []);
      setIsFollowing(res.data.user.followers?.some(f => f._id === currentUser?._id));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [id, currentUser?._id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      const res = await api.put(`/users/follow/${id}`);
      setIsFollowing(res.data.isFollowing);

      // Update current user's following list
      if (res.data.isFollowing) {
        updateUser({
          following: [...(currentUser.following || []), id]
        });
      } else {
        updateUser({
          following: currentUser.following?.filter(fId => fId !== id) || []
        });
      }

      // Refresh profile to get updated counts
      fetchProfile();
    } catch (err) {
      console.error(err);
    }
    setFollowLoading(false);
  };

  // Check if current user can message this profile
  const canMessage = () => {
    if (!currentUser || !user) return false;
    if (currentUser._id === id) return false; // Can't message yourself

    // Can message if I follow them OR they follow me
    const iFollowThem = isFollowing || currentUser.following?.includes(id);
    const theyFollowMe = user.followers?.some(f => f._id === currentUser._id);

    return iFollowThem || theyFollowMe;
  };

  if (loading) {
    return <div className="loading-message">Loading profile...</div>;
  }

  if (!user) {
    return <div className="card">User not found</div>;
  }

  const isOwnProfile = currentUser?._id === id;

  return (
    <div className="profile-page">
      <div className="profile-header card">
        <img
          src={user.avatar ? `${API_URL}/uploads/avatars/${user.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e91e63&color=fff&size=120`}
          alt={user.name}
          className="profile-avatar avatar-ring"
          onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e91e63&color=fff&size=120`; }}
        />
        <h1>{user.name}</h1>
        {user.location && <p className="location"><FaMapMarkerAlt /> {user.location}</p>}
        {user.bio && <p className="bio">{user.bio}</p>}

        {/* Clickable Stats */}
        <div className="profile-stats">
          <div className="stat">
            <strong>{posts.length}</strong>
            <span>Posts</span>
          </div>
          <div
            className="stat clickable"
            onClick={() => setShowModal('followers')}
          >
            <strong>{user.followers?.length || 0}</strong>
            <span>Followers</span>
          </div>
          <div
            className="stat clickable"
            onClick={() => setShowModal('following')}
          >
            <strong>{user.following?.length || 0}</strong>
            <span>Following</span>
          </div>
        </div>

        {/* Children Info */}
        {user.children && user.children.length > 0 && (
          <div className="profile-children">
            <FaBaby className="section-icon" />
            <div className="children-tags">
              {user.children.map((child, index) => (
                <span key={index} className="child-tag">
                  {child.name}{child.age ? `, ${child.age}` : ''}
                  {child.gender === 'boy' && ' 👦'}
                  {child.gender === 'girl' && ' 👧'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {user.interests && user.interests.length > 0 && (
          <div className="profile-interests">
            <FaHeart className="section-icon" />
            <div className="interests-tags">
              {user.interests.map((interest, index) => (
                <span key={index} className="interest-tag">{interest}</span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="profile-actions">
          {isOwnProfile ? (
            <Link to="/edit-profile" className="btn btn-primary">
              <FaEdit /> Edit Profile
            </Link>
          ) : (
            <>
              <button
                className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  'Loading...'
                ) : isFollowing ? (
                  <><FaUserCheck /> Following</>
                ) : (
                  <><FaUserPlus /> Follow</>
                )}
              </button>

              {canMessage() && (
                <Link to={`/messages/${id}`} className="btn btn-secondary">
                  <FaEnvelope /> Message
                </Link>
              )}

              {!canMessage() && !isFollowing && (
                <span className="message-hint">
                  Follow to message
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <h2 className="section-title">Posts</h2>

      {posts.length === 0 ? (
        <div className="card empty-state">
          <p>No posts yet</p>
        </div>
      ) : (
        posts.map(post => <Post key={post._id} post={post} />)
      )}

      {/* Followers/Following Modal */}
      {showModal && (
        <FollowersModal
          userId={id}
          type={showModal}
          onClose={() => setShowModal(null)}
        />
      )}
    </div>
  );
};

export default Profile;