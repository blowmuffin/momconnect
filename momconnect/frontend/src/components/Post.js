import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../services/api';
import { FaHeart, FaRegHeart, FaComment, FaBookmark, FaRegBookmark, FaTrash } from 'react-icons/fa';
import './Post.css';


const Post = ({ post, onDelete }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.likes?.includes(user?._id));
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [isSaved, setIsSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(post.comments || []);

  const handleLike = async () => {
    try {
      const res = await api.put(`/posts/${post._id}/like`);
      setIsLiked(res.data.isLiked);
      setLikesCount(res.data.likesCount);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    try {
      const res = await api.put(`/posts/${post._id}/save`);
      setIsSaved(res.data.isSaved);
    } catch (err) {
      console.error(err);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      const res = await api.post(`/posts/${post._id}/comment`, { content: comment });
      setComments([res.data, ...comments]);
      setComment('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this post?')) {
      try {
        await api.delete(`/posts/${post._id}`);
        onDelete && onDelete(post._id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  return (
    <div className="post card">
      <div className="post-header">
        <Link to={`/profile/${post.user?._id}`} className="post-user">
          <img
            src={post.user?.avatar ? `${API_URL}/uploads/avatars/${post.user.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.name || 'User')}&background=ff6b9d&color=fff&size=40`}
            alt={post.user?.name}
            className="avatar"
            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.name || 'User')}&background=ff6b9d&color=fff&size=40`; }}
          />
          <div>
            <span className="user-name">{post.user?.name}</span>
            <span className="post-time">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>
        </Link>
        {post.user?._id === user?._id && (
          <button className="delete-btn" onClick={handleDelete}><FaTrash /></button>
        )}
      </div>

      <div className="post-content">
        <p>{post.content}</p>
        {post.images?.length > 0 && (
          <div className="post-images">
            {post.images.map((img, i) => (
              <img key={i} src={`${API_URL}/uploads/posts/${img}`} alt="" />
            ))}
          </div>
        )}
      </div>

      <div className="post-stats">
        <span>{likesCount} likes</span>
        <span>{comments.length} comments</span>
      </div>

      <div className="post-actions">
        <button className={`action-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
          {isLiked ? <FaHeart /> : <FaRegHeart />} Like
        </button>
        <button className="action-btn" onClick={() => setShowComments(!showComments)}>
          <FaComment /> Comment
        </button>
        <button className={`action-btn ${isSaved ? 'saved' : ''}`} onClick={handleSave}>
          {isSaved ? <FaBookmark /> : <FaRegBookmark />} Save
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          <form onSubmit={handleComment} className="comment-form">
            <input
              type="text"
              placeholder="Write a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Post</button>
          </form>
          <div className="comments-list">
            {comments.map((c) => (
              <div key={c._id} className="comment">
                <img
                  src={c.user?.avatar ? `${API_URL}/uploads/avatars/${c.user.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user?.name || 'User')}&background=ff6b9d&color=fff&size=32`}
                  alt=""
                  className="avatar-sm"
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user?.name || 'User')}&background=ff6b9d&color=fff&size=32`; }}
                />
                <div className="comment-content">
                  <strong>{c.user?.name}</strong>
                  <p>{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;