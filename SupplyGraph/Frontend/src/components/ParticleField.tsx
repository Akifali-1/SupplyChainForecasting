import React, { useEffect, useRef } from 'react';

// Particle count tuned per device capability
const NUM_PARTICLES = typeof window !== 'undefined' && window.innerWidth < 768 ? 60 : 90;

export const ParticleField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isPaused = false;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    // Initialise particles once
    const particles = Array.from({ length: NUM_PARTICLES }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 0.8 + 0.8,
    }));

    // ── Guard 1: Visibility API — pause when tab is hidden ────────────────
    const onVisibilityChange = () => {
      isPaused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // ── Guard 2: IntersectionObserver — pause when scrolled off-screen ────
    const observer = new IntersectionObserver(
      ([entry]) => { isPaused = !entry.isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(canvas);

    // ── Guard 3: Debounced resize — prevents mid-frame canvas clear ───────
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }, 150);
    };
    window.addEventListener('resize', handleResize, { passive: true });

    // ── Draw loop — skips paint entirely when paused ──────────────────────
    const draw = () => {
      animId = requestAnimationFrame(draw);
      if (isPaused) return;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(0, 180, 216, 0.55)';
      ctx.beginPath();

      for (let i = 0; i < NUM_PARTICLES; i++) {
        const p = particles[i];
        // Modulo wrapping avoids 4 branch checks per particle per frame
        p.x = ((p.x + p.vx) % width + width) % width;
        p.y = ((p.y + p.vy) % height + height) % height;
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(resizeTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.75 }}
    />
  );
};

export default ParticleField;
