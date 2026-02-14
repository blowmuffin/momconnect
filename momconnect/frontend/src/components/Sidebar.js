import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../services/api';
import FollowersModal from './FollowersModal';
import { FaHome, FaCompass, FaUsers, FaUser, FaEnvelope, FaCog, FaRobot } from 'react-icons/fa';
import './Sidebar.css';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [showModal, setShowModal] = useState(null);

  // Smiley emoji component for AI Assistant
  const SmileyIcon = () => <span style={{ fontSize: '1.1rem' }}>😊</span>;

  const menuItems = [
    { path: '/', icon: FaHome, label: 'Home' },
    { path: '/explore', icon: FaCompass, label: 'Explore' },
    { path: '/groups', icon: FaUsers, label: 'Groups' },
    { path: '/messages', icon: FaEnvelope, label: 'Messages' },
    { path: '/chatbot', icon: SmileyIcon, label: 'AI Assistant' },
    { path: `/profile/${user?._id}`, icon: FaUser, label: 'Profile' },
    { path: '/edit-profile', icon: FaCog, label: 'Settings' },
  ];

  const getAvatarUrl = () => {
    if (user?.avatar) {
      return `${API_URL}/uploads/avatars/${user.avatar}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=e91e63&color=fff&size=100`;
  };

  return (
    <aside className="sidebar">
      {/* User Profile Card */}
      {user && (
        <div className="sidebar-profile">
          <div className="profile-avatar-wrapper">
            <img
              src={getAvatarUrl()}
              alt={user.name}
              className="profile-avatar"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=e91e63&color=fff&size=100`;
              }}
            />
          </div>
          <h3 className="profile-name">{user.name}</h3>
          {user.bio && <p className="profile-bio">{user.bio}</p>}

          {/* Clickable Stats */}
          <div className="profile-stats">
            <div
              className="stat clickable"
              onClick={() => setShowModal('followers')}
              role="button"
              tabIndex={0}
              aria-label={`${user.followers?.length || 0} followers`}
            >
              <strong>{user.followers?.length || 0}</strong>
              <span>Followers</span>
            </div>
            <div
              className="stat clickable"
              onClick={() => setShowModal('following')}
              role="button"
              tabIndex={0}
              aria-label={`${user.following?.length || 0} following`}
            >
              <strong>{user.following?.length || 0}</strong>
              <span>Following</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive || location.pathname === item.path ? 'active' : ''}`
            }
          >
            <item.icon className="sidebar-icon" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>© 2024 MomConnect</p>
        <p>Made with ❤️ for Moms</p>
      </div>

      {/* Followers/Following Modal */}
      {showModal && (
        <FollowersModal
          userId={user?._id}
          type={showModal}
          onClose={() => setShowModal(null)}
        />
      )}
    </aside>
  );
};

export default Sidebar;