"use client";

import { useEffect, useState } from "react";
import type { Slide } from "@/lib/landing-slides";

export default function Carrusel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const n = slides.length;

  useEffect(() => {
    if (n <= 1) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(id);
  }, [n]);

  if (n === 0) return null;
  const ir = (idx: number) => setI(((idx % n) + n) % n);

  return (
    <section className="relative h-64 w-full overflow-hidden sm:h-80 lg:h-96">
      {slides.map((s, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0"} ${s.imagen ? "bg-cover bg-center" : (s.gradiente ?? "bg-slate-800")}`}
          style={s.imagen ? { backgroundImage: `url(${s.imagen})` } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          {(s.titulo || s.subtitulo) ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              {s.titulo ? <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-white drop-shadow sm:text-5xl">{s.titulo}</h2> : null}
              {s.subtitulo ? <p className="mt-3 max-w-2xl text-base text-slate-100 drop-shadow sm:text-lg">{s.subtitulo}</p> : null}
            </div>
          ) : null}
        </div>
      ))}

      {n > 1 ? (
        <>
          <button onClick={() => ir(i - 1)} aria-label="Anterior" className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button onClick={() => ir(i + 1)} aria-label="Siguiente" className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {slides.map((_, idx) => (
              <button key={idx} onClick={() => ir(idx)} aria-label={`Ir al slide ${idx + 1}`} className={`h-2.5 rounded-full transition-all ${idx === i ? "w-8 bg-[#f5c518]" : "w-2.5 bg-white/60 hover:bg-white"}`} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
