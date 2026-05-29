import React from 'react';
import PropTypes from 'prop-types';

const overlayStyle = {
  display: 'none',
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.5)',
  zIndex: 1000,
  justifyContent: 'center',
  alignItems: 'center',
};

const contentStyle = {
  background: 'white',
  borderRadius: 20,
  padding: 24,
  textAlign: 'center',
  maxWidth: 280,
  width: '90%',
};

const imgStyle = {
  width: '100%',
  borderRadius: 12,
};

const textStyle = {
  marginTop: 10,
  fontSize: 13,
  color: '#6b7280',
};

function CoffeeModal({ open, onClose }) {
  if (!open) {
    return <div style={{ display: 'none' }}></div>;
  }

  const handleOverlayClick = () => {
    onClose();
  };

  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      style={{ ...overlayStyle, display: 'flex' }}
      onClick={handleOverlayClick}
    >
      <div style={contentStyle} onClick={handleContentClick}>
        <div style={{
          width: 160,
          height: 160,
          background: '#f3f4f6',
          borderRadius: 12,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
        }}>
          ☕
        </div>
        <p style={textStyle}>感谢你的支持 ☕</p>
      </div>
    </div>
  );
}

CoffeeModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

export default CoffeeModal;
