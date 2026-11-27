import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** True when the page is taller than the window, so there is something to scroll back up */
function pageScrolls() {
  return document.documentElement.scrollHeight > window.innerHeight + 40;
}

/** At the bottom of any page that scrolls: a link back to the top. */
export default function BackToTop() {
  const [scrolls, setScrolls] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const check = () => setScrolls(pageScrolls());
    check();
    window.addEventListener('resize', check);
    // The page grows and shrinks as content loads and sections open
    const observer = new ResizeObserver(check);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', check);
      observer.disconnect();
    };
  }, [location.pathname]);

  if (!scrolls) return null;

  function toTop() {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  return (
    <p className="back-to-top page-end">
      <button type="button" className="link" onClick={toTop}>↑ Back to top</button>
    </p>
  );
}
