import type React from 'react';
import './TrackInfoCard.css';

export interface TrackInfoCardProps {
  albumImageUrl: string | undefined;
  name: string;
  artistsText: string;
  statusText?: string | null;
  statusVariant?: 'added-by-user' | 'added-by-other';
  isDisabled?: boolean;
  onClick: () => void;
  onPreview?: (e: React.MouseEvent) => void;
  hasPreview?: boolean;
  onRemove?: (e: React.MouseEvent) => void;
  showRemove?: boolean;
}

export function TrackInfoCard({
  albumImageUrl,
  name,
  artistsText,
  statusText,
  statusVariant,
  isDisabled = false,
  onClick,
  onPreview,
  hasPreview = false,
  onRemove,
  showRemove = false,
}: TrackInfoCardProps) {
  return (
    <button
      type="button"
      className={`track-info-card ${isDisabled ? 'disabled' : ''} ${statusVariant ? `status-${statusVariant}` : ''}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
    >
      <img
        src={albumImageUrl}
        alt="Album art"
        className="track-info-card__image"
      />

      <div className="track-info-card__details">
        <div className="track-info-card__name" title={name}>{name}</div>
        <div className="track-info-card__artists" title={artistsText}>{artistsText}</div>
      </div>

      <div className="track-info-card__right">
        {statusText && (
          <div className={`track-info-card__status ${statusVariant || ''}`}>
            {/* <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg> */}
            <span>{statusText}</span>
          </div>
        )}

        {hasPreview && (
          <span
            className="track-info-card__remove-btn"
            onClick={(e) => {
              e.stopPropagation();
              onPreview?.(e);
            }}
            role="button"
            aria-label="Play preview"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}

        {showRemove && (
          <span
            className="track-info-card__remove-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(e);
            }}
            role="button"
            aria-label="Remove from playlist"
            title="Remove from playlist"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm3-9h2v7H9V10zm4 0h2v7h-2V10zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}

export default TrackInfoCard;


