// src/components/GameGrid.tsx

import React, { useState, useEffect } from 'react';

interface GameGridProps {
  gridSize: number;
  sequence: number[];
  status: 'sequence' | 'input' | 'correct' | 'incorrect';
  isUserTurn: boolean;
  onTileClick: (index: number) => void;
  onSequenceComplete: () => void;
  sequenceDelay: number;
}

const GameGrid: React.FC<GameGridProps> = ({
  gridSize,
  sequence,
  status,
  isUserTurn,
  onTileClick,
  onSequenceComplete,
  sequenceDelay
}) => {
  const [litTile, setLitTile] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'sequence') {
      let i = 0;
      const interval = setInterval(() => {
        if (i < sequence.length) {
          setLitTile(sequence[i]);
          i++;
        } else {
          setLitTile(null);
          clearInterval(interval);
          onSequenceComplete();
        }
      }, sequenceDelay);

      const cleanupTimeout = setTimeout(() => {
        setLitTile(null);
      }, sequence.length * sequenceDelay + sequenceDelay / 2);

      return () => {
        clearInterval(interval);
        clearTimeout(cleanupTimeout);
      };
    }
  }, [status, sequence, onSequenceComplete, sequenceDelay]);

  const getTileClass = (index: number) => {
    let className = 'tile';
    if (index === litTile) {
      className += ' lit';
    }
    if (status === 'incorrect') {
      className += ' incorrect';
    }
    if (status === 'correct') {
      className += ' correct';
    }
    return className;
  };

  return (
    <div className="grid-container">
      {Array.from({ length: gridSize }).map((_, index) => (
        <button
          key={index}
          className={getTileClass(index)}
          disabled={!isUserTurn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTileClick(index);
          }}
        />
      ))}
    </div>
  );
};

export default GameGrid;
