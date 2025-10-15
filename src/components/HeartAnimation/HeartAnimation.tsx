import { useEffect, useState } from 'react';
import './HeartAnimation.css';

interface HeartAnimationProps {
  x: number;
  y: number;
  onComplete: () => void;
  type?: 'heart' | 'thumbs' | 'fire';
}

export const HeartAnimation = ({ x, y, onComplete, type = 'heart' }: HeartAnimationProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const getEmoji = () => {
    switch (type) {
      case 'heart': return '❤️';
      case 'thumbs': return '👍';
      case 'fire': return '🔥';
      default: return '❤️';
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`heart-animation ${type}`}
      style={{
        left: x,
        top: y,
      }}
    >
      {getEmoji()}
    </div>
  );
};

