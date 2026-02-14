import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FaImage, FaTimes, FaUsers, FaPlus } from 'react-icons/fa';
import './CreateGroup.css';

const CreateGroup = () => {
  const navigate = useNavigate();
  const fileRef = useRef();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    isPrivate: false,
    rules: ''
  });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    { value: 'newborn', label: '👶 Newborn (0-12 months)' },
    { value: 'toddler', label: '💜 Toddler (1-3 years)' },
    { value: 'school-age', label: '🎒 School Age (4-12 years)' },
    { value: 'teens', label: '🎮 Teens (13-18 years)' },
    { value: 'single-moms', label: '💪 Single Moms' },
    { value: 'working-moms', label: '💼 Working Moms' },
    { value: 'stay-at-home', label: '🏠 Stay at Home Moms' },
    { value: 'health', label: '🏥 Health & Wellness' },
    { value: 'recipes', label: '🍳 Recipes & Cooking' },
    { value: 'crafts', label: '🎨 Crafts & DIY' },
    { value: 'support', label: '❤️ Support & Advice' },
    { value: 'local', label: '📍 Local Meetups' },
    { value: 'general', label: '💬 General Discussion' },
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    setPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Group name is required');
      return;
    }

    if (formData.name.length < 3) {
      setError('Group name must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('category', formData.category);
      data.append('isPrivate', formData.isPrivate);
      data.append('rules', formData.rules);
      if (image) {
        data.append('image', image);
      }

      const res = await api.post('/groups', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      navigate(`/groups/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group');
    }

    setLoading(false);
  };

  return (
    <div className="create-group-page">
      <div className="create-group-container card">
        <div className="create-group-header">
          <FaUsers className="header-icon" />
          <h1>Create a New Group</h1>
          <p>Build a community of moms with similar interests</p>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Group Image */}
          <div className="form-group">
            <label>Group Image</label>
            <div className="image-upload-area">
              {preview ? (
                <div className="image-preview">
                  <img src={preview} alt="Preview" />
                  <button type="button" className="remove-btn" onClick={removeImage}>
                    <FaTimes />
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder" onClick={() => fileRef.current.click()}>
                  <FaImage />
                  <span>Click to upload group image</span>
                </div>
              )}
              <input
                type="file"
                ref={fileRef}
                onChange={handleImageSelect}
                accept="image/*"
                hidden
              />
            </div>
          </div>

          {/* Group Name */}
          <div className="form-group">
            <label>Group Name *</label>
            <input
              type="text"
              name="name"
              placeholder="e.g., First-Time Moms Support"
              value={formData.name}
              onChange={handleChange}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              placeholder="What is this group about? Who should join?"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              maxLength={1000}
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label>Category</label>
            <select name="category" value={formData.category} onChange={handleChange}>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Privacy */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isPrivate"
                checked={formData.isPrivate}
                onChange={handleChange}
              />
              <span className="checkbox-text">
                <strong>Make this group private</strong>
                <small>Only approved members can see posts and join</small>
              </span>
            </label>
          </div>

          {/* Rules */}
          <div className="form-group">
            <label>Group Rules (Optional)</label>
            <textarea
              name="rules"
              placeholder="Enter each rule on a new line, e.g.:&#10;Be respectful to all members&#10;No spam or self-promotion&#10;Keep discussions on topic"
              value={formData.rules}
              onChange={handleChange}
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <button type="submit" className="btn btn-primary submit-btn" disabled={loading}>
            {loading ? 'Creating...' : <><FaPlus /> Create Group</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGroup;