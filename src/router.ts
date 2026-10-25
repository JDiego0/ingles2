/**
 * Router mínimo por hash (#/ruta). Funciona en GitHub Pages sin configuración del servidor
 * y respeta el botón «atrás» de Android.
 */
import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  parts: string[];
}

function parse(): Route {
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, '')) || '/';
  const path = raw.startsWith('/') ? raw : '/' + raw;
  return { path, parts: path.split('/').filter(Boolean) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(href: string) {
  const target = href.startsWith('#') ? href : '#' + href;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

/** Vuelve atrás si hay historial dentro de la app; si no, va al destino indicado. */
export function goBack(fallback = '#/') {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}
