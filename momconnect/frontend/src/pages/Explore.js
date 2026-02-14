import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Post from '../components/Post';
import { FaFire, FaClock, FaHeart, FaFilter, FaSpinner } from 'react-icons/fa';
import './Explore.css';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'parenting', label: '👶 Parenting' },
  { value: 'health', label: '💪 Health' },
  { value: 'recipes', label: '🍳 Recipes' },
  { value: 'activities', label: '🎨 Activities' },
  { value: 'support', label: '💝 Support' },
  { value: 'general', label: '💬 General' }
];

const Explore = () => {
  const [activeTab, setActiveTab] = useState('foryou');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    fetchPosts(1, true);
  }, [activeTab, category]);

  const fetchPosts = async (pageNum = 1, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      let endpoint = '/posts/explore';
      if (activeTab === 'foryou') {
        endpoint = '/posts/recommendations';
      }

      const params = new URLSearchParams({
        page: pageNum,
        limit: 10,
        ...(category !== 'all' && { category })
      });

      const res = await api.get(`${endpoint}?${params}`);
      const newPosts = res.data.posts || [];

      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }

      setHasMore(pageNum < res.data.totalPages);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(page + 1, false);
    }
  };

  const tabs = [
    { id: 'foryou', label: 'For You', icon: FaHeart },
    { id: 'trending', label: 'Trending', icon: FaFire },
    { id: 'recent', label: 'Recent', icon: FaClock }
  ];

  // Skeleton loader component
  const SkeletonPost = () => (
    <div className="skeleton-card">
      <div className="skeleton-header">
        <div className="skeleton skeleton-avatar"></div>
        <div className="skeleton-info">
          <div className="skeleton skeleton-text" style={{ width: '120px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '80px' }}></div>
        </div>
      </div>
      <div className="skeleton skeleton-text" style={{ width: '100%' }}></div>
      <div className="skeleton skeleton-text" style={{ width: '100%' }}></div>
      <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
    </div>
  );

  return (
    <div className="explore-page">
      {/* Page Header */}
      <div className="explore-header">
        <h1>🌎 Explore</h1>
        <p className="explore-subtitle">Discover posts from the MomConnect community</p>
      </div>

      {/* Tabs */}
      <div className="explore-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        <FaFilter className="filter-icon" />
        <div className="category-pills">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`category-pill ${category === cat.value ? 'active' : ''}`}
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="explore-content">
        {loading ? (
          <div className="skeleton-list">
            {[1, 2, 3].map(i => <SkeletonPost key={i} />)}
          </div>
        ) : error ? (
          <div className="error-state card">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => fetchPosts(1, true)}>
              Try Again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state card">
            <h3>No posts found</h3>
            <p>
              {activeTab === 'foryou'
                ? 'Start interacting with posts to get personalized recommendations!'
                : 'Be the first to post in this category!'}
            </p>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <Post key={post._id} post={post} />
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="load-more">
                <button
                  className="btn btn-secondary"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Explore;