import { memo } from 'react';
import type { Track, PlaylistCollection } from '../../types/types';
import './AlbumArtCard.css';

interface AlbumArtCardProps {
  track: Track;
  playlistCollection: PlaylistCollection | null;
  isGuessWindowOver: boolean;
  ownerName?: string;
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

export const AlbumArtCard = memo(({ 
  track, 
  playlistCollection, 
  isGuessWindowOver, 
  ownerName 
}: AlbumArtCardProps) => {
  const comment = playlistCollection?.songs[track.uri]?.comment;
  const albumImage = track.album.images[0]?.url;

  return (
    <div className="album-art-card">
      {albumImage && (
        <img 
          src={albumImage} 
          alt={`${track.album.name} cover`}
          className="album-art-image"
        />
      )}
      
      <div className="track-info">
        <h2 className="track-title">{track.name}</h2>
        <p className="track-artists">
          {track.artists.map(artist => artist.name).join(', ')}
        </p>
        
        <div className="track-meta">
          <div className="added-by-info">
            <span>Added by:</span>
            <div className="owner-avatar">
              <div className={`owner-mask ${isGuessWindowOver ? 'revealed' : ''}`}>
                {isGuessWindowOver ? '' : '?'}
              </div>
            </div>
            <span className="owner-name">
              {isGuessWindowOver ? (ownerName || 'Unknown') : 'Hidden'}
            </span>
          </div>
        </div>

        {comment && (
          <div className="comment-display">
            <div className="comment-label">Song note:</div>
            {comment.promptKey ? (
              <div className="comment-with-prompt">
                <div className="comment-prompt">
                  {getPromptText(comment.promptKey)}
                </div>
                <div className="comment-text">{comment.text}</div>
              </div>
            ) : (
              <div className="comment-text">{comment.text}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

