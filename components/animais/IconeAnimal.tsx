import { useId, type ReactNode } from 'react';
import type { ChaveAnimal } from '@/config/animais';
import { combinarClasses } from '@/util/ClassesUtils';

type DesenhoAnimal = {
  fundo: string;
  formas: ReactNode;
};

const TINTA = '#2b1d12';

const DESENHOS: Record<ChaveAnimal, DesenhoAnimal> = {
  capivara: {
    fundo: '#f6e3c6',
    formas: (
      <>
        <ellipse cx="14" cy="14" rx="4.2" ry="3.6" fill="#7a4e24" />
        <ellipse cx="34" cy="14" rx="4.2" ry="3.6" fill="#7a4e24" />
        <rect x="10" y="12" width="28" height="31" rx="12" fill="#a0703c" />
        <rect x="14" y="26" width="20" height="14" rx="7" fill="#8a5a2b" />
        <ellipse cx="20" cy="31" rx="1.7" ry="1.1" fill={TINTA} />
        <ellipse cx="28" cy="31" rx="1.7" ry="1.1" fill={TINTA} />
        <circle cx="17" cy="21" r="2.1" fill={TINTA} />
        <circle cx="31" cy="21" r="2.1" fill={TINTA} />
        <circle cx="17.7" cy="20.3" r="0.6" fill="#fff" />
        <circle cx="31.7" cy="20.3" r="0.6" fill="#fff" />
        <path
          d="M21 36 Q24 38.2 27 36"
          fill="none"
          stroke={TINTA}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  tucano: {
    fundo: '#fff1c1',
    formas: (
      <>
        <ellipse cx="17" cy="38" rx="13" ry="10" fill="#1f1f1f" />
        <circle cx="19" cy="23" r="12" fill="#1f1f1f" />
        <ellipse cx="22" cy="30" rx="6.5" ry="5" fill="#fff8e1" />
        <circle cx="22" cy="20" r="3.6" fill="#4fc3f7" />
        <circle cx="22.3" cy="20" r="1.7" fill="#111" />
        <path
          d="M27 16 C35 13 43 17 45 25 C39 24 33 25 28 27 Z"
          fill="#ffb300"
        />
        <path
          d="M28 27 C33 25.5 39 25 45 25 C42 29 35 30.5 28 29.5 Z"
          fill="#f57c00"
        />
        <path d="M41 19.5 C43.5 21 44.6 23 45 25 L41.5 25.3 Z" fill="#d84315" />
        <path
          d="M28 27 C33 25.5 39 25 45 25"
          fill="none"
          stroke="#8d4a00"
          strokeWidth="0.8"
        />
      </>
    ),
  },
  onca: {
    fundo: '#fff0d4',
    formas: (
      <>
        <circle cx="13" cy="14" r="5.2" fill="#e8901c" />
        <circle cx="35" cy="14" r="5.2" fill="#e8901c" />
        <circle cx="13" cy="14" r="2.5" fill="#3a2a16" />
        <circle cx="35" cy="14" r="2.5" fill="#3a2a16" />
        <circle cx="24" cy="27" r="15.5" fill="#f4a72c" />
        <circle cx="15" cy="21" r="1.7" fill="#3a2a16" />
        <circle cx="33" cy="21" r="1.7" fill="#3a2a16" />
        <circle cx="19" cy="15.5" r="1.4" fill="#3a2a16" />
        <circle cx="29" cy="15.5" r="1.4" fill="#3a2a16" />
        <circle cx="24" cy="13.8" r="1.3" fill="#3a2a16" />
        <circle cx="12.5" cy="29" r="1.6" fill="#3a2a16" />
        <circle cx="35.5" cy="29" r="1.6" fill="#3a2a16" />
        <ellipse cx="24" cy="33" rx="8.5" ry="6.5" fill="#fff3dc" />
        <ellipse cx="18.5" cy="24.5" rx="2" ry="2.4" fill="#3a2a16" />
        <ellipse cx="29.5" cy="24.5" rx="2" ry="2.4" fill="#3a2a16" />
        <circle cx="19.1" cy="23.8" r="0.6" fill="#fff" />
        <circle cx="30.1" cy="23.8" r="0.6" fill="#fff" />
        <path d="M21.4 29.5 H26.6 L24 32.6 Z" fill="#8b3a2a" />
        <path
          d="M24 32.6 V34.4 M24 34.4 Q22 36 20.4 35 M24 34.4 Q26 36 27.6 35"
          fill="none"
          stroke="#5a3a1a"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </>
    ),
  },
  arara: {
    fundo: '#ffe0e0',
    formas: (
      <>
        <path d="M6 32 Q12 46 28 47 Q16 40 15 30 Z" fill="#1e88e5" />
        <path d="M10 33 Q15 41 24 43 Q17 38 16 31 Z" fill="#fdd835" />
        <circle cx="21" cy="24" r="13" fill="#e53935" />
        <ellipse cx="26.5" cy="23" rx="6.2" ry="7" fill="#fff" />
        <path
          d="M23.5 26 H26.5 M24 28 H27"
          stroke="#e57373"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <circle cx="25.5" cy="21" r="2.3" fill="#fdd835" />
        <circle cx="25.6" cy="21" r="1.1" fill="#111" />
        <path
          d="M30 17 C38 16 43 23 39.5 31 C37.5 27 34.5 25.6 31 26.5 Z"
          fill="#f5f0e6"
        />
        <path
          d="M31 26.5 C34.5 25.6 37.6 27.5 37.4 30.5 C34.5 31.5 32 30.6 30.2 29.4 Z"
          fill="#2b2b2b"
        />
      </>
    ),
  },
  tamandua: {
    fundo: '#ece7df',
    formas: (
      <>
        <ellipse cx="14" cy="41" rx="17" ry="9" fill="#8d7b68" />
        <path
          d="M-2 36 C10 31 22 32 31 38 L30 42 C22 37 10 36 0 40 Z"
          fill="#2b2b2b"
        />
        <path
          d="M0 40 C10 36 22 37 30 42 L29 44 C21 40 10 39 1 43 Z"
          fill="#f5f5f5"
        />
        <ellipse cx="12.5" cy="16.5" rx="3.2" ry="2.6" fill="#6d5c4b" />
        <ellipse cx="18" cy="24" rx="10.5" ry="9" fill="#8d7b68" />
        <path
          d="M24 19.5 C32 20.5 40 22.5 45 24.5 C40 27 32 28.5 24 28.5 Z"
          fill="#7d6a55"
        />
        <circle cx="44.5" cy="24.8" r="1.6" fill="#2b2b2b" />
        <circle cx="20.5" cy="21.5" r="1.5" fill="#1d1d1d" />
        <circle cx="21" cy="21" r="0.45" fill="#fff" />
      </>
    ),
  },
  jabuti: {
    fundo: '#e3f1d6',
    formas: (
      <>
        <rect x="11" y="31" width="6" height="8" rx="2.5" fill="#8d6e63" />
        <rect x="27" y="31" width="6" height="8" rx="2.5" fill="#8d6e63" />
        <path
          d="M33 29 C36 27 38 26.5 40 26.5 L40 31 C37 31 35 31.5 33 32.5 Z"
          fill="#a1887f"
        />
        <ellipse cx="40.5" cy="27.5" rx="5.8" ry="4.6" fill="#a1887f" />
        <circle cx="42.3" cy="26.2" r="1.1" fill="#1d1d1d" />
        <path
          d="M42 29.4 Q43.6 30.2 45 29.3"
          fill="none"
          stroke="#5d4037"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <path d="M7 32 C7 18 35 16 37 32 Z" fill="#6b8e23" />
        <path
          d="M17 23.5 L22 21.5 L27 23.5 L27 28.5 L22 30.5 L17 28.5 Z"
          fill="#8bb33f"
        />
        <path d="M9.5 29 L14 26 L15.5 29.5 Z" fill="#8bb33f" />
        <path d="M29 26 L33.5 28 L32 31 Z" fill="#8bb33f" />
        <circle cx="22" cy="26" r="1.3" fill="#ffb74d" />
        <rect x="6" y="31" width="32" height="3.4" rx="1.7" fill="#556b2f" />
      </>
    ),
  },
  boto: {
    fundo: '#ffe3ee',
    formas: (
      <>
        <path
          d="M2 36 C4 21 21 14 30 18 C34 20 36 22 38 24 L45.5 25 C45.5 27.4 41 28.4 37 28.4 C32 33.5 20 39 2 39 Z"
          fill="#f48fb1"
        />
        <path
          d="M8 37 C16 36 26 33.5 33 29.5 C28 35 18 38.5 6 39 Z"
          fill="#fbc4d8"
        />
        <circle cx="26.5" cy="19.5" r="6" fill="#f8a5c2" />
        <circle cx="29.5" cy="23.5" r="1.4" fill="#1d1d1d" />
        <circle cx="29.9" cy="23.1" r="0.45" fill="#fff" />
        <path
          d="M35 27.2 C38 27.7 42 27.2 45.5 26.2"
          fill="none"
          stroke="#c2185b"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </>
    ),
  },
  coruja: {
    fundo: '#efe3cf',
    formas: (
      <>
        <path d="M11 9 L19 16 L10.5 19 Z" fill="#6d4c41" />
        <path d="M37 9 L29 16 L37.5 19 Z" fill="#6d4c41" />
        <ellipse cx="24" cy="29" rx="14.5" ry="15.5" fill="#8d6e63" />
        <circle cx="18.3" cy="23.5" r="6.2" fill="#d7ccc8" />
        <circle cx="29.7" cy="23.5" r="6.2" fill="#d7ccc8" />
        <circle cx="18.3" cy="23.5" r="3.7" fill="#ffd54f" />
        <circle cx="29.7" cy="23.5" r="3.7" fill="#ffd54f" />
        <circle cx="18.6" cy="23.6" r="1.9" fill="#1d1d1d" />
        <circle cx="29.4" cy="23.6" r="1.9" fill="#1d1d1d" />
        <circle cx="19.2" cy="23" r="0.6" fill="#fff" />
        <circle cx="30" cy="23" r="0.6" fill="#fff" />
        <path d="M24 27.5 L21.8 30.5 L24 33 L26.2 30.5 Z" fill="#f9a825" />
        <path
          d="M17 37.5 L19 39.5 L21 37.5 M22 37.5 L24 39.5 L26 37.5 M27 37.5 L29 39.5 L31 37.5"
          fill="none"
          stroke="#5d4037"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  preguica: {
    fundo: '#f1e8da',
    formas: (
      <>
        <circle cx="24" cy="26" r="16.5" fill="#b69d7f" />
        <path
          d="M16 11.5 Q20 8.5 24 11.5 Q28 8.5 32 11.5"
          fill="none"
          stroke="#9c8264"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <ellipse cx="24" cy="28" rx="12.5" ry="10.5" fill="#ece0cb" />
        <path
          d="M11.5 25 C13.5 20.5 20 21.5 21.2 25.5 C19.2 29 13.8 29 11.5 25 Z"
          fill="#5d4632"
        />
        <path
          d="M36.5 25 C34.5 20.5 28 21.5 26.8 25.5 C28.8 29 34.2 29 36.5 25 Z"
          fill="#5d4632"
        />
        <circle cx="17.3" cy="25.3" r="1.5" fill="#1d1d1d" />
        <circle cx="30.7" cy="25.3" r="1.5" fill="#1d1d1d" />
        <circle cx="17.7" cy="24.8" r="0.5" fill="#fff" />
        <circle cx="31.1" cy="24.8" r="0.5" fill="#fff" />
        <ellipse cx="24" cy="30" rx="2.7" ry="1.9" fill="#3e2c1c" />
        <path
          d="M20.5 33.5 Q24 36.6 27.5 33.5"
          fill="none"
          stroke="#3e2c1c"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  'lobo-guara': {
    fundo: '#ffe6cc',
    formas: (
      <>
        <path d="M8 5 L19.5 17 L11 22.5 Z" fill="#c4541f" />
        <path d="M40 5 L28.5 17 L37 22.5 Z" fill="#c4541f" />
        <path d="M10.5 9.5 L17 17 L12 20.5 Z" fill="#ffb38a" />
        <path d="M37.5 9.5 L31 17 L36 20.5 Z" fill="#ffb38a" />
        <path
          d="M11.5 19 C11.5 12.5 36.5 12.5 36.5 19 C38.5 29 30.5 39.5 24 41.5 C17.5 39.5 9.5 29 11.5 19 Z"
          fill="#d9622b"
        />
        <path
          d="M15.5 30 C17.5 36.5 21.5 40 24 41.5 C26.5 40 30.5 36.5 32.5 30 C28.5 33.5 19.5 33.5 15.5 30 Z"
          fill="#fff3e8"
        />
        <path
          d="M20 29 C20 33.5 22 36.5 24 37.5 C26 36.5 28 33.5 28 29 C26 30.6 22 30.6 20 29 Z"
          fill="#2b2b2b"
        />
        <ellipse cx="24" cy="30.2" rx="2.3" ry="1.6" fill="#111" />
        <ellipse cx="18.5" cy="23.5" rx="1.7" ry="2" fill={TINTA} />
        <ellipse cx="29.5" cy="23.5" rx="1.7" ry="2" fill={TINTA} />
        <circle cx="19" cy="22.9" r="0.55" fill="#fff" />
        <circle cx="30" cy="22.9" r="0.55" fill="#fff" />
      </>
    ),
  },
  'mico-leao': {
    fundo: '#fff3d6',
    formas: (
      <>
        <circle cx="24" cy="25" r="19" fill="#f59e0b" />
        <path
          d="M8 18 L4 14 L10 15 Z M40 18 L44 14 L38 15 Z M24 6 L21 2 L27 2 Z M14 9 L11 4 L17 6 Z M34 9 L37 4 L31 6 Z"
          fill="#f59e0b"
        />
        <circle cx="24" cy="25" r="14.5" fill="#fbbf24" />
        <ellipse cx="24" cy="28" rx="8.5" ry="10" fill="#5b3a29" />
        <circle cx="20.5" cy="25" r="2.3" fill="#f3e0c0" />
        <circle cx="27.5" cy="25" r="2.3" fill="#f3e0c0" />
        <circle cx="20.7" cy="25.2" r="1.3" fill="#1d1d1d" />
        <circle cx="27.3" cy="25.2" r="1.3" fill="#1d1d1d" />
        <circle cx="21.1" cy="24.7" r="0.45" fill="#fff" />
        <circle cx="27.7" cy="24.7" r="0.45" fill="#fff" />
        <ellipse cx="24" cy="30.2" rx="1.6" ry="1" fill={TINTA} />
        <path
          d="M21.5 33.5 Q24 35.2 26.5 33.5"
          fill="none"
          stroke="#e8c39e"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </>
    ),
  },
  tatu: {
    fundo: '#efe6dc',
    formas: (
      <>
        <path d="M3 37 L12 32.5 L12 37.5 Z" fill="#8d7b6a" />
        <rect x="11" y="35" width="5" height="7" rx="2" fill="#7a6858" />
        <rect x="29" y="35" width="5" height="7" rx="2" fill="#7a6858" />
        <path d="M8 38 C8 21 34 17 38 34 L38 38 Z" fill="#9e8a78" />
        <path
          d="M16 23.5 C15 28 15 33 16 38 M22 21.2 C21.5 27 21.5 33 22 38 M28 21.6 C28.6 27 28.6 33 28 38"
          fill="none"
          stroke="#7a6858"
          strokeWidth="1.3"
        />
        <rect x="7" y="36" width="32" height="3" rx="1.5" fill="#7a6858" />
        <path
          d="M35 31 C37 25.5 42 25 46.5 31.5 C43.5 34.5 39 35.5 35.5 34.5 Z"
          fill="#b8a594"
        />
        <ellipse
          cx="38.2"
          cy="25.5"
          rx="1.6"
          ry="3.2"
          transform="rotate(-15 38.2 25.5)"
          fill="#8d7b6a"
        />
        <circle cx="40.8" cy="29" r="1.1" fill="#1d1d1d" />
        <circle cx="41.1" cy="28.7" r="0.35" fill="#fff" />
        <circle cx="46" cy="31.5" r="0.9" fill="#5d4c3e" />
      </>
    ),
  },
  jacare: {
    fundo: '#e1f0d8',
    formas: (
      <>
        <circle cx="16" cy="15" r="5.5" fill="#4d7c3a" />
        <circle cx="32" cy="15" r="5.5" fill="#4d7c3a" />
        <path
          d="M10 21 C10 14 38 14 38 21 L35 46 C35 50 13 50 13 46 Z"
          fill="#5b8f45"
        />
        <path
          d="M12.6 29 L15 30.4 L12.9 31.8 Z M13.3 35 L15.6 36.3 L13.6 37.7 Z M35.4 29 L33 30.4 L35.1 31.8 Z M34.7 35 L32.4 36.3 L34.4 37.7 Z"
          fill="#fff"
        />
        <circle cx="16" cy="14.5" r="3" fill="#f2e14c" />
        <circle cx="32" cy="14.5" r="3" fill="#f2e14c" />
        <ellipse cx="16" cy="14.5" rx="0.9" ry="2.2" fill="#1d1d1d" />
        <ellipse cx="32" cy="14.5" rx="0.9" ry="2.2" fill="#1d1d1d" />
        <circle cx="24" cy="23" r="1.3" fill="#4d7c3a" />
        <circle cx="20" cy="27" r="1.1" fill="#4d7c3a" />
        <circle cx="28" cy="27" r="1.1" fill="#4d7c3a" />
        <ellipse cx="21.5" cy="41" rx="1.1" ry="1.4" fill="#2f5a24" />
        <ellipse cx="26.5" cy="41" rx="1.1" ry="1.4" fill="#2f5a24" />
      </>
    ),
  },
  ariranha: {
    fundo: '#dcefee',
    formas: (
      <>
        <circle cx="13" cy="16" r="3.6" fill="#4e342e" />
        <circle cx="35" cy="16" r="3.6" fill="#4e342e" />
        <ellipse cx="24" cy="27" rx="15" ry="14" fill="#6b4a32" />
        <path
          d="M14 38 C18 34 22 37 24 35 C26 37 30 34 34 38 C30 46 18 46 14 38 Z"
          fill="#f1e3c8"
        />
        <ellipse cx="24" cy="30.5" rx="6.5" ry="4.5" fill="#8a6650" />
        <ellipse cx="24" cy="28.6" rx="2.4" ry="1.6" fill="#1d1d1d" />
        <circle cx="18" cy="23" r="1.7" fill="#1d1d1d" />
        <circle cx="30" cy="23" r="1.7" fill="#1d1d1d" />
        <circle cx="18.5" cy="22.4" r="0.55" fill="#fff" />
        <circle cx="30.5" cy="22.4" r="0.55" fill="#fff" />
        <path
          d="M22 32.5 Q24 34 26 32.5"
          fill="none"
          stroke="#3e2c1c"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M17.5 30 L11 29 M17.5 31.5 L11 32.8 M30.5 30 L37 29 M30.5 31.5 L37 32.8"
          fill="none"
          stroke="#d7c4a8"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </>
    ),
  },
  seriema: {
    fundo: '#f3ede2',
    formas: (
      <>
        <ellipse cx="15" cy="43" rx="14" ry="9" fill="#a8977e" />
        <path
          d="M13 41 C13 31 17 25 21.5 22.5 L28 24.5 C25 28.5 22.5 34 22.5 42 Z"
          fill="#c2b49e"
        />
        <path
          d="M17 33 L20 34 M16.5 37 L20 38"
          fill="none"
          stroke="#9a8a74"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <circle cx="26" cy="19" r="7" fill="#c2b49e" />
        <path
          d="M22 13.5 C20 8 22.5 4.5 25 3 C24 7 25 10 26.2 12.6 Z"
          fill="#8d7d68"
        />
        <path
          d="M24.6 12.6 C24.3 8 27 5.2 29.5 4.5 C27.8 8 27.8 10.5 27.8 13.2 Z"
          fill="#8d7d68"
        />
        <path d="M32 17.5 L41.5 20.3 L32.2 22.2 Z" fill="#d84315" />
        <circle cx="28" cy="18" r="2.7" fill="#64b5f6" />
        <circle cx="28" cy="18" r="1.4" fill="#ffe082" />
        <circle cx="28.1" cy="18" r="0.8" fill="#1d1d1d" />
      </>
    ),
  },
};

type PropriedadesIconeAnimal = {
  chave: ChaveAnimal;
  className?: string;
};

// Sempre decorativo: o apelido ("Capivara anônima") vem em texto ao lado ou
// no rótulo acessível de quem usa o ícone.
export default function IconeAnimal({
  chave,
  className,
}: PropriedadesIconeAnimal) {
  const idRecorte = useId();
  const desenho = DESENHOS[chave];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 48 48"
      className={combinarClasses('size-8 shrink-0 rounded-full', className)}
    >
      <defs>
        <clipPath id={idRecorte}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idRecorte})`}>
        <rect width="48" height="48" fill={desenho.fundo} />
        {desenho.formas}
      </g>
    </svg>
  );
}
