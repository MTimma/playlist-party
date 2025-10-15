import { useState, memo } from 'react';
import { ReactionButton } from '../ReactionButton/ReactionButton';
import './CommentPrompt.css';

interface CommentPromptProps {
  trackName: string;
  onSubmit: (comment: { text: string; promptKey?: string }) => Promise<void>;
  onSkip: () => void;
  isSubmitting?: boolean;
}

const PROMPTS = [
  { key: 'first_heard', text: 'What were you doing when you first heard this song?' },
  { key: 'reminds_who', text: 'Who does this song remind you of?' },
  { key: 'heard_where', text: 'Where did you hear it?' },
  { key: 'why_special', text: 'Why is it special?' },
  { key: 'favorite_memory', text: 'What\'s your favorite memory with this song?' },
  { key: 'makes_me_feel', text: 'How does this song make you feel?' },
  { key: 'perfect_moment', text: 'What\'s the perfect moment for this song?' },
  { key: 'song_story', text: 'What\'s the story behind this song for you?' },
  { key: 'hidden_meaning', text: 'What hidden meaning does this song have?' },
  { key: 'dance_move', text: 'What dance move goes with this song?' },
  { key: 'karaoke_memory', text: 'Any karaoke memories with this song?' },
  { key: 'road_trip_song', text: 'Is this a good road trip song?' }
];

export const CommentPrompt = memo(({ 
  trackName, 
  onSubmit, 
  onSkip, 
  isSubmitting = false 
}: CommentPromptProps) => {
  const [currentPrompt, setCurrentPrompt] = useState(() => 
    PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
  );
  const [commentText, setCommentText] = useState('');
  const [usePrompt, setUsePrompt] = useState(true);

  const generateNewPrompt = () => {
    let newPrompt;
    do {
      newPrompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    } while (newPrompt.key === currentPrompt.key && PROMPTS.length > 1);
    setCurrentPrompt(newPrompt);
  };

  const handleSubmit = async () => {
    if (!commentText.trim()) return;

    try {
      await onSubmit({
        text: commentText.trim(),
        promptKey: usePrompt ? currentPrompt.key : undefined
      });
    } catch (error) {
      console.error('Failed to submit comment:', error);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <div className="comment-prompt-overlay">
      <div className="comment-prompt-modal">
        <div className="modal-header">
          <h3 className="modal-title">Add a note about this song</h3>
          <p className="modal-subtitle">🎵 {trackName}</p>
        </div>

        <div className="prompt-section">
          <div className="prompt-toggle">
            <label className="toggle-container">
              <input
                type="checkbox"
                checked={usePrompt}
                onChange={(e) => setUsePrompt(e.target.checked)}
                className="toggle-input"
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">Use prompt</span>
            </label>
          </div>

          {usePrompt && (
            <div className="prompt-display">
              <div className="prompt-text">{currentPrompt.text}</div>
              <button 
                className="regenerate-btn"
                onClick={generateNewPrompt}
                type="button"
              >
                🎲 New prompt
              </button>
            </div>
          )}
        </div>

        <div className="comment-input-section">
          <textarea
            className="comment-textarea"
            placeholder={usePrompt ? "Your answer..." : "Share your thoughts about this song..."}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={4}
            maxLength={500}
          />
          <div className="character-count">
            {commentText.length}/500
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="skip-btn"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Skip for now
          </button>
          <button 
            className="submit-btn"
            onClick={handleSubmit}
            disabled={!commentText.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <div className="submit-spinner">
                <div className="spinner-dot"></div>
                <div className="spinner-dot"></div>
                <div className="spinner-dot"></div>
              </div>
            ) : (
              'Add note'
            )}
          </button>
        </div>

        <div className="modal-footer">
          <p className="footer-text">
            Other players will see your note and can react to it! ❤️ 👍 🔥
          </p>
        </div>
      </div>
    </div>
  );
});

