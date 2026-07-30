// candidate/LiveTranscript.jsx
// Live rolling transcript — streams words in as they arrive

import { useEffect, useRef, useState } from 'react';
import './LiveTranscript.css';

export default function LiveTranscript({ entries, phase }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="lt-root">
      {entries.map((entry) => (
        <TranscriptEntry key={entry.id} entry={entry} />
      ))}

      {/* Live indicator when processing */}
      {phase === 'processing' && (
        <div className="lt-entry lt-entry--you">
          <span className="lt-label">You</span>
          <span className="lt-bubble lt-bubble--processing">
            <span className="lt-dot" /><span className="lt-dot" /><span className="lt-dot" />
          </span>
        </div>
      )}

      {phase === 'arjun_thinking' && (
        <div className="lt-entry lt-entry--arjun">
          <span className="lt-label">Ammy</span>
          <span className="lt-bubble lt-bubble--processing">
            <span className="lt-dot" /><span className="lt-dot" /><span className="lt-dot" />
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

// Typewriter effect for Arjun's messages, instant for candidate
function TranscriptEntry({ entry }) {
  const [displayed, setDisplayed] = useState(
    entry.role === 'you' ? entry.text : ''
  );
  const indexRef = useRef(0);

  useEffect(() => {
    // Preserve original instant candidate rendering during Phase 1.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (entry.role === 'you') { setDisplayed(entry.text); return; }

    // Arjun: typewriter at ~40ms/char
    indexRef.current = 0;
    setDisplayed('');
    const interval = setInterval(() => {
      indexRef.current++;
      setDisplayed(entry.text.slice(0, indexRef.current));
      if (indexRef.current >= entry.text.length) clearInterval(interval);
    }, 22); // 22ms ≈ 45 chars/sec — feels natural

    return () => clearInterval(interval);
  }, [entry.text, entry.role]);

  return (
    <div className={`lt-entry lt-entry--${entry.role === 'arjun' ? 'arjun' : 'you'}`}>
      <span className="lt-label">{entry.role === 'arjun' ? 'Arjun' : 'You'}</span>
      <span className={`lt-bubble lt-bubble--${entry.role === 'arjun' ? 'arjun' : 'you'}`}>
        {displayed}
        {entry.role === 'arjun' && displayed.length < entry.text.length && (
          <span className="lt-cursor">|</span>
        )}
      </span>
    </div>
  );
}
