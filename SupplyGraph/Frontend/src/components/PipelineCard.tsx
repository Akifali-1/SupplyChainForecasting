import React, { memo } from 'react';
import { motion } from 'framer-motion';

// ── Interfaces ──────────────────────────────────────────────────────────────
interface PipelineCardData {
  stage: string;
  name: string;
  icon: React.ComponentType<any>;
  accent: string;
  description: string;
}

// Props simplified — no hover state. All hover effects driven by CSS.
interface PipelineCardProps {
  card: PipelineCardData;
  index: number;
}

// ── PipelineVisual — memo'd so SVG never re-renders ─────────────────────────
const PipelineVisual = memo(({ index, accent }: { index: number; accent: string }) => {
  switch (index) {
    case 0:
      return (
        <svg className="w-[180px] h-[80px]" viewBox="0 0 180 80" fill="none">
          <rect x="20" y="25" width="24" height="30" rx="3" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
          <rect x="78" y="25" width="24" height="30" rx="3" stroke={accent} strokeWidth="1.5" />
          <rect x="136" y="25" width="24" height="30" rx="3" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
          <path d="M 44 40 L 78 40" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
          <path d="M 102 40 L 136 40" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
          {/* animate-flow is paused by default, runs only when .pipeline-card:hover */}
          <path d="M 44 40 L 78 40" stroke={accent} strokeWidth="1.5" strokeDasharray="5,5" className="animate-flow" />
        </svg>
      );
    case 1:
      return (
        <svg className="w-[180px] h-[80px]" viewBox="0 0 180 80" fill="none">
          <path d="M 10 50 L 30 35 L 50 65 L 70 20 L 90 60 L 110 30 L 130 50 L 150 40" stroke="white" strokeOpacity="0.08" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 10 50 Q 30 38, 50 48 T 90 40 T 130 42 T 170 40" stroke={accent} strokeWidth="2" strokeLinecap="round" className="animate-flow" />
        </svg>
      );
    case 2:
      return (
        <svg className="w-[180px] h-[80px]" viewBox="0 0 180 80" fill="none">
          <line x1="20" y1="40" x2="160" y2="40" stroke="white" strokeOpacity="0.06" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="40" r="8" fill="#000000" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
          <circle cx="95" cy="40" r="8" fill="#000000" stroke={accent} strokeWidth="2" />
          <circle cx="140" cy="40" r="8" fill="#000000" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
          <line x1="95" y1="20" x2="95" y2="30" stroke={accent} strokeWidth="1.5" />
          <line x1="50" y1="20" x2="50" y2="30" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
          <line x1="140" y1="20" x2="140" y2="30" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
        </svg>
      );
    case 3:
      return (
        <svg className="w-[180px] h-[80px]" viewBox="0 0 180 80" fill="none">
          <line x1="30" y1="40" x2="70" y2="20" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
          <line x1="30" y1="40" x2="70" y2="60" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
          <line x1="70" y1="20" x2="110" y2="40" stroke={accent} strokeWidth="1.5" strokeOpacity="0.4" className="animate-flow" />
          <line x1="70" y1="60" x2="110" y2="40" stroke={accent} strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="110" y1="40" x2="150" y2="40" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
          <circle cx="30" cy="40" r="5" fill="#000000" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
          <circle cx="70" cy="20" r="5" fill="#000000" stroke={accent} strokeWidth="1.5" />
          <circle cx="70" cy="60" r="5" fill="#000000" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
          <circle cx="110" cy="40" r="5" fill="#000000" stroke={accent} strokeWidth="1.5" />
          <circle cx="150" cy="40" r="5" fill="#000000" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
        </svg>
      );
    case 4:
      return (
        <svg className="w-[180px] h-[80px]" viewBox="0 0 180 80" fill="none">
          <path d="M 20 15 Q 60 70, 110 50 T 160 55" stroke="white" strokeOpacity="0.08" strokeWidth="2" strokeLinecap="round" />
          <path d="M 20 15 Q 60 75, 110 55 T 160 62" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="160" cy="62" r="3" fill={accent} />
          <circle cx="160" cy="62" r="7" stroke={accent} strokeWidth="1" className="animate-pulse-glow" />
        </svg>
      );
    case 5:
      return (
        <svg className="w-[180px] h-[80px]" viewBox="0 0 180 80" fill="none">
          <path d="M 20 50 Q 50 30, 80 45 T 140 20 L 160 15" stroke="white" strokeOpacity="0.1" strokeWidth="2" />
          <path d="M 80 45 T 140 20 L 160 15 L 160 35 L 140 40 Z" fill={`${accent}15`} />
          <path d="M 80 45 T 140 20 L 160 15" stroke={accent} strokeWidth="2" className="animate-flow" />
          <circle cx="80" cy="45" r="4" fill={accent} />
        </svg>
      );
    case 6:
      return (
        <svg className="w-[180px] h-[80px]" viewBox="0 0 180 80" fill="none">
          <path d="M 20 40 L 70 40" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
          <path d="M 70 40 L 110 20 L 160 20" stroke={accent} strokeWidth="1.5" className="animate-flow" />
          <path d="M 70 40 L 110 60 L 160 60" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
          <circle cx="110" cy="60" r="5" fill="#EF4444" />
          <line x1="108" y1="58" x2="112" y2="62" stroke="white" strokeWidth="1.5" />
          <line x1="112" y1="58" x2="108" y2="62" stroke="white" strokeWidth="1.5" />
        </svg>
      );
    case 7:
      return (
        <svg className="w-[180px] h-[80px]" viewBox="0 0 180 80" fill="none">
          <circle cx="90" cy="40" r="22" stroke={accent} strokeWidth="1" strokeOpacity="0.2" />
          <circle cx="90" cy="40" r="14" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" className="animate-pulse-glow" />
          <circle cx="90" cy="40" r="6" fill={accent} />
        </svg>
      );
    default:
      return null;
  }
});
PipelineVisual.displayName = 'PipelineVisual';

// ── PipelineCard — pure CSS hover, zero React state on hover ─────────────────
// Uses CSS custom properties for dynamic accent colors so no JS runs on hover
export const PipelineCard = memo(({ card, index }: PipelineCardProps) => {
  const Icon = card.icon;

  return (
    <motion.div
      // whileHover drives the y-lift via Framer Motion values — bypasses React render cycle
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="pipeline-card relative flex-shrink-0 w-[330px] h-[340px] rounded-[32px] p-6 flex flex-col justify-between snap-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a0a0c 0%, #020203 100%)',
        // CSS custom properties — set once at mount, hover effect driven by CSS
        '--card-accent-border': `${card.accent}44`,
        '--card-glow': `0 10px 40px -15px ${card.accent}33, inset 0 0 12px ${card.accent}11`,
      } as React.CSSProperties}
    >
      {/* contain:strict isolates animations — repaint cannot escape this box */}
      <div
        className="h-[120px] w-full flex items-center justify-center relative overflow-hidden bg-white/[0.01] border border-white/[0.04] rounded-2xl"
        style={{ contain: 'layout style paint' }}
      >
        {/* PipelineVisual is memo'd — frozen after mount */}
        <PipelineVisual index={index} accent={card.accent} />
      </div>

      <div className="flex-1 flex flex-col justify-end mt-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${card.accent}15` }}
          >
            <Icon className="w-[16px] h-[16px]" style={{ color: card.accent }} />
          </div>
          <span
            className="font-bold text-xs uppercase tracking-wider"
            style={{ color: card.accent }}
          >
            Stage {card.stage}
          </span>
        </div>

        <h3 className="text-white font-bold text-base tracking-wide uppercase mt-2">
          {card.name}
        </h3>
        <p className="text-neutral-500 font-light text-xs leading-relaxed mt-2.5">
          {card.description}
        </p>
      </div>

      {/* pipeline-card-bar: opacity driven by CSS .pipeline-card:hover — no JS */}
      <div
        className="pipeline-card-bar absolute bottom-0 left-6 right-6 h-[2px] rounded-t-full"
        style={{ backgroundColor: card.accent }}
      />
    </motion.div>
  );
});
PipelineCard.displayName = 'PipelineCard';

export default PipelineCard;
