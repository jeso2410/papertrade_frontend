import React, { useState } from 'react';
import { API_BASE_URL } from './apiConfig';
import './Signup.css';

const Login = ({ onSwitch, onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    email: ''
  });
  
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation: Check for empty fields
    if (!formData.email.trim()) {
      setMessage('⚠️ Please fill all fields');
      setIsSuccess(false);
      return;
    }

    setLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies/headers are passed
        body: JSON.stringify({
          email: formData.email
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setMessage('✅ Login Successful!');
        console.log('User Data:', data);
        console.log('Logged in User ID:', data.user_id);
        
        if (data.access_token) {
          localStorage.setItem('token', data.access_token);
        }
        
        // Save user details for session persistence
        localStorage.setItem('user_session', JSON.stringify(data));

        // Call parent handler with full data (including ws_id)
        if (onLoginSuccess) {
           // Small delay to show success message before switching
           setTimeout(() => {
             onLoginSuccess(data);
           }, 1000);
        }

      } else {
        setIsSuccess(false);
        setMessage(`❌ Error: ${data.detail || 'Invalid credentials'}`);
      }
    } catch (error) {
      setIsSuccess(false);
      setMessage('❌ Failed to connect to server');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h2>Welcome Back</h2>
        <form onSubmit={handleSubmit}>

          <div className="input-group">
            <label>Email</label>
            <input
              className="signup-input"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="user@example.com"
              required
            />
          </div>

          <button type="submit" className="signup-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#cbd5e1' }}>
            Don't have an account?{' '}
            <button 
              type="button" 
              onClick={onSwitch}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#a5b4fc', 
                cursor: 'pointer', 
                textDecoration: 'underline',
                padding: 0,
                fontSize: 'inherit',
                fontFamily: 'inherit'
              }}
            >
              Sign Up
            </button>
          </div>

        </form>

        {message && (
          <div className={`message ${isSuccess ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;