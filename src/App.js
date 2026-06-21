import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// CONSTANTS

const LEVELS = {
  easy:   { label: 'EASY',   grid: 3, cells: 4, showMs: 3000, description: '3×3 grid · 4 cells lit · 3s to memorise' },
  medium: { label: 'MEDIUM', grid: 4, cells: 6, showMs: 2500, description: '4×4 grid · 6 cells lit · 2.5s to memorise' },
  hard:   { label: 'HARD',   grid: 5, cells: 9, showMs: 2000, description: '5×5 grid · 9 cells lit · 2s to memorise' },
};

const THEMES = {
  neon:    { label: 'NEON',    lit: '#00fff7', litGlow: '#00fff7', dim: '#0a2a2a', border: '#00fff7', bg: '#0a0a1a' },
  plasma:  { label: 'PLASMA',  lit: '#ff00ff', litGlow: '#ff00ff', dim: '#1a0a1a', border: '#ff00ff', bg: '#0d000d' },
  ember:   { label: 'EMBER',   lit: '#ff6b00', litGlow: '#ff6b00', dim: '#1a0d00', border: '#ff6b00', bg: '#0d0800' },
  matrix:  { label: 'MATRIX',  lit: '#39ff14', litGlow: '#39ff14', dim: '#001a00', border: '#39ff14', bg: '#000d00' },
};

const PHASE = { MENU: 'menu', MEMORISE: 'memorise', RECALL: 'recall', RESULT: 'result' };

// HELPERS

function generatePattern(gridSize, count) {
  const total = gridSize * gridSize;
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return new Set(indices.slice(0, count));
}

function scoreResult(pattern, guess) {
  let correct = 0;
  pattern.forEach(idx => { if (guess.has(idx)) correct++; });
  const wrong = guess.size - correct;
  return { correct, wrong, total: pattern.size };
}

// COMPONENTS 

function Cell({ lit, selected, onClick, theme, phase, flashing }) {
  const isRecall = phase === PHASE.RECALL;
  const isMemoise = phase === PHASE.MEMORISE;

  let bg = theme.dim;
  let shadow = 'none';
  let border = `1px solid ${theme.border}22`;
  let cursor = isRecall ? 'pointer' : 'default';

  if ((isMemoise || phase === PHASE.RESULT) && lit) {
    bg = theme.lit;
    shadow = `0 0 18px 4px ${theme.litGlow}99, 0 0 6px 1px ${theme.litGlow}`;
    border = `1px solid ${theme.lit}`;
  }
  if (isRecall && selected) {
    bg = theme.lit + 'cc';
    shadow = `0 0 12px 2px ${theme.litGlow}77`;
    border = `1px solid ${theme.lit}`;
  }
  if (flashing) {
    bg = '#ffffff';
    shadow = `0 0 30px 10px #ffffff`;
  }

  return (
    <div
      className={`pg-cell ${isRecall ? 'pg-cell--clickable' : ''} ${selected ? 'pg-cell--selected' : ''}`}
      style={{ background: bg, boxShadow: shadow, border, cursor }}
      onClick={isRecall ? onClick : undefined}
    />
  );
}

function Grid({ gridSize, pattern, selected, onToggle, theme, phase }) {
  const total = gridSize * gridSize;
  return (
    <div
      className="pg-grid"
      style={{
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gap: gridSize === 5 ? '8px' : '10px',
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <Cell
          key={i}
          lit={pattern.has(i)}
          selected={selected.has(i)}
          onClick={() => onToggle(i)}
          theme={theme}
          phase={phase}
        />
      ))}
    </div>
  );
}

function CountdownRing({ ms, totalMs, color }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const progress = ms / totalMs;
  const dash = circ * progress;
  return (
    <svg width="72" height="72" className="pg-countdown">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#ffffff11" strokeWidth="4" />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.1s linear' }}
      />
      <text x="36" y="41" textAnchor="middle" fill={color} fontSize="13" fontFamily="'Press Start 2P'" fontWeight="bold">
        {Math.ceil(ms / 1000)}
      </text>
    </svg>
  );
}

//  MAIN APP

export default function App() {
  const [phase, setPhase]           = useState(PHASE.MENU);
  const [level, setLevel]           = useState('medium');
  const [themeKey, setThemeKey]     = useState('neon');
  const [pattern, setPattern]       = useState(new Set());
  const [selected, setSelected]     = useState(new Set());
  const [result, setResult]         = useState(null);
  const [timeLeft, setTimeLeft]     = useState(0);
  const [round, setRound]           = useState(1);
  const [streak, setStreak]         = useState(0);
  const [highScore, setHighScore]   = useState(() => parseInt(localStorage.getItem('pg-hs') || '0'));
  const [score, setScore]           = useState(0);
  const [showPattern, setShowPattern] = useState(false);

  const timerRef = useRef(null);
  const theme = THEMES[themeKey];
  const cfg = LEVELS[level];

  // start memorise phase 
  const startRound = useCallback(() => {
    const pat = generatePattern(cfg.grid, cfg.cells);
    setPattern(pat);
    setSelected(new Set());
    setResult(null);
    setShowPattern(true);
    setPhase(PHASE.MEMORISE);
    setTimeLeft(cfg.showMs);

    let remaining = cfg.showMs;
    timerRef.current = setInterval(() => {
      remaining -= 100;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setShowPattern(false);
        setPhase(PHASE.RECALL);
      }
    }, 100);
  }, [cfg]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // toggle a cell during recall 
  const toggleCell = useCallback((idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < cfg.cells) next.add(idx);
      return next;
    });
  }, [cfg.cells]);

  // submit guess
  const submit = useCallback(() => {
    const res = scoreResult(pattern, selected);
    const pts = res.correct * 10 - res.wrong * 5;
    const newScore = score + Math.max(0, pts);
    const newStreak = res.correct === res.total && res.wrong === 0 ? streak + 1 : 0;
    setResult(res);
    setScore(newScore);
    setStreak(newStreak);
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('pg-hs', String(newScore));
    }
    setPhase(PHASE.RESULT);
  }, [pattern, selected, score, streak, highScore]);

  // next round
  const nextRound = useCallback(() => {
    setRound(r => r + 1);
    startRound();
  }, [startRound]);

  // back to menu
  const goMenu = useCallback(() => {
    clearInterval(timerRef.current);
    setPhase(PHASE.MENU);
    setRound(1);
    setScore(0);
    setStreak(0);
    setResult(null);
    setSelected(new Set());
    setPattern(new Set());
  }, []);

  return (
    <div className="pg-root" style={{ '--theme-color': theme.lit, '--theme-bg': theme.bg, '--theme-dim': theme.dim }}>
      {/* scanlines overlay */}
      <div className="pg-scanlines" aria-hidden="true" />

      {/* Nav */}
      <nav className="pg-nav">
        <span className="pg-nav-brand" onClick={goMenu} style={{ color: theme.lit, textShadow: `0 0 10px ${theme.lit}` }}>
          <span className="brand-logo" style={{ color: theme.lit, fontSize: '1.5rem', padding: '0 0.5rem 0.6rem' }}>⊞ </span>
          PATTERN<span style={{ color: '#fff' }}>GRID</span>
        </span>
        <div className="pg-nav-stats">
          <span className="pg-stat">SCORE <b style={{ color: theme.lit }}>{score}</b></span>
          <span className="pg-stat">BEST <b style={{ color: theme.lit }}>{highScore}</b></span>
          {streak > 1 && <span className="pg-streak" style={{ color: theme.lit }}>🔥 ×{streak}</span>}
        </div>
      </nav>

      {/* Menu */}
      {phase === PHASE.MENU && (
        <div className="pg-screen pg-menu">
          <div className="pg-menu-hero">
            <h1 className="pg-title" style={{ color: theme.lit, textShadow: `0 0 20px ${theme.lit}, 0 0 40px ${theme.lit}88` }}>
                <span className="brand-logo" style={{ color: theme.lit, fontSize: '4rem', margin: '0 0.5rem' }}>⊞</span>
                <br />PATTERN<br />GRID
            </h1>
            <p className="pg-subtitle">Memorise the pattern. Recreate it. Beat your streak.</p>
          </div>

          {/* Level */}
          <div className="pg-config-section">
            <div className="pg-config-label">— SELECT LEVEL —</div>
            <div className="pg-btn-group">
              {Object.entries(LEVELS).map(([key, val]) => (
                <button
                  key={key}
                  className={`pg-btn-level ${level === key ? 'pg-btn-level--active' : ''}`}
                  style={level === key ? { borderColor: theme.lit, color: theme.lit, boxShadow: `0 0 12px ${theme.lit}66` } : {}}
                  onClick={() => setLevel(key)}
                >
                  {val.label}
                  <span className="pg-btn-desc">{val.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="pg-config-section">
            <div className="pg-config-label">— COLOUR THEME —</div>
            <div className="pg-theme-swatches">
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  className={`pg-swatch ${themeKey === key ? 'pg-swatch--active' : ''}`}
                  style={{
                    background: t.lit,
                    boxShadow: themeKey === key ? `0 0 16px 4px ${t.litGlow}` : 'none',
                    outline: themeKey === key ? `2px solid #fff` : '2px solid transparent',
                  }}
                  onClick={() => setThemeKey(key)}
                  title={t.label}
                />
              ))}
            </div>
            <div className="pg-theme-label" style={{ color: theme.lit }}>{theme.label}</div>
          </div>

          {/* High Score */}
          {highScore > 0 && (
            <div className="pg-hs-badge" style={{ borderColor: theme.lit, color: theme.lit }}>
              🏆 HIGH SCORE: {highScore}
            </div>
          )}

          <button
            className="pg-start-btn"
            style={{ borderColor: theme.lit, color: theme.lit, boxShadow: `0 0 20px ${theme.lit}55, inset 0 0 20px ${theme.lit}11` }}
            onClick={startRound}
          >
            START GAME
          </button>
          <p className="pg-designed-by">
            Designed by <a href="https://sprithvi10.github.io/seg3125-portfolio/" style={{ color: theme.lit }}>Prithviraj Sowdermett</a> · SEG3125 · uOttawa
          </p>
        </div>
      )}

      {/* Memorise */}
      {phase === PHASE.MEMORISE && (
        <div className="pg-screen pg-game-screen">
          <div className="pg-hud">
            <div className="pg-hud-left">
              <div className="pg-hud-label">ROUND</div>
              <div className="pg-hud-val" style={{ color: theme.lit }}>{round}</div>
            </div>
            <div className="pg-hud-center">
              <div className="pg-phase-tag" style={{ color: theme.lit, borderColor: theme.lit }}>
                ⚡ MEMORISE
              </div>
              <CountdownRing ms={timeLeft} totalMs={cfg.showMs} color={theme.lit} />
            </div>
            <div className="pg-hud-right">
              <div className="pg-hud-label">SCORE</div>
              <div className="pg-hud-val" style={{ color: theme.lit }}>{score}</div>
            </div>
          </div>
          <p className="pg-instruction">Remember the lit cells!</p>
          <Grid
            gridSize={cfg.grid}
            pattern={pattern}
            selected={new Set()}
            onToggle={() => {}}
            theme={theme}
            phase={PHASE.MEMORISE}
          />
          <button className="pg-back-btn" onClick={goMenu}>✕ QUIT</button>
        </div>
      )}

      {/* Recall */}
      {phase === PHASE.RECALL && (
        <div className="pg-screen pg-game-screen">
          <div className="pg-hud">
            <div className="pg-hud-left">
              <div className="pg-hud-label">ROUND</div>
              <div className="pg-hud-val" style={{ color: theme.lit }}>{round}</div>
            </div>
            <div className="pg-hud-center">
              <div className="pg-phase-tag" style={{ color: '#fff', borderColor: '#fff' }}>
                🎯 RECALL
              </div>
              <div className="pg-sel-count" style={{ color: theme.lit }}>
                {selected.size} / {cfg.cells} selected
              </div>
            </div>
            <div className="pg-hud-right">
              <div className="pg-hud-label">SCORE</div>
              <div className="pg-hud-val" style={{ color: theme.lit }}>{score}</div>
            </div>
          </div>
          <p className="pg-instruction">Tap the cells that were lit.</p>
          <Grid
            gridSize={cfg.grid}
            pattern={new Set()}
            selected={selected}
            onToggle={toggleCell}
            theme={theme}
            phase={PHASE.RECALL}
          />
          <button
            className="pg-submit-btn"
            style={{ borderColor: theme.lit, color: theme.lit, boxShadow: `0 0 16px ${theme.lit}55` }}
            onClick={submit}
            disabled={selected.size === 0}
          >
            SUBMIT
          </button>
          <button className="pg-back-btn" onClick={goMenu}>✕ QUIT</button>
        </div>
      )}

      {/* Result */}
      {phase === PHASE.RESULT && result && (
        <div className="pg-screen pg-game-screen">
          <div className="pg-hud">
            <div className="pg-hud-left">
              <div className="pg-hud-label">ROUND</div>
              <div className="pg-hud-val" style={{ color: theme.lit }}>{round}</div>
            </div>
            <div className="pg-hud-center">
              <div className="pg-phase-tag" style={{ color: result.correct === result.total && result.wrong === 0 ? '#39ff14' : '#ff4444', borderColor: result.correct === result.total && result.wrong === 0 ? '#39ff14' : '#ff4444' }}>
                {result.correct === result.total && result.wrong === 0 ? '✓ PERFECT' : '✗ RESULT'}
              </div>
            </div>
            <div className="pg-hud-right">
              <div className="pg-hud-label">SCORE</div>
              <div className="pg-hud-val" style={{ color: theme.lit }}>{score}</div>
            </div>
          </div>

          {/* show correct pattern overlaid */}
          <Grid
            gridSize={cfg.grid}
            pattern={pattern}
            selected={selected}
            onToggle={() => {}}
            theme={theme}
            phase={PHASE.RESULT}
          />

          <div className="pg-result-card" style={{ borderColor: theme.lit }}>
            <div className="pg-result-row">
              <span>✓ Correct</span>
              <span style={{ color: '#39ff14' }}>{result.correct} / {result.total}</span>
            </div>
            <div className="pg-result-row">
              <span>✗ Wrong clicks</span>
              <span style={{ color: result.wrong > 0 ? '#ff4444' : '#fff' }}>{result.wrong}</span>
            </div>
            {streak > 1 && (
              <div className="pg-result-row">
                <span>🔥 Streak</span>
                <span style={{ color: theme.lit }}>×{streak}</span>
              </div>
            )}
          </div>

          <div className="pg-result-actions">
            <button
              className="pg-start-btn"
              style={{ borderColor: theme.lit, color: theme.lit, boxShadow: `0 0 16px ${theme.lit}55` }}
              onClick={nextRound}
            >
              NEXT ROUND
            </button>
            <button className="pg-back-btn" onClick={goMenu}>MENU</button>
          </div>
        </div>
      )}
    </div>
  );
}