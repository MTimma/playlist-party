import { useState } from 'react';
import { HeartAnimation } from '../HeartAnimation/HeartAnimation';
import './ReactionButton.css';

interface ReactionButtonProps {
  type: 'heart' | 'thumbs' | 'fire';
  count: number;
  isActive: boolean;
  onReact: () => void;
  disabled?: boolean;
}

interface AnimationState {
  id: string;
  x: number;
  y: number;
}

export const ReactionButton = ({ 
  type, 
  count, 
  isActive, 
  onReact, 
  disabled = false 
}: ReactionButtonProps) => {
  const [animations, setAnimations] = useState<AnimationState[]>([]);

  const getEmoji = () => {
    switch (type) {
      case 'heart': return '❤️';
      case 'thumbs': return '👍';
      case 'fire': return '🔥';
      default: return '❤️';
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    if (disabled) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Create new animation
    const newAnimation: AnimationState = {
      id: Date.now().toString(),
      x,
      y,
    };

    setAnimations(prev => [...prev, newAnimation]);
    onReact();
  };

  const removeAnimation = (id: string) => {
    setAnimations(prev => prev.filter(anim => anim.id !== id));
  };

  return (
    <button
      className={`reaction-button ${type} ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={`React with ${type}`}
    >
      <span className="reaction-emoji">{getEmoji()}</span>
      {count > 0 && <span className="reaction-count">{count}</span>}
      
      {animations.map(animation => (
        <HeartAnimation
          key={animation.id}
          x={animation.x}
          y={animation.y}
          type={type}
          onComplete={() => removeAnimation(animation.id)}
        />
      ))}
    </button>
  );
};

