import { useEffect, useRef } from 'react';

const alea = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const FEUILLE = 'M0 0 C10 -14 34 -16 50 0 C34 16 10 14 0 0Z';
const NB_FEUILLES = 18;

const genererLiane = (graine: number) => {
  const points = Array.from({ length: 10 }, (_, i) => ({ x: 22 + alea(graine + i) * 26, y: i * 100 }));
  const [p0, p1, ...suite] = points;
  const tige = `M${p0.x} ${p0.y} Q${p0.x + 24} 50 ${p1.x} ${p1.y} ` + suite.map((p) => `T${p.x} ${p.y}`).join(' ');

  const feuilles = Array.from({ length: NB_FEUILLES }, (_, i) => {
    const y = 20 + i * 48 + alea(graine * 7 + i) * 12;
    const k = Math.min(Math.floor(y / 100), points.length - 2);
    const t = (y - points[k].y) / 100;
    const x = points[k].x + (points[k + 1].x - points[k].x) * t;
    const angle = i % 2 ? -50 + alea(graine + i * 3) * 70 : 150 + alea(graine + i * 5) * 60;
    const taille = 0.6 + alea(graine + i * 11) * 0.7;
    return { x, y, angle, taille, delai: -alea(graine + i * 13) * 6 };
  });

  return { tige, feuilles };
};

const LIANES = [genererLiane(1), genererLiane(42)];

const CORPS = 'M58 168 C18 128 62 102 100 100 S182 78 140 40';

const Jungle = () => {
  const racineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const racine = racineRef.current!;
    let frame = 0;

    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        racine.style.setProperty('--px', String((e.clientX / innerWidth) * 2 - 1));
        racine.style.setProperty('--py', String((e.clientY / innerHeight) * 2 - 1));
        racine.querySelectorAll('.leaf:not(.rustle)').forEach((feuille) => {
          const r = feuille.getBoundingClientRect();
          if (e.clientX > r.left - 8 && e.clientX < r.right + 8 && e.clientY > r.top - 8 && e.clientY < r.bottom + 8) {
            feuille.classList.add('rustle');
          }
        });
      });
    };
    const finRustle = (e: AnimationEvent) => {
      if (e.animationName === 'rustle') (e.target as Element).classList.remove('rustle');
    };

    window.addEventListener('pointermove', onMove);
    racine.addEventListener('animationend', finRustle);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      racine.removeEventListener('animationend', finRustle);
    };
  }, []);

  return (
    <div className="jungle" ref={racineRef} aria-hidden="true">
      <div className="jungle-snake">
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" className="snake-ring" />
          <circle cx="100" cy="100" r="84" className="snake-ring snake-ring-thin" />
          <polygon points="63,163 53,173 74,184" className="snake-fill" />
          <path d={CORPS} className="snake-body" />
          <path d={CORPS} className="snake-scales" />
          <g transform="translate(140 40) rotate(-138)">
            <path d="M20 0 H30 L35 -4 M30 0 L35 4" className="snake-tongue" />
            <path d="M-6 -8 C6 -11 18 -6 21 0 C18 6 6 11 -6 8 Z" className="snake-fill" />
            <circle cx="11" cy="-4" r="1.6" className="snake-eye" />
            <circle cx="11" cy="4" r="1.6" className="snake-eye" />
          </g>
        </svg>
      </div>

      <div className="jungle-vines">
        {LIANES.map((liane, cote) => (
          <svg
            key={cote}
            className={`vine ${cote ? 'vine-right' : 'vine-left'}`}
            viewBox="0 0 130 900"
            preserveAspectRatio="xMinYMin slice"
          >
            <path d={liane.tige} className="vine-stem" />
            {liane.feuilles.map((f, i) => (
              <g key={i} transform={`translate(${f.x} ${f.y}) rotate(${f.angle}) scale(${f.taille})`}>
                <g className="leaf" style={{ animationDelay: `${f.delai}s` }}>
                  <path d={FEUILLE} />
                  <path d="M2 0 L46 0" className="leaf-rib" />
                </g>
              </g>
            ))}
          </svg>
        ))}
      </div>
    </div>
  );
};

export default Jungle;
