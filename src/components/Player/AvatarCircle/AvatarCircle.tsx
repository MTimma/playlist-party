import React from 'react';
import './AvatarCircle.css';

interface AvatarCircleProps {
  name: string;
  avatarType?: 'initials' | 'preset';
  avatarPresetId?: string;
  avatarUrl?: string;
  size?: number;
  masked?: boolean; // show ? overlay
}

export const AvatarCircle: React.FC<AvatarCircleProps> = ({
  name,
  avatarType = 'initials',
  avatarPresetId,
  avatarUrl,
  size = 40,
  masked = false,
}) => {
  const initials = name
    .split(' ')
    .map(w => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const imgSrc = avatarUrl || (avatarType === 'preset' && avatarPresetId ? `/presets/${avatarPresetId}.png` : undefined);

  return (
    <div className={`avatar-circle ${masked ? 'masked' : ''}`} style={{ width: size, height: size }}>
      {imgSrc ? (
        <img src={imgSrc} alt={`${name}'s avatar`} className="avatar-image" />
      ) : (
        <div className="avatar-initials">{initials}</div>
      )}
      {masked && (
        <div className="avatar-mask">?</div>
      )}
    </div>
  );
};

export default AvatarCircle;


