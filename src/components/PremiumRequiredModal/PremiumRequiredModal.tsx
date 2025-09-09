import React from 'react';
import './PremiumRequiredModal.css';

interface PremiumRequiredModalProps {
  onClose: () => void;
}

const PremiumRequiredModal: React.FC<PremiumRequiredModalProps> = ({ onClose }) => {
  return (
    <div className="premium-modal-overlay" role="dialog" aria-modal="true">
      <div className="premium-modal">
        <h2 className="premium-modal-title">Spotify Premium Required</h2>
        <p className="premium-modal-text">
          Playlist Partyuses the Spotify Web Playback SDK which is only available for Premium
          accounts. Please upgrade to Spotify Premium or log in with a Premium account to
          continue.
        </p>
        <div className="premium-modal-actions">
          <a
            href="https://www.spotify.com/premium/"
            target="_blank"
            rel="noopener noreferrer"
            className="premium-modal-learnmore"
          >
            Learn More
          </a>
          <button className="premium-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumRequiredModal;



