import React, { useState } from 'react';
import { API_BASE_URL } from './apiConfig';
import './TradeModal.css';

const TradeModal = ({ isOpen, onClose, tokenData, marketData, type, userId, onOrderSuccess }) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Derive live price if available, else static
  const tokenKey = tokenData?.token ? String(tokenData.token) : null;
  const liveTokenData = marketData && tokenKey ? marketData[tokenKey] : null;
  
  // DEBUG: Log to see if we satisfy the condition
  // console.log(`TradeModal Token: ${tokenKey}, Live Data:`, liveTokenData);

  const currentLtp = liveTokenData?.last_price || liveTokenData?.ltp || tokenData.ltp || 0;
  const currentChange = liveTokenData?.change_percent || liveTokenData?.percent_change || tokenData.change_diff || 0;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        user_id: userId,
        token: tokenData.token, // Ensure this is the token ID string
        symbol_name: tokenData.name || tokenData.symbol, // Use the resolved name
        order_type: type, // "BUY" or "SELL"
        quantity: parseInt(quantity)
      };

      console.log("Placing Order:", payload);

      const response = await fetch(`${API_BASE_URL}/trade/place_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess(`✅ ${data.message}`);
        setTimeout(() => {
            onOrderSuccess();
            onClose();
        }, 1500);
      } else {
        setError(`❌ ${data.message || 'Order Failed'}`);
      }
    } catch (err) {
      console.error("Order Error:", err);
      setError('❌ Network Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
            <h2 style={{ color: type === 'BUY' ? '#4ade80' : '#f87171' }}>
                {type} {tokenData.name || "Unknown"}
            </h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="price-display">
            LTP: 
            <span className={tokenData.change_diff >= 0 ? "text-green" : "text-red"}>
                ₹{tokenData.ltp || "0.00"}
            </span>
        </div>

        <form onSubmit={handleSubmit}>
            <div className="input-group">
                <label>Quantity</label>
                <input 
                    type="number" 
                    min="1" 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    className="trade-input"
                    required
                />
            </div>

            <div className="estimated-total">
                Est. Total: ₹{(quantity * (tokenData.ltp || 0)).toFixed(2)}
            </div>

            {error && <div className="error-msg">{error}</div>}
            {success && <div className="success-msg">{success}</div>}

            <button 
                type="submit" 
                className={`trade-btn ${type === 'BUY' ? 'btn-buy' : 'btn-sell'}`}
                disabled={loading}
            >
                {loading ? 'Processing...' : `Confirm ${type} @ ${parseFloat(currentLtp || 0).toFixed(2)}`}
            </button>
        </form>
      </div>
    </div>
  );
};

export default TradeModal;
