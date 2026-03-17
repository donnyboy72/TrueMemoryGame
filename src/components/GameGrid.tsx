// src/components/GameGrid.tsx

import React, { useState, useEffect } from 'react';

interface GameGridProps {
  gridSize: number;
  sequence: number[];
  status: 'sequence' | 'input' | 'correct' | 'incorrect';
  isUserTurn: boolean;
  onTileClick: (index: number, clickX: number, clickY: number) => void;
  onSequenceComplete: () => void;
  sequenceDelay: number;
  stimulusDuration: number;
}

const GameGrid: React.FC<GameGridProps> = ({
  gridSize,
  sequence,
  status,
  isUserTurn,
  onTileClick,
  onSequenceComplete,
  sequenceDelay,
  stimulusDuration
}) => {
  const [litTile, setLitTile] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'sequence') {
      let i = 0;
      const playSequence = async () => {
        for (const tileIndex of sequence) {
          setLitTile(tileIndex);
          await new Promise(resolve => setTimeout(resolve, stimulusDuration));
          setLitTile(null);
          await new Promise(resolve => setTimeout(resolve, sequenceDelay - stimulusDuration));
        }
        onSequenceComplete();
      };

      playSequence();
    }
  }, [status, sequence, onSequenceComplete, sequenceDelay, stimulusDuration]);

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

  const columns = Math.sqrt(gridSize);

  return (
    <div 
      className="grid-container" 
      style={{ gridTemplateColumns: `repeat(${columns}, var(--tile-size))` }}
    >
      {Array.from({ length: gridSize }).map((_, index) => (
        <button
          key={index}
          className={getTileClass(index)}
          data-tile-index={index}
          disabled={!isUserTurn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTileClick(index, e.clientX, e.clientY);
          }}
        />
      ))}
    </div>
  );
};

export default GameGrid;
