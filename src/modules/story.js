// Scroll story cards, nav scrollspy, the federal fiscal clock, and the few
// figures in the markup that are computed from the data rather than typed.
import { NODES, META, siteById, CITIES } from '../lib/data.js';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const inWords = (n) => (n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : String(n));

/** data-count="orgs" | "cities" | "site:<id>" — a count taken from data/. */
function countFor(key) {
  if (key === 'orgs') return NODES.length;
  if (key === 'cities') return CITIES.length;
  if (key.startsWith('site:')) return siteById[key.slice(5)]?.members.length;
  return undefined;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function initStory() {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const card = e.target.querySelector('.beat-card');
        if (card && e.isIntersecting) card.classList.add('vis');
      }),
    { threshold: 0.35 },
  );
  document.querySelectorAll('.beat').forEach((b) => io.observe(b));

  const links = [...document.querySelectorAll('nav#top a.nl')];
  const spy = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id));
      }),
    { rootMargin: '-40% 0px -55% 0px' },
  );
  ['story', 'atlas', 'network', 'money', 'contracts', 'watchlist', 'method']
    .map((id) => document.getElementById(id))
    .forEach((s) => s && spy.observe(s));

  // Federal fiscal year starts Oct 1; quarters set award tempo.
  const now = new Date();
  const fy = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  const q = Math.floor(((now.getMonth() + 3) % 12) / 3) + 1;
  const txt = 'FY' + String(fy).slice(2) + ' · Q' + q;
  const p1 = document.getElementById('fy-pill');
  if (p1) p1.textContent = txt;
  const p2 = document.getElementById('fy-pill2');
  if (p2) p2.textContent = txt + ' — FEDERAL FISCAL CLOCK';

  // Figures derived from data/ so they cannot drift from it.
  // In the markup: <span data-count="site:beavercreek" data-as="Word">Twenty</span>.
  // data-as="word" / "Word" spells the number; the typed text is the no-JS fallback.
  document.querySelectorAll('[data-count]').forEach((el) => {
    const n = countFor(el.dataset.count);
    if (n == null) return;
    let t = String(n);
    if (el.dataset.as === 'word' || el.dataset.as === 'Word') t = inWords(n);
    if (el.dataset.as === 'Word') t = t[0].toUpperCase() + t.slice(1);
    el.textContent = t;
  });
  const refreshed = document.querySelector('[data-meta="refreshed"]');
  if (refreshed && META.data_refreshed) {
    const [y, m] = META.data_refreshed.split('-');
    refreshed.textContent = 'DATA REFRESHED ' + MONTHS[Number(m) - 1] + ' ' + y;
  }
}
