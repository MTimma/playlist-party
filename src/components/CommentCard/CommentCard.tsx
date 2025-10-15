import { memo } from 'react';
import { ReactionButton } from '../ReactionButton/ReactionButton';
import './CommentCard.css';

interface CommentCardProps {
  comment: {
    text: string;
    promptKey?: string;
    createdBy: string;
    updatedAt: Date;
  };
  authorName: string;
  currentUserId: string | null;
  reactions?: {
    hearts: { [userId: string]: boolean };
    thumbs: { [userId: string]: boolean };
    fire: { [userId: string]: boolean };
  };
  onReact?: (type: 'heart' | 'thumbs' | 'fire') => void;
}

const getPromptText = (promptKey: string): string => {
  const prompts: Record<string, string> = {
    'first_heard': 'What were you doing when you first heard this song?',
    'reminds_who': 'Who does this song remind you of?',
    'heard_where': 'Where did you hear it?',
    'why_special': 'Why is it special?',
    'favorite_memory': 'What\'s your favorite memory with this song?',
    'makes_me_feel': 'How does this song make you feel?',
    'perfect_moment': 'What\'s the perfect moment for this song?',
    'song_story': 'What\'s the story behind this song for you?',
    'hidden_meaning': 'What hidden meaning does this song have?',
    'dance_move': 'What dance move goes with this song?',
    'karaoke_memory': 'Any karaoke memories with this song?',
    'road_trip_song': 'Is this a good road trip song?'
  };
  return prompts[promptKey] || '';
};

export const CommentCard = memo(({ 
  comment, 
  authorName, 
  currentUserId,
  reactions = { hearts: {}, thumbs: {}, fire: {} },
  onReact
}: CommentCardProps) => {
  const isOwnComment = comment.createdBy === currentUserId;
  
  const heartCount = Object.keys(reactions.hearts).length;
  const thumbsCount = Object.keys(reactions.thumbs).length;
  const fireCount = Object.keys(reactions.fire).length;
  
  const hasReactedHeart = currentUserId ? reactions.hearts[currentUserId] : false;
  const hasReactedThumbs = currentUserId ? reactions.thumbs[currentUserId] : false;
  const hasReactedFire = currentUserId ? reactions.fire[currentUserId] : false;

  const handleReaction = (type: 'heart' | 'thumbs' | 'fire') => {
    if (onReact && !isOwnComment) {
      onReact(type);
    }
  };

  return (
    <div className={`comment-card ${isOwnComment ? 'own-comment' : ''}`}>
      <div className="comment-header">
        <div className="author-info">
          <div className="author-avatar">
            {authorName.charAt(0).toUpperCase()}
          </div>
          <div className="author-details">
            <span className="author-name">
              {authorName}
              {isOwnComment && ' (You)'}
            </span>
            <span className="comment-time">
              {new Date(comment.updatedAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="comment-content">
        {comment.promptKey && (
          <div className="comment-prompt">
            {getPromptText(comment.promptKey)}
          </div>
        )}
        <div className="comment-text">
          {comment.text}
        </div>
      </div>

      {onReact && !isOwnComment && (
        <div className="comment-reactions">
          <ReactionButton
            type="heart"
            count={heartCount}
            isActive={hasReactedHeart}
            onReact={() => handleReaction('heart')}
          />
          <ReactionButton
            type="thumbs"
            count={thumbsCount}
            isActive={hasReactedThumbs}
            onReact={() => handleReaction('thumbs')}
          />
          <ReactionButton
            type="fire"
            count={fireCount}
            isActive={hasReactedFire}
            onReact={() => handleReaction('fire')}
          />
        </div>
      )}

      {isOwnComment && (heartCount > 0 || thumbsCount > 0 || fireCount > 0) && (
        <div className="comment-reactions readonly">
          {heartCount > 0 && (
            <div className="reaction-display">
              <span className="reaction-emoji">❤️</span>
              <span className="reaction-count">{heartCount}</span>
            </div>
          )}
          {thumbsCount > 0 && (
            <div className="reaction-display">
              <span className="reaction-emoji">👍</span>
              <span className="reaction-count">{thumbsCount}</span>
            </div>
          )}
          {fireCount > 0 && (
            <div className="reaction-display">
              <span className="reaction-emoji">🔥</span>
              <span className="reaction-count">{fireCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

