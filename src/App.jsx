import { useState, useEffect } from 'react';
import Signup from './Signup';
import Login from './Login';
import MarketDashboard from './MarketDashboard';
import './App.css';

function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [authData, setAuthData] = useState(() => {
    // Check for existing session on load
    const savedSession = localStorage.getItem('user_session');
    return savedSession ? JSON.parse(savedSession) : null;
  });

  // If user is logged in, show Dashboard
  if (authData) {
    return <MarketDashboard ws_id={authData.ws_id} userId={authData.user_id} />;
  }

  return (
    <>
      {isLogin ? (
        <Login 
          onSwitch={() => setIsLogin(false)} 
          onLoginSuccess={(data) => setAuthData(data)}
        />
      ) : (
        <Signup onSwitch={() => setIsLogin(true)} />
      )}
    </>
  );
}

export default App;
