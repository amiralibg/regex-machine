import { useEffect, useRef, useState } from 'react';

/**
 * The course button with its chalk critter.
 *
 * Physics is a small hand-rolled simulation, one requestAnimationFrame loop:
 * the button is a damped rotational spring that takes random impulses, and
 * the critter is a walker with real gravity — when the button jolts, the
 * critter is launched, tumbles, lands with a squash, then resumes walking.
 * Transforms are written straight to refs each frame; React state only
 * tracks discrete poses (walk / air) and facing.
 */
export function CourseButton({ onClick }: { onClick: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const critterRef = useRef<HTMLDivElement>(null);
  const [air, setAir] = useState(false);
  const [startled, setStartled] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const nudgeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const s = {
      angle: 0,
      angleVel: 0,
      x: 14,
      vx: 20,
      y: 0,
      vy: 0,
      tilt: 0,
      phase: 0,
      squash: 0,
      facing: 1 as 1 | -1,
      air: false,
    };

    let alive = true;
    let raf = 0;
    let last = performance.now();
    let wiggleAt = 0;

    const launch = (vy: number, jolt: number): void => {
      if (s.air) return;
      s.air = true;
      s.vy = vy;
      s.vx = Math.sign(s.vx || 1) * 20 + jolt;
      setAir(true);
      setStartled(true);
    };

    const wiggle = (now: number): void => {
      if (!alive) return;
      const power = 9 + Math.random() * 9;
      s.angleVel += (Math.random() < 0.5 ? -1 : 1) * power;
      if (Math.random() < 0.75) launch(110 + power * 5, (Math.random() - 0.5) * 50);
      wiggleAt = now + 3200 + Math.random() * 5200;
    };

    const nudge = (): void => {
      s.angleVel += (Math.random() < 0.5 ? -1 : 1) * 6;
      launch(120, (Math.random() - 0.5) * 30);
    };
    nudgeRef.current = nudge;

    const tick = (now: number): void => {
      if (!alive) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (now >= wiggleAt) wiggle(now);

      // button: damped rotational spring around its bottom edge
      s.angleVel += (-s.angle * 160 - s.angleVel * 9) * dt;
      s.angle += s.angleVel * dt;

      const w = btnRef.current?.offsetWidth ?? 110;
      s.x += s.vx * dt;
      if (s.x < 5) {
        s.x = 5;
        s.vx = Math.abs(s.vx) * (s.air ? 0.6 : 1);
        s.facing = 1;
        setFacing(1);
      } else if (s.x > w - 25) {
        s.x = w - 25;
        s.vx = -Math.abs(s.vx) * (s.air ? 0.6 : 1);
        s.facing = -1;
        setFacing(-1);
      }
      if (s.air) {
        s.vy -= 1500 * dt;
        s.y += s.vy * dt;
        if (s.y <= 0) {
          s.y = 0;
          s.air = false;
          setAir(false);
          setStartled(false);
          s.squash = 1;
          s.vx = Math.sign(s.vx || 1) * 20;
        }
      } else {
        s.phase += dt * 10;
        s.y = Math.abs(Math.sin(s.phase)) * 1.8;
      }
      s.squash = Math.max(0, s.squash - dt * 5);

      // critter leans against horizontal travel while airborne
      const tiltTarget = s.air ? Math.max(-16, Math.min(16, -s.vx * 0.35)) : 0;
      s.tilt += (tiltTarget - s.tilt) * Math.min(1, dt * 12);

      if (btnRef.current) {
        btnRef.current.style.transform = `rotate(${s.angle.toFixed(2)}deg)`;
      }
      if (critterRef.current) {
        critterRef.current.style.transform = `translate3d(${s.x.toFixed(1)}px, ${(-s.y).toFixed(1)}px, 0) rotate(${s.tilt.toFixed(1)}deg) scaleX(${s.facing}) scaleY(${(1 - s.squash * 0.28).toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };

    wiggleAt = performance.now() + 2200 + Math.random() * 2500;
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative inline-flex">
      <div
        ref={critterRef}
        aria-hidden
        className="pointer-events-none absolute bottom-full left-0 z-10 h-[38px] w-[30px]"
        style={{ transformOrigin: '50% 100%', willChange: 'transform' }}
      >
        <svg width="30" height="38" viewBox="0 0 30 38" className="overflow-visible">
          {/* legs */}
          <g className={air ? 'critter-leg critter-leg-air-a' : 'critter-leg critter-leg-a'}>
            <line x1="12" y1="29" x2="9" y2="37" stroke="var(--color-ink)" strokeWidth="2.2" strokeLinecap="round" />
          </g>
          <g className={air ? 'critter-leg critter-leg-air-b' : 'critter-leg critter-leg-b'}>
            <line x1="18" y1="29" x2="21" y2="37" stroke="var(--color-ink)" strokeWidth="2.2" strokeLinecap="round" />
          </g>
          {/* arms */}
          <g className={air ? 'critter-arm critter-arm-air-a' : 'critter-arm critter-arm-a'}>
            <path d="M9.5 19 Q6 20, 4.5 23" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g className={air ? 'critter-arm critter-arm-air-b' : 'critter-arm critter-arm-b'}>
            <path d="M20.5 19 Q24 20, 25.5 23" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
          </g>
          {/* body: a chalk stub, slightly tilted, one chipped corner */}
          <g transform="rotate(-3 15 16)">
            <rect x="9" y="4.5" width="12.6" height="24.5" rx="3.4" fill="var(--color-ink)" />
            <path d="M9 9.5 L11.6 11 L9 12.8 Z" fill="var(--color-canvas)" />
            {/* face, drawn in board color on the chalk */}
            {startled ? (
              <>
                <line x1="10.2" y1="9.4" x2="12.4" y2="8.6" stroke="var(--color-canvas)" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="18.2" y1="8.6" x2="20.4" y2="9.4" stroke="var(--color-canvas)" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="12.2" cy="12.8" r="2.5" fill="var(--color-canvas)" />
                <circle cx="18.2" cy="12.8" r="2.5" fill="var(--color-canvas)" />
                <circle cx="12.9" cy="12" r="0.7" fill="var(--color-ink)" />
                <circle cx="18.9" cy="12" r="0.7" fill="var(--color-ink)" />
                <ellipse cx="15.2" cy="19" rx="2" ry="2.5" fill="var(--color-canvas)" />
              </>
            ) : (
              <>
                <circle className="critter-eye" cx="12.2" cy="13" r="1.7" fill="var(--color-canvas)" />
                <circle className="critter-eye" cx="18.2" cy="13" r="1.7" fill="var(--color-canvas)" />
                <circle cx="12.8" cy="12.4" r="0.5" fill="var(--color-ink)" />
                <circle cx="18.8" cy="12.4" r="0.5" fill="var(--color-ink)" />
                <path d="M13.4 18.6 Q15.2 20.2, 17 18.6" fill="none" stroke="var(--color-canvas)" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="10.6" cy="16.8" r="1.1" fill="var(--color-backref)" opacity="0.5" />
                <circle cx="19.8" cy="16.8" r="1.1" fill="var(--color-backref)" opacity="0.5" />
              </>
            )}
          </g>
        </svg>
      </div>
      <button
        ref={btnRef}
        onClick={onClick}
        onMouseEnter={() => {
          const b = btnRef.current;
          if (b && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            nudgeRef.current?.();
          }
        }}
        className="min-w-[7.75rem] rounded px-5 py-1.5 text-center text-sm transition-colors hover:opacity-90"
        style={{ border: '1.5px solid var(--color-accent)', color: 'var(--color-accent)', borderRadius: 'var(--radius-md)', transformOrigin: '50% 100%', willChange: 'transform' }}
      >
        course →
      </button>
    </div>
  );
}
