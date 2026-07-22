// Store-screenshot generator: seeds realistic demo data into the local preview
// and captures the key screens at Apple 6.9" resolution (440x956 @3x = 1320x2868).
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';

const OUT = new URL('../store-shots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
await mkdir(OUT, { recursive: true });

const now = Date.now();
const day = 864e5;
const mkLog = (o) => ({
  id: now - Math.floor(Math.random() * 1e9), ts: now, date: 'Jul 21, 2026',
  dogName: '', breed: '', style: '', size: 'medium', min: 45,
  pw: 0, bo: 0, bs: 0, sl: 0, hf: 0, ta: 0, fi: 0,
  diff: 1, notes: '', timed: false, before: null, after: null, ...o
});

const fmt = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const logs = [
  mkLog({ dogName: 'Bella Smith', breed: 'Goldendoodle', style: 'Teddy Bear', size: 'large', min: 82, diff: 2, timed: true, ts: now - 2 * 3600e3, date: fmt(now), pw: 7, bo: 12, bs: 18, sl: 16, hf: 14, ta: 4, fi: 6, sect: { pw: 420, bo: 720, bs: 1080, sl: 960, hf: 840, ta: 240, fi: 360 }, notes: 'Best behavior yet — no breaks needed!' }),
  mkLog({ dogName: 'Milo Chen', breed: 'Shih Tzu', style: 'Puppy Cut', size: 'small', min: 38, diff: 1, timed: true, ts: now - day, date: fmt(now - day), pw: 5, bo: 6, bs: 9, sl: 8, hf: 7, ta: 2, fi: 3 }),
  mkLog({ dogName: 'Daisy Nguyen', breed: 'Bichon Frise', style: 'Full Face & Feet (FFF)', size: 'small', min: 41, diff: 1, ts: now - day - 3600e3, date: fmt(now - day) }),
  mkLog({ dogName: 'Rocky Alvarez', breed: 'Miniature Schnauzer', style: 'Breed Specific', size: 'medium', min: 47, diff: 2, ts: now - 2 * day, date: fmt(now - 2 * day) }),
  mkLog({ dogName: 'Luna Park', breed: 'Cockapoo', style: 'Summer Cut', size: 'medium', min: 52, diff: 3, timed: true, ts: now - 3 * day, date: fmt(now - 3 * day) }),
  mkLog({ dogName: 'Bella Smith', breed: 'Goldendoodle', style: 'Teddy Bear', size: 'large', min: 89, diff: 2, ts: now - 14 * day, date: fmt(now - 14 * day) }),
  mkLog({ dogName: 'Bella Smith', breed: 'Goldendoodle', style: 'Teddy Bear', size: 'large', min: 96, diff: 3, ts: now - 28 * day, date: fmt(now - 28 * day) }),
  mkLog({ dogName: 'Milo Chen', breed: 'Shih Tzu', style: 'Puppy Cut', size: 'small', min: 44, diff: 1, ts: now - 21 * day, date: fmt(now - 21 * day) }),
  mkLog({ dogName: 'Teddy Brooks', breed: 'Pomeranian', style: 'Lion Cut', size: 'small', min: 35, diff: 2, ts: now - 4 * day, date: fmt(now - 4 * day) }),
  mkLog({ dogName: 'Coco Rivera', breed: 'Standard Poodle', style: 'Lamb Cut', size: 'large', min: 105, diff: 3, ts: now - 6 * day, date: fmt(now - 6 * day) }),
];

const state = {
  schemaVersion: 4, onboarded: true, theme: 'light', tab: 'home',
  logs,
  breedNotes: {
    goldendoodle: { blade: '5F body', comb: '1" guard', targetMin: 80, notes: 'Sensitive paws — do feet last. Loves the high-velocity dryer.' },
    'shih tzu': { blade: '7F', comb: '', targetMin: 40, notes: 'Round the face, short sani.' }
  },
  goals: { dogsPerDay: 6, avgTarget: 55 },
  chk: {}, standards: [],
  timerSplits: [], timerStart: null, timerRunning: false,
  logFilter: 'all'
};

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 440, height: 956, deviceScaleFactor: 3 });
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });

await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await page.goto('http://localhost:5487', { waitUntil: 'networkidle0' });
await page.evaluate((st) => {
  _resetting = true; // stop the beforeunload save() from clobbering the seed on reload
  localStorage.setItem('groompace-v5', JSON.stringify(st));
  localStorage.setItem('groompace-last-version', String(APP_VERSION)); // suppress the update toast in shots
}, state);
await page.reload({ waitUntil: 'networkidle0' });
await page.evaluate(async () => { await document.fonts.ready; });
// Hide the PWA install banner — irrelevant inside the store app.
await page.evaluate(() => {
  if (typeof _deferredPrompt !== 'undefined') _deferredPrompt = null;
  const btn = document.querySelector('[data-action="install-pwa"]');
  if (btn) { const card = btn.closest('.c') || btn.parentElement; if (card) card.style.display = 'none'; }
  R();
  const btn2 = document.querySelector('[data-action="install-pwa"]');
  if (btn2) { const card = btn2.closest('.c') || btn2.parentElement; if (card) card.style.display = 'none'; }
});
await new Promise(r => setTimeout(r, 600));

const shot = async (name) => {
  await new Promise(r => setTimeout(r, 450));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('captured', name);
};

// 1. Home
await shot('1-home');

// 2. Timer running with ghost race (23 min into a Goldendoodle groom)
await page.evaluate(() => {
  S.tab = 'timer';
  S.timerDogName = 'Bella Smith'; S.timerBreed = 'Goldendoodle'; S.timerStyle = 'Teddy Bear';
  S.timerSize = 'large';
  S.timerStart = Date.now() - 23 * 60e3;
  S.timerRunning = true; S.timerPausedAt = null; S.timerTotalPausedDuration = 0;
  S.timerSplits = [
    { label: 'pw', elapsed: 6 * 60e3, time: Date.now() - 17 * 60e3 },
    { label: 'bo', elapsed: 17 * 60e3, time: Date.now() - 6 * 60e3 }
  ];
  S.timerGhost = getGhostTime('Bella Smith', 'Goldendoodle');
  R(); if (typeof tick === 'function') tick();
});
await shot('2-timer-ghost');

// 3. Review screen with a new PB
await page.evaluate(() => {
  clearInterval(typeof TI !== 'undefined' ? TI : undefined);
  S.timerRunning = false; S.timerStart = null;
  S.timerReview = {
    min: 78, totalMs: 78 * 60e3, dogName: 'Bella Smith', breed: 'Goldendoodle',
    style: 'Teddy Bear', size: 'large', prevBest: 82,
    pw: 6, bo: 11, bs: 17, sl: 15, hf: 13, ta: 4, fi: 5,
    sect: null, before: null, splits: []
  };
  R();
});
await shot('3-new-pb');

// 4. Log tab
await page.evaluate(() => { S.timerReview = null; S.tab = 'log'; S.logFilter = 'all'; R(); });
await shot('4-log');

// 5. Stats
await page.evaluate(() => { S.tab = 'me'; S.sub2 = 'stats'; R(); });
await shot('5-stats');

// 6. Awards
await page.evaluate(() => { S.sub2 = 'achievements'; R(); });
await shot('6-awards');

// 7. Timer setup with style pills (shows the new feature)
await page.evaluate(() => {
  S.tab = 'timer'; S.timerRunning = false; S.timerStart = null; S.timerReview = null;
  S.timerDogName = 'Bella Smith'; S.timerBreed = 'Goldendoodle'; S.timerStyle = 'Teddy Bear';
  R();
});
await shot('7-timer-setup');

await browser.close();
console.log('DONE ->', OUT);
