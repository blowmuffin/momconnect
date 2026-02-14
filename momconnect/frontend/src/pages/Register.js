import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHeart, FaUser, FaEnvelope, FaLock } from 'react-icons/fa';
import './Auth.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const { register, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await register(name, email, password);
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
          <h1>Join MomConnect</h1>
          <p>Connect with moms like you! 🌸</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {(error || localError) && <div className="error-alert">{error || localError}</div>}

          <div className="form-group">
            <div className="input-icon">
              <FaUser />
              <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <div className="input-icon">
              <FaEnvelope />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <div className="input-icon">
              <FaLock />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <div className="input-icon">
              <FaLock />
              <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;