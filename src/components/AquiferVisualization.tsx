import React, { useMemo } from 'react';

interface Props {
  depthM: number;        // metres below ground reference
  flowRateLpm: number;
  pumpOn: boolean;
  isSimulated: boolean;
  maxDepthM?: number;
}

export default function AquiferVisualization({
  depthM,
  flowRateLpm,
  pumpOn,
  isSimulated,
  maxDepthM = 40,
}: Props) {
  const W = 480;
  const H = 380;

  // Layout constants
  const groundY = 60;
  const aquiferTopY = 240;
  const aquiferBotY = 330;
  const borewellX = W / 2;
  const borewellW = 18;

  // Water table Y — maps depthM (5..40) onto (groundY+30 .. aquiferTopY-10)
  const minDepth = 5;
  const waterTableY = useMemo(() => {
    const range = maxDepthM - minDepth;
    const frac = Math.max(0, Math.min(1, (depthM - minDepth) / range));
    return groundY + 30 + frac * (aquiferTopY - groundY - 50);
  }, [depthM, maxDepthM]);

  // Pump animation: flow dots move upward when pump on
  const flowing = pumpOn && flowRateLpm > 2;

  return (
    <div className="relative w-full">
      {/* Simulated badge */}
      {isSimulated && (
        <div className="absolute top-2 left-2 z-10 text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 font-mono">
          SIMULATED CROSS-SECTION
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ maxHeight: 380 }}
        aria-label="Conceptual groundwater cross-section visualization"
      >
        <defs>
          {/* Sky gradient */}
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1628" />
            <stop offset="100%" stopColor="#0d1f3c" />
          </linearGradient>
          {/* Soil gradient */}
          <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d1a0e" />
            <stop offset="60%" stopColor="#3d2210" />
            <stop offset="100%" stopColor="#4a2e14" />
          </linearGradient>
          {/* Rock gradient */}
          <linearGradient id="rockGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2a35" />
            <stop offset="100%" stopColor="#1e1e28" />
          </linearGradient>
          {/* Aquifer water gradient */}
          <linearGradient id="aquiferGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a4d6e" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#063a54" stopOpacity="0.95" />
          </linearGradient>
          {/* Water table gradient */}
          <linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0.35" />
          </linearGradient>
          {/* Pipe gradient */}
          <linearGradient id="pipeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4a5568" />
            <stop offset="50%" stopColor="#718096" />
            <stop offset="100%" stopColor="#4a5568" />
          </linearGradient>
          <clipPath id="surfaceClip">
            <rect x="0" y={groundY} width={W} height={H - groundY} />
          </clipPath>
        </defs>

        {/* ── Sky / Above Ground ────────────────────────────── */}
        <rect x={0} y={0} width={W} height={groundY} fill="url(#skyGrad)" />

        {/* Ground surface line */}
        <rect x={0} y={groundY - 4} width={W} height={8} fill="#4a5568" />
        <rect x={0} y={groundY - 1} width={W} height={2} fill="#718096" />

        {/* ── Soil layer ──────────────────────────────────── */}
        <rect x={0} y={groundY} width={W} height={aquiferTopY - groundY} fill="url(#soilGrad)" />

        {/* Soil texture dots */}
        {[...Array(40)].map((_, i) => (
          <circle
            key={`soil-${i}`}
            cx={30 + (i % 8) * 55 + (Math.floor(i / 8) * 12)}
            cy={groundY + 20 + Math.floor(i / 8) * 30 + (i % 3) * 8}
            r={1.5}
            fill="#5a3a1a"
            opacity={0.5}
          />
        ))}

        {/* ── Rock strata layer ────────────────────────────── */}
        <rect x={0} y={aquiferTopY - 30} width={W} height={30} fill="url(#rockGrad)" />
        {/* Rock strata lines */}
        {[0, 10, 20].map(dy => (
          <line key={dy} x1={0} y1={aquiferTopY - 28 + dy} x2={W} y2={aquiferTopY - 25 + dy}
            stroke="#3a3a48" strokeWidth={1} strokeDasharray="8,6" opacity={0.6} />
        ))}
        <text x={8} y={aquiferTopY - 8} className="text-[9px]" fill="#9ca3af" fontSize={9}>ROCK / CLAY LAYER</text>

        {/* ── Water table fill ────────────────────────────── */}
        <rect
          x={0} y={waterTableY} width={W} height={aquiferTopY - waterTableY}
          fill="url(#wtGrad)"
          clipPath="url(#surfaceClip)"
        />

        {/* Water table line */}
        <line
          x1={0} y1={waterTableY} x2={W} y2={waterTableY}
          stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="6,4" opacity={0.7}
        />
        {/* Animated water surface shimmer */}
        <line
          x1={0} y1={waterTableY + 2} x2={W} y2={waterTableY + 2}
          stroke="#22d3ee" strokeWidth={0.5} opacity={0.3}
        />

        {/* ── Aquifer zone ─────────────────────────────────── */}
        <rect x={0} y={aquiferTopY} width={W} height={aquiferBotY - aquiferTopY} fill="url(#aquiferGrad)" />
        {/* Aquifer texture — gravel dots */}
        {[...Array(35)].map((_, i) => (
          <circle
            key={`gravel-${i}`}
            cx={15 + (i % 12) * 38 + (Math.floor(i / 12) * 8)}
            cy={aquiferTopY + 12 + Math.floor(i / 12) * 22 + (i % 4) * 6}
            r={3}
            fill="#0c6e99"
            opacity={0.4}
          />
        ))}
        <rect x={0} y={aquiferBotY} width={W} height={H - aquiferBotY} fill="#0a1a2e" />

        {/* ── Borewell ──────────────────────────────────────── */}
        {/* Well casing */}
        <rect
          x={borewellX - borewellW / 2} y={groundY - 10}
          width={borewellW} height={aquiferBotY - groundY + 10}
          fill="url(#pipeGrad)" rx={2}
        />
        {/* Inner well */}
        <rect
          x={borewellX - borewellW / 2 + 3} y={groundY}
          width={borewellW - 6} height={aquiferBotY - groundY}
          fill={pumpOn ? '#063a54' : '#0a1628'} rx={1}
        />

        {/* ── Pump / Motor unit (above ground) ─────────────── */}
        {/* Pump base */}
        <rect x={borewellX - 24} y={groundY - 44} width={48} height={42} fill="#1e3a5f" rx={4} />
        <rect x={borewellX - 22} y={groundY - 42} width={44} height={38} fill="#0f2540" rx={3} />
        {/* Motor symbol */}
        <circle cx={borewellX} cy={groundY - 24} r={12} fill="#1a4a6e" stroke="#2a6a9e" strokeWidth={1.5} />
        <text x={borewellX} y={groundY - 20} textAnchor="middle" fill="#7dd3fc" fontSize={10} fontWeight="bold">P</text>
        {/* Pump status light */}
        <circle
          cx={borewellX + 14} cy={groundY - 38}
          r={4}
          fill={pumpOn ? '#22c55e' : '#6b7280'}
          opacity={pumpOn ? 1 : 0.5}
        >
          {pumpOn && <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />}
        </circle>

        {/* ── Discharge pipe (horizontal) ───────────────────── */}
        <rect x={borewellX + 9} y={groundY - 32} width={60} height={8} fill="#4a5568" rx={2} />
        <rect x={borewellX + 65} y={groundY - 36} width={8} height={16} fill="#4a5568" rx={2} />

        {/* ── Flow water in borewell ────────────────────────── */}
        {flowing && (
          <>
            {/* Animated water drops moving up */}
            {[0, 1, 2].map(i => (
              <circle key={`drop-${i}`} cx={borewellX} cy={waterTableY + 20} r={3} fill="#22d3ee" opacity={0.7}>
                <animate
                  attributeName="cy"
                  values={`${waterTableY + 20};${groundY + 5}`}
                  dur="1.8s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.8;0"
                  dur="1.8s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </>
        )}

        {/* ── Sensor marker ─────────────────────────────────── */}
        <g transform={`translate(${borewellX - 45}, ${waterTableY - 8})`}>
          <rect x={0} y={0} width={38} height={16} fill="#1e3a5f" rx={3} />
          <text x={19} y={11} textAnchor="middle" fill="#22d3ee" fontSize={8} fontWeight="600">SENSOR</text>
        </g>
        <line x1={borewellX - 7} y1={waterTableY} x2={borewellX - 7} y2={waterTableY}
          stroke="#22d3ee" strokeWidth={1} />

        {/* ── Labels ────────────────────────────────────────── */}
        {/* Ground surface */}
        <text x={8} y={groundY - 8} fill="#9ca3af" fontSize={9} fontWeight="500">GROUND SURFACE</text>

        {/* Water table label */}
        <g>
          <rect x={W - 110} y={waterTableY - 12} width={104} height={15} fill="#0a1f35" rx={3} opacity={0.9} />
          <text x={W - 58} y={waterTableY - 2} textAnchor="middle" fill="#22d3ee" fontSize={9} fontWeight="600">
            WATER TABLE
          </text>
        </g>

        {/* Depth callout */}
        <line x1={W - 160} y1={groundY} x2={W - 160} y2={waterTableY} stroke="#22d3ee" strokeWidth={0.75} strokeDasharray="3,3" opacity={0.5} />
        <line x1={W - 165} y1={groundY} x2={W - 155} y2={groundY} stroke="#22d3ee" strokeWidth={1} opacity={0.5} />
        <line x1={W - 165} y1={waterTableY} x2={W - 155} y2={waterTableY} stroke="#22d3ee" strokeWidth={1} opacity={0.5} />
        <text x={W - 148} y={(groundY + waterTableY) / 2 + 4} fill="#22d3ee" fontSize={9}>
          {depthM.toFixed(1)} m
        </text>

        {/* Borewell label */}
        <text x={borewellX + borewellW + 6} y={groundY + 40} fill="#9ca3af" fontSize={8}>BOREWELL</text>

        {/* Aquifer zone label */}
        <text x={8} y={aquiferTopY + 22} fill="#7dd3fc" fontSize={10} fontWeight="600">AQUIFER ZONE</text>
        <text x={8} y={aquiferTopY + 35} fill="#4a8fa6" fontSize={8}>(Saturated zone — conceptual)</text>

        {/* Extraction status */}
        <g transform={`translate(${W - 120}, ${aquiferTopY + 15})`}>
          <rect x={0} y={0} width={112} height={24} fill="#0a1f35" rx={4} />
          <circle cx={12} cy={12} r={4} fill={pumpOn && flowRateLpm > 2 ? '#22c55e' : '#6b7280'} />
          <text x={22} y={16} fill={pumpOn ? '#86efac' : '#6b7280'} fontSize={9} fontWeight="600">
            {pumpOn && flowRateLpm > 2 ? `EXTRACTING ${flowRateLpm.toFixed(0)} L/min` : 'PUMP IDLE'}
          </text>
        </g>
      </svg>
    </div>
  );
}
