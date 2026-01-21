import { useState, useEffect } from 'react';
import Signup from './Signup';
import Login from './Login';
import MarketDashboard from './MarketDashboard';
import './App.css';

import Portfolio from './Portfolio';
import TradeHistory from './TradeHistory';

function App() {
  const [isLogin, setIsLogin] = useState(false); // Restore state
  const [authData, setAuthData] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'portfolio', 'history'

  // Load session from local storage on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('user_session');
    if (storedSession) {
      setAuthData(JSON.parse(storedSession));
    }
  }, []);

  const handleLoginSuccess = (data) => {
    setAuthData(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('user_session');
    localStorage.removeItem('token');
    setAuthData(null);
    setCurrentView('dashboard');
  };

  // If user is logged in
  if (authData) {
      // Always render MarketDashboard, pass currentView to control main content
      return <MarketDashboard 
                ws_id={authData.ws_id} 
                userId={authData.user_id} 
                activeView={currentView}
                onNavigateToDashboard={() => setCurrentView('dashboard')}
                onNavigateToPortfolio={() => setCurrentView('portfolio')}
                onNavigateToHistory={() => setCurrentView('history')}
                onLogout={handleLogout} 
             />;
  }

  return (
    <>
      {isLogin ? (
        <Login 
          onSwitch={() => setIsLogin(false)} 
          onLoginSuccess={handleLoginSuccess}
        />
      ) : (
        <Signup onSwitch={() => setIsLogin(true)} />
      )}
    </>
  );
}

export default App;
