import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHome, FaCompass, FaUsers, FaEnvelope, FaSignOutAlt, FaHeart, FaSearch, FaRobot } from 'react-icons/fa';
import SearchUsers from './SearchUsers';
import './Navbar.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getAvatarUrl = () => {
    if (user?.avatar) {
      return `${API_URL}/uploads/avatars/${user.avatar}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=ff6b9d&color=fff&size=40`;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <FaHeart className="logo-icon" />
          <span>MomConnect</span>
        </Link>

        <div className="navbar-search">
          {showSearch ? (
            <SearchUsers onClose={() => setShowSearch(false)} />
          ) : (
            <button
              className="search-toggle"
              onClick={() => setShowSearch(true)}
              title="Search people"
            >
              <FaSearch />
              <span>Search people...</span>
            </button>
          )}
        </div>

        <div className="navbar-links">
          <Link to="/" className="nav-link" title="Home"><FaHome /></Link>
          <Link to="/explore" className="nav-link" title="Explore"><FaCompass /></Link>
          <Link to="/groups" className="nav-link" title="Groups"><FaUsers /></Link>
          <Link to="/messages" className="nav-link" title="Messages"><FaEnvelope /></Link>
          <Link to="/chatbot" className="nav-link chatbot-link" title="AI Assistant"><FaRobot /></Link>
          <Link to={`/profile/${user?._id}`} className="nav-profile">
            <img
              src={getAvatarUrl()}
              alt={user?.name}
              className="avatar-sm"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=ff6b9d&color=fff&size=40`;
              }}
            />
          </Link>
          <button onClick={handleLogout} className="nav-link logout-btn" title="Logout">
            <FaSignOutAlt />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;