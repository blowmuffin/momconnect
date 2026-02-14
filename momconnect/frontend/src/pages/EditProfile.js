import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../services/api';
import { FaCamera, FaUser, FaMapMarkerAlt, FaInfoCircle, FaHeart, FaBaby, FaPlus, FaTimes, FaSave } from 'react-icons/fa';
import './EditProfile.css';

const EditProfile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    location: '',
    interests: []
  });
  const [children, setChildren] = useState([]);
  const [newInterest, setNewInterest] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
        location: user.location || '',
        interests: user.interests || []
      });
      setChildren(user.children || []);
      if (user.avatar) {
        setAvatarPreview(`${API_URL}/uploads/avatars/${user.avatar}`);
      }
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const uploadAvatar = async () => {
    if (!avatar) return;

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', avatar);

      const res = await api.put('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      updateUser({ avatar: res.data.avatar });
      setAvatar(null);
      setSuccess('Profile photo updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload photo');
    }
    setAvatarLoading(false);
  };

  const addInterest = () => {
    if (newInterest.trim() && !formData.interests.includes(newInterest.trim())) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }));
      setNewInterest('');
    }
  };

  const removeInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const addChild = () => {
    setChildren([...children, { name: '', age: '', gender: '' }]);
  };

  const updateChild = (index, field, value) => {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  };

  const removeChild = (index) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    try {
      const res = await api.put('/users/profile', {
        name: formData.name,
        bio: formData.bio,
        location: formData.location,
        interests: formData.interests,
        children: children.filter(c => c.name.trim())
      });

      updateUser(res.data);
      setSuccess('Profile updated successfully!');
      
      // Upload avatar if selected
      if (avatar) {
        await uploadAvatar();
      }

      setTimeout(() => {
        navigate(`/profile/${user._id}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
    setLoading(false);
  };

  return (
    <div className="edit-profile-page">
      <div className="edit-profile-container card">
        <h1><FaUser /> Edit Profile</h1>

        {error && <div className="error-alert">{error}</div>}
        {success && <div className="success-alert">{success}</div>}

        <form onSubmit={handleSubmit}>
          {/* Avatar Section */}
          <div className="avatar-section">
            <div className="avatar-wrapper">
              <img
                src={avatarPreview || 'https://via.placeholder.com/120'}
                alt="Profile"
                className="profile-avatar"
              />
              <button 
                type="button" 
                className="avatar-edit-btn"
                onClick={() => fileRef.current.click()}
              >
                <FaCamera />
              </button>
              <input
                type="file"
                ref={fileRef}
                onChange={handleAvatarSelect}
                accept="image/*"
                hidden
              />
            </div>
            {avatar && (
              <button 
                type="button" 
                className="btn btn-secondary upload-btn"
                onClick={uploadAvatar}
                disabled={avatarLoading}
              >
                {avatarLoading ? 'Uploading...' : 'Upload Photo'}
              </button>
            )}
          </div>

          {/* Name */}
          <div className="form-group">
            <label><FaUser /> Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your name"
              maxLength={50}
            />
          </div>

          {/* Bio */}
          <div className="form-group">
            <label><FaInfoCircle /> Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell other moms about yourself..."
              rows={4}
              maxLength={500}
            />
            <span className="char-count">{formData.bio.length}/500</span>
          </div>

          {/* Location */}
          <div className="form-group">
            <label><FaMapMarkerAlt /> Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="City, Country"
              maxLength={100}
            />
          </div>

          {/* Children */}
          <div className="form-group">
            <label><FaBaby /> Children</label>
            <div className="children-list">
              {children.map((child, index) => (
                <div key={index} className="child-item">
                  <input
                    type="text"
                    placeholder="Name"
                    value={child.name}
                    onChange={(e) => updateChild(index, 'name', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Age"
                    value={child.age}
                    onChange={(e) => updateChild(index, 'age', e.target.value)}
                    min="0"
                    max="50"
                  />
                  <select
                    value={child.gender}
                    onChange={(e) => updateChild(index, 'gender', e.target.value)}
                  >
                    <option value="">Gender</option>
                    <option value="boy">Boy</option>
                    <option value="girl">Girl</option>
                    <option value="other">Other</option>
                  </select>
                  <button 
                    type="button" 
                    className="remove-child-btn"
                    onClick={() => removeChild(index)}
                  >
                    <FaTimes />
                  </button>
                </div>
              ))}
              <button type="button" className="add-child-btn" onClick={addChild}>
                <FaPlus /> Add Child
              </button>
            </div>
          </div>

          {/* Interests */}
          <div className="form-group">
            <label><FaHeart /> Interests</label>
            <div className="interests-input">
              <input
                type="text"
                placeholder="Add an interest (e.g., cooking, yoga)"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
              />
              <button type="button" className="add-interest-btn" onClick={addInterest}>
                <FaPlus />
              </button>
            </div>
            <div className="interests-list">
              {formData.interests.map((interest, index) => (
                <span key={index} className="interest-tag">
                  {interest}
                  <button type="button" onClick={() => removeInterest(interest)}>
                    <FaTimes />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate(`/profile/${user._id}`)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : <><FaSave /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfile;