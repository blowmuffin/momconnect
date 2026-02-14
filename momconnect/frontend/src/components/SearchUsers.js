import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { API_URL } from '../services/api';
import { FaSearch, FaTimes, FaSpinner } from 'react-icons/fa';
import './SearchUsers.css';

const SearchUsers = ({ onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        const searchUsers = async () => {
            if (query.trim().length < 2) {
                setResults([]);
                setShowResults(false);
                return;
            }

            setLoading(true);
            try {
                const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
                setResults(res.data.users || []);
                setShowResults(true);
            } catch (err) {
                console.error('Search error:', err);
                setResults([]);
            }
            setLoading(false);
        };

        const debounce = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounce);
    }, [query]);

    const handleSelect = (userId) => {
        setQuery('');
        setShowResults(false);
        navigate(`/profile/${userId}`);
        onClose?.();
    };

    const getAvatarUrl = (user) => {
        if (user.avatar) {
            return `${API_URL}/uploads/avatars/${user.avatar}`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ff6b9d&color=fff&size=40`;
    };

    return (
        <div className="search-container">
            <div className="search-input-wrapper">
                <FaSearch className="search-icon" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search people by name..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="search-input"
                />
                {query && (
                    <button className="clear-btn" onClick={() => setQuery('')}>
                        <FaTimes />
                    </button>
                )}
                {loading && <FaSpinner className="loading-icon animate-spin" />}
            </div>

            {showResults && (
                <div className="search-results">
                    {results.length === 0 ? (
                        <div className="no-results">
                            <p>No users found for "{query}"</p>
                        </div>
                    ) : (
                        <>
                            <div className="results-header">
                                <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
                            </div>
                            {results.map((user) => (
                                <div
                                    key={user._id}
                                    className="result-item"
                                    onClick={() => handleSelect(user._id)}
                                >
                                    <img
                                        src={getAvatarUrl(user)}
                                        alt={user.name}
                                        className="avatar"
                                        onError={(e) => {
                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ff6b9d&color=fff&size=40`;
                                        }}
                                    />
                                    <div className="result-info">
                                        <span className="result-name">{user.name}</span>
                                        {user.location && (
                                            <span className="result-location">📍 {user.location}</span>
                                        )}
                                        {user.bio && (
                                            <span className="result-bio">{user.bio.slice(0, 50)}{user.bio.length > 50 ? '...' : ''}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchUsers;
