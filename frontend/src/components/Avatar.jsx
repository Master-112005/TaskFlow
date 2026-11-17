import React from 'react'

// 6 pre-built avatars: 3 boys, 3 girls. The key (BOY_1..GIRL_3) is stored on the user
// record; a null/unknown key falls back to the initials circle.
export const AVATAR_KEYS = ['BOY_1', 'BOY_2', 'BOY_3', 'GIRL_1', 'GIRL_2', 'GIRL_3']

const DARK = '#20262f'

const Eyes = () => (
  <>
    <circle cx="27" cy="32" r="1.7" fill={DARK} />
    <circle cx="37" cy="32" r="1.7" fill={DARK} />
  </>
)

const Brows = () => (
  <>
    <rect x="24.5" y="27.5" width="5" height="1.5" rx="0.75" fill={DARK} />
    <rect x="34.5" y="27.5" width="5" height="1.5" rx="0.75" fill={DARK} />
  </>
)

const Smile = () => (
  <path d="M28 38 Q32 41.5 36 38" stroke={DARK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
)

function Svg({ bg, children }) {
  return (
    <svg viewBox="0 0 64 64" className="avatar-svg" aria-hidden="true" focusable="false">
      <rect width="64" height="64" fill={bg} />
      {children}
    </svg>
  )
}

function Body({ shirt, skin, hairBehind = null, hair = null, extra = null }) {
  return (
    <>
      {/* shoulders */}
      <path d="M12 64 C12 52 20 47 32 47 C44 47 52 52 52 64 Z" fill={shirt} />
      {/* neck */}
      <rect x="28" y="38" width="8" height="9" rx="3" fill={skin} />
      {hairBehind}
      {/* head + ears */}
      <ellipse cx="32" cy="33" rx="12" ry="13" fill={skin} />
      <circle cx="20" cy="33" r="2.4" fill={skin} />
      <circle cx="44" cy="33" r="2.4" fill={skin} />
      {hair}
      <Brows />
      <Eyes />
      <Smile />
      {extra}
    </>
  )
}

/* --- boys --- */

// BOY_1: short black hair, blue shirt
const BOY_1 = (
  <Svg bg="#2f4159">
    <Body
      shirt="#4f8cff"
      skin="#e8b98a"
      hair={<ellipse cx="32" cy="24" rx="13" ry="9.5" fill="#23282f" />}
      extra={
        <g fill="#23282f">
          <rect x="19.5" y="27" width="3" height="7" rx="1.5" />
          <rect x="41.5" y="27" width="3" height="7" rx="1.5" />
        </g>
      }
    />
  </Svg>
)

// BOY_2: curly brown hair, short beard, green shirt
const BOY_2 = (
  <Svg bg="#3a4a3d">
    <Body
      shirt="#2ea043"
      skin="#d9a066"
      hair={
        <g fill="#4c3524">
          <circle cx="24" cy="24" r="4.6" />
          <circle cx="29" cy="21" r="4.6" />
          <circle cx="35" cy="21" r="4.6" />
          <circle cx="40" cy="24" r="4.6" />
          <circle cx="21" cy="28" r="3.6" />
          <circle cx="43" cy="28" r="3.6" />
        </g>
      }
      extra={
        <g>
          <ellipse cx="32" cy="41.5" rx="8.5" ry="4.5" fill="#4c3524" />
          <path d="M28 38.5 Q32 41.5 36 38.5" stroke="#e8d7bd" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      }
    />
  </Svg>
)

// BOY_3: dark hair, round glasses, purple shirt
const BOY_3 = (
  <Svg bg="#4a3d52">
    <Body
      shirt="#a371f7"
      skin="#c68642"
      hair={<ellipse cx="32" cy="23.5" rx="13" ry="9.5" fill="#1d2126" />}
      extra={
        <g stroke="#20262f" strokeWidth="1.5" fill="none">
          <circle cx="26.5" cy="32" r="4.4" />
          <circle cx="37.5" cy="32" r="4.4" />
          <path d="M30.9 32 L33.1 32" />
          <path d="M22.1 31 L20.5 30" />
          <path d="M41.9 31 L43.5 30" />
        </g>
      }
    />
  </Svg>
)

/* --- girls --- */

// GIRL_1: long brown hair, orange shirt
const GIRL_1 = (
  <Svg bg="#57403a">
    <Body
      shirt="#f0883e"
      skin="#e8b98a"
      hairBehind={
        <g fill="#5a3d2b">
          <rect x="16.5" y="22" width="9" height="27" rx="4.5" />
          <rect x="38.5" y="22" width="9" height="27" rx="4.5" />
        </g>
      }
      hair={<ellipse cx="32" cy="24" rx="13.5" ry="10" fill="#5a3d2b" />}
      extra={<path d="M32 20 Q28 22.5 26 26.5" stroke="#4a301f" strokeWidth="1.3" fill="none" strokeLinecap="round" />}
    />
  </Svg>
)

// GIRL_2: black ponytail with a tie, teal shirt
const GIRL_2 = (
  <Svg bg="#3d4a52">
    <Body
      shirt="#39c5cf"
      skin="#caa07a"
      hair={<ellipse cx="32" cy="24" rx="13" ry="9.5" fill="#23282f" />}
      extra={
        <g>
          <circle cx="45" cy="21" r="4.6" fill="#23282f" />
          <circle cx="45" cy="21" r="1.8" fill="#f0883e" />
          <path d="M32 20.5 Q29 22.5 27.5 26" stroke="#14181d" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      }
    />
  </Svg>
)

// GIRL_3: short bob, freckles, pink shirt
const GIRL_3 = (
  <Svg bg="#524049">
    <Body
      shirt="#e05d75"
      skin="#e8b98a"
      hairBehind={
        <path
          d="M17 30 C17 15 47 15 47 30 L47 40 C47 44 41 44 41 40 L41 31 C41 22 23 22 23 31 L23 40 C23 44 17 44 17 40 Z"
          fill="#2b2320"
        />
      }
      hair={<ellipse cx="32" cy="24" rx="13.5" ry="10" fill="#2b2320" />}
      extra={
        <g fill="#e5a08c" opacity="0.8">
          <circle cx="25" cy="37.5" r="1.1" />
          <circle cx="39" cy="37.5" r="1.1" />
        </g>
      }
    />
  </Svg>
)

const AVATAR_MAP = { BOY_1: BOY_1, BOY_2: BOY_2, BOY_3: BOY_3, GIRL_1: GIRL_1, GIRL_2: GIRL_2, GIRL_3: GIRL_3 }

/** The raw SVG for one avatar key (used by the picker). */
export function AvatarImage({ id }) {
  return AVATAR_MAP[id] || null
}

export function initialsOf(name) {
  return (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

/**
 * Round avatar that shows the chosen pre-built avatar when the user has one,
 * otherwise the initials circle. `className` picks the size (sm / big / xl).
 */
export function UserAvatar({ name, avatar, className = '' }) {
  const cls = `avatar-btn ${className}`.trim()
  const svg = AVATAR_MAP[avatar]
  if (svg) {
    return <span className={`${cls} avatar-filled`}>{svg}</span>
  }
  return <span className={cls}>{initialsOf(name)}</span>
}
