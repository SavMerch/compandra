import { cn } from '@/lib/utils';
import { useSignedUrl } from '@/data/hooks';

type Scene = { sky: string; sun: string; sunY: number; layers: [string, string][]; extra?: React.ReactNode };
const hills = {
  a: 'M0 150C70 110 130 130 200 140S320 100 400 130V240H0Z', b: 'M0 180C90 150 150 195 240 175S340 150 400 170V240H0Z', c: 'M0 210C100 190 180 225 280 205S360 200 400 208V240H0Z',
  peaks: 'M0 170L70 90 120 140 190 60 260 145 320 95 400 165V240H0Z', peaks2: 'M0 195L90 130 170 190 250 125 330 185 400 150V240H0Z',
  mesa: 'M0 165H60L75 115H150L165 165H250L262 135H330L345 165H400V240H0Z',
};
export const scenes: Record<string, Scene> = {
  coast: { sky: '#BFE3E0', sun: '#F4B98A', sunY: 78, layers: [[hills.b, '#3A9C98'], [hills.c, '#EFD9B4']], extra: <path d="M285 205c2-30 8-50 18-68m0 0c-14-3-26 2-33 12m33-12c10-9 24-9 33 0m-33 0c-6 10-8 18-6 28" stroke="#16263D" strokeWidth="4" fill="none" strokeLinecap="round" /> },
  arena: { sky: '#16263D', sun: '#16263D', sunY: 60, layers: [[hills.b, '#0F6B6B'], [hills.c, '#FBFAF6']], extra: <g fill="#F3C96B"><path d="M95 62l10 92h-20z" opacity=".25" /><path d="M300 62l10 92h-20z" opacity=".25" /><circle cx="95" cy="60" r="5" /><circle cx="300" cy="60" r="5" /></g> },
  mountains: { sky: '#DCE7EE', sun: '#F2A65A', sunY: 62, layers: [[hills.peaks, '#5B7A99'], [hills.peaks2, '#2F4A68'], [hills.c, '#16263D']] },
  home: { sky: '#F8E2C8', sun: '#E8765F', sunY: 70, layers: [[hills.a, '#9CBF9E'], [hills.c, '#3E7C59']], extra: <g><path d="M170 180v-34l32-24 32 24v34z" fill="#FBFAF6" /><path d="M162 150l40-32 40 32" stroke="#C94F38" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" /><rect x="195" y="158" width="14" height="22" fill="#16263D" /></g> },
  garden: { sky: '#F7D9D3', sun: '#FBFAF6', sunY: 66, layers: [[hills.a, '#A9C8A0'], [hills.b, '#5E9A73'], [hills.c, '#2E6A52']] },
  desert: { sky: '#F6C89F', sun: '#C94F38', sunY: 74, layers: [[hills.mesa, '#B8623F'], [hills.b, '#D98E5F'], [hills.c, '#16263D']] },
  city: { sky: '#CFE0EA', sun: '#F2A65A', sunY: 56, layers: [['M0 240V150h40v-30h35v50h30V90h45v70h28v-40h40v60h34V100h48v50h30v-20h70v110z', '#16263D'], [hills.c, '#0F6B6B']] },
  lake: { sky: '#E4EFEA', sun: '#F2B880', sunY: 64, layers: [[hills.peaks2, '#6E9C96'], ['M0 178H400V240H0Z', '#2C7C86'], ['M60 196h90M210 212h120M120 226h70', '#FFFFFF55']] },
};
export const sceneKeys = Object.keys(scenes);

export function CoverArt({ scene, path, className, alt }: { scene?: string; path?: string | null; className?: string; alt?: string }) {
  const url = useSignedUrl(path);
  if (path && url.data) return <img src={url.data} alt={alt ?? ''} className={cn('h-full w-full object-cover', className)} />;
  const s = scenes[scene ?? 'coast'] ?? scenes.coast;
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={cn('h-full w-full', className)} role={alt ? 'img' : undefined} aria-label={alt} aria-hidden={alt ? undefined : true}>
      <rect width="400" height="240" fill={s.sky} />
      <circle cx="120" cy={s.sunY} r="32" fill={s.sun} />
      {s.extra}
      {s.layers.map(([d, c], i) => (c.endsWith('55') ? <path key={i} d={d} stroke={c} strokeWidth="3" strokeLinecap="round" fill="none" /> : <path key={i} d={d} fill={c} />))}
    </svg>
  );
}
