/**
 * JarvisAvatar — animated SVG orb that reacts to speech state.
 * States: idle (breathing pulse), speaking (active pulse + mouth), listening (cyan glow).
 */

const JarvisAvatar = ({ speaking = false, listening = false, size = 48 }) => {
  const state = listening ? 'listening' : speaking ? 'speaking' : 'idle'

  const colors = {
    idle: { core: '#6366f1', glow: 'rgba(99,102,241,0.25)', ring: 'rgba(99,102,241,0.12)' },
    speaking: { core: '#a78bfa', glow: 'rgba(167,139,250,0.4)', ring: 'rgba(167,139,250,0.15)' },
    listening: { core: '#22d3ee', glow: 'rgba(34,211,238,0.4)', ring: 'rgba(34,211,238,0.15)' },
  }

  const c = colors[state]
  const cx = 50
  const cy = 50

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="block"
      >
        <defs>
          <radialGradient id={`jarvis-grad-${state}`} cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor={state === 'listening' ? '#67e8f9' : '#c4b5fd'} />
            <stop offset="100%" stopColor={c.core} />
          </radialGradient>
        </defs>

        {/* Outer ring — pulse */}
        <circle
          cx={cx} cy={cy} r="46"
          fill="none"
          stroke={c.ring}
          strokeWidth="1.5"
          opacity="0.6"
        >
          <animate
            attributeName="r"
            values={state === 'idle' ? '42;46;42' : '40;48;40'}
            dur={state === 'idle' ? '3s' : state === 'speaking' ? '0.8s' : '1.2s'}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values={state === 'idle' ? '0.3;0.6;0.3' : '0.4;0.8;0.4'}
            dur={state === 'idle' ? '3s' : state === 'speaking' ? '0.8s' : '1.2s'}
            repeatCount="indefinite"
          />
        </circle>

        {/* Glow ring */}
        <circle
          cx={cx} cy={cy} r="36"
          fill="none"
          stroke={c.glow}
          strokeWidth="3"
        >
          <animate
            attributeName="r"
            values={state === 'idle' ? '34;37;34' : '32;39;32'}
            dur={state === 'idle' ? '3s' : state === 'speaking' ? '0.6s' : '1s'}
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-width"
            values={state === 'speaking' ? '2;5;2' : '2;3.5;2'}
            dur={state === 'speaking' ? '0.6s' : '2s'}
            repeatCount="indefinite"
          />
        </circle>

        {/* Core orb */}
        <circle
          cx={cx} cy={cy} r="28"
          fill={`url(#jarvis-grad-${state})`}
          opacity="0.9"
        >
          <animate
            attributeName="r"
            values={state === 'idle' ? '27;29;27' : state === 'speaking' ? '26;30;26' : '25;30;25'}
            dur={state === 'idle' ? '3s' : state === 'speaking' ? '0.8s' : '1.2s'}
            repeatCount="indefinite"
          />
        </circle>

        {/* Left eye */}
        <ellipse
          cx="40" cy="44" rx="3.5" ry={state === 'listening' ? '4.5' : '3.5'}
          fill="white"
          opacity="0.9"
        >
          {state === 'speaking' && (
            <animate
              attributeName="ry"
              values="3.5;2;3.5"
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>

        {/* Right eye */}
        <ellipse
          cx="60" cy="44" rx="3.5" ry={state === 'listening' ? '4.5' : '3.5'}
          fill="white"
          opacity="0.9"
        >
          {state === 'speaking' && (
            <animate
              attributeName="ry"
              values="3.5;2;3.5"
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>

        {/* Mouth */}
        {state === 'speaking' ? (
          <ellipse cx={cx} cy="58" rx="6" ry="3" fill="white" opacity="0.85">
            <animate
              attributeName="ry"
              values="2;5;3;5;2"
              dur="0.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="rx"
              values="5;7;6;7;5"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </ellipse>
        ) : state === 'listening' ? (
          <circle cx={cx} cy="58" r="3.5" fill="white" opacity="0.8">
            <animate
              attributeName="r"
              values="3;4.5;3"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </circle>
        ) : (
          /* Idle: small smile arc */
          <path
            d="M 43 56 Q 50 62 57 56"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.7"
          />
        )}
      </svg>
    </div>
  )
}

export default JarvisAvatar
