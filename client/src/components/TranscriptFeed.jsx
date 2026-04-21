// components/TranscriptFeed.jsx
// Shows the spoken conversation as a transcript scroll below the avatar

import { useEffect, useRef } from 'react';
import './TranscriptFeed.css';

export default function TranscriptFeed({ entries }) {
  // entries: [{ role: 'arjun' | 'you', text: string, id: number }]
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="transcript-feed">
      {entries.map((entry, i) => (
        <div
          key={entry.id ?? i}
          className={`transcript-entry ${entry.role}`}
          style={{ animationDelay: `${Math.min(i * 0.03, 0.2)}s` }}
        >
          <span className="transcript-speaker">
            {entry.role === 'arjun' ? 'Arjun' : 'You'}
          </span>
          <p className="transcript-text">{entry.text}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
