import React, { useState } from 'react';
import './Signup.css';

const Signup = ({ onSwitch }) => {
  // 1. ડેટા સાચવવા માટે State
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  });
  
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2. ઇનપુટમાં લખાય ત્યારે ડેટા અપડેટ કરવા માટે
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 3. ફોર્મ સબમિટ થાય ત્યારે API કોલ કરવા માટે
  const handleSubmit = async (e) => {
    e.preventDefault(); // પેજ રિફ્રેશ થતું અટકાવશે
    
    // Validation: Check for empty fields
    if (!formData.name.trim() || !formData.email.trim()) {
      setMessage('⚠️ Please fill all fields');
      setIsSuccess(false);
      return;
    }

    setLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const response = await fetch('https://backend-1-mpd2.onrender.com/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setMessage('✅ Sign Up Successful!');
        console.log('Server Response:', data);
      } else {
        setIsSuccess(false);
        setMessage(`❌ Error: ${data.detail || 'Something went wrong'}`);
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
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit}>
          
          <div className="input-group">
            <label>Name</label>
            <input
              className="signup-input"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
          </div>

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
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>

          <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#cbd5e1' }}>
            Already have an account?{' '}
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
              Login
            </button>
          </div>

        </form>

        {/* મેસેજ બતાવવા માટે */}
        {message && (
          <div className={`message ${isSuccess ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;