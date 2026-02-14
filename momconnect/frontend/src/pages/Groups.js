import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { API_URL } from '../services/api';
import { FaUsers, FaPlus, FaLock, FaGlobe, FaSearch } from 'react-icons/fa';
import './Groups.css';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'newborn', label: '👶 Newborn' },
    { value: 'toddler', label: '💜 Toddler' },
    { value: 'school-age', label: '🎒 School Age' },
    { value: 'teens', label: '🎮 Teens' },
    { value: 'single-moms', label: '💪 Single Moms' },
    { value: 'working-moms', label: '💼 Working Moms' },
    { value: 'stay-at-home', label: '🏠 Stay at Home' },
    { value: 'health', label: '🏥 Health' },
    { value: 'recipes', label: '🍳 Recipes' },
    { value: 'crafts', label: '🎨 Crafts' },
    { value: 'support', label: '❤️ Support' },
    { value: 'local', label: '📍 Local' },
    { value: 'general', label: '💬 General' },
  ];

  useEffect(() => {
    fetchGroups();
    fetchMyGroups();
  }, [selectedCategory, searchQuery]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      let url = '/groups?';
      if (selectedCategory !== 'all') url += `category=${selectedCategory}&`;
      if (searchQuery) url += `search=${searchQuery}`;
      
      const res = await api.get(url);
      setGroups(res.data.groups || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchMyGroups = async () => {
    try {
      const res = await api.get('/groups/my-groups');
      setMyGroups(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchGroups();
  };

  const displayedGroups = activeTab === 'my' ? myGroups : groups;

  return (
    <div className="groups-page">
      <div className="groups-header">
        <div className="groups-title">
          <h1><FaUsers /> Groups</h1>
          <p>Join groups and connect with other moms</p>
        </div>
        <Link to="/groups/create" className="btn btn-primary">
          <FaPlus /> Create Group
        </Link>
      </div>

      {/* Tabs */}
      <div className="groups-tabs">
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Groups
        </button>
        <button 
          className={`tab ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          My Groups ({myGroups.length})
        </button>
      </div>

      {/* Search and Filter */}
      {activeTab === 'all' && (
        <div className="groups-filters">
          <form onSubmit={handleSearch} className="search-form">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
          
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-filter"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Groups Grid */}
      {loading ? (
        <div className="loading-message">Loading groups...</div>
      ) : displayedGroups.length === 0 ? (
        <div className="card empty-state">
          <FaUsers className="empty-icon" />
          <h3>{activeTab === 'my' ? "You haven't joined any groups yet" : "No groups found"}</h3>
          <p>{activeTab === 'my' ? "Join a group or create your own!" : "Try a different search or create a new group"}</p>
          <Link to="/groups/create" className="btn btn-primary" style={{ marginTop: '20px' }}>
            <FaPlus /> Create Group
          </Link>
        </div>
      ) : (
        <div className="groups-grid">
          {displayedGroups.map(group => (
            <Link to={`/groups/${group._id}`} key={group._id} className="group-card card">
              <div className="group-image">
                <img
                  src={group.image ? `${API_URL}/uploads/groups/${group.image}` : 'https://via.placeholder.com/300x150?text=Group'}
                  alt={group.name}
                />
                {group.isPrivate ? (
                  <span className="privacy-badge private"><FaLock /> Private</span>
                ) : (
                  <span className="privacy-badge public"><FaGlobe /> Public</span>
                )}
              </div>
              <div className="group-info">
                <h3>{group.name}</h3>
                <span className="group-category">{group.category}</span>
                <p className="group-description">
                  {group.description?.slice(0, 80)}{group.description?.length > 80 ? '...' : ''}
                </p>
                <div className="group-meta">
                  <span><FaUsers /> {group.members?.length || 0} members</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Groups;