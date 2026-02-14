import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import CreatePost from '../components/CreatePost';
import Post from '../components/Post';
import './Home.css';

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'advice', label: 'Advice' },
    { value: 'milestone', label: 'Milestones' },
    { value: 'recipe', label: 'Recipes' },
    { value: 'health', label: 'Health' },
    { value: 'fun', label: 'Fun' },
  ];

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/posts?category=${category}`);
      setPosts(res.data.posts || []);
    } catch (err) {
      console.error(err);
      setPosts([]);
    }
    setLoading(false);
  }, [category]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  const handlePostDelete = (postId) => {
    setPosts(posts.filter(p => p._id !== postId));
  };

  return (
    <div className="home-page">
      <CreatePost onPostCreated={handlePostCreated} />

      <div className="category-filter">
        {categories.map(c => (
          <button
            key={c.value}
            className={`filter-btn ${category === c.value ? 'active' : ''}`}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-message">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="card empty-state">
          <h3>No posts yet</h3>
          <p>Be the first to share something!</p>
        </div>
      ) : (
        posts.map(post => (
          <Post key={post._id} post={post} onDelete={handlePostDelete} />
        ))
      )}
    </div>
  );
};

export default Home;