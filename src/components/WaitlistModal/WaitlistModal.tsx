import { useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import './WaitlistModal.css';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
}

export const WaitlistModal = ({ isOpen, onClose, onSubmit }: WaitlistModalProps) => {
  const [email, setEmail] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(email);
      setSuccess(true);
      setEmail('');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setEmail('');
      setConsentGiven(false);
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  return (
    <div className="waitlist-modal-overlay" onClick={handleClose}>
      <div className="waitlist-modal" onClick={(e) => e.stopPropagation()}>
        <button className="waitlist-modal-close" onClick={handleClose} disabled={isSubmitting}>
          ×
        </button>
        
        {!success ? (
          <>
            <h2>{t('waitlist.title')}</h2>
            {/* <div className="waitlist-warning">
              <p className="waitlist-warning-title">{t('waitlist.limitedAvailability')}</p>
              <p>{t('waitlist.limitDescription')}</p>
              <p>{t('waitlist.joinDescription')}</p>
            </div> */}

            <form onSubmit={handleSubmit} className="waitlist-form">

            <div className="privacy-notice">
                <h4>{t('waitlist.privacyTitle')}</h4>
                <ul>
                  <li>{t('waitlist.privacyNotify')}</li>
                  <li>{t('waitlist.privacySecure')}</li>
                  <li>{t('waitlist.privacyDelete')}</li>
                  <li>{t('waitlist.privacyContact')} <strong>marti.timma@gmail.com</strong></li>
                </ul>
              </div>
              <input
                type="email"
                placeholder={t('waitlist.enterEmail')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="waitlist-input"
                required
              />
              
              
              <label className="consent-checkbox">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  disabled={isSubmitting}
                  required
                />
                <span>{t('waitlist.consentText')}</span>
              </label>
              
              {error && <div className="waitlist-error">{error}</div>}
              
              <button 
                type="submit" 
                className="waitlist-submit-btn"
                disabled={isSubmitting || !consentGiven}
              >
                {isSubmitting ? t('waitlist.joining') : t('waitlist.joinWaitlist')}
              </button>
            </form>
          </>
        ) : (
          <div className="waitlist-success">
            <div className="waitlist-success-icon">✓</div>
            <h3>{t('waitlist.successTitle')}</h3>
            <p>{t('waitlist.successMessage')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

