import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../services/api';
import { FaImage, FaTimes } from 'react-icons/fa';
import './CreatePost.css';

const CreatePost = ({ onPostCreated, groupId }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const categories = [
    { value: 'general', label: '💬 General' },
    { value: 'advice', label: '💡 Advice' },
    { value: 'milestone', label: '🎉 Milestone' },
    { value: 'recipe', label: '🍳 Recipe' },
    { value: 'health', label: '🏥 Health' },
    { value: 'fun', label: '🎈 Fun' },
    { value: 'question', label: '❓ Question' },
    { value: 'support', label: '❤️ Support' },
  ];

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }
    setImages([...images, ...files]);
    setPreviews([...previews, ...files.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('category', category);
      if (groupId) {
        formData.append('groupId', groupId);
      }
      images.forEach(img => formData.append('images', img));

      const res = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setContent('');
      setImages([]);
      setPreviews([]);
      setCategory('general');
      onPostCreated && onPostCreated(res.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to create post');
    }
    setLoading(false);
  };

  return (
    <div className="create-post card">
      <div className="create-post-header">
        <img
          src={user?.avatar ? `${API_URL}/uploads/avatars/${user.avatar}` : 'https://via.placeholder.com/40'}
          alt=""
          className="avatar"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="category-select">
          {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          placeholder={`What's on your mind, ${user?.name?.split(' ')[0]}? 🌸`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />

        {previews.length > 0 && (
          <div className="image-previews">
            {previews.map((url, i) => (
              <div key={i} className="preview">
                <img src={url} alt="" />
                <button type="button" onClick={() => removeImage(i)}><FaTimes /></button>
              </div>
            ))}
          </div>
        )}

        <div className="create-post-actions">
          <input type="file" ref={fileRef} onChange={handleImageSelect} accept="image/*" multiple hidden />
          <button type="button" className="add-photo" onClick={() => fileRef.current.click()}>
            <FaImage /> Photo
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || !content.trim()}>
            {loading ? 'Posting...' : 'Share'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;