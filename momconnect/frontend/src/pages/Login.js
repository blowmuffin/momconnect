import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHeart, FaEnvelope, FaLock } from 'react-icons/fa';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error, setError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <FaHeart className="auth-logo" />
          <h1>MomConnect</h1>
          <p>Welcome back, Mama! 💕</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-alert">{error}</div>}

          <div className="form-group">
            <div className="input-icon">
              <FaEnvelope />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-icon">
              <FaLock />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>New to MomConnect? <Link to="/register">Join us</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;