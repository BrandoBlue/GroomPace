// GroomPace app — loaded as a classic script (NOT type="module").
// Inline onchange handlers in HTML templates (photo uploads, import, goals)
// call functions on the global scope (rvPhoto, hPh, importData, etc.).
// ES modules have their own scope; migrating those handlers is deferred.
// Keep this tag: <script src="app.js"></script> at end of <body>.

const APP_VERSION = '0.16.0';

const SK = 'groompace-v5';

// ── PWA Install Prompt Logic ──
let _deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    R(); // Re-render to show install banner
});

// ── Data ──
const BLADES = [
    {n:'#50',len:'1/125"',mm:'0.2',area:'Veterinary / surgical only'},
    {n:'#40',len:'1/100"',mm:'0.25',area:'Base blade for guard combs'},
    {n:'#30',len:'1/50"',mm:'0.5',area:'Base for guard combs, close work'},
    {n:'#15',len:'3/64"',mm:'1.2',area:'Paw pads, ears, inner sanitary'},
    {n:'#10',len:'1/16"',mm:'1.5',area:'Sanitary, pads, poodle faces, under combs'},
    {n:'#9',len:'5/64"',mm:'2',area:'Body, between #10 and #7'},
    {n:'#8½',len:'7/64"',mm:'2.8',area:'Body work on medium breeds'},
    {n:'#7F',len:'1/8"',mm:'3.2',area:'Body on most breeds — smooth finish'},
    {n:'#7',len:'1/8"',mm:'3.2',area:'Pre-bath rough cut, thick/matted coats'},
    {n:'#5F',len:'1/4"',mm:'6.3',area:'Fuller body look, summer trims'},
    {n:'#5',len:'1/4"',mm:'6.3',area:'Pre-bath on dense coats'},
    {n:'#4F',len:'3/8"',mm:'9.5',area:'Natural look, terrier bodies'},
    {n:'#4',len:'3/8"',mm:'9.5',area:'Thick coats needing length'},
    {n:'#3F',len:'1/2"',mm:'13',area:'Puppy trims, longest blade cut'},
    {n:'#3¾',len:'1/2"',mm:'13',area:'Rough cut before finishing'},
];

const GUARDS = [
    {n:'#0 (A)',len:'5/16"',mm:'8'}, {n:'#½ (B)',len:'1/2"',mm:'13'},
    {n:'#1 (C)',len:'5/8"',mm:'16'}, {n:'#1½ (D)',len:'3/4"',mm:'19'},
    {n:'#2 (E)',len:'1"',mm:'25'},   {n:'#3',len:'1¼"',mm:'32'},
    {n:'#4',len:'1½"',mm:'38'},      {n:'#5',len:'2"',mm:'50'},
];

// Common breeds groomers see most often. Used to seed the breed dropdown
// so the user has options before they've logged anything. The user can
// still type breeds not on this list — datalist suggests but doesn't enforce.
const COMMON_BREEDS = [
    // Doodles & designer mixes
    'Goldendoodle', 'Labradoodle', 'Bernedoodle', 'Sheepadoodle', 'Aussiedoodle',
    'Cockapoo', 'Cavapoo', 'Maltipoo', 'Shih-Poo', 'Yorkipoo', 'Schnoodle',
    'Pomapoo', 'Havapoo', 'Whoodle', 'Pyredoodle',
    // Poodles
    'Standard Poodle', 'Miniature Poodle', 'Toy Poodle',
    // Small breeds (frequent)
    'Shih Tzu', 'Maltese', 'Yorkshire Terrier', 'Bichon Frise', 'Havanese',
    'Pomeranian', 'Cavalier King Charles Spaniel', 'Lhasa Apso', 'Pekingese',
    'Coton de Tulear', 'Brussels Griffon', 'Pug', 'French Bulldog',
    'Boston Terrier', 'Chihuahua', 'Papillon', 'Italian Greyhound', 'Dachshund',
    // Terriers
    'West Highland White Terrier', 'Scottish Terrier', 'Cairn Terrier',
    'Norwich Terrier', 'Norfolk Terrier', 'Wire Fox Terrier',
    'Soft Coated Wheaten Terrier', 'Airedale Terrier', 'Jack Russell Terrier',
    'Welsh Terrier',
    // Spaniels & setters
    'Cocker Spaniel', 'English Springer Spaniel', 'English Cocker Spaniel',
    'Brittany', 'Irish Setter', 'Gordon Setter',
    // Sporting & working
    'Golden Retriever', 'Labrador Retriever', 'German Shepherd',
    'Australian Shepherd', 'Border Collie', 'Bernese Mountain Dog',
    'Old English Sheepdog', 'Newfoundland', 'Saint Bernard', 'Great Pyrenees',
    'Samoyed', 'Siberian Husky', 'Alaskan Malamute', 'Schipperke',
    // Schnauzers
    'Miniature Schnauzer', 'Standard Schnauzer', 'Giant Schnauzer',
    // Other common visitors
    'Bouvier des Flandres', 'Portuguese Water Dog', 'Briard', 'Komondor',
    'Puli', 'Tibetan Terrier', 'Affenpinscher', 'Chinese Crested',
    'Shiba Inu', 'American Eskimo',
    // Catch-alls
    'Mixed Breed', 'Mutt', 'Other'
];

// The three services a groom can be. Multi-select, because salons often split
// bathers and groomers: Bath + Brush pairs with either of the others. Full Hair
// Cut and FFF cover overlapping work, so selecting one clears the other.
// Each service brings its own timer steps; combos merge them and drop
// duplicates (you only prework a dog once, however many services it gets).
const SERVICES = [
    { k: 'bath', l: 'Bath + Brush',  steps: ['pw','ba','bd','bo'] },
    { k: 'full', l: 'Full Hair Cut', steps: ['pw','bo','bs','sl','hf'] },
    { k: 'fff',  l: 'FFF',           steps: ['pw','bo','ff'] }
];
const SERVICE_EXCLUSIVE = ['full', 'fff'];

// Timer steps: storage key -> button label + icon. `ta` (Tail) and `fi`
// (Finished) are retired from new grooms but stay here so older logs still
// render their recorded times. STEP_ORDER fixes button order across combos.
const STEPS = {
    pw: { t: 'Pre Work', e: 'paw' },
    ba: { t: 'Bath',     e: 'droplet' },
    bd: { t: 'Blow Dry', e: 'wind' },
    bo: { t: 'Brush',    e: 'comb' },
    bs: { t: 'Body',     e: 'clippers' },
    sl: { t: 'Legs',     e: 'scissors' },
    hf: { t: 'Head',     e: 'dog' },
    ff: { t: 'FFF',      e: 'sparkle' },
    ta: { t: 'Tail',     e: 'tail' },
    fi: { t: 'Finished', e: 'sparkle' }
};
const STEP_ORDER = ['pw','ba','bd','bo','bs','sl','hf','ff'];

// Services live in the existing free-text `style` field as a comma-joined
// list ("Bath + Brush, FFF"), so nothing about the storage shape changes and
// old typed styles ("Teddy Bear") still display and survive editing.
function serviceKeys(style) {
    const parts = String(style || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return SERVICES.filter(sv => parts.includes(sv.l.toLowerCase())).map(sv => sv.k);
}
// Anything in the stored style that isn't one of the three services — i.e. a
// style from before this change. Preserved rather than silently dropped.
function legacyStyle(style) {
    const known = SERVICES.map(sv => sv.l.toLowerCase());
    return String(style || '').split(',').map(s => s.trim())
        .filter(s => s && !known.includes(s.toLowerCase())).join(', ');
}
function styleFromKeys(keys, legacy) {
    const labels = SERVICES.filter(sv => keys.includes(sv.k)).map(sv => sv.l);
    if (legacy && legacy.trim()) labels.push(legacy.trim());
    return labels.join(', ');
}
// Toggle a service, enforcing the Full Hair Cut / FFF exclusivity.
function toggleService(keys, k) {
    if (keys.includes(k)) return keys.filter(x => x !== k);
    const next = keys.filter(x => !(SERVICE_EXCLUSIVE.includes(k) && SERVICE_EXCLUSIVE.includes(x)));
    return [...next, k];
}
// De-duplicated union of every selected service's steps, in STEP_ORDER.
function stepsForServices(keys) {
    const want = new Set();
    SERVICES.forEach(sv => { if (keys.includes(sv.k)) sv.steps.forEach(s => want.add(s)); });
    return STEP_ORDER.filter(s => want.has(s));
}

// ── Custom icon system ─────────────────────────────────────────────────────
// Hand-drawn inline SVGs in GroomPace's own visual language (soft rounded
// strokes, groomer-flavored). Replaces emoji app-wide. Two tricks make these
// perfect drop-in replacements for the emoji they succeed:
//   • width/height:1em (see .ic in CSS) → the icon scales with whatever
//     font-size the old emoji sat at, with no per-site sizing.
//   • stroke="currentColor" → the icon inherits the surrounding text color,
//     so colored section labels tint their icon for free.
// IC('name') returns a line icon; ICf('name') fills (for badges/dots).
const _ICP = {
    // nav + core
    home: '<path d="M4 11.2 12 4l8 7.2"/><path d="M6.2 9.8V19a1.6 1.6 0 0 0 1.6 1.6h8.4A1.6 1.6 0 0 0 17.8 19V9.8"/><path d="M10 20.4v-4.6a2 2 0 0 1 4 0v4.6"/>',
    stopwatch: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.6"/><path d="M12 6.4V3.9"/><path d="M9.5 3.9h5"/><path d="M18.4 7.1l1.2-1.2"/>',
    scissors: '<circle cx="6" cy="6.5" r="2.3"/><circle cx="6" cy="17.5" r="2.3"/><path d="M8 7.9 19.5 17"/><path d="M8 16.1 19.5 7"/><circle cx="11.8" cy="12" r=".9" fill="currentColor" stroke="none"/>',
    comb: '<rect x="4.4" y="5.2" width="15.2" height="4.2" rx="2.1"/><path d="M7.2 9.4v9"/><path d="M10.4 9.4v7"/><path d="M13.6 9.4v9"/><path d="M16.8 9.4v7"/>',
    paw: '<ellipse cx="6" cy="10.2" rx="1.5" ry="1.9"/><ellipse cx="9.8" cy="7.5" rx="1.6" ry="2"/><ellipse cx="14.2" cy="7.5" rx="1.6" ry="2"/><ellipse cx="18" cy="10.2" rx="1.5" ry="1.9"/><path d="M12 11.4c2.7 0 5 1.8 5 4 0 1.8-1.5 3-3.2 2.5-.7-.2-1.2-.3-1.8-.3s-1.1.1-1.8.3C8.5 18.4 7 17.2 7 15.4c0-2.2 2.3-4 5-4Z"/>',
    dog: '<path d="M4.7 6c-.7 1.6-.8 3.7-.1 5.4"/><path d="M19.3 6c.7 1.6.8 3.7.1 5.4"/><path d="M4.6 6.1C5.9 5 6.9 5.2 8 6.3"/><path d="M19.4 6.1C18.1 5 17.1 5.2 16 6.3"/><path d="M5.1 9.8c0 3.9 3 6.9 6.9 6.9s6.9-3 6.9-6.9"/><circle cx="9.4" cy="10.4" r=".8" fill="currentColor" stroke="none"/><circle cx="14.6" cy="10.4" r=".8" fill="currentColor" stroke="none"/><path d="M10.6 13.3a1.6 1.2 0 0 0 2.8 0"/>',
    // stats / data
    chart: '<path d="M4 4v15a1 1 0 0 0 1 1h15"/><rect x="7" y="11" width="2.8" height="6" rx=".6"/><rect x="12" y="7.5" width="2.8" height="9.5" rx=".6"/><rect x="17" y="13.5" width="2.8" height="3.5" rx=".6"/>',
    trend: '<path d="M4 4v15a1 1 0 0 0 1 1h15"/><path d="M7 15l3.4-3.6 2.6 2.2L20 8"/><path d="M20 12V8h-4"/>',
    trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3"/><path d="M17 5.5h2.5V7a3 3 0 0 1-3 3"/><path d="M12 13v3.5"/><path d="M8.5 20h7"/><path d="M9.5 20c0-1.4 1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/>',
    medal: '<circle cx="12" cy="14" r="5.2"/><path d="M12 11.4l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z" fill="currentColor" stroke="none"/><path d="M8.5 9.3 6 3.8"/><path d="M15.5 9.3 18 3.8"/>',
    star: '<path d="M12 4l2.3 4.8 5.2.7-3.8 3.6.95 5.2L12 15.9 7.35 18.3l.95-5.2L4.5 9.5l5.2-.7Z"/>',
    bulb: '<path d="M9 16.5a5.5 5.5 0 1 1 6 0c-.5.4-.8.9-.9 1.5H9.9c-.1-.6-.4-1.1-.9-1.5Z"/><path d="M9.8 20.5h4.4"/><path d="M10.2 18.4h3.6"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    // photos / media
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.7l1-1.6A1 1 0 0 1 10 5h4a1 1 0 0 1 .85.4l1 1.6h1.65A1.5 1.5 0 0 1 20 8.5V17a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17Z"/><circle cx="12" cy="12.5" r="3.2"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M4.5 17l4.5-4.5 3.5 3.2L16 12l3.5 3.3"/>',
    share: '<circle cx="17" cy="6" r="2.4"/><circle cx="6.5" cy="12" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="M8.6 10.8 14.9 7.2"/><path d="M8.6 13.2 14.9 16.8"/>',
    upload: '<path d="M12 15V5"/><path d="M8 8.5 12 4.5l4 4"/><path d="M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    download: '<path d="M12 4.5v10"/><path d="M8 11l4 4 4-4"/><path d="M5 15.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-2.5"/>',
    // tools / misc
    wrench: '<path d="M15.5 4.5a4.5 4.5 0 0 0-5.6 5.6L4.3 15.7a1.8 1.8 0 0 0 2.5 2.5l5.6-5.6a4.5 4.5 0 0 0 5.6-5.6l-2.7 2.7-2.4-.5-.5-2.4Z"/>',
    notebook: '<rect x="6" y="4" width="13" height="16" rx="1.6"/><path d="M9.5 4v16"/><path d="M12 8.5h4"/><path d="M12 12h4"/><path d="M6 8.5H4.8"/><path d="M6 12H4.8"/><path d="M6 15.5H4.8"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 9.5h16"/><path d="M8 4v3"/><path d="M16 4v3"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 16.3h2"/>',
    clipboard: '<rect x="5.5" y="5" width="13" height="15" rx="2"/><rect x="9" y="3.4" width="6" height="3.2" rx="1"/><path d="M9 11h6"/><path d="M9 14.5h6"/><path d="M9 18h3.5"/>',
    palette: '<path d="M12 4a8 8 0 1 0 0 16c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-1 .8-1.8 1.8-1.8h1.2A4 4 0 0 0 20 10c0-3.5-3.6-6-8-6Z"/><circle cx="8" cy="11.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1" fill="currentColor" stroke="none"/>',
    disk: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h9.7L20 7.8V18.5A1.5 1.5 0 0 1 18.5 20h-12A1.5 1.5 0 0 1 5 18.5Z"/><path d="M8 4v4.5h6.5V4"/><rect x="8.5" y="12.5" width="7" height="5" rx=".8"/>',
    phone: '<rect x="7" y="3.5" width="10" height="17" rx="2.4"/><path d="M10.5 6.5h3"/><path d="M11 17.8h2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3.5v2"/><path d="M12 18.5v2"/><path d="M3.5 12h2"/><path d="M18.5 12h2"/><path d="M6 6l1.4 1.4"/><path d="M16.6 16.6 18 18"/><path d="M18 6l-1.4 1.4"/><path d="M7.4 16.6 6 18"/>',
    moon: '<path d="M20 13.5A8 8 0 0 1 9.3 4.2 8 8 0 1 0 20 13.5Z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/><circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none"/>',
    ghost: '<path d="M5.5 19.2V11a6.5 6.5 0 0 1 13 0v8.2l-2.2-1.4-2.2 1.4L12 17.8l-2.1 1.4-2.2-1.4Z"/><circle cx="9.7" cy="10.8" r=".9" fill="currentColor" stroke="none"/><circle cx="14.3" cy="10.8" r=".9" fill="currentColor" stroke="none"/>',
    bolt: '<path d="M13 3 5.5 13.2h5L11 21l7.5-10.2h-5Z"/>',
    flame: '<path d="M12 3.5c2.5 3 4 4.8 4 7.8a4 4 0 0 1-8 0c0-1 .3-1.9.8-2.6-.1 1.3.6 2.3 1.5 2.4-.6-1.9.3-4.3 1.7-7.6Z"/>',
    hand: '<path d="M8 13V6.4a1.1 1.1 0 0 1 2.2 0V11"/><path d="M10.2 11V4.6a1.1 1.1 0 0 1 2.2 0V11"/><path d="M12.4 11V5.2a1.1 1.1 0 0 1 2.2 0V11.5"/><path d="M14.6 11.5V7.4a1.1 1.1 0 0 1 2.2 0v5.1a6 6 0 0 1-6 6 5.4 5.4 0 0 1-3.9-1.6l-2.4-2.5a1.2 1.2 0 0 1 1.7-1.7L8 14"/>',
    crown: '<path d="M4 8.5l3.6 3.2L12 5.5l4.4 6.2L20 8.5l-1.4 9h-13Z"/><path d="M5.7 20h12.6"/>',
    rosette: '<circle cx="12" cy="9.3" r="5"/><path d="M9.2 13.2 7.6 20l4.4-2.3L16.4 20l-1.6-6.8"/><path d="M12 6.8l.85 1.7 1.9.28-1.37 1.34.32 1.88L12 11.1l-1.7.9.32-1.88L9.25 8.76l1.9-.28Z" fill="currentColor" stroke="none"/>',
    repeat: '<path d="M5 9a5 5 0 0 1 8.5-2.8L16 8"/><path d="M16 4.5V8h-3.5"/><path d="M19 15a5 5 0 0 1-8.5 2.8L8 16"/><path d="M8 19.5V16h3.5"/>',
    sparkle: '<path d="M12 4l1.4 4.6L18 10l-4.6 1.4L12 16l-1.4-4.6L6 10l4.6-1.4Z"/><path d="M18.5 15l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6Z" fill="currentColor" stroke="none"/>',
    pencil: '<path d="M15.5 5.5l3 3"/><path d="M5 19l.9-3.4L15.6 5.9a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L8.4 18.1Z"/>',
    clippers: '<rect x="8.5" y="3.5" width="7" height="9" rx="1.6"/><path d="M9.5 3.5v-1"/><path d="M12 3.5v-1"/><path d="M14.5 3.5v-1"/><path d="M8.5 12.5 7 15.5v3a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5v-3l-1.5-3"/>',
    pause: '<rect x="7" y="5" width="3.4" height="14" rx="1.2"/><rect x="13.6" y="5" width="3.4" height="14" rx="1.2"/>',
    play: '<path d="M7.5 5.5v13a1 1 0 0 0 1.5.87l10.5-6.5a1 1 0 0 0 0-1.74L9 4.63A1 1 0 0 0 7.5 5.5Z"/>',
    tail: '<path d="M5.5 19c-.6-5 1.4-9.6 5.4-12.2 2.4-1.5 4.9-1.8 6.7-.9-1.5 0-2.9.5-4 1.5 1.3 0 2.5.4 3.3 1.4-1.6-.3-3 .1-4.1 1.2-1.1 1.1-1.6 2.6-1.4 4.1"/>',
    droplet: '<path d="M12 3.6c3.3 3.9 5.3 6.5 5.3 9.4a5.3 5.3 0 0 1-10.6 0c0-2.9 2-5.5 5.3-9.4Z"/>',
    wind: '<path d="M3.5 9h8.6a2.6 2.6 0 1 0-2.6-2.6"/><path d="M3.5 13.2h10.2a2.7 2.7 0 1 1-2.7 2.7"/><path d="M3.5 17.4h5.2"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.4"/>',
    hourglass: '<path d="M7 4h10"/><path d="M7 20h10"/><path d="M7.5 4c0 4 4.5 5 4.5 8s-4.5 4-4.5 8"/><path d="M16.5 4c0 4-4.5 5-4.5 8s4.5 4 4.5 8"/>',
    turtle: '<path d="M6 15a6 4.5 0 0 1 12 0Z"/><path d="M18 14.5c1.2 0 2-.6 2.4-1.3"/><path d="M6.5 15c-1 .2-1.8-.2-2.3-.9"/><path d="M8.5 18.5 8 20"/><path d="M15.5 18.5 16 20"/><path d="M17.5 12.2c.6-.5 1.5-.5 2 .1"/>',
    warning: '<path d="M12 4.5 20.5 19a1 1 0 0 1-.9 1.5H4.4a1 1 0 0 1-.9-1.5Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".2" fill="currentColor" stroke="none"/>',
    chevronL: '<path d="M14.5 6 8.5 12l6 6"/>',
    chevronR: '<path d="M9.5 6l6 6-6 6"/>',
    arrowR: '<path d="M4 12h15"/><path d="M13.5 6.5 19 12l-5.5 5.5"/>',
    arrowL: '<path d="M20 12H5"/><path d="M10.5 6.5 5 12l5.5 5.5"/>',
    close: '<path d="M6.5 6.5 17.5 17.5"/><path d="M17.5 6.5 6.5 17.5"/>'
};
function IC(name, sw) {
    return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.9}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${_ICP[name] || ''}</svg>`;
}
const NAV_ICONS = { home: IC('home'), timer: IC('stopwatch'), log: IC('scissors'), tools: IC('comb'), me: IC('paw') };
// Difficulty dot — a filled circle in the semantic color (easy/mod/hard).
// Hardcoded hex (not currentColor) so it stays green/amber/coral anywhere.
function diffDot(n) {
    const c = n === 3 ? '#D98B7B' : n === 2 ? '#D4A85C' : '#7BAF8E';
    return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="${c}"/></svg>`;
}

// Shared service picker (timer setup / log form / edit form). Multi-select
// pills; `keys` is the array of selected service keys. `legacy` renders an
// editable field for a pre-existing style so old grooms don't lose it.
function serviceGrid(action, keys, legacy, legacyId) {
    return `
    <div style="display:flex;gap:6px">
        ${SERVICES.map(sv => `<button class="pill ${keys.includes(sv.k) ? 'on' : ''}" style="flex:1;padding:12px 4px;font-size:13px" data-action="${action}" data-svc="${sv.k}">${esc(sv.l)}</button>`).join('')}
    </div>
    ${legacy ? `<label class="lbl" for="${legacyId}" style="margin-top:10px">Previous style</label><input class="inp" id="${legacyId}" value="${esc(legacy)}">` : ''}`;
}

const ACH = [
    {id:'first', e:'paw', t:'First Groom', d:'Log your first groom', ck: s => s.logs.length >= 1},
    {id:'five', e:'hand', t:'High Five', d:'Log 5 grooms', ck: s => s.logs.length >= 5},
    {id:'ten', e:'medal', t:'Double Digits', d:'Log 10 grooms', ck: s => s.logs.length >= 10},
    {id:'25', e:'star', t:'Quarter Century', d:'Log 25 grooms', ck: s => s.logs.length >= 25},
    {id:'50', e:'trophy', t:'Fifty & Fabulous', d:'Log 50 grooms', ck: s => s.logs.length >= 50},
    {id:'100', e:'crown', t:'Century Club', d:'Log 100 grooms', ck: s => s.logs.length >= 100},
    {id:'s30', e:'bolt', t:'Speed Demon', d:'Under 30 min groom', ck: s => s.logs.some(l => l.min <= 30)},
    {id:'s20', e:'flame', t:'Blazing Fast', d:'Under 20 min groom', ck: s => s.logs.some(l => l.min <= 20)},
    {id:'t5', e:'stopwatch', t:'Timer Pro', d:'Use live timer 5 times', ck: s => s.logs.filter(l => l.timed).length >= 5},
    {id:'b5', e:'dog', t:'Breed Master', d:'Groom 5 different breeds', ck: s => new Set(s.logs.map(l => (l.breed || '').toLowerCase()).filter(Boolean)).size >= 5},
    {id:'b10', e:'rosette', t:'Breed Expert', d:'Groom 10 different breeds', ck: s => new Set(s.logs.map(l => (l.breed || '').toLowerCase()).filter(Boolean)).size >= 10},
    {id:'ph', e:'camera', t:'Shutterbug', d:'Photos on 5 grooms', ck: s => s.logs.filter(l => (l.before || l.after)).length >= 5},
    {id:'str', e:'trend', t:'Trending Up', d:'3 consecutive faster grooms', ck: s => { if(s.logs.length < 3) return false; return s.logs[0].min < s.logs[1].min && s.logs[1].min < s.logs[2].min; }},
    {id:'notes', e:'notebook', t:'Note Taker', d:'Notes for 3 breeds', ck: s => Object.keys(s.breedNotes || {}).length >= 3},
    {id:'repeat', e:'repeat', t:'Repeat Client', d:'Groom the same dog twice', ck: s => { const n = s.logs.map(l => (l.dogName || '').toLowerCase()).filter(Boolean); return n.length !== new Set(n).size; }}
];

const CHK = [
    {id:'c1', t:'Station clean & organized'}, {id:'c2', t:'All blades sharp & ready'},
    {id:'c3', t:'Shears cleaned & oiled'},    {id:'c4', t:'Guard combs laid out'},
    {id:'c5', t:'Products stocked'},          {id:'c6', t:"Today's dogs reviewed"},
    {id:'c7', t:'Timer/clock visible'},       {id:'c8', t:'Phone put away'},
];

// ── State ──
let S = {
    tab: 'home', sub: 'blades', sub2: 'achievements', 
    logs: [], chk: {}, breedNotes: {}, 
    goals: { dogsPerDay: 0, avgTarget: 0 }, standards: [],
    
    // Timer State
    timerStart: null, timerRunning: false, timerSplits: [],
    timerPausedAt: null, timerTotalPausedDuration: 0,
    timerBreed: '', timerStyle: '', timerNotes: '', timerSize: 'medium', timerDogName: '', timerBeforePhoto: null,
    timerReview: null, timerGhost: null, 
    
    // UI State
    showForm: false, editId: null, 
    showBreedForm: false, editBreedKey: null, 
    showStdForm: false, editStdId: null,
    viewDog: null,
    onboarded: false,
    logFilter: 'today',
    logWeekOffset: 0,
    logDate: null,   // 'YYYY-MM-DD' for the Day filter; null = today
    theme: 'auto'
};

let TI = null;
let _modal = null;
let _toast = null;
let _toastTimer = null;
let _resetting = false;
let _prevTab = null;
// Set just before an R() that should deliberately land at the top of the page.
let _scrollToTop = false;
// Where she was in the list before a form took over the screen.
let _formReturnY = 0;

// Lightbox state holds array of photo refs and index
let _lightbox = null; 

// ── Photo Storage (IndexedDB) ──
const DB_NAME = 'groompace-photos';
const DB_VERSION = 1;
const STORE = 'photos';
let _dbPromise = null;

function openPhotoDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return _dbPromise;
}

async function savePhoto(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    if (dataUrl.startsWith('idb:')) return dataUrl;
    try {
        const db = await openPhotoDB();
        const id = 'idb:photo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(dataUrl, id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        return id;
    } catch (err) {
        console.error('Failed to save photo to IDB:', err);
        return dataUrl;
    }
}

async function loadPhoto(ref) {
    if (!ref || typeof ref !== 'string') return null;
    if (!ref.startsWith('idb:')) return ref; 
    try {
        const db = await openPhotoDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(ref);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error('Failed to load photo from IDB:', err);
        return null;
    }
}

async function deletePhoto(ref) {
    if (!ref || typeof ref !== 'string' || !ref.startsWith('idb:')) return;
    try {
        const db = await openPhotoDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(ref);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error('Failed to delete photo from IDB:', err);
    }
}

async function hydratePhotosForView() {
    const refs = new Set();
    S.logs.forEach(l => {
        if (l.before && typeof l.before === 'string' && l.before.startsWith('idb:')) refs.add(l.before);
        if (l.after  && typeof l.after  === 'string' && l.after.startsWith('idb:'))  refs.add(l.after);
    });
    if (S.timerBeforePhoto && typeof S.timerBeforePhoto === 'string' && S.timerBeforePhoto.startsWith('idb:')) {
        refs.add(S.timerBeforePhoto);
    }
    if (!refs.size) return;
    
    const entries = await Promise.all([...refs].map(async ref => [ref, await loadPhoto(ref)]));
    entries.forEach(([ref, url]) => { _photoCache[ref] = url; });
    R();
}

const _photoCache = {};

function photoSrc(ref) {
    if (!ref) return '';
    if (typeof ref !== 'string') return '';
    if (!ref.startsWith('idb:')) return ref;
    return _photoCache[ref] || '';
}

function photoThumb(ref, extraClass) {
    const src = photoSrc(ref);
    const cls = 'photo-thumb' + (extraClass ? ' ' + extraClass : '');
    if (src) return `<img src="${src}" class="${cls}" alt="">`;
    return `<div class="photo-placeholder ${extraClass || ''}" style="font-size:22px;color:var(--di)">${IC('camera')}</div>`;
}

function renderPhotoPicker(prefix, target, hasPhoto, previewHtml) {
    return `
    <div class="photo-picker">
        <div class="photo-picker-stack">
            <label class="file-btn file-btn-camera" for="${prefix}Cam" style="display:inline-flex;align-items:center;justify-content:center;gap:7px">
                ${IC('camera')} Take Photo with Camera
                <input type="file" accept="image/*" capture="environment" id="${prefix}Cam" onchange="photoPick('${prefix}Cam','${target}')">
            </label>
            <label class="file-btn file-btn-gallery" for="${prefix}Gal" style="display:inline-flex;align-items:center;justify-content:center;gap:7px">
                ${IC('image')} Choose from Photo Library
                <input type="file" accept="image/*" id="${prefix}Gal" onchange="photoPick('${prefix}Gal','${target}')">
            </label>
        </div>
        ${hasPhoto ? `<div class="photo-preview">${previewHtml || ''}</div>` : ''}
    </div>`;
}

function photoPick(inputId, target) {
    const el = document.getElementById(inputId);
    if (!el || !el.files[0]) return;
    compressPhoto(el.files[0], async d => {
        const ref = await savePhoto(d);
        _photoCache[ref] = d;
        if (target === 'timerBefore') { S.timerBeforePhoto = ref; save(); }
        else if (target === 'rvAfter') _rvAfter = ref;
        else if (target === 'formB') _phB = ref;
        else if (target === 'formA') _phA = ref;
        else if (target === 'editB') _edPhB = ref;
        else if (target === 'editA') _edPhA = ref;
        R();
    });
    el.value = '';
}

// ── Schema Version & Migrations ──
const SCHEMA_VERSION = 5;

const MIGRATIONS = {
    4: (state) => {
        if (Array.isArray(state.logs)) {
            state.logs = state.logs.map(log => ({
                id: log.id || Date.now() + Math.random(),
                ts: log.ts || Date.now(),
                date: log.date || '',
                dogName: log.dogName || '',
                breed: log.breed || '',
                style: log.style || '',
                size: log.size || 'medium',
                min: log.min || 0,
                pw: log.pw || 0, bo: log.bo || 0, bs: log.bs || 0,
                sl: log.sl || 0, hf: log.hf || 0, ta: log.ta || 0, fi: log.fi || 0,
                diff: log.diff || 1,
                notes: log.notes || '',
                timed: !!log.timed,
                before: log.before || null,
                after: log.after || null
            }));
        }
        return state;
    },
    // v5: adds the Bath / Blow Dry / FFF step fields. Purely additive — every
    // existing field (including ta/fi from retired steps) is left untouched,
    // so old grooms keep their recorded times.
    5: (state) => {
        if (Array.isArray(state.logs)) {
            state.logs = state.logs.map(log => ({
                ...log,
                ba: log.ba || 0, bd: log.bd || 0, ff: log.ff || 0
            }));
        }
        return state;
    }
};

function migrate(state) {
    const fromVersion = state.schemaVersion || 3; 
    if (fromVersion > SCHEMA_VERSION) {
        console.warn('Saved data is newer than app. Skipping migrations.');
        return state;
    }
    for (let v = fromVersion + 1; v <= SCHEMA_VERSION; v++) {
        if (MIGRATIONS[v]) {
            try {
                state = MIGRATIONS[v](state);
                console.log(`Migrated data to v${v}`);
            } catch (e) {
                console.error(`Migration to v${v} failed:`, e);
            }
        }
    }
    state.schemaVersion = SCHEMA_VERSION;
    return state;
}

// ── Initialization & Storage ──
function load() {
    _resetting = false;
    try {
        let raw = localStorage.getItem(SK);
        
        // Smart Data Migration Backup: If v5 is empty, grab the data from v4 or v3
        if (!raw) {
            raw = localStorage.getItem('groompace-v4') || localStorage.getItem('groompace-v3');
            if (raw) {
                localStorage.setItem(SK, raw); // Save it to the new v5 key safely
                console.log("Successfully migrated previous app data to v5.");
            }
        }

        if (raw) {
            let data = JSON.parse(raw);
            data = migrate(data);
            Object.assign(S, data);
            // Restore in-progress timer after reload (additive — preserves pause state from save)
            if (S.timerStart && typeof S.timerStart === 'number' && !S.timerReview) {
                S.timerRunning = true;
                S.timerGhost = getGhostTime(S.timerDogName, S.timerBreed);
            } else {
                S.timerRunning = false;
                if (!S.timerReview) {
                    S.timerStart = null;
                    S.timerPausedAt = null;
                    S.timerTotalPausedDuration = 0;
                    S.timerSplits = [];
                }
                S.timerGhost = null;
            }
            S.tab = 'home';
            S.sub = 'blades';
            S.sub2 = 'achievements';
            S.showForm = false;
            S.editId = null;
            S.showBreedForm = false;
            S.editBreedKey = null;
            S.showStdForm = false;
            S.editStdId = null;
            S.viewDog = null;
            
            if (!S.breedNotes || typeof S.breedNotes !== 'object') S.breedNotes = {};
            if (!S.goals || typeof S.goals !== 'object') S.goals = { dogsPerDay: 0, avgTarget: 0 };
            if (!Array.isArray(S.standards)) S.standards = [];
            if (!Array.isArray(S.logs)) S.logs = [];
            if (!Array.isArray(S.timerSplits)) S.timerSplits = [];
            if (S.timerStart !== null && typeof S.timerStart !== 'number') S.timerStart = null;
            if (S.timerPausedAt === undefined) S.timerPausedAt = null;
            if (S.timerTotalPausedDuration === undefined) S.timerTotalPausedDuration = 0;
            if (!S.logFilter) S.logFilter = 'today';
            if (S.logWeekOffset === undefined) S.logWeekOffset = 0;
            if (typeof S.logDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(S.logDate)) S.logDate = null;
            if (!['auto','light','dark'].includes(S.theme)) S.theme = 'auto';
        }
    } catch(e) {
        console.error('Failed to load saved data:', e);
    }
    
    if (S.standards.length === 0) {
        S.standards.push({
            id: 'std_' + Date.now(),
            title: 'Small to medium dog (3 blade and under)',
            aim: 40, max: 60,
            text: "1. Pre work (nails, paw pads, sani) - 5-8 min\n2. Brush out dog - 3-10 min\n3. Body shave - 8-15 min\n4. Scissor legs and feet - 10 min\n5. Head and face - 10-15 min\n6. Tail - 3-5 min\n7. Look over dog, step back and check"
        });
    }
}

function save() {
    if (_resetting) return;
    try {
        const payload = { ...S, schemaVersion: SCHEMA_VERSION };
        localStorage.setItem(SK, JSON.stringify(payload));
    } catch(e) {
        console.error('Failed to save:', e);
        const isQuota = e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014;
        if (isQuota) {
            showToast('Storage full. Export a backup from Profile → Stats, then delete old grooms to free space.', 'error', 8000);
        } else {
            showToast('Could not save. Your recent changes may be lost if you close the app.', 'error', 6000);
        }
    }
    // ⚠️ SACRED FUNCTION EDIT: mirror state to the device on native builds.
    // Fire-and-forget, fully guarded, and no-op on web — it cannot affect the
    // localStorage write above or the web app in any way. See nativeMirror().
    try { nativeMirror(); } catch(e) {}
}

// ── Native durability (Capacitor only — every function no-ops on the web) ──
// WKWebView / Android WebView can evict localStorage + IndexedDB under storage
// pressure or "Offload App". For an app whose whole promise is "your data stays
// on your phone", eviction would be catastrophic. On native we mirror the state
// string to the app's Documents folder (iCloud-backed on iOS) on every save,
// keep a weekly full backup that also carries the photos, and restore from
// either if web storage ever comes up empty. The permanent fix is cloud backup
// (Phase E1); this is the floor until then.
const NATIVE_STATE_FILE = 'groompace-state.json';
const NATIVE_BACKUP_FILE = 'groompace-full-backup.json';
const NATIVE_BACKUP_TS_KEY = 'groompace-native-backup-ts';
let _mirrorTimer = null;
let _pendingRestoreToast = false;

function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}
function _fsPlugin() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) || null;
}

// Debounced 2s mirror of the raw state string. Called from save().
function nativeMirror() {
    if (!isNative()) return;
    const fs = _fsPlugin();
    if (!fs) return;
    clearTimeout(_mirrorTimer);
    _mirrorTimer = setTimeout(() => {
        const raw = localStorage.getItem(SK);
        if (!raw) return;
        fs.writeFile({ path: NATIVE_STATE_FILE, data: raw, directory: 'DOCUMENTS', encoding: 'utf8' }).catch(() => {});
    }, 2000);
}

// Weekly full backup incl. inline photos (reuses the export resolve pipeline).
async function nativeFullBackup() {
    if (!isNative()) return;
    const fs = _fsPlugin();
    if (!fs) return;
    try {
        const last = Number(localStorage.getItem(NATIVE_BACKUP_TS_KEY) || 0);
        if (Date.now() - last < 7 * 864e5) return;
        const resolvedLogs = await Promise.all((S.logs || []).map(async l => ({
            ...l,
            before: l.before && l.before.startsWith?.('idb:') ? await loadPhoto(l.before) : l.before,
            after:  l.after  && l.after.startsWith?.('idb:')  ? await loadPhoto(l.after)  : l.after
        })));
        const payload = { ...S, logs: resolvedLogs, schemaVersion: SCHEMA_VERSION };
        delete payload.timerBeforePhoto;
        await fs.writeFile({ path: NATIVE_BACKUP_FILE, data: JSON.stringify(payload), directory: 'DOCUMENTS', encoding: 'utf8' });
        localStorage.setItem(NATIVE_BACKUP_TS_KEY, String(Date.now()));
    } catch (e) { /* backup is best-effort */ }
}

// Restore from the device mirror if localStorage is empty. Runs on native BEFORE
// load(), so the normal load() path then reads restored data as if nothing broke.
// Returns true if it restored anything (used to defer a user-facing toast).
async function nativeRestoreIfEmpty() {
    if (!isNative()) return false;
    const fs = _fsPlugin();
    if (!fs) return false;
    if (localStorage.getItem(SK)) return false; // web storage intact — nothing to do
    // Prefer the lightweight state mirror (freshest — written every save).
    try {
        const res = await fs.readFile({ path: NATIVE_STATE_FILE, directory: 'DOCUMENTS', encoding: 'utf8' });
        if (res && res.data) {
            localStorage.setItem(SK, res.data);
            _pendingRestoreToast = true;
            // Photos live in IndexedDB (also evictable). If the state's idb: refs
            // are now dangling, re-seed them from the full backup's inline photos.
            await nativeReseedPhotosFromBackup();
            return true;
        }
    } catch (e) { /* no mirror file — fall through to full backup */ }
    // Fall back to the full backup (has inline photos).
    try {
        const res = await fs.readFile({ path: NATIVE_BACKUP_FILE, directory: 'DOCUMENTS', encoding: 'utf8' });
        if (res && res.data) {
            const clean = sanitizeImport(JSON.parse(res.data));
            if (clean) {
                for (const log of clean.logs) {
                    if (log.before && log.before.startsWith?.('data:image/')) log.before = await savePhoto(log.before);
                    if (log.after && log.after.startsWith?.('data:image/')) log.after = await savePhoto(log.after);
                }
                localStorage.setItem(SK, JSON.stringify({ ...clean, schemaVersion: SCHEMA_VERSION }));
                _pendingRestoreToast = true;
                return true;
            }
        }
    } catch (e) { /* nothing to restore — genuine fresh install */ }
    return false;
}

// Share a Blob via the native OS share sheet. WKWebView exposes neither
// navigator.share({files}) nor a working <a download>, so on native we write the
// blob to the Cache dir and hand its file URI to the Capacitor Share plugin.
// Returns true if it handled the share; false → caller uses the web path.
async function nativeShareFile(blob, filename, title, text) {
    if (!isNative()) return false;
    const fs = _fsPlugin();
    const Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
    if (!fs || !Share) return false;
    try {
        const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(blob);
        });
        const base64 = String(dataUrl).split(',')[1];
        const w = await fs.writeFile({ path: filename, data: base64, directory: 'CACHE' });
        await Share.share({ title, text, url: w.uri });
        return true;
    } catch (e) {
        if (e && e.message && /cancel/i.test(e.message)) return true; // user dismissed
        console.warn('Native share failed:', e);
        return false;
    }
}

// After a state-mirror restore, recover any photos whose IndexedDB blobs were
// evicted, using the full backup's inline copies. Best-effort and idempotent.
async function nativeReseedPhotosFromBackup() {
    const fs = _fsPlugin();
    if (!fs) return;
    try {
        const res = await fs.readFile({ path: NATIVE_BACKUP_FILE, directory: 'DOCUMENTS', encoding: 'utf8' });
        if (!res || !res.data) return;
        const backup = JSON.parse(res.data);
        const byId = {};
        (backup.logs || []).forEach(l => { byId[l.id] = l; });
        const state = JSON.parse(localStorage.getItem(SK));
        let changed = false;
        for (const log of (state.logs || [])) {
            const src = byId[log.id];
            if (!src) continue;
            for (const k of ['before', 'after']) {
                const ref = log[k];
                if (ref && ref.startsWith?.('idb:') && !(await loadPhoto(ref)) && src[k] && src[k].startsWith?.('data:image/')) {
                    log[k] = await savePhoto(src[k]);
                    changed = true;
                }
            }
        }
        if (changed) localStorage.setItem(SK, JSON.stringify(state));
    } catch (e) { /* best-effort */ }
}

// ── Utility Helpers ──
function esc(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function tc(m) { return m <= 25 ? 'var(--sg)' : m <= 40 ? 'var(--hn)' : 'var(--rd)'; }
function dk() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtT(ms) { const s = Math.floor(ms/1000), m = Math.floor(s/60); return String(m).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }
function fmtM(ms) { return Math.round(ms/60000); }
function fmtDurSec(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
    return s ? m + ':' + String(s).padStart(2, '0') : m + 'm';
}

// Display order for step times on cards and breakdowns. Retired steps (Tail,
// Finished) stay on the end so older grooms still show what they recorded —
// a step with no time is never rendered, so they cost nothing on new grooms.
const SECT_SHORT = { pw:'Pre', ba:'Bath', bd:'Dry', bo:'Brush', bs:'Body', sl:'Legs', hf:'Head', ff:'FFF', ta:'Tail', fi:'Fin' };
const SECT_KEYS = [...STEP_ORDER, 'ta', 'fi'].map(k => ({ k, s: SECT_SHORT[k], n: STEPS[k].t }));

function sectDur(l, key) {
    if (l.sect && l.sect[key]) return fmtDurSec(l.sect[key]);
    if (l[key]) return l[key] + 'm';
    return null;
}

function sectionTags(l) {
    return SECT_KEYS.map(({ k, s }) => {
        const d = sectDur(l, k);
        return d ? `${s} ${d}` : null;
    }).filter(Boolean);
}

function weekRange(offset) {
    offset = offset || 0;
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() + mondayOffset + offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const label = offset === 0 ? 'This Week' : offset === -1 ? 'Last Week' : fmt(start) + ' – ' + fmt(new Date(end.getTime() - 864e5));
    return { start: start.getTime(), end: end.getTime(), label };
}

function todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.getTime(), end: end.getTime(), label: 'Today' };
}

// Shift a 'YYYY-MM-DD' key by whole days, staying in local time.
function shiftDayKey(key, delta) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d + delta);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

// The single day the Log's Day filter is showing (defaults to today).
function logDayKey() {
    return S.logDate || dk();
}

function dayRange(key) {
    const k = key || dk();
    const [y, m, d] = k.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const today = dk();
    const label = k === today ? 'Today'
        : k === shiftDayKey(today, -1) ? 'Yesterday'
        : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { start: start.getTime(), end: end.getTime(), label, key: k };
}

function filterLogs(logs) {
    if (S.logFilter === 'all') return logs;
    if (S.logFilter === 'today') {
        const { start, end } = dayRange(logDayKey());
        return logs.filter(l => l.ts && l.ts >= start && l.ts < end);
    }
    const { start, end } = weekRange(S.logWeekOffset || 0);
    return logs.filter(l => l.ts && l.ts >= start && l.ts < end);
}

function hasSectionData(l) {
    if (l.sect && SECT_KEYS.some(({ k }) => l.sect[k] > 0)) return true;
    return SECT_KEYS.some(({ k }) => l[k] > 0);
}

function filterLabel() {
    if (S.logFilter === 'today') return dayRange(logDayKey()).label;
    if (S.logFilter === 'all') return 'All Time';
    return weekRange(S.logWeekOffset || 0).label;
}

function renderSectionBreakdown(l) {
    const items = SECT_KEYS.map(({ k, n }) => {
        const sec = l.sect && l.sect[k];
        const val = sec || (l[k] ? l[k] * 60 : 0);
        return val > 0 ? { n, sec: sec || l[k] * 60 } : null;
    }).filter(Boolean);
    if (!items.length) return '';
    const max = Math.max(...items.map(i => i.sec));
    return `<div class="section-breakdown">
        <div class="sec-lbl" style="color:var(--hn);margin-bottom:8px">Step Breakdown</div>
        ${items.map(i => `
        <div class="section-row">
            <span>${i.n}</span>
            <strong>${fmtDurSec(i.sec)}</strong>
        </div>
        <div class="section-bar-wrap"><div class="section-bar" style="width:${Math.round(i.sec / max * 100)}%"></div></div>`).join('')}
    </div>`;
}

function elapsed() {
    if (!S.timerStart) return 0;
    const pausedDur = S.timerTotalPausedDuration || 0;
    if (S.timerPausedAt) {
        return S.timerPausedAt - S.timerStart - pausedDur;
    }
    return Date.now() - S.timerStart - pausedDur;
}

function getAvg() { return S.logs.length ? Math.round(S.logs.reduce((a,l) => a + l.min, 0) / S.logs.length) : null; }
function trend() {
    if (S.logs.length < 6) return null;
    const r = Math.round(S.logs.slice(0,3).reduce((a,l) => a + l.min, 0) / 3);
    const o = Math.round(S.logs.slice(3,6).reduce((a,l) => a + l.min, 0) / 3);
    return o - r;
}
function pbs() {
    const m = {};
    S.logs.forEach(l => {
        const k = (l.breed || '').toLowerCase();
        if (!k) return; // breed-less grooms can't have a per-breed best
        if (!m[k] || l.min < m[k].min) m[k] = l;
    });
    return Object.values(m).sort((a,b) => a.min - b.min).slice(0, 8);
}
function weekLogs(offset) {
    if (offset === undefined) offset = 0;
    const { start, end } = weekRange(offset);
    return S.logs.filter(l => l.ts && l.ts >= start && l.ts < end);
}
function quote() {
    const q = [
        "Every dog you finish faster proves you're growing.",
        "Speed comes from confidence — you're building both.",
        "It's not rushing. It's eliminating waste.",
        "The best groomers work smarter, not harder.",
        "Your hands know what to do. Trust the system.",
        "Consistency creates speed. Do the reps.",
        "Quality got you here. Systems take you further."
    ];
    return q[Math.floor(Date.now() / 864e5) % q.length];
}
function getDogNames() {
    return [...new Set(S.logs.map(l => (l.dogName || '')).filter(Boolean))].sort();
}
// One-line groom label: joins whatever identity parts exist, never renders blank.
function groomLabel(...parts) {
    return parts.filter(Boolean).map(esc).join(' · ') || 'Groom';
}
function getDogHistory(name) {
    return S.logs.filter(l => (l.dogName || '').toLowerCase() === name.toLowerCase()).sort((a,b) => b.ts - a.ts);
}
function getGhostTime(dogName, breed) {
    let logs = [];
    if (dogName) logs = S.logs.filter(l => (l.dogName||'').toLowerCase() === dogName.toLowerCase());
    if (!logs.length && breed) logs = S.logs.filter(l => (l.breed||'').toLowerCase() === breed.toLowerCase());
    if (!logs.length) return null;
    return Math.min(...logs.map(l => l.min));
}
function breedNoteFor(breed) {
    if (!breed) return null;
    const n = S.breedNotes[breed.trim().toLowerCase()];
    return (n && (n.blade || n.comb || n.targetMin || n.notes)) ? n : null;
}
function renderBreedNoteCard(breed) {
    const n = breedNoteFor(breed);
    if (!n) return '';
    return `
    <div class="c fi" style="padding:14px 16px;margin-bottom:14px;border:1px solid rgba(155,141,196,.3);text-align:left">
        <div class="sec-lbl" style="color:var(--lv);margin-bottom:8px;display:flex;align-items:center;gap:6px">${IC('notebook')} Your ${esc(breed.trim())} Notes</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap${n.notes ? ';margin-bottom:8px' : ''}">
            ${n.blade ? `<span class="tag">Blade: ${esc(n.blade)}</span>` : ''}
            ${n.comb ? `<span class="tag">Comb: ${esc(n.comb)}</span>` : ''}
            ${n.targetMin ? `<span class="tag" style="background:var(--rg);color:var(--rd)">Target: ${n.targetMin}m</span>` : ''}
        </div>
        ${n.notes ? `<div style="font-size:13px;color:var(--tm);line-height:1.5">${esc(n.notes)}</div>` : ''}
    </div>`;
}

// ── Theme (Auto / Light / Dark) ──
function applyTheme() {
    const root = document.documentElement;
    if (S.theme === 'light' || S.theme === 'dark') root.dataset.theme = S.theme;
    else delete root.dataset.theme;
    // Keep the browser/status-bar chrome in sync with the effective theme
    const dark = S.theme === 'dark' ||
        (S.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#121212' : '#FBF7F2');
    // Native: keep the OS status bar in step with the effective theme.
    const SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
    if (SB) {
        try {
            // Style.Dark = dark text (for a light bg); Style.Light = light text (dark bg).
            SB.setStyle({ style: dark ? 'LIGHT' : 'DARK' });
            if (SB.setBackgroundColor) SB.setBackgroundColor({ color: dark ? '#121212' : '#FBF7F2' });
        } catch (e) {}
    }
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (S.theme === 'auto') applyTheme();
});

// ── UI Actions ──
function vib() {
    // Native: real iOS/Android haptics (navigator.vibrate is a no-op in WKWebView).
    // Every tappable control routes through vib(), so this one line gives the whole
    // app native haptics inside the wrapper. Web falls back to the vibration API.
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (H) { try { H.impact({ style: 'LIGHT' }); return; } catch (e) {} }
    if (navigator.vibrate) navigator.vibrate(40);
}
function showAlert(msg) { vib(); _modal = { type: 'alert', msg }; R(); }
function showConfirm(msg, cb) { vib(); _modal = { type: 'confirm', msg, onConfirm: cb }; R(); }

function showToast(msg, type = 'info', duration = 4000) {
    clearTimeout(_toastTimer);
    _toast = { msg, type };
    R();
    if (duration > 0) {
        _toastTimer = setTimeout(() => {
            _toast = null;
            R();
        }, duration);
    }
}

function compressPhoto(file, cb) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
        showToast('That file isn\'t an image.', 'error');
        return;
    }
    if (file.size > 30 * 1024 * 1024) {
        showToast('Photo is too large (over 30MB).', 'error');
        return;
    }
    
    const r = new FileReader();
    r.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            try {
                const c = document.createElement('canvas');
                const max = 1200;
                let w = img.width, h = img.height;
                if (!w || !h) throw new Error('Image has no dimensions');
                if (w > max || h > max) {
                    if (w > h) { h = Math.round(h * (max / w)); w = max; }
                    else { w = Math.round(w * (max / h)); h = max; }
                }
                c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                if (!ctx) throw new Error('Canvas context unavailable');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = c.toDataURL('image/jpeg', 0.75);
                if (!dataUrl || dataUrl === 'data:,') throw new Error('Canvas produced empty output');
                cb(dataUrl);
            } catch (err) {
                console.error('Photo compression failed:', err);
                showToast('Could not process that photo. Try a different one.', 'error');
            }
        };
        img.onerror = function() {
            showToast('Could not read that photo (unsupported format?).', 'error');
        };
        img.src = e.target.result;
    };
    r.onerror = function() {
        showToast('Could not read the photo file.', 'error');
    };
    try {
        r.readAsDataURL(file);
    } catch (err) {
        console.error('readAsDataURL failed:', err);
        showToast('Could not open the photo file.', 'error');
    }
}

// ── Lightbox Swipe Support ──
let _swipeStartX = 0;
let _isSwiping = false;
let _lastSwipeTime = 0;

function handleSwipe(endX) {
    if (!_lightbox || !_lightbox.refs || _lightbox.refs.length < 2) return;
    const diff = _swipeStartX - endX;
    
    // If they moved their finger/mouse more than 50 pixels, it's a swipe
    if (Math.abs(diff) > 50) {
        _lastSwipeTime = Date.now(); // Record the time so we don't accidentally close the modal
        if (diff > 50 && _lightbox.index < _lightbox.refs.length - 1) {
            vib(); _lightbox.index++; R();
        } else if (diff < -50 && _lightbox.index > 0) {
            vib(); _lightbox.index--; R();
        }
    }
}

// Touch support (Mobile)
document.addEventListener('touchstart', e => {
    if (_lightbox) _swipeStartX = e.changedTouches[0].screenX;
}, {passive: true});

document.addEventListener('touchend', e => {
    if (_lightbox) handleSwipe(e.changedTouches[0].screenX);
}, {passive: true});

// Mouse support (Desktop Testing)
document.addEventListener('mousedown', e => {
    if (_lightbox) { _swipeStartX = e.screenX; _isSwiping = true; }
});

document.addEventListener('mouseup', e => {
    if (_isSwiping && _lightbox) { _isSwiping = false; handleSwipe(e.screenX); }
});

// ── Timer Core ──
function startTimer() { 
    vib(); 
    S.timerStart = Date.now(); 
    S.timerRunning = true; 
    S.timerSplits = []; 
    S.timerReview = null; 
    S.timerPausedAt = null;
    S.timerTotalPausedDuration = 0;
    
    // Ghost Racer Logic Initialization
    S.timerGhost = getGhostTime(S.timerDogName, S.timerBreed);
    
    save(); tick(); R(); 
}

function togglePause() {
    vib();
    if (S.timerPausedAt) {
        // Resume
        S.timerTotalPausedDuration += (Date.now() - S.timerPausedAt);
        S.timerPausedAt = null;
        tick(); // restart the UI refresh loop
    } else {
        // Pause
        S.timerPausedAt = Date.now();
        clearInterval(TI);
        TI = null;
        paintTimer(); // Paint one last time to secure the exact paused visual state
    }
    save(); R();
}

function paintTimer() {
    try {
        const el = document.getElementById('tn');
        if (el) {
            const elMs = elapsed();
            el.textContent = fmtT(elMs);
            
            // Ghost Racing Live Paint
            if (S.timerGhost) {
                const targetMs = S.timerGhost * 60000;
                const pct = Math.min((elMs / targetMs) * 100, 100);
                const bar = document.getElementById('ghostBar');
                const icon = document.getElementById('ghostIcon');
                const status = document.getElementById('ghostStatus');
                
                if (bar && icon && status) {
                    bar.style.width = pct + '%';
                    icon.style.left = `calc(${pct}% - 8px)`;
                    
                    if (S.timerPausedAt) {
                        status.innerHTML = `${IC('pause')} Paused...`;
                        status.style.color = 'var(--mu)';
                    } else if (elMs <= targetMs) {
                        const leftMs = targetMs - elMs;
                        bar.style.background = 'linear-gradient(90deg, #7BAF8E, #A3D2B5)';
                        icon.innerHTML = IC('scissors'); icon.style.color = 'var(--rd)'; // racing ahead
                        status.innerHTML = `${IC('ghost')} Ahead of ghost! (${fmtT(leftMs)} to beat PB)`;
                        status.style.color = 'var(--sg)';
                    } else {
                        const overMs = elMs - targetMs;
                        bar.style.background = 'var(--co)';
                        icon.innerHTML = IC('turtle'); icon.style.color = 'var(--co)'; // fell behind — turns into a turtle!
                        status.innerHTML = `${IC('warning')} Ghost finished ${fmtT(overMs)} ago`;
                        status.style.color = 'var(--co)';
                    }
                }
            }
        } else if (!S.timerRunning) {
            clearInterval(TI);
            TI = null;
        }
    } catch (err) {
        console.error('Timer paint error:', err);
        clearInterval(TI);
        TI = null;
    }
}

function tick() {
    clearInterval(TI);
    if (!S.timerPausedAt) {
        TI = setInterval(paintTimer, 200);
    }
}

function split(label) {
    vib(); 
    // We store 'elapsed' so split math perfectly ignores any paused time
    S.timerSplits.push({ label, elapsed: elapsed(), time: Date.now() }); 
    save(); R(); 
}

function stopTimer() {
    vib();
    clearInterval(TI); 
    S.timerRunning = false;
    const tot = elapsed();
    const sp = S.timerSplits;
    
    // Per-step minutes, keyed by step id (pw/ba/bd/bo/bs/sl/hf/ff…).
    const mins = { pw:0, ba:0, bd:0, bo:0, bs:0, sl:0, hf:0, ff:0, ta:0, fi:0 };
    const sect = {};

    let lastElapsed = 0;
    let lastTime = S.timerStart;

    const parsedSplits = sp.map(x => {
        let durMs = 0;
        
        if (x.elapsed !== undefined) {
            durMs = x.elapsed - lastElapsed;
            lastElapsed = x.elapsed;
        } else {
            durMs = x.time - lastTime;
            lastTime = x.time;
        }
        
        const durSec = Math.max(0, Math.round(durMs / 1000));
        sect[x.label] = durSec;
        const durM = durSec >= 60 ? Math.round(durSec / 60) : (durSec > 0 ? 1 : 0);
        
        if (x.label in mins) mins[x.label] = durM;

        return { label: (STEPS[x.label] || {}).t || x.label, dur: fmtT(durMs), sec: durSec };
    });

    S.timerReview = {
        breed: S.timerBreed || '',
        style: S.timerStyle || '',
        notes: S.timerNotes || '',
        size: S.timerSize,
        dogName: S.timerDogName || '',
        min: fmtM(tot),
        totalMs: tot,
        mins,
        sect,
        before: S.timerBeforePhoto || null,
        splits: parsedSplits,
        prevBest: S.timerGhost || null
    };
    
    S.timerStart = null; 
    S.timerSplits = []; 
    S.timerGhost = null; 
    save(); R();
}

function cancelTimer() {
    vib(); clearInterval(TI); 
    S.timerStart = null; S.timerRunning = false; 
    S.timerPausedAt = null; S.timerTotalPausedDuration = 0;
    S.timerSplits = []; S.timerReview = null; 
    S.timerBeforePhoto = null; S.timerDogName = ''; 
    S.timerBreed = ''; S.timerStyle = ''; S.timerNotes = '';
    S.timerGhost = null;
    save(); R();
}

let _rvDf = 1, _rvAfter = null;

function saveReview() {
    vib();
    const rv = S.timerReview; 
    if (!rv) return;
    if (rv.min < 1) { showAlert('Groom must be at least 1 minute to save.'); return; }
    const breed = (rv.breed || '').trim();
    // One Notes field: what she planned at setup, edited on this screen.
    const notes = (document.getElementById('rvNotes') || {}).value || rv.notes || '';
    const m = rv.mins || {};

    S.logs.unshift({
        id: Date.now(), ts: Date.now(),
        date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}),
        dogName: rv.dogName || '', breed, style: rv.style, size: rv.size,
        min: rv.min,
        pw: m.pw || 0, ba: m.ba || 0, bd: m.bd || 0, bo: m.bo || 0,
        bs: m.bs || 0, sl: m.sl || 0, hf: m.hf || 0, ff: m.ff || 0,
        ta: m.ta || 0, fi: m.fi || 0,
        sect: rv.sect || null,
        diff: _rvDf, notes: notes.trim(), timed: true, before: rv.before, after: _rvAfter
    });
    
    const isPB = !!(rv.prevBest && rv.min < rv.prevBest);
    S.timerReview = null; S.timerBeforePhoto = null; S.timerDogName = '';
    S.timerBreed = ''; S.timerStyle = ''; S.timerNotes = '';
    _rvDf = 1; _rvAfter = null;
    save(); S.tab = 'log'; R();
    showToast(isPB ? `New personal best saved — ${rv.min}m! 🎉` : 'Groom saved 🐾', 'info');
}

function discardReview() {
    showConfirm("Discard this timed groom?", () => {
        S.timerReview = null; S.timerBeforePhoto = null; S.timerDogName = ''; 
        S.timerBreed = ''; S.timerStyle = ''; S.timerNotes = '';
        _rvDf = 1; _rvAfter = null; save(); R();
    });
}

function updateDatalist() {
    const bList = document.getElementById('breedList');
    const dList = document.getElementById('dogNameList');
    if (bList) {
        // Merge: starter list + breeds she's logged + breeds she has notes for.
        // Set dedupes; sort keeps the dropdown predictable.
        const breeds = [...new Set([
            ...COMMON_BREEDS,
            ...S.logs.map(l => l.breed),
            ...Object.keys(S.breedNotes)
        ])].filter(Boolean).sort();
        bList.innerHTML = breeds.map(b => `<option value="${esc(b)}">`).join('');
    }
    if (dList) {
        dList.innerHTML = getDogNames().map(n => `<option value="${esc(n)}">`).join('');
    }
}

// ── Rendering Engine ──
function R() {
    const ct = document.getElementById('ct'), nv = document.getElementById('nv'), mod = document.getElementById('modalRoot');
    const toastEl = document.getElementById('toastRoot');
    
    // Re-rendering replaces #ct wholesale, which drops the page back to the top.
    // Remember where she was so opening a photo or editing keeps her place.
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const inputSnapshot = {};
    const focusedId = document.activeElement ? document.activeElement.id : null;
    let selStart = null, selEnd = null;
    document.querySelectorAll('#ct input, #ct textarea').forEach(inp => {
        // Skip file inputs — their values can't be programmatically restored anyway.
        if (inp.id && inp.type !== 'file') {
            inputSnapshot[inp.id] = inp.value;
            if (inp === document.activeElement) {
                try { selStart = inp.selectionStart; selEnd = inp.selectionEnd; } catch(e) {}
            }
        }
    });

    const tabs = [
        { k:'home', l:'Home' }, { k:'timer', l:'Timer' },
        { k:'log', l:'Log' }, { k:'tools', l:'Tools' },
        { k:'me', l:'Me' }
    ];
    nv.innerHTML = tabs.map(t =>
        `<button class="${S.tab === t.k ? 'on' : ''}" data-action="go-tab" data-tab="${esc(t.k)}">
            <span class="ni">${NAV_ICONS[t.k]}</span><span class="nl">${t.l}</span>
        </button>`
    ).join('');
    
    if (_modal) {
        mod.innerHTML = `
        <div class="modal-backdrop">
            <div class="c fi modal-box">
                <div style="font-size:16px;font-weight:600;line-height:1.5">${esc(_modal.msg)}</div>
                <div class="modal-actions">
                    ${_modal.type === 'confirm' ? `<button class="btn-secondary" style="flex:1" id="modalCancel">Cancel</button>` : ''}
                    <button class="btn-primary" style="flex:1" id="modalOk">OK</button>
                </div>
            </div>
        </div>`;
    } else if (_lightbox && _lightbox.refs) {
        const src = photoSrc(_lightbox.refs[_lightbox.index]);
        const label = _lightbox.labels[_lightbox.index];
        const multi = _lightbox.refs.length > 1;
        
        mod.innerHTML = `
        <div data-action="close-photo" style="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;" class="fi">
            
            <div style="position:absolute;top:calc(env(safe-area-inset-top,12px) + 20px);left:0;right:0;display:flex;justify-content:center;pointer-events:none;">
                <span style="background:rgba(255,255,255,0.15);padding:6px 16px;border-radius:20px;color:#fff;font-weight:600;font-size:14px;letter-spacing:1px;text-transform:uppercase;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
                    ${label} ${multi ? `(${_lightbox.index + 1}/${_lightbox.refs.length})` : ''}
                </span>
            </div>

            <button data-action="close-photo" style="position:absolute;top:calc(env(safe-area-inset-top,12px) + 12px);right:16px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);color:var(--wh);font-size:22px;font-weight:300;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:1001;">${IC('close')}</button>
            
            <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                ${multi ? `<button data-action="lb-prev" style="position:absolute;left:-10px;padding:20px;color:#fff;font-size:32px;opacity:${_lightbox.index > 0 ? '1' : '0.2'};z-index:1001;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;">${IC('chevronL')}</button>` : ''}
                
                <img src="${src}" style="max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px;cursor:default;box-shadow:0 10px 40px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
                
                ${multi ? `<button data-action="lb-next" style="position:absolute;right:-10px;padding:20px;color:#fff;font-size:32px;opacity:${_lightbox.index < _lightbox.refs.length - 1 ? '1' : '0.2'};z-index:1001;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;">${IC('chevronR')}</button>` : ''}
            </div>
            
            ${multi ? `<div style="position:absolute;bottom:calc(env(safe-area-inset-bottom,20px) + 20px);color:rgba(255,255,255,0.6);font-size:12px;letter-spacing:1px;pointer-events:none;">Swipe to switch</div>` : ''}
        </div>`;
    } else {
        mod.innerHTML = '';
    }

    if (toastEl) {
        if (_toast) {
            const cls = _toast.type === 'error' ? 'toast-error' : _toast.type === 'warn' ? 'toast-warn' : 'toast-info';
            toastEl.innerHTML = `<div class="toast ${cls} fi">${esc(_toast.msg)}</div>`;
        } else {
            toastEl.innerHTML = '';
        }
    }

   if (!S.onboarded) {
        ct.innerHTML = renderOnboard();
        wireActions();
        return;
    }
    
    const fn = { home: renderHome, timer: renderTimer, log: renderLog, tools: renderTools, me: renderMe };
    
    try {
        ct.innerHTML = (fn[S.tab] || renderHome)();
    } catch (err) {
        console.error(`Render failed for tab "${S.tab}":`, err);
        showToast('Something went wrong loading that screen.', 'error');
        try {
            S.tab = 'home';
            ct.innerHTML = renderHome();
        } catch (err2) {
            console.error('Home render also failed:', err2);
            ct.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--tm)"><h2 style="margin-bottom:12px">Something went wrong</h2><p style="font-size:14px;line-height:1.6;margin-bottom:20px">Try refreshing the page. Your data is safe.</p><button onclick="location.reload()" style="padding:14px 28px;background:var(--rd);color:var(--wh);border-radius:12px;font-size:15px;font-weight:600">Refresh</button></div>';
        }
    }
    const tabChanged = _prevTab !== null && _prevTab !== S.tab;
    _prevTab = S.tab;
    if (tabChanged) {
        ct.classList.remove('fade-in');
        void ct.offsetWidth;
        ct.classList.add('fade-in');
    } else {
        ct.classList.remove('fade-in');
    }
    
    updateDatalist();
    // Keep the active sub-tab fully visible in horizontally scrollable tab bars
    const activeSub = ct.querySelector('.sub-tab.on');
    if (activeSub && activeSub.scrollIntoView) {
        try { activeSub.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }
    if (S.timerRunning && !S.timerPausedAt) tick();
    
    wireActions();
    
    Object.keys(inputSnapshot).forEach(id => {
        const inp = document.getElementById(id);
        if (inp && inp.type !== 'file' && inp.value !== inputSnapshot[id]) {
            inp.value = inputSnapshot[id];
        }
    });
    if (focusedId) {
        const focused = document.getElementById(focusedId);
        if (focused) {
            focused.focus();
            if (selStart !== null && typeof focused.setSelectionRange === 'function') {
                try { focused.setSelectionRange(selStart, selEnd); } catch(e) {}
            }
        }
    }

    // Restore the scroll position last, so nothing above (focus, scrollIntoView)
    // can steal it. Tab switches intentionally start at the top.
    if (!tabChanged && scrollY > 0 && !_scrollToTop) restoreScroll(scrollY);
    _scrollToTop = false;
}

// Clamp to the new page height — a shorter render can't scroll as far.
function restoreScroll(y) {
    const apply = () => {
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo(0, Math.min(y, max));
    };
    apply();
    // Images and late layout can change the height right after paint.
    requestAnimationFrame(apply);
}

function go(t) {
    vib(); S.tab = t; S.showForm = false; S.editId = null; S.viewDog = null;
    _scrollToTop = true; _formReturnY = 0;
    R(); window.scrollTo({top: 0, behavior: 'smooth'});
}

// Re-render and land at the top — for switches that swap the whole list out.
function topR() { _scrollToTop = true; R(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

const ACTIONS = {
    'go-tab':            (el) => go(el.dataset.tab),
    'go-log-form':       ()   => { vib(); S.tab = 'log'; S.showForm = true; _formReturnY = 0; R(); },
    'go-prep':           ()   => { vib(); S.tab = 'me'; S.sub2 = 'checklist'; R(); },
    'finish-onboard':    ()   => { vib(); S.onboarded = true; save(); R(); },
    'edit-log':          (el) => editLog(Number(el.dataset.id)),
    'del-log':           (el) => delLog(Number(el.dataset.id)),
    'view-dog':          (el) => { vib(); S.viewDog = el.dataset.name; S.tab = 'me'; S.sub2 = 'dogs'; R(); },
    'view-dog-me':       (el) => { vib(); S.viewDog = el.dataset.name; R(); },
    'clear-view-dog':    ()   => { vib(); S.viewDog = null; R(); },
    'edit-breed':        (el) => { vib(); S.editBreedKey = el.dataset.key; R(); },
    'del-breed':         (el) => delBreed(el.dataset.key),
    'edit-std':          (el) => { vib(); S.editStdId = el.dataset.id; R(); },
    'del-std':           (el) => delStd(el.dataset.id),
    'set-sub':           (el) => { vib(); S.sub = el.dataset.sub; S.showBreedForm=false; S.editBreedKey=null; S.showStdForm=false; S.editStdId=null; R(); },
    'set-sub2':          (el) => { vib(); S.sub2 = el.dataset.sub2; S.viewDog = null; R(); },
    'set-theme':         (el) => { vib(); S.theme = el.dataset.theme; applyTheme(); save(); R(); },
    'set-log-filter':    (el) => { vib(); S.logFilter = el.dataset.filter; if (el.dataset.filter !== 'week') S.logWeekOffset = 0; if (el.dataset.filter !== 'today') S.logDate = null; save(); topR(); },
    'log-day-prev':      ()   => { vib(); S.logDate = shiftDayKey(logDayKey(), -1); save(); topR(); },
    'log-day-next':      ()   => { vib(); if (logDayKey() < dk()) { S.logDate = shiftDayKey(logDayKey(), 1); save(); topR(); } },
    'log-day-today':     ()   => { vib(); S.logDate = null; save(); topR(); },
    'log-week-prev':     ()   => { vib(); S.logWeekOffset = (S.logWeekOffset || 0) - 1; save(); topR(); },
    'log-week-next':     ()   => { vib(); if ((S.logWeekOffset || 0) < 0) { S.logWeekOffset = (S.logWeekOffset || 0) + 1; save(); topR(); } },
    'set-size':          (el) => { vib(); S.timerSize = el.dataset.size; save(); R(); },
    'set-size-form':     (el) => pSz(el.dataset.size),
    'set-size-edit':     (el) => eSz(el.dataset.size),
    'set-service-form':  (el) => pSvc(el.dataset.svc),
    'set-service-edit':  (el) => eSvc(el.dataset.svc),
    'set-service-timer': (el) => {
        vib();
        const keys = toggleService(serviceKeys(S.timerStyle), el.dataset.svc);
        S.timerStyle = styleFromKeys(keys, legacyStyle(S.timerStyle));
        save(); R();
    },
    'set-diff-form':     (el) => pDf(Number(el.dataset.diff)),
    'set-diff-edit':     (el) => eDf(Number(el.dataset.diff)),
    'set-rv-diff':       (el) => rvDiff(Number(el.dataset.diff)),
    'toggle-chk':        (el) => { vib(); const k = el.dataset.key; S.chk[k] = !S.chk[k]; save(); R(); },
    'show-form':         ()   => { vib(); S.showForm = true; openInlineForm(); },
    'cancel-form':       ()   => { vib(); S.showForm = false; _phB = null; _phA = null; _svc = []; closeInlineForm(); },
    'cancel-edit':       ()   => { vib(); S.editId = null; closeInlineForm(); },
    'show-breed-form':   ()   => { vib(); S.showBreedForm = true; R(); },
    'cancel-breed-form': ()   => { vib(); S.showBreedForm = false; S.editBreedKey = null; R(); },
    'show-std-form':     ()   => { vib(); S.showStdForm = true; R(); },
    'cancel-std-form':   ()   => { vib(); S.showStdForm = false; S.editStdId = null; R(); },
    'split':             (el) => split(el.dataset.split),
    'toggle-pause':      ()   => togglePause(),
    'submit-log':        ()   => submitLog(),
    'save-edit':         ()   => saveEdit(),
    'save-breed':        (el) => saveBreedNote(el.dataset.key || null),
    'save-std':          (el) => saveStd(el.dataset.id || null),
    'clear-photo-edit':  (el) => { if (el.dataset.which === 'B') _edPhB = null; else _edPhA = null; R(); },
    'show-photo':        (el) => { 
        vib(); 
        const src = el.dataset.source;
        const logId = el.dataset.logid;
        const which = el.dataset.which;
        
        let b = null, a = null;
        if (logId) {
            const log = S.logs.find(x => x.id == logId);
            if (log) { b = log.before; a = log.after; }
        } else if (src === 'review') {
            b = S.timerReview ? S.timerReview.before : null;
            a = _rvAfter;
        } else if (src === 'form') {
            b = _phB; a = _phA;
        } else if (src === 'edit') {
            b = _edPhB; a = _edPhA;
        } else if (src === 'setup') {
            b = S.timerBeforePhoto; a = null;
        }
        
        const refs = [];
        const labels = [];
        if (b) { refs.push(b); labels.push('Before'); }
        if (a) { refs.push(a); labels.push('After'); }
        
        let idx = 0;
        if (which === 'A' && b) idx = 1;
        
        if (refs.length > 0) {
            _lightbox = { refs, labels, index: idx };
            R();
        }
    },
    'lb-prev':           ()   => { if (_lightbox && _lightbox.index > 0) { vib(); _lightbox.index--; R(); } },
    'lb-next':           ()   => { if (_lightbox && _lightbox.index < _lightbox.refs.length - 1) { vib(); _lightbox.index++; R(); } },
    'close-photo':       ()   => { 
        // If they just swiped less than 300ms ago, ignore the close action!
        if (Date.now() - _lastSwipeTime < 300) return; 
        vib(); _lightbox = null; R(); 
    },
    'share-photos':      (el) => shareBeforeAfter(Number(el.dataset.id)),
    'save-review':       ()   => saveReview(),
    'discard-review':    ()   => discardReview(),
    'start-timer-setup': ()   => {
        S.timerDogName = document.getElementById('tDN').value;
        S.timerBreed = document.getElementById('tB').value;
        // S.timerStyle is live-maintained by the pill grid / tSX input listener.
        startTimer();
    },
    'stop-timer':        ()   => stopTimer(),
    'cancel-timer':      ()   => cancelTimer(),
    'export-data':       ()   => exportData(),
    'install-pwa':       async () => {
        if (!_deferredPrompt) return;
        _deferredPrompt.prompt();
        const { outcome } = await _deferredPrompt.userChoice;
        if (outcome === 'accepted') { _deferredPrompt = null; R(); }
    },
    'reset-all':         ()   => showConfirm('Reset ALL data?', async () => {
        _resetting = true;
        localStorage.removeItem(SK);
        try {
            if (_dbPromise) {
                const db = await _dbPromise;
                db.close();
                _dbPromise = null;
            }
            await new Promise((resolve, reject) => {
                const req = indexedDB.deleteDatabase(DB_NAME);
                req.onsuccess = resolve;
                req.onerror   = () => reject(req.error);
                req.onblocked = resolve;
            });
        } catch (err) {
            console.error('Failed to clear IDB during reset:', err);
        }
        location.reload();
    })
};

let _actionsWired = false;
function wireActions() {
    if (!_actionsWired) {
        _actionsWired = true;
        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;
            const handler = ACTIONS[action];
            if (handler) {
                e.preventDefault();
                try {
                    handler(el);
                } catch (err) {
                    console.error(`Action "${action}" failed:`, err);
                    showToast('Something went wrong. Try again.', 'error');
                }
            }
        });
        // Live breed-note preview on timer setup. Updates only the #bnPrev
        // container (no full R()) so typing never loses focus or caret.
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'tB') {
                S.timerBreed = e.target.value;
                const prev = document.getElementById('bnPrev');
                if (prev) prev.innerHTML = renderBreedNoteCard(S.timerBreed);
            }
            // Timer notes type straight into state (no full R(), caret safe).
            if (e.target && e.target.id === 'tNotes') S.timerNotes = e.target.value;
        });
        // Log day picker — the calendar input has no id on purpose so R()'s
        // input snapshot can't restore a stale date over the state-driven one.
        document.addEventListener('change', (e) => {
            if (!e.target || !e.target.dataset || e.target.dataset.role !== 'log-date') return;
            const v = e.target.value;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
            vib();
            S.logDate = v === dk() ? null : v;
            save(); topR();
        });
    }
    const cancelBtn = document.getElementById('modalCancel');
    if (cancelBtn) cancelBtn.onclick = () => { _modal = null; R(); };
    const okBtn = document.getElementById('modalOk');
    if (okBtn) okBtn.onclick = () => {
        const cb = _modal && _modal.onConfirm;
        _modal = null;
        R();
        if (cb) cb();
    };
}

// ════ VIEWS ════

// 1. ONBOARD
function renderOnboard() {
    return `
    <div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px">
        <div style="font-size:64px;margin-bottom:16px;color:var(--rd)">${IC('scissors')}</div>
        <h1 style="font-size:36px;margin-bottom:8px">GroomPace</h1>
        <p style="font-size:14px;color:var(--rd);font-weight:500;letter-spacing:1px;text-transform:uppercase;margin-bottom:24px">Your Personal Speed Tracker</p>
        <p style="font-size:16px;color:var(--tm);line-height:1.7;max-width:320px;margin-bottom:36px">Track your groom times, beat your personal bests, and compare returning dogs over time.</p>

        <div style="display:flex;flex-direction:column;gap:14px;width:100%;max-width:290px;margin-bottom:40px;text-align:left">
            ${[
                ['stopwatch', 'Live timer with Ghost Racing'],
                ['camera', 'Before & after photos'],
                ['dog', 'Track returning dogs over time'],
                ['trend', 'Trends & personal bests'],
                ['comb', 'Blade reference & pace standards'],
                ['trophy', 'Milestones & daily prep']
            ].map(([ic, f]) => `<div style="font-size:15px;color:var(--tm);display:flex;align-items:center;gap:11px"><span style="font-size:20px;color:var(--ro);flex-shrink:0">${IC(ic)}</span>${f}</div>`).join('')}
        </div>

        <button data-action="finish-onboard" style="width:100%;max-width:280px;padding:18px;background:linear-gradient(135deg,var(--ro),var(--rd));border-radius:16px;color:var(--wh);font-size:17px;font-weight:600;box-shadow:0 8px 24px rgba(212,132,154,.35);display:inline-flex;align-items:center;justify-content:center;gap:8px">Let's Go ${IC('paw')}</button>
        <p style="font-size:12px;color:var(--di);margin-top:20px">Free forever · All data stays on your phone</p>
    </div>`;
}

// 2. HOME
function renderHome() {
    const a = getAvg(), t = trend(), wl = weekLogs(), wAvg = wl.length ? Math.round(wl.reduce((a,l) => a + l.min, 0) / wl.length) : null;
    const recent = weekLogs().slice(0, 3);
    const earned = ACH.filter(a => a.ck(S)).length;
    const todayDone = CHK.filter(i => S.chk[dk() + '_' + i.id]).length;
    const gs = S.goals.dogsPerDay > 0 || S.goals.avgTarget > 0;

    const installBanner = _deferredPrompt ? `
    <div class="c fi" style="padding:14px 18px; margin-bottom:14px; background:linear-gradient(135deg,var(--ro),var(--rd)); color:var(--wh); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:14px; font-weight:500; display:inline-flex; align-items:center; gap:7px;">${IC('phone')} Install GroomPace as an App!</span>
        <button data-action="install-pwa" style="padding:8px 16px; background:var(--wh); color:var(--rd); border-radius:10px; font-weight:bold; font-size:13px;">Install</button>
    </div>` : '';

    return `
    <div style="padding-top:env(safe-area-inset-top,12px)">
        ${installBanner}
        <div style="text-align:center;padding:28px 16px 20px;background:linear-gradient(180deg,var(--ca),var(--bg));margin:0 -18px 18px;position:relative;overflow:hidden">
            <div style="position:absolute;top:10px;left:18px;opacity:.06;font-size:40px;transform:rotate(-12deg)">${IC('paw')}</div>
            <div style="position:absolute;top:40px;right:14px;opacity:.05;font-size:30px;transform:rotate(20deg)">${IC('scissors')}</div>
            <div style="font-size:10px;letter-spacing:2.5px;color:var(--ro);text-transform:uppercase;font-weight:600;margin-bottom:6px">GroomPace</div>
            <h1 style="font-size:26px;line-height:1.2;display:inline-flex;align-items:center;gap:9px">Welcome back <span style="color:var(--rd);font-size:22px">${IC('scissors')}</span></h1>
            <p style="font-size:13px;color:var(--mu);margin-top:8px;font-style:italic">"${esc(quote())}"</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
            <div class="c fi" style="padding:16px 8px;text-align:center">
                <div style="font-size:20px;margin-bottom:6px;color:var(--ro)">${IC('paw')}</div>
                <div style="font-family:Fraunces,serif;font-size:22px;font-weight:600">${S.logs.length}</div>
                <div style="font-size:11px;color:var(--di);margin-top:4px">Total</div>
            </div>
            <div class="c fi" style="padding:16px 8px;text-align:center">
                <div style="font-size:20px;margin-bottom:6px;color:var(--ro)">${IC('stopwatch')}</div>
                <div style="font-family:Fraunces,serif;font-size:22px;font-weight:600">${a ? a + 'm' : '—'}</div>
                <div style="font-size:11px;color:var(--di);margin-top:4px">Avg Time</div>
            </div>
            <div class="c fi" style="padding:16px 8px;text-align:center">
                <div style="font-size:20px;margin-bottom:6px;color:${t > 0 ? 'var(--sg)' : 'var(--ro)'}">${t > 0 ? IC('trend') : IC('chart')}</div>
                <div style="font-family:Fraunces,serif;font-size:22px;font-weight:600;${t > 0 ? 'color:var(--sg)' : ''}">${t ? Math.abs(t) + 'm' : '—'}</div>
                <div style="font-size:11px;color:var(--di);margin-top:4px">${t > 0 ? 'Faster' : t < 0 ? 'Slower' : 'Trend'}</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <button data-action="go-tab" data-tab="timer" style="background:linear-gradient(135deg,var(--ro),var(--rd));border-radius:var(--r);padding:22px 16px;color:var(--wh);text-align:left;box-shadow:0 8px 24px rgba(212,132,154,.3)">
                <div style="font-size:26px;margin-bottom:10px">${IC('stopwatch')}</div>
                <div style="font-size:16px;font-weight:600">Start Timer</div>
            </button>
            <button class="c" data-action="go-log-form" style="border:1px solid var(--bd);border-radius:var(--r);padding:22px 16px;text-align:left">
                <div style="font-size:26px;margin-bottom:10px;color:var(--rd)">${IC('scissors')}</div>
                <div style="font-size:16px;font-weight:600;color:var(--tx)">Log Groom</div>
            </button>
        </div>

        <div class="c" style="padding:18px;margin-bottom:14px">
            <div style="font-size:11px;letter-spacing:1.5px;color:var(--lv);text-transform:uppercase;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px">${IC('chart')} This Week</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                <div><div style="font-family:Fraunces,serif;font-size:20px;font-weight:600">${wl.length}</div><div style="font-size:11px;color:var(--di)">Dogs</div></div>
                <div><div style="font-family:Fraunces,serif;font-size:20px;font-weight:600">${wAvg ? wAvg + 'm' : '—'}</div><div style="font-size:11px;color:var(--di)">Avg Time</div></div>
                <div><div style="font-family:Fraunces,serif;font-size:20px;font-weight:600;color:${wl.length ? 'var(--sg)' : 'var(--tx)'}">${wl.length ? Math.min(...wl.map(l => l.min)) + 'm' : '—'}</div><div style="font-size:11px;color:var(--di)">Fastest</div></div>
            </div>
            ${gs ? `
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--bl)">
                ${S.goals.avgTarget ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--mu)">Target: ${S.goals.avgTarget}m</span><span style="font-weight:600;color:${(wAvg || 99) <= S.goals.avgTarget ? 'var(--sg)' : 'var(--hn)'}">${wAvg ? (wAvg <= S.goals.avgTarget ? IC('check') + ' On track' : IC('hourglass') + ' ' + Math.abs(wAvg - S.goals.avgTarget) + 'm to go') : '—'}</span></div>` : ''}
                ${S.goals.dogsPerDay ? `<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--mu)">Goal: ${S.goals.dogsPerDay}/day</span><span style="font-weight:600;color:var(--mu)">${wl.length ? Math.round(wl.length / 7 * 10) / 10 : 0}/day avg</span></div>` : ''}
            </div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
            <div class="c" style="padding:16px;cursor:pointer" data-action="go-tab" data-tab="me">
                <div style="font-size:10px;letter-spacing:1.5px;color:var(--hn);text-transform:uppercase;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px">${IC('trophy')} Milestones</div>
                <div style="font-size:15px;font-weight:500">${earned}/${ACH.length}</div>
            </div>
            <div class="c" style="padding:16px;cursor:pointer" data-action="go-prep">
                <div style="font-size:10px;letter-spacing:1.5px;color:var(--sg);text-transform:uppercase;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px">${IC('check')} Prep</div>
                <div style="font-size:15px;font-weight:500">${todayDone}/${CHK.length}</div>
            </div>
        </div>

        ${recent.length ? `
        <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;margin-left:4px;margin-right:4px">
                <div style="font-size:11px;letter-spacing:1.5px;color:var(--di);text-transform:uppercase;font-weight:600">This Week's Grooms</div>
                <button class="btn-ghost" data-action="go-tab" data-tab="log" style="font-size:12px;padding:6px 10px;display:inline-flex;align-items:center;gap:4px">See all ${IC('arrowR')}</button>
            </div>
            ${recent.map(l => `
            <div class="c" style="padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;align-items:center;gap:4px">
                    <span style="font-size:15px;font-weight:600">${groomLabel(l.dogName, l.breed || l.style)}</span>
                    ${l.diff >= 2 ? diffDot(l.diff) : ''}
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                    ${l.timed ? `<span style="font-size:13px;color:var(--ro)">${IC('stopwatch')}</span>` : ''}
                    ${(l.before || l.after) ? `<span style="font-size:13px;color:var(--mu)">${IC('camera')}</span>` : ''}
                    <span style="font-family:Fraunces,serif;font-size:18px;font-weight:600;color:${tc(l.min)}">${l.min}m</span>
                </div>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
}

// 3. TIMER
function renderTimer() {
    const run = S.timerRunning, sp = S.timerSplits, done = sp.map(s => s.label);
    
    // Review Screen
    if (S.timerReview) {
        const rv = S.timerReview;
        return `
        <div style="padding-top:28px">
            <div style="text-align:center;margin-bottom:24px">
                <div style="font-size:11px;letter-spacing:2px;color:var(--sg);text-transform:uppercase;font-weight:600;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:6px">${IC('check')} Groom Complete!</div>
                <div class="timer-num" style="color:var(--sg)">${fmtT(rv.totalMs || rv.min * 60000)}</div>
                <div style="font-size:15px;color:var(--tm);margin-top:8px;font-weight:500;">
                    ${groomLabel(rv.dogName, rv.breed, rv.style)}
                </div>
                ${rv.prevBest && rv.min < rv.prevBest ? `
                <div class="pb-banner fi"><span style="font-size:16px;vertical-align:-.15em">${IC('sparkle')}</span> New Personal Best! ${rv.prevBest - rv.min}m faster than your previous ${rv.prevBest}m${rv.dogName ? ' with ' + esc(rv.dogName) : ''}</div>` : ''}
                ${!rv.prevBest && rv.breed ? `
                <div class="baseline-note fi"><span style="font-size:15px;vertical-align:-.15em">${IC('star')}</span> First timed ${esc(rv.breed)} — this sets your ghost pace to race next time</div>` : ''}
            </div>

            ${rv.splits.length ? `
            <div class="c" style="padding:16px;margin-bottom:16px">
                ${rv.splits.map((x,i) => `
                <div style="display:flex;justify-content:space-between;padding:8px 0;${i < rv.splits.length - 1 ? 'border-bottom:1px solid var(--bl)' : ''}">
                    <span style="font-size:14px;color:var(--tm);text-transform:capitalize">${x.label}</span>
                    <span style="font-size:14px;font-weight:600">${x.dur}</span>
                </div>`).join('')}
                <div style="display:flex;justify-content:space-between;padding:10px 0 0;border-top:2px solid var(--bd);margin-top:4px">
                    <span style="font-size:14px;font-weight:600;color:var(--tx)">Total</span>
                    <span style="font-size:14px;font-weight:700;color:${tc(rv.min)}">${rv.min}m</span>
                </div>
            </div>` : ''}

            ${rv.before ? `
            <div style="margin-bottom:16px">
                <div class="lbl">Before Photo</div>
                <button data-action="show-photo" data-source="review" data-which="B" style="padding:0;background:none;border:none;cursor:pointer;">
                    ${photoThumb(rv.before, 'photo-thumb')}
                </button>
            </div>` : ''}

            <div class="c" style="padding:22px;margin-bottom:16px;border:1px solid rgba(212,132,154,.2)">
                <div class="sec-lbl" style="color:var(--rd)">Complete Your Log</div>
                
                <div style="margin-bottom:16px"><label class="lbl">Difficulty</label>
                    <div style="display:flex;gap:8px" id="rvDf">
                        <button class="diff-btn on-1" style="flex:1;" data-action="set-rv-diff" data-diff="1">${diffDot(1)} Easy</button>
                        <button class="diff-btn" style="flex:1;" data-action="set-rv-diff" data-diff="2">${diffDot(2)} Med</button>
                        <button class="diff-btn" style="flex:1;" data-action="set-rv-diff" data-diff="3">${diffDot(3)} Hard</button>
                    </div>
                </div>

                <div style="margin-bottom:16px"><label class="lbl" style="display:inline-flex;align-items:center;gap:5px">${IC('camera')} After Photo</label>
                    ${renderPhotoPicker('rvP', 'rvAfter', !!_rvAfter, _rvAfter ? `<button data-action="show-photo" data-source="review" data-which="A" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(_rvAfter)}</button>` : '')}
                </div>

                <div style="margin-bottom:18px"><label class="lbl" for="rvNotes">Notes</label>
                    <textarea class="inp" id="rvNotes" rows="3" placeholder="Your plan, plus how it went" style="resize:vertical">${esc(rv.notes || '')}</textarea>
                </div>
                
                <div style="display:flex;gap:12px">
                    <button data-action="save-review" class="btn-primary" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px">Save ${IC('paw')}</button>
                    <button data-action="discard-review" class="btn-secondary">Discard</button>
                </div>
            </div>
        </div>`;
    }

    // Setup Screen
    if (!run && !S.timerStart) {
        const tKeys = serviceKeys(S.timerStyle);
        return `
        <div style="padding-top:28px">
            <h2 style="font-size:26px;margin-bottom:6px">Live Timer</h2>
            <p style="font-size:14px;color:var(--mu);margin-bottom:28px">Set up, then start when the dog hits the table.</p>

            <div class="c" style="padding:22px;margin-bottom:18px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
                    <div><label class="lbl" for="tDN">Dog & Last Name</label><input class="inp" id="tDN" placeholder="e.g. Bella Smith" value="${esc(S.timerDogName)}" list="dogNameList"></div>
                    <div><label class="lbl" for="tB">Breed</label><input class="inp" id="tB" placeholder="e.g. Goldendoodle" value="${esc(S.timerBreed)}" list="breedList"></div>
                </div>
                <div style="margin-bottom:16px"><label class="lbl">Service</label>
                    ${serviceGrid('set-service-timer', tKeys)}
                    <p style="font-size:11px;color:var(--di);margin-top:7px;line-height:1.5">Pick one or combine — your step buttons match what you selected.</p>
                </div>
                <div style="margin-bottom:16px"><label class="lbl" for="tNotes">Notes</label>
                    <textarea class="inp" id="tNotes" rows="2" placeholder="Shampoo, cut plan, anything to remember mid-groom" style="resize:vertical">${esc(S.timerNotes || '')}</textarea>
                </div>
                <div style="margin-bottom:16px"><label class="lbl">Size</label>
                    <div style="display:flex;gap:6px">
                        ${['small','medium','large'].map(s => `<button class="pill ${S.timerSize === s ? 'on' : ''}" style="flex:1;padding:14px 4px;" data-action="set-size" data-size="${s}">${s}</button>`).join('')}
                    </div>
                </div>
                <div><label class="lbl" style="display:inline-flex;align-items:center;gap:5px">${IC('camera')} Before Photo</label>
                    ${renderPhotoPicker('tP', 'timerBefore', !!S.timerBeforePhoto, S.timerBeforePhoto ? `<button data-action="show-photo" data-source="setup" data-which="B" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(S.timerBeforePhoto)}</button>` : '')}
                </div>
            </div>
            
            <div id="bnPrev">${renderBreedNoteCard(S.timerBreed)}</div>

            <button data-action="start-timer-setup" style="width:100%;padding:20px;background:linear-gradient(135deg,var(--ro),var(--rd));border-radius:16px;color:var(--wh);font-size:18px;font-weight:600;box-shadow:0 8px 24px rgba(212,132,154,.35);display:inline-flex;align-items:center;justify-content:center;gap:8px">${IC('play')} Start Timer</button>
        </div>`;
    }

    // Running Screen — step buttons come from the services picked at setup.
    // If nothing was picked, offer every step so the timer is never unusable.
    const runKeys = serviceKeys(S.timerStyle);
    const runSteps = runKeys.length ? stepsForServices(runKeys) : STEP_ORDER;
    const splitBtns = runSteps.map(k => ({ l: k, e: STEPS[k].e, t: STEPS[k].t }));

    return `
    <div style="padding-top:40px;text-align:center">
        <div style="font-size:14px;color:var(--mu);margin-bottom:8px;font-weight:500;">
            ${groomLabel(S.timerDogName, S.timerBreed, S.timerStyle)}
        </div>
        
        <div class="timer-num run" id="tn" style="${S.timerPausedAt ? 'color:var(--mu);' : ''}">${fmtT(elapsed())}</div>
        
        <div style="text-align:center; margin-top:-4px; margin-bottom:16px;">
            <button data-action="toggle-pause" style="padding:8px 24px; background:var(--ca); border-radius:20px; font-weight:600; font-size:14px; color:var(--tm); border:1px solid var(--bd); display:inline-flex; align-items:center; gap:6px;">
                ${S.timerPausedAt ? IC('play') + ' Resume' : IC('pause') + ' Pause'}
            </button>
        </div>

        ${S.timerNotes && S.timerNotes.trim() ? `
        <div class="c" style="padding:14px 16px;margin-bottom:14px;text-align:left;border:1px solid rgba(155,141,196,.3)">
            <div class="sec-lbl" style="color:var(--lv);margin-bottom:6px;display:flex;align-items:center;gap:6px">${IC('notebook')} Your Plan</div>
            <div style="font-size:14px;color:var(--tm);line-height:1.55;white-space:pre-wrap">${esc(S.timerNotes.trim())}</div>
        </div>` : ''}

        ${renderBreedNoteCard(S.timerBreed)}

        ${S.timerGhost ? `
        <div class="c ghost-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <span style="font-size:13px; font-weight:700; color:var(--tx); display:flex; align-items:center; gap:6px;">${IC('ghost')} Ghost Pace</span>
                <span style="font-size:12px; font-weight:600; color:var(--mu); background:var(--ca); padding:4px 8px; border-radius:8px;">PB: ${S.timerGhost}m</span>
            </div>
            <div style="height:8px; background:var(--bl); border-radius:4px; position:relative; overflow:visible; margin: 0 10px;">
                <div style="position:absolute; right:-14px; top:-9px; font-size:18px; color:var(--lv); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">${IC('ghost')}</div>
                <div id="ghostBar" style="position:absolute; left:0; top:0; height:100%; border-radius:4px; background:linear-gradient(90deg, #7BAF8E, #A3D2B5); width:0%; transition: width 0.5s ease-out, background 0.5s ease;"></div>
                <div id="ghostIcon" style="position:absolute; top:-8px; left:0%; font-size:16px; color:var(--rd); transition: left 0.5s ease-out; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); z-index:2;">${IC('scissors')}</div>
            </div>
            <div id="ghostStatus" style="font-size:12px; color:var(--sg); margin-top:16px; text-align:center; font-weight:600;">Racing...</div>
        </div>
        ` : ''}

        <div style="display:flex;gap:8px;justify-content:center;margin:24px 0;flex-wrap:wrap;max-width:340px;margin-left:auto;margin-right:auto;">
            <div style="width:100%; font-size:11px; color:var(--mu); font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Tap when you finish each step — records that step's time:</div>
            ${splitBtns.map(s => {
                const d = done.includes(s.l);
                const clickable = run && !d && !S.timerPausedAt;
                return `<button ${clickable ? `data-action="split" data-split="${esc(s.l)}"` : ''} style="padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px;${d ? 'background:var(--ss);color:var(--sg);' : 'background:var(--card);border:1px solid var(--bd);color:var(--tm);box-shadow:var(--sh);'} ${!clickable ? 'opacity:.5;' : ''}">${IC(s.e)} ${s.t}${d ? ' ' + IC('check') : ''}</button>`;
            }).join('')}
        </div>
        
        ${sp.length ? `
        <div class="c" style="padding:18px;margin-bottom:28px;text-align:left">
            ${sp.map((x,i) => {
                const prev = i === 0 ? 0 : sp[i-1].elapsed;
                return `
                <div style="display:flex;justify-content:space-between;padding:8px 0;${i < sp.length - 1 ? 'border-bottom:1px solid var(--bl)' : ''}">
                    <span style="font-size:14px;color:var(--tm)">${(STEPS[x.label] || {}).t || x.label} <span style="color:var(--di);font-size:11px">(step time)</span></span>
                    <span style="font-size:14px;font-weight:600">${fmtT(x.elapsed - prev)}</span>
                </div>`;
            }).join('')}
        </div>` : ''}
        
        <div style="display:flex;gap:12px;justify-content:center;margin-top:auto;">
            <button data-action="stop-timer" style="flex:2;padding:18px;background:var(--sg);border-radius:16px;color:var(--wh);font-size:17px;font-weight:600;box-shadow:0 6px 20px rgba(123,175,142,.3);display:inline-flex;align-items:center;justify-content:center;gap:7px">${IC('stop')} Done</button>
            <button data-action="cancel-timer" style="flex:1;padding:18px;border:1px solid var(--bd);border-radius:16px;color:var(--mu);font-size:16px;font-weight:500;">Cancel</button>
        </div>
    </div>`;
}

function rvDiff(d) {
    vib(); _rvDf = d;
    document.querySelectorAll('#rvDf .diff-btn').forEach((b,i) => {
        b.className = 'diff-btn';
        if(i+1 === d) b.classList.add('on-'+d);
    });
}

// 4. LOG
function renderLog() {
    const filtered = filterLogs(S.logs);
    const label = filterLabel();
    const dayKey = logDayKey();
    const isToday = dayKey === dk();
    const count = `${filtered.length} dog${filtered.length !== 1 ? 's' : ''}`;

    return `
    <div class="page">
        <h2 class="page-title">Groom Log</h2>
        <p class="page-sub">${S.logFilter === 'all' ? 'Full history — use filters to focus on a day or a week.'
            : S.logFilter === 'today' ? 'Showing ' + esc(label) + ' — tap the date to jump to any day.'
            : 'Showing ' + esc(label.toLowerCase()) + '\'s grooms — tap a dog for full history.'}</p>

        ${!S.showForm && !S.editId ? `
        <div class="filter-bar">
            <button class="sub-tab ${S.logFilter === 'today' ? 'on' : ''}" data-action="set-log-filter" data-filter="today" style="display:inline-flex;align-items:center;justify-content:center;gap:5px">${IC('sun')} Day</button>
            <button class="sub-tab ${S.logFilter === 'week' ? 'on' : ''}" data-action="set-log-filter" data-filter="week" style="display:inline-flex;align-items:center;justify-content:center;gap:5px">${IC('calendar')} Week</button>
            <button class="sub-tab ${S.logFilter === 'all' ? 'on' : ''}" data-action="set-log-filter" data-filter="all" style="display:inline-flex;align-items:center;justify-content:center;gap:5px">${IC('clipboard')} All</button>
        </div>
        ${S.logFilter === 'week' ? `
        <div class="week-nav">
            <button data-action="log-week-prev" style="display:inline-flex;align-items:center;justify-content:center">${IC('arrowL')}</button>
            <span class="week-nav-label">${esc(label)} · ${filtered.length} dog${filtered.length !== 1 ? 's' : ''}</span>
            <button data-action="log-week-next" ${(S.logWeekOffset || 0) >= 0 ? 'disabled style="opacity:.35"' : 'style="display:inline-flex;align-items:center;justify-content:center"'}>${IC('arrowR')}</button>
        </div>` : S.logFilter === 'today' ? `
        <div class="week-nav">
            <button data-action="log-day-prev" aria-label="Previous day" style="display:inline-flex;align-items:center;justify-content:center">${IC('arrowL')}</button>
            <label class="day-pick" title="Pick a date">
                <span class="day-pick-icon">${IC('calendar')}</span>
                <span>${esc(label)} · ${count}</span>
                <input type="date" class="day-pick-input" data-role="log-date" value="${dayKey}" max="${dk()}" aria-label="Pick a date">
            </label>
            <button data-action="log-day-next" ${isToday ? 'disabled style="opacity:.35" aria-label="Next day"' : 'aria-label="Next day" style="display:inline-flex;align-items:center;justify-content:center"'}>${IC('arrowR')}</button>
        </div>
        ${!isToday ? `<div style="text-align:center;margin-bottom:14px"><button class="btn-ghost" data-action="log-day-today">Back to today</button></div>` : ''}` : `
        <div style="text-align:center;font-size:14px;font-weight:600;color:var(--tm);margin-bottom:14px">${esc(label)} · ${count}</div>`}` : ''}
        
        ${S.editId ? renderEditForm() : S.showForm ? renderLogForm() : `
        <button data-action="show-form" class="btn-primary" style="margin-bottom:20px;background:var(--rg);color:var(--rd);border:2px dashed rgba(212,132,154,.35);box-shadow:none;display:inline-flex;align-items:center;justify-content:center;gap:7px">${IC('paw')} Log a Groom Manually</button>`}
        
        ${filtered.length === 0 && !S.showForm && !S.editId ? `
        <div class="empty">
            <div class="empty-icon">${S.logFilter === 'today' ? IC('sun') : S.logFilter === 'week' ? IC('calendar') : IC('scissors')}</div>
            <div class="empty-title">${S.logFilter === 'today' ? (isToday ? 'No grooms today yet' : 'No grooms on ' + esc(label)) : S.logFilter === 'week' ? 'No grooms this week' : 'No grooms yet'}</div>
            <div class="empty-sub">${S.logFilter === 'all' ? 'Track your first groom to see trends and personal bests.' : 'Start the timer when your next dog hits the table.'}</div>
            <button data-action="go-tab" data-tab="timer" class="btn-primary" style="max-width:260px;margin:0 auto;display:inline-flex;align-items:center;justify-content:center;gap:7px">${IC('stopwatch')} Start Timer</button>
        </div>` : `
        
        ${!S.showForm && !S.editId && filtered.length >= 3 ? `
        <div class="c" style="padding:20px 14px">
            <div class="sec-lbl" style="color:var(--di)">Recent Trend</div>
            ${renderChart(filtered.slice(0, 14).reverse())}
        </div>` : ''}

        ${!S.showForm && !S.editId ? filtered.map(l => {
            const tags = sectionTags(l);
            const hist = l.dogName ? getDogHistory(l.dogName) : [];
            const cmp = hist.length >= 2;

            return `
            <div class="c">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:8px">
                    <div>
                        ${l.dogName ? `<span style="font-size:16px;font-weight:600">${esc(l.dogName)}</span>${l.breed ? `<span style="font-size:13px;color:var(--mu);margin-left:6px">${esc(l.breed)}</span>` : ''}` : `<span style="font-size:16px;font-weight:600">${esc(l.breed || l.style) || 'Groom'}</span>`}
                        ${l.style && (l.dogName || l.breed) ? `<span style="font-size:13px;color:var(--mu);margin-left:6px">${esc(l.style)}</span>` : ''}
                        ${!l.breed ? `<button class="btn-ghost" data-action="edit-log" data-id="${l.id}" style="font-size:12px;padding:2px 8px;margin-left:6px;color:var(--ro)">+ Add breed</button>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                        ${l.diff >= 2 ? diffDot(l.diff) : ''}
                        ${l.timed ? `<span style="font-size:14px;color:var(--ro)">${IC('stopwatch')}</span>` : ''}
                        <span style="font-family:Fraunces,serif;font-size:20px;font-weight:600;color:${tc(l.min)}">${l.min}m</span>
                    </div>
                </div>

                ${tags.length ? `
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                    ${tags.map(t => `<span class="tag tag-sect">${esc(t)}</span>`).join('')}
                    <span class="tag">${esc(l.size)}</span>
                </div>` : ''}

                ${hasSectionData(l) ? renderSectionBreakdown(l) : ''}

                ${(l.before || l.after) ? `
                <div style="display:flex;gap:12px;margin-bottom:12px">
                    ${l.before ? `<div><div class="lbl">Before</div><button data-action="show-photo" data-logid="${l.id}" data-which="B" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(l.before)}</button></div>` : ''}
                    ${l.after ? `<div><div class="lbl">After</div><button data-action="show-photo" data-logid="${l.id}" data-which="A" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(l.after)}</button></div>` : ''}
                </div>` : ''}

                ${l.notes ? `<div style="font-size:13px;color:var(--di);margin-bottom:12px;font-style:italic">"${esc(l.notes)}"</div>` : ''}

                <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--bl)">
                    <span style="font-size:12px;color:var(--di)">${esc(l.date)}</span>
                    <div class="log-actions">
                        ${(l.before && l.after) ? `<button class="btn-ghost" data-action="share-photos" data-id="${l.id}" style="display:inline-flex;align-items:center;gap:5px">${IC('share')} Share</button>` : ''}
                        ${cmp ? `<button class="btn-ghost" data-action="view-dog" data-name="${esc(l.dogName)}">History (${hist.length})</button>` : ''}
                        <button class="btn-ghost" data-action="edit-log" data-id="${l.id}">Edit</button>
                        <button class="btn-ghost btn-danger" data-action="del-log" data-id="${l.id}">Delete</button>
                    </div>
                </div>
            </div>`;
        }).join('') : ''}`}
    </div>`;
}

function renderChart(logs) {
    if (logs.length < 2) return '';
    const mx = Math.max(...logs.map(l => l.min)), mn = Math.min(...logs.map(l => l.min));
    const rng = Math.max(mx - mn, 10);
    return `
    <div style="height:80px;display:flex;align-items:flex-end;gap:4px;padding:0 4px">
        ${logs.map(l => {
            const h = Math.max(((l.min - mn) / rng) * 60 + 16, 14);
            return `
            <div style="flex:1;height:${h}px;background:linear-gradient(180deg,${tc(l.min)},${tc(l.min)}88);border-radius:6px 6px 3px 3px;position:relative">
                <div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--mu);font-weight:600;white-space:nowrap">${l.min}</div>
            </div>`;
        }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;border-top:2px solid var(--bd);margin-top:6px;padding-top:6px;font-size:10px;color:var(--di);font-weight:600;text-transform:uppercase;letter-spacing:1px;">
        <span>Older</span>
        <span style="display:inline-flex;align-items:center;gap:4px">Newer ${IC('arrowR')}</span>
    </div>`;
}

// Manual Log Form
let _sz = 'medium', _df = 1, _phB = null, _phA = null, _svc = [];

function renderLogForm() {
    return `
    <div class="c" style="border:1px solid rgba(212,132,154,.25);border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:var(--su)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
            <span style="font-size:24px;color:var(--rd)">${IC('paw')}</span><h3 style="font-size:20px;color:var(--rd)">Log a Groom</h3>
        </div>
        
        <div style="margin-bottom:16px">
            <label class="lbl" for="fDate">Date</label>
            <input type="date" class="inp" id="fDate" value="${dk()}">
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div><label class="lbl" for="fDN">Dog & Last Name</label><input class="inp" id="fDN" placeholder="e.g. Bella Smith" list="dogNameList"></div>
            <div><label class="lbl" for="fB">Breed</label><input class="inp" id="fB" placeholder="e.g. Shih Tzu (optional)" list="breedList"></div>
        </div>
        
        <div style="margin-bottom:16px"><label class="lbl">Service</label>
            ${serviceGrid('set-service-form', _svc)}
        </div>

        <div style="margin-bottom:16px"><label class="lbl">Size</label>
            <div style="display:flex;gap:6px" id="szB">
                ${['small','medium','large'].map(s => `<button class="pill ${_sz===s?'on':''}" style="flex:1;padding:12px 2px;" data-action="set-size-form" data-size="${s}">${s}</button>`).join('')}
            </div>
        </div>

        <div style="margin-bottom:16px"><label class="lbl">Difficulty</label>
            <div style="display:flex;gap:6px" id="dfB">
                <button class="diff-btn ${_df===1?'on-1':''}" style="flex:1" data-action="set-diff-form" data-diff="1">${diffDot(1)} Easy</button>
                <button class="diff-btn ${_df===2?'on-2':''}" style="flex:1" data-action="set-diff-form" data-diff="2">${diffDot(2)} Med</button>
                <button class="diff-btn ${_df===3?'on-3':''}" style="flex:1" data-action="set-diff-form" data-diff="3">${diffDot(3)} Hard</button>
            </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div><label class="lbl" for="fT">Total Time (min) *</label><input class="inp" id="fT" type="number" inputmode="numeric" placeholder="45" style="border-color:var(--ro)"></div>
            ${(_svc.length ? stepsForServices(_svc) : STEP_ORDER).map(k =>
                `<div><label class="lbl" for="f_${k}">${STEPS[k].t} (min)</label><input class="inp" id="f_${k}" type="number" inputmode="numeric"></div>`).join('')}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div><label class="lbl" style="display:inline-flex;align-items:center;gap:5px">${IC('camera')} Before</label>
                ${renderPhotoPicker('fPB', 'formB', !!_phB, _phB ? `<button data-action="show-photo" data-source="form" data-which="B" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(_phB)}</button>` : '')}
            </div>
            <div><label class="lbl" style="display:inline-flex;align-items:center;gap:5px">${IC('camera')} After</label>
                ${renderPhotoPicker('fPA', 'formA', !!_phA, _phA ? `<button data-action="show-photo" data-source="form" data-which="A" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(_phA)}</button>` : '')}
            </div>
        </div>
        
        <div style="margin-bottom:20px"><label class="lbl" for="fN">Notes</label><input class="inp" id="fN" placeholder="Optional notes"></div>
        
        <div style="display:flex;gap:12px">
            <button data-action="submit-log" style="flex:2;padding:16px;background:linear-gradient(135deg,var(--ro),var(--rd));border-radius:14px;color:var(--wh);font-size:16px;font-weight:600;box-shadow:0 6px 16px rgba(212,132,154,.35);display:inline-flex;align-items:center;justify-content:center;gap:7px">Save ${IC('paw')}</button>
            <button data-action="cancel-form" style="flex:1;padding:16px;border:1px solid var(--bd);border-radius:14px;color:var(--mu);font-size:15px;font-weight:500;">Cancel</button>
        </div>
    </div>`;
}

function pSz(s) { vib(); _sz = s; R(); }
function pDf(d) { vib(); _df = d; R(); }
function pSvc(k) { vib(); _svc = toggleService(_svc, k); R(); }

// Reads every step's minute input by id prefix. Steps not currently rendered
// (because their service isn't selected) simply come back 0.
function stepMinutesFromForm(prefix) {
    const out = {};
    Object.keys(STEPS).forEach(k => {
        const el = document.getElementById(prefix + k);
        out[k] = el ? Math.max(0, parseInt(el.value) || 0) : 0;
    });
    return out;
}

function submitLog() {
    vib();
    const b = document.getElementById('fB').value.trim();
    const t = Math.max(0, parseInt(document.getElementById('fT').value) || 0);
    
    if(!t) { showAlert('Please enter a valid total time.'); return; }
    
    const dStr = document.getElementById('fDate').value || dk();
    const dObj = new Date(dStr + 'T12:00:00');
    
    S.logs.unshift({
        id: Date.now(), ts: dObj.getTime(),
        date: dObj.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}),
        dogName: (document.getElementById('fDN').value || '').trim(),
        breed: b, style: styleFromKeys(_svc),
        size: _sz, min: t,
        ...stepMinutesFromForm('f_'),
        diff: _df, notes: document.getElementById('fN').value.trim(),
        timed: false, before: _phB, after: _phA
    });

    S.logs.sort((a,b) => b.ts - a.ts);
    S.showForm = false; _sz = 'medium'; _df = 1; _phB = null; _phA = null; _svc = [];
    save(); closeInlineForm();
}

// Edit Log Form
let _edSz = 'medium', _edDf = 1, _edPhB = null, _edPhA = null, _edSvc = [];

function editLog(id) {
    vib();
    const l = S.logs.find(x => x.id === id);
    if (!l) return;
    S.editId = id;
    _edSz = l.size || 'medium'; _edDf = l.diff || 1;
    _edPhB = l.before; _edPhA = l.after;
    // Light up whichever services the stored style names. Anything else it
    // holds (a style from before services existed) is shown in its own field
    // by renderEditForm so editing never silently discards it.
    _edSvc = serviceKeys(l.style);
    openInlineForm();
}

function renderEditForm() {
    const l = S.logs.find(x => x.id === S.editId);
    if (!l) return '';

    const dObj = new Date(l.ts || Date.now());
    const isoDate = `${dObj.getFullYear()}-${String(dObj.getMonth()+1).padStart(2,'0')}-${String(dObj.getDate()).padStart(2,'0')}`;

    return `
    <div class="c" style="border:1px solid rgba(123,175,142,.4);border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:var(--su)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
            <span style="font-size:24px;color:var(--sg)">${IC('pencil')}</span><h3 style="font-size:20px;color:var(--sg)">Edit Groom</h3>
        </div>
        
        <div style="margin-bottom:16px">
            <label class="lbl" for="eDate">Date</label>
            <input type="date" class="inp" id="eDate" value="${isoDate}">
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div><label class="lbl" for="eDN">Dog & Last Name</label><input class="inp" id="eDN" value="${esc(l.dogName || '')}" list="dogNameList"></div>
            <div><label class="lbl" for="eB">Breed</label><input class="inp" id="eB" value="${esc(l.breed || '')}" list="breedList"></div>
        </div>
        
        <div style="margin-bottom:16px"><label class="lbl">Service</label>
            ${serviceGrid('set-service-edit', _edSvc, legacyStyle(l.style), 'eStX')}
        </div>

        <div style="margin-bottom:16px"><label class="lbl">Size</label>
            <div style="display:flex;gap:6px" id="edSzB">
                ${['small','medium','large'].map(s => `<button class="pill ${_edSz===s?'on':''}" style="flex:1;padding:12px 2px;" data-action="set-size-edit" data-size="${s}">${s}</button>`).join('')}
            </div>
        </div>
        
        <div style="margin-bottom:16px"><label class="lbl">Difficulty</label>
            <div style="display:flex;gap:6px" id="edDfB">
                <button class="diff-btn ${_edDf===1?'on-1':''}" style="flex:1;" data-action="set-diff-edit" data-diff="1">${diffDot(1)} Easy</button>
                <button class="diff-btn ${_edDf===2?'on-2':''}" style="flex:1;" data-action="set-diff-edit" data-diff="2">${diffDot(2)} Med</button>
                <button class="diff-btn ${_edDf===3?'on-3':''}" style="flex:1;" data-action="set-diff-edit" data-diff="3">${diffDot(3)} Hard</button>
            </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div><label class="lbl" for="eT">Total (min) *</label><input class="inp" id="eT" type="number" inputmode="numeric" value="${l.min || ''}" style="border-color:var(--sg)"></div>
            ${(() => {
                // Steps for the chosen services, plus any retired step this
                // groom already has time on (Tail/Finished) so it stays editable.
                const shown = _edSvc.length ? stepsForServices(_edSvc) : STEP_ORDER;
                const extra = Object.keys(STEPS).filter(k => !shown.includes(k) && (l[k] || 0) > 0);
                return [...shown, ...extra].map(k =>
                    `<div><label class="lbl" for="e_${k}">${STEPS[k].t}</label><input class="inp" id="e_${k}" type="number" inputmode="numeric" value="${l[k] || ''}"></div>`).join('');
            })()}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div><label class="lbl" style="display:inline-flex;align-items:center;gap:5px">${IC('camera')} Before</label>
                ${renderPhotoPicker('ePB', 'editB', !!_edPhB, _edPhB ? `<div style="position:relative;display:inline-block"><button data-action="show-photo" data-source="edit" data-which="B" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(_edPhB)}</button><button data-action="clear-photo-edit" data-which="B" style="position:absolute;top:-6px;right:-6px;background:var(--card);color:var(--co);border-radius:50%;width:24px;height:24px;box-shadow:var(--sh);font-weight:bold;font-size:14px;border:1px solid var(--bd);">×</button></div>` : '')}
            </div>
            <div><label class="lbl" style="display:inline-flex;align-items:center;gap:5px">${IC('camera')} After</label>
                ${renderPhotoPicker('ePA', 'editA', !!_edPhA, _edPhA ? `<div style="position:relative;display:inline-block"><button data-action="show-photo" data-source="edit" data-which="A" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(_edPhA)}</button><button data-action="clear-photo-edit" data-which="A" style="position:absolute;top:-6px;right:-6px;background:var(--card);color:var(--co);border-radius:50%;width:24px;height:24px;box-shadow:var(--sh);font-weight:bold;font-size:14px;border:1px solid var(--bd);">×</button></div>` : '')}
            </div>
        </div>
        
        <div style="margin-bottom:20px"><label class="lbl" for="eN">Notes</label><input class="inp" id="eN" placeholder="Notes" value="${esc(l.notes || '')}"></div>
        
        <div style="display:flex;gap:12px">
            <button data-action="save-edit" style="flex:2;padding:16px;background:var(--sg);border-radius:14px;color:var(--wh);font-size:16px;font-weight:600;box-shadow:0 6px 16px rgba(123,175,142,.3);display:inline-flex;align-items:center;justify-content:center;gap:7px">Save Changes ${IC('check')}</button>
            <button data-action="cancel-edit" style="flex:1;padding:16px;border:1px solid var(--bd);border-radius:14px;color:var(--mu);font-size:15px;font-weight:500;">Cancel</button>
        </div>
    </div>`;
}

function eSz(s) { vib(); _edSz = s; R(); }
function eDf(d) { vib(); _edDf = d; R(); }
function eSvc(k) { vib(); _edSvc = toggleService(_edSvc, k); R(); }

function saveEdit() {
    vib();
    const l = S.logs.find(x => x.id === S.editId);
    if (!l) return;
    
    const b = document.getElementById('eB').value.trim();
    const t = Math.max(0, parseInt(document.getElementById('eT').value) || 0);
    if (!t) { showAlert('A valid time is required.'); return; }
    
    const dStr = document.getElementById('eDate').value || dk();
    const dObj = new Date(dStr + 'T12:00:00');
    
    l.ts = dObj.getTime();
    l.date = dObj.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
    l.dogName = (document.getElementById('eDN').value || '').trim();
    l.breed = b;
    l.style = styleFromKeys(_edSvc, ((document.getElementById('eStX') || {}).value || ''));
    l.size = _edSz;
    l.diff = _edDf;
    l.min = t;
    Object.assign(l, stepMinutesFromForm('e_'));
    l.notes = document.getElementById('eN').value.trim();
    l.before = _edPhB;
    l.after = _edPhA;
    
    S.logs.sort((a,b) => b.ts - a.ts);
    S.editId = null; save(); closeInlineForm();
}

// Open a form that takes over the list: start at the top, but remember the
// spot in the list so closing the form puts her back on the same dog.
function openInlineForm() {
    _formReturnY = window.scrollY || 0;
    _scrollToTop = true;
    R();
    window.scrollTo(0, 0);
}

// Leave the form and land back on the dog she opened it from.
function closeInlineForm() {
    const y = _formReturnY;
    _formReturnY = 0;
    R();
    if (y > 0) restoreScroll(y);
}

function delLog(id) {
    showConfirm('Delete this groom record permanently?', () => {
        const log = S.logs.find(l => l.id === id);
        if (log) {
            if (log.before) deletePhoto(log.before);
            if (log.after)  deletePhoto(log.after);
        }
        S.logs = S.logs.filter(l => l.id !== id);
        save();
        R();
    });
}

// 5. TOOLS
function renderTools() {
    const sub = S.sub || 'blades';
    return `
    <div style="padding-top:28px">
        <h2 style="font-size:26px;margin-bottom:18px">Tools</h2>
        <div style="display:flex;gap:6px;margin-bottom:20px;background:var(--ca);padding:6px;border-radius:14px;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;">
            ${[
                {k:'blades', i:'comb', l:'Blades'},
                {k:'breeds', i:'dog', l:'Breeds'},
                {k:'standards', i:'stopwatch', l:'Pace'},
                {k:'goals', i:'target', l:'Goals'}
            ].map(t => `<button class="sub-tab ${sub === t.k ? 'on' : ''}" style="flex:1;padding:12px 6px;min-width:70px;display:inline-flex;align-items:center;justify-content:center;gap:5px;" data-action="set-sub" data-sub="${esc(t.k)}">${IC(t.i)} ${t.l}</button>`).join('')}
        </div>
        ${sub === 'blades' ? renderBlades() : sub === 'breeds' ? renderBreeds() : sub === 'standards' ? renderStandards() : renderGoals()}
    </div>`;
}

function renderBlades() {
    return `
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div style="font-size:11px;letter-spacing:1.5px;color:var(--rd);text-transform:uppercase;font-weight:600;margin-bottom:6px">Clipper Blades</div>
        <div style="font-size:12px;color:var(--mu);margin-bottom:14px">Higher number = shorter cut</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="border-bottom:2px solid var(--bd)">
                <th style="text-align:left;padding:8px 4px;color:var(--mu);font-weight:600">Blade</th>
                <th style="text-align:left;padding:8px 4px;color:var(--mu);font-weight:600">Length</th>
                <th style="text-align:left;padding:8px 4px;color:var(--mu);font-weight:600">Use</th>
            </tr>
            ${BLADES.map((b,i) => `
            <tr style="border-bottom:1px solid var(--bl);${i%2 ? 'background:var(--ca)' : ''}">
                <td style="padding:10px 4px;font-weight:600;color:var(--rd);white-space:nowrap">${b.n}</td>
                <td style="padding:10px 4px;white-space:nowrap">${b.len} <span style="color:var(--di);font-size:11px;">(${b.mm}mm)</span></td>
                <td style="padding:10px 4px;color:var(--tm);line-height:1.4">${b.area}</td>
            </tr>`).join('')}
        </table>
    </div>
    
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div style="font-size:11px;letter-spacing:1.5px;color:var(--hn);text-transform:uppercase;font-weight:600;margin-bottom:6px">Guard Combs</div>
        <div style="font-size:12px;color:var(--mu);margin-bottom:14px">Attach over a #30 or #40 blade</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="border-bottom:2px solid var(--bd)">
                <th style="text-align:left;padding:8px 4px;color:var(--mu);font-weight:600">Comb</th>
                <th style="text-align:left;padding:8px 4px;color:var(--mu);font-weight:600">Length</th>
                <th style="text-align:left;padding:8px 4px;color:var(--mu);font-weight:600">mm</th>
            </tr>
            ${GUARDS.map((g,i) => `
            <tr style="border-bottom:1px solid var(--bl);${i%2 ? 'background:var(--ca)' : ''}">
                <td style="padding:10px 4px;font-weight:600;color:var(--hn)">${g.n}</td>
                <td style="padding:10px 4px">${g.len}</td>
                <td style="padding:10px 4px;color:var(--di)">${g.mm}mm</td>
            </tr>`).join('')}
        </table>
    </div>
    
    <div class="c" style="padding:20px">
        <div style="font-size:11px;letter-spacing:1.5px;color:var(--sg);text-transform:uppercase;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:6px">${IC('bulb')} Quick Tips</div>
        <div style="font-size:13px;color:var(--tm);line-height:1.6">
            <p style="margin-bottom:8px">• <strong>#10</strong> — workhorse: sanitary, pads, poodle faces, base for combs.</p>
            <p style="margin-bottom:8px">• <strong>#7F</strong> — most popular body blade, smooth finish.</p>
            <p style="margin-bottom:8px">• <strong>F = Finish</strong> (smooth). Skip-tooth = rough/bulk removal.</p>
            <p style="margin-bottom:8px">• <strong>With the grain</strong> leaves one blade length longer.</p>
            <p>• Blades hot? Swap to a cool backup on a ceramic tile.</p>
        </div>
    </div>`;
}

// Standards
function renderStandards() {
    const stds = S.standards || [];
    const showForm = S.showStdForm;
    const editId = S.editStdId;
    
    return `
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-size:11px;letter-spacing:1.5px;color:var(--co);text-transform:uppercase;font-weight:600;display:flex;align-items:center;gap:6px">${IC('stopwatch')} Salon Standards</div>
            ${!showForm && !editId ? `<button data-action="show-std-form" style="padding:8px 16px;background:var(--cs);border:1px solid var(--co);border-radius:10px;color:var(--co);font-size:13px;font-weight:600">+ Add Standard</button>` : ''}
        </div>
        
        ${showForm ? renderStdForm(null) : ''}
        ${stds.length === 0 && !showForm ? `<div style="text-align:center;padding:30px 20px;color:var(--di);font-size:14px">No pace standards set.</div>` : ''}
        
        ${stds.map(s => {
            if(editId === s.id) return renderStdForm(s.id);
            const textLines = (s.text || '').split('\n').filter(Boolean);
            return `
            <div style="padding:16px 0;border-bottom:1px solid var(--bl)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <span style="font-size:16px;font-weight:600;color:var(--tx)">${esc(s.title)}</span>
                    <div>
                        <button data-action="edit-std" data-id="${s.id}" style="font-size:13px;color:var(--ro);margin-right:12px;font-weight:600;">Edit</button>
                        <button data-action="del-std" data-id="${s.id}" style="font-size:16px;color:var(--di);font-weight:bold;">×</button>
                    </div>
                </div>
                
                <div style="display:flex;gap:8px;margin-bottom:12px;">
                    <span style="background:var(--rg);border:1px solid var(--ro);border-radius:8px;padding:4px 10px;font-size:12px;color:var(--rd);font-weight:600;">Aim: ${s.aim}m</span>
                    <span style="background:var(--ca);border-radius:8px;padding:4px 10px;font-size:12px;color:var(--tm);font-weight:500;">Max: ${s.max}m</span>
                </div>
                
                <div style="font-size:13px;color:var(--mu);line-height:1.6;background:var(--bg);padding:12px;border-radius:10px;border:1px solid var(--bl);">
                    ${textLines.map(line => `<div style="margin-bottom:6px;">${esc(line)}</div>`).join('')}
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

function renderStdForm(existingId) {
    const isEdit = !!existingId;
    const s = isEdit ? S.standards.find(x => x.id === existingId) : {title:'', aim:'', max:'', text:''};
    
    return `
    <div style="padding:18px;background:var(--ca);border-radius:14px;margin-bottom:16px;border:1px solid ${isEdit ? 'var(--co)' : 'var(--sg)'}40">
        <div style="font-size:13px;font-weight:600;color:${isEdit ? 'var(--co)' : 'var(--sg)'};margin-bottom:14px;display:flex;align-items:center;gap:6px">${isEdit ? IC('pencil') + ' Edit Standard' : IC('stopwatch') + ' New Pace Standard'}</div>
        
        <div style="margin-bottom:14px"><label class="lbl" for="stdTitle">Title (e.g. Small/Med 3 Blade)</label><input class="inp" id="stdTitle" value="${esc(s.title)}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
            <div><label class="lbl" for="stdAim">Aim Time (min)</label><input class="inp" id="stdAim" type="number" value="${s.aim || ''}"></div>
            <div><label class="lbl" for="stdMax">Max Time (min)</label><input class="inp" id="stdMax" type="number" value="${s.max || ''}"></div>
        </div>
        
        <div style="margin-bottom:16px">
            <label class="lbl" for="stdText">Step Breakdown</label>
            <div style="font-size:11px;color:var(--mu);margin-bottom:6px;">Put each step on a new line.</div>
            <textarea class="inp" id="stdText" rows="6" placeholder="1. Pre work (nails, pads, sani) - 5-8 min\n2. Brush out - 10 min">${esc(s.text)}</textarea>
        </div>
        
        <div style="display:flex;gap:12px">
            <button data-action="save-std" ${isEdit ? `data-id="${s.id}"` : ''} style="flex:2;padding:14px;background:${isEdit ? 'var(--co)' : 'var(--sg)'};border-radius:12px;color:var(--wh);font-size:14px;font-weight:600">${isEdit ? 'Save Changes' : 'Add Standard'}</button>
            <button data-action="cancel-std-form" style="flex:1;padding:14px 16px;border:1px solid var(--bd);border-radius:12px;color:var(--mu);font-size:14px;font-weight:500;">Cancel</button>
        </div>
    </div>`;
}

function saveStd(id) {
    vib();
    const title = document.getElementById('stdTitle').value.trim();
    if (!title) { showAlert("Title is required."); return; }
    
    const aim = parseInt(document.getElementById('stdAim').value) || 0;
    const max = parseInt(document.getElementById('stdMax').value) || 0;
    const text = document.getElementById('stdText').value.trim();
    
    if (id) {
        const s = S.standards.find(x => x.id === id);
        if (s) { s.title = title; s.aim = aim; s.max = max; s.text = text; }
    } else {
        S.standards.push({ id: 'std_' + Date.now(), title, aim, max, text });
    }
    
    S.showStdForm = false; S.editStdId = null; save(); R();
}

function delStd(id) { showConfirm('Delete this standard?', () => { S.standards = S.standards.filter(s => s.id !== id); save(); R(); }); }

// Breeds
function renderBreeds() {
    const breeds = Object.keys(S.breedNotes).sort();
    const showForm = S.showBreedForm, editKey = S.editBreedKey;
    
    return `
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-size:11px;letter-spacing:1.5px;color:var(--lv);text-transform:uppercase;font-weight:600;display:flex;align-items:center;gap:6px">${IC('notebook')} Your Breed Notes</div>
            ${!showForm && !editKey ? `<button data-action="show-breed-form" style="padding:8px 16px;background:var(--rg);border:1px solid var(--ro);border-radius:10px;color:var(--rd);font-size:13px;font-weight:600">+ Add Breed</button>` : ''}
        </div>

        ${showForm ? renderBreedForm(null) : ''}
        ${breeds.length === 0 && !showForm ? `<div style="text-align:center;padding:30px 20px;color:var(--di);font-size:14px">No breed notes yet. Tap "+ Add Breed" to start.</div>` : ''}
        
        ${breeds.map(b => {
            const n = S.breedNotes[b];
            if(editKey === b) return renderBreedForm(b);
            return `
            <div style="padding:14px 0;border-bottom:1px solid var(--bl)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-size:16px;font-weight:600;text-transform:capitalize;color:var(--tx)">${esc(b)}</span>
                    <div>
                        <button data-action="edit-breed" data-key="${esc(b)}" style="font-size:13px;color:var(--ro);margin-right:12px;font-weight:600;">Edit</button>
                        <button data-action="del-breed" data-key="${esc(b)}" style="font-size:16px;color:var(--di);font-weight:bold;">×</button>
                    </div>
                </div>
                
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                    ${n.blade ? `<span style="background:var(--ca);border-radius:8px;padding:4px 10px;font-size:12px;color:var(--tm);font-weight:500;">Blade: ${esc(n.blade)}</span>` : ''}
                    ${n.comb ? `<span style="background:var(--ca);border-radius:8px;padding:4px 10px;font-size:12px;color:var(--tm);font-weight:500;">Comb: ${esc(n.comb)}</span>` : ''}
                    ${n.targetMin ? `<span style="background:var(--ca);border-radius:8px;padding:4px 10px;font-size:12px;color:var(--tm);font-weight:500;">Target: ${n.targetMin}m</span>` : ''}
                </div>
                ${n.notes ? `<div style="font-size:13px;color:var(--mu);line-height:1.5;margin-top:6px;">${esc(n.notes)}</div>` : ''}
            </div>`;
        }).join('')}
    </div>`;
}

function renderBreedForm(existingKey) {
    const isEdit = !!existingKey;
    const n = isEdit ? S.breedNotes[existingKey] : {blade:'', comb:'', targetMin:0, notes:''};
    return `
    <div style="padding:18px;background:var(--ca);border-radius:14px;margin-bottom:16px;border:1px solid ${isEdit ? 'var(--lv)' : 'var(--ro)'}40">
        <div style="font-size:13px;font-weight:600;color:${isEdit ? 'var(--lv)' : 'var(--rd)'};margin-bottom:14px;display:flex;align-items:center;gap:6px">${isEdit ? IC('pencil') + ' Edit ' + esc(existingKey) : IC('dog') + ' New Breed'}</div>
        
        ${!isEdit ? `<div style="margin-bottom:14px"><label class="lbl" for="bnName">Breed Name *</label><input class="inp" id="bnName" placeholder="e.g. Shih Tzu" list="breedList"></div>` : ''}
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
            <div><label class="lbl" for="bnBlade">Blade</label><input class="inp" id="bnBlade" placeholder="e.g. #7F" value="${esc(n.blade)}"></div>
            <div><label class="lbl" for="bnComb">Guard Comb</label><input class="inp" id="bnComb" placeholder="e.g. #1" value="${esc(n.comb)}"></div>
        </div>
        
        <div style="margin-bottom:14px"><label class="lbl" for="bnTarget">Target Time (min)</label><input class="inp" id="bnTarget" type="number" inputmode="numeric" placeholder="e.g. 35" value="${n.targetMin || ''}"></div>
        <div style="margin-bottom:16px"><label class="lbl" for="bnNotes">Style Notes / Tips</label><input class="inp" id="bnNotes" placeholder="e.g. Round head, fuller legs" value="${esc(n.notes)}"></div>
        
        <div style="display:flex;gap:12px">
            <button data-action="save-breed" ${isEdit ? `data-key="${esc(existingKey)}"` : ''} style="flex:2;padding:14px;background:${isEdit ? 'var(--lv)' : 'var(--ro)'};border-radius:12px;color:var(--wh);font-size:14px;font-weight:600">${isEdit ? 'Save Changes' : 'Add Breed'}</button>
            <button data-action="cancel-breed-form" style="flex:1;padding:14px 16px;border:1px solid var(--bd);border-radius:12px;color:var(--mu);font-size:14px;font-weight:500;">Cancel</button>
        </div>
    </div>`;
}

function saveBreedNote(existingKey) {
    vib();
    let key = existingKey;
    if (!key) {
        const nameEl = document.getElementById('bnName');
        if (!nameEl || !nameEl.value.trim()) { showAlert('Please enter a breed name'); return; }
        key = nameEl.value.trim().toLowerCase();
    }
    S.breedNotes[key] = {
        blade: document.getElementById('bnBlade').value.trim(),
        comb: document.getElementById('bnComb').value.trim(),
        targetMin: parseInt(document.getElementById('bnTarget').value) || 0,
        notes: document.getElementById('bnNotes').value.trim()
    };
    S.showBreedForm = false; S.editBreedKey = null; save(); R();
}
function delBreed(b) { showConfirm('Delete notes for ' + b + '?', () => { delete S.breedNotes[b]; save(); R(); }); }

function renderGoals() {
    const a = getAvg(); 
    return `
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div style="font-size:11px;letter-spacing:1.5px;color:var(--hn);text-transform:uppercase;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:6px">${IC('target')} Your Goals</div>
        
        <div style="margin-bottom:20px"><label class="lbl" for="gD">Dogs Per Day Target</label><input class="inp" id="gD" type="number" inputmode="numeric" value="${S.goals.dogsPerDay || ''}" placeholder="e.g. 8" onchange="S.goals.dogsPerDay=Math.max(0,parseInt(this.value)||0);save()"></div>
        <div style="margin-bottom:20px"><label class="lbl" for="gA">Average Groom Time Target (min)</label><input class="inp" id="gA" type="number" inputmode="numeric" value="${S.goals.avgTarget || ''}" placeholder="e.g. 35" onchange="S.goals.avgTarget=Math.max(0,parseInt(this.value)||0);save()"></div>
        
        <div style="padding:16px;background:var(--ca);border-radius:14px">
            <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--tx)">Progress Snapshot</div>
            <div style="font-size:14px;color:var(--tm);line-height:1.7">
                <p style="margin-bottom:6px;">Current average: <strong style="color:var(--tx)">${a ? a + 'm' : 'No data'}</strong>${S.goals.avgTarget ? ` (goal: ${S.goals.avgTarget}m ${a && a <= S.goals.avgTarget ? IC('check') : ''})` : ''}</p>
                <p style="margin-bottom:6px;">This week: <strong style="color:var(--tx)">${weekLogs().length} dogs</strong>${S.goals.dogsPerDay ? ` (daily goal: ${S.goals.dogsPerDay})` : ''}</p>
                <p>Total logged: <strong style="color:var(--tx)">${S.logs.length}</strong></p>
                ${S.goals.avgTarget && a ? `<p style="margin-top:10px;font-weight:600;font-size:13px;padding-top:10px;border-top:1px solid var(--bl);color:${a <= S.goals.avgTarget ? 'var(--sg)' : 'var(--hn)'}">You are ${a <= S.goals.avgTarget ? 'meeting your time goal!' : Math.abs(a - S.goals.avgTarget) + 'm away from goal.'}</p>` : ''}
            </div>
        </div>
    </div>`;
}

// 6. ME (Profile & History)
function renderMe() {
    const sub = S.sub2 || 'achievements';
    return `
    <div style="padding-top:28px">
        <h2 style="font-size:26px;margin-bottom:18px">Profile</h2>
        <div style="display:flex;gap:6px;margin-bottom:20px;background:var(--ca);padding:6px;border-radius:14px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
            ${[
                {k:'achievements', i:'trophy', l:'Awards'},
                {k:'dogs', i:'dog', l:'Dogs'},
                {k:'checklist', i:'check', l:'Prep'},
                {k:'stats', i:'chart', l:'Stats'}
            ].map(t => `<button class="sub-tab ${sub === t.k ? 'on' : ''}" style="flex:1;padding:12px 6px;min-width:70px;display:inline-flex;align-items:center;justify-content:center;gap:5px;" data-action="set-sub2" data-sub2="${esc(t.k)}">${IC(t.i)} ${t.l}</button>`).join('')}
        </div>
        ${sub === 'achievements' ? renderAch() : sub === 'dogs' ? renderDogs() : sub === 'checklist' ? renderChecklist() : renderStats()}
    </div>`;
}

function renderAch() {
    return `
    <div class="c" style="padding:20px">
        <div style="font-size:11px;letter-spacing:1.5px;color:var(--lv);text-transform:uppercase;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:6px">${IC('medal')} ${ACH.filter(a => a.ck(S)).length}/${ACH.length} Earned</div>
        ${ACH.map(a => {
            const e = a.ck(S);
            return `
            <div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--bl)">
                <span style="font-size:24px;color:${e ? 'var(--ro)' : 'var(--di)'};${e ? '' : 'opacity:.4'}">${IC(a.e)}</span>
                <div style="flex:1">
                    <div style="font-size:14px;font-weight:600;color:${e ? 'var(--tx)' : 'var(--di)'};margin-bottom:2px;">${a.t}</div>
                    <div style="font-size:12px;color:var(--mu)">${a.d}</div>
                </div>
                ${e ? `<span style="color:var(--sg);font-size:18px">${IC('check')}</span>` : `<span style="color:var(--di);font-size:15px">${IC('lock')}</span>`}
            </div>`;
        }).join('')}
    </div>`;
}

function renderDogs() {
    if (S.viewDog) return renderDogDetail(S.viewDog);
    
    const nm = {};
    S.logs.forEach(l => {
        if (!l.dogName) return;
        const k = l.dogName.toLowerCase();
        if (!nm[k]) nm[k] = { name: l.dogName, breed: l.breed, count: 0, best: Infinity, last: 0, lastDate: '' };
        nm[k].count++;
        if (l.min < nm[k].best) nm[k].best = l.min;
        if (l.ts > nm[k].last) { nm[k].last = l.ts; nm[k].lastDate = l.date; nm[k].breed = l.breed; }
    });
    
    const dogs = Object.values(nm).sort((a,b) => b.last - a.last);
    const rpt = dogs.filter(d => d.count >= 2);
    const one = dogs.filter(d => d.count === 1);
    
    return `
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div style="font-size:11px;letter-spacing:1.5px;color:var(--lv);text-transform:uppercase;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:6px">${IC('dog')} Dog History</div>

        ${dogs.length === 0 ? `<div class="empty"><div class="empty-icon">${IC('dog')}</div><div class="empty-title">No dogs logged yet</div><div class="empty-sub">Add a Dog & Last Name when logging to track returning clients over time.</div><button data-action="go-log-form" class="btn-primary" style="max-width:240px;margin:0 auto">Log a Groom</button></div>` : ''}
        
        ${rpt.length ? `
        <div style="font-size:12px;color:var(--mu);margin-bottom:12px;font-weight:600">RETURNING CLIENTS (${rpt.length})</div>
        ${rpt.map(d => `
        <button data-action="view-dog-me" data-name="${esc(d.name)}" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--bl);text-align:left">
            <div>
                <div style="font-size:15px;font-weight:600;color:var(--tx)">${esc(d.name)}</div>
                <div style="font-size:12px;color:var(--mu)">${d.breed ? esc(d.breed) + ' · ' : ''}${d.count} visits</div>
            </div>
            <div style="text-align:right">
                <div style="font-family:Fraunces,serif;font-size:16px;font-weight:600;color:${tc(d.best)}">Best: ${d.best}m</div>
                <div style="font-size:11px;color:var(--di)">${esc(d.lastDate)}</div>
            </div>
        </button>`).join('')}` : ''}
        
        ${one.length ? `
        <div style="font-size:12px;color:var(--mu);margin-bottom:12px;margin-top:${rpt.length ? '20px' : '0'};font-weight:600">ONE-TIME CLIENTS (${one.length})</div>
        ${one.map(d => `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--bl)">
            <span style="font-size:14px;font-weight:500">${esc(d.name)}${d.breed ? ` <span style="color:var(--mu);font-size:12px">${esc(d.breed)}</span>` : ''}</span>
            <span style="font-size:13px;color:var(--mu)">${d.best}m</span>
        </div>`).join('')}` : ''}
    </div>`;
}

function renderDogDetail(name) {
    const hist = getDogHistory(name);
    if (!hist.length) { S.viewDog = null; return renderDogs(); }
    
    const best = Math.min(...hist.map(l => l.min));
    const worst = Math.max(...hist.map(l => l.min));
    const avg = Math.round(hist.reduce((a,l) => a + l.min, 0) / hist.length);
    const imp = hist.length >= 2 && hist[0].min < hist[1].min;
    
    const secs = SECT_KEYS.map(x => x.k);
    const secN = Object.fromEntries(SECT_KEYS.map(x => [x.k, x.n]));
    const secAvg = {};
    
    secs.forEach(s => {
        const vals = hist.map(l => {
            if (l.sect && l.sect[s]) return l.sect[s];
            if (l[s]) return l[s] * 60;
            return 0;
        }).filter(v => v > 0);
        secAvg[s] = vals.length ? Math.round(vals.reduce((a, x) => a + x, 0) / vals.length) : 0;
    });

    return `
    <div>
        <button data-action="clear-view-dog" style="display:flex;align-items:center;gap:6px;font-size:14px;color:var(--ro);font-weight:600;margin-bottom:16px">${IC('arrowL')} All Dogs</button>
        
        <div class="c" style="padding:20px;margin-bottom:16px">
            <div style="text-align:center;margin-bottom:16px">
                <div style="font-size:26px;margin-bottom:6px;color:var(--lv)">${IC('dog')}</div>
                <h2 style="font-size:22px">${esc(name)}</h2>
                <div style="font-size:13px;color:var(--mu);margin-top:4px">${hist[0].breed ? esc(hist[0].breed) + ' · ' : ''}${hist.length} visits</div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
                <div style="text-align:center;padding:12px;background:var(--bg);border-radius:12px">
                    <div style="font-family:Fraunces,serif;font-size:20px;font-weight:600;color:var(--sg)">${best}m</div>
                    <div style="font-size:10px;color:var(--di);margin-top:2px">Best</div>
                </div>
                <div style="text-align:center;padding:12px;background:var(--bg);border-radius:12px">
                    <div style="font-family:Fraunces,serif;font-size:20px;font-weight:600">${avg}m</div>
                    <div style="font-size:10px;color:var(--di);margin-top:2px">Avg</div>
                </div>
                <div style="text-align:center;padding:12px;background:var(--bg);border-radius:12px">
                    <div style="font-family:Fraunces,serif;font-size:20px;font-weight:600;color:var(--co)">${worst}m</div>
                    <div style="font-size:10px;color:var(--di);margin-top:2px">Slowest</div>
                </div>
            </div>
            
            ${hist.length >= 2 ? `
            <div style="padding:12px;background:${imp ? 'var(--ss)' : 'var(--hs)'};border-radius:12px;text-align:center;font-size:14px;font-weight:600;color:${imp ? 'var(--sg)' : 'var(--hn)'}">
                ${imp ? IC('trend') + ' Getting faster! Last was ' + Math.abs(hist[0].min - hist[1].min) + 'm quicker' : IC('chart') + ' Last was ' + (hist[0].min === hist[1].min ? 'same speed' : Math.abs(hist[0].min - hist[1].min) + 'm ' + (hist[0].min > hist[1].min ? 'slower' : 'faster'))}
            </div>` : ''}
        </div>
        
        ${Object.values(secAvg).some(v => v > 0) ? `
        <div class="c" style="padding:20px;margin-bottom:16px">
            <div style="font-size:11px;letter-spacing:1.5px;color:var(--hn);text-transform:uppercase;font-weight:600;margin-bottom:14px">Avg Section Times</div>
            ${secs.filter(s => secAvg[s] > 0).map(s => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bl)">
                <span style="font-size:14px;color:var(--tm)">${secN[s]}</span>
                <span style="font-size:14px;font-weight:600">${fmtDurSec(secAvg[s])} avg</span>
            </div>`).join('')}
        </div>` : ''}
        
        <div class="c" style="padding:20px;margin-bottom:16px">
            <div style="font-size:11px;letter-spacing:1.5px;color:var(--co);text-transform:uppercase;font-weight:600;margin-bottom:14px">Visit History</div>
            ${hist.length >= 2 ? `<div style="margin-bottom:16px">${renderChart(hist.slice().reverse())}</div>` : ''}
            
            ${hist.map((l,i) => {
                const prev = hist[i+1], diff = prev ? (l.min - prev.min) : null;
                const tags = sectionTags(l);
                
                return `
                <div style="padding:14px 0;border-bottom:1px solid var(--bl)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <div style="font-size:13px;color:var(--mu);display:inline-flex;align-items:center;gap:4px">${esc(l.date)}${l.timed ? `<span style="color:var(--ro)">${IC('stopwatch')}</span>` : ''} ${l.diff >= 2 ? diffDot(l.diff) : ''}</div>
                        <div style="display:flex;align-items:center;gap:8px">
                            ${diff !== null ? `<span style="font-size:12px;font-weight:600;color:${diff < 0 ? 'var(--sg)' : diff > 0 ? 'var(--co)' : 'var(--mu)'}">${diff < 0 ? '▼' : '▲'}${Math.abs(diff)}m</span>` : ''}
                            <span style="font-family:Fraunces,serif;font-size:18px;font-weight:600;color:${tc(l.min)}">${l.min}m</span>
                        </div>
                    </div>
                    ${tags.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${tags.map(t => `<span class="tag tag-sect">${esc(t)}</span>`).join('')}</div>` : ''}
                    ${hasSectionData(l) ? renderSectionBreakdown(l) : ''}
                    ${(l.before || l.after) ? `<div style="display:flex;gap:8px;margin-top:8px;align-items:center">${l.before ? `<button data-action="show-photo" data-logid="${l.id}" data-which="B" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(l.before, 'photo-thumb')}</button>` : ''} ${l.after ? `<button data-action="show-photo" data-logid="${l.id}" data-which="A" style="padding:0;background:none;border:none;cursor:pointer;">${photoThumb(l.after, 'photo-thumb')}</button>` : ''} ${(l.before && l.after) ? `<button class="btn-ghost" data-action="share-photos" data-id="${l.id}" style="display:inline-flex;align-items:center;gap:5px">${IC('share')} Share</button>` : ''}</div>` : ''}
                    ${l.notes ? `<div style="font-size:12px;color:var(--di);margin-top:6px;font-style:italic">"${esc(l.notes)}"</div>` : ''}
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

function renderChecklist() {
    const d = dk();
    return `
    <div class="c">
        <div class="sec-lbl" style="color:var(--sg);display:flex;align-items:center;gap:6px">${IC('check')} Prep — ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</div>
        ${CHK.map(item => {
            const k = d + '_' + item.id, on = !!S.chk[k];
            return `
            <div class="chk-row ${on ? 'done' : ''}" data-action="toggle-chk" data-key="${esc(k)}">
                <button class="chk ${on ? 'on' : ''}">${on ? IC('check') : ''}</button>
                <span style="font-size:15px">${item.t}</span>
            </div>`;
        }).join('')}
    </div>`;
}

function sectionAverages() {
    const sums = {}, counts = {};
    let logsWith = 0;
    S.logs.forEach(l => {
        if (!hasSectionData(l)) return;
        logsWith++;
        SECT_KEYS.forEach(({ k }) => {
            const sec = (l.sect && l.sect[k]) || (l[k] ? l[k] * 60 : 0);
            if (sec > 0) { sums[k] = (sums[k] || 0) + sec; counts[k] = (counts[k] || 0) + 1; }
        });
    });
    if (logsWith < 3) return null;
    const avgs = SECT_KEYS.map(({ k, n }) => counts[k] ? { k, n, avg: Math.round(sums[k] / counts[k]) } : null).filter(Boolean);
    return avgs.length >= 2 ? avgs : null;
}

function breedTrends() {
    const byBreed = {};
    S.logs.forEach(l => {
        const k = (l.breed || '').toLowerCase();
        if (k) (byBreed[k] = byBreed[k] || []).push(l);
    });
    const out = [];
    Object.values(byBreed).forEach(logs => {
        if (logs.length < 4) return;
        const sorted = logs.slice().sort((a, b) => a.ts - b.ts);
        const half = Math.floor(sorted.length / 2);
        const avg = arr => arr.reduce((a, l) => a + l.min, 0) / arr.length;
        out.push({
            breed: sorted[0].breed,
            count: logs.length,
            delta: Math.round(avg(sorted.slice(0, half)) - avg(sorted.slice(half)))
        });
    });
    return out.sort((a, b) => b.delta - a.delta).slice(0, 3);
}

function renderInsights() {
    const secAvgs = sectionAverages();
    const trends = breedTrends();
    let html = '';
    if (secAvgs) {
        const total = secAvgs.reduce((a, s) => a + s.avg, 0);
        const top = secAvgs.slice().sort((a, b) => b.avg - a.avg)[0];
        html += `
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div class="sec-lbl" style="color:var(--lv);display:flex;align-items:center;gap:6px">${IC('bulb')} Where Your Time Goes</div>
        <p style="font-size:13px;color:var(--tm);line-height:1.5;margin-bottom:12px"><strong>${top.n}</strong> is your biggest step — ${fmtDurSec(top.avg)} on average (${Math.round(top.avg / total * 100)}% of a typical groom). Trimming minutes there moves your times the most.</p>
        ${secAvgs.map(s => `
        <div class="section-row"><span>${s.n}</span><strong>${fmtDurSec(s.avg)}</strong></div>
        <div class="section-bar-wrap"><div class="section-bar" style="width:${Math.round(s.avg / top.avg * 100)}%"></div></div>`).join('')}
    </div>`;
    }
    if (trends.length) {
        html += `
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div class="sec-lbl" style="color:var(--sg);display:flex;align-items:center;gap:6px">${IC('trend')} Breed Progress</div>
        ${trends.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bl)">
            <div>
                <div style="font-size:14px;font-weight:600;text-transform:capitalize">${esc(t.breed)}</div>
                <div style="font-size:11px;color:var(--di)">${t.count} grooms</div>
            </div>
            <span style="font-size:13px;font-weight:700;color:${t.delta > 0 ? 'var(--sg)' : t.delta < 0 ? 'var(--co)' : 'var(--mu)'}">${t.delta > 0 ? '▼ ' + t.delta + 'm faster' : t.delta < 0 ? '▲ ' + Math.abs(t.delta) + 'm slower' : '— steady'}</span>
        </div>`).join('')}
        <p style="font-size:11px;color:var(--di);margin-top:10px;line-height:1.5">Compares your early grooms to your recent ones, per breed (4+ grooms).</p>
    </div>`;
    }
    return html;
}

function renderStats() {
    const p = pbs(), a = getAvg();
    const emptyStats = !S.logs.length;

    return `
    ${emptyStats ? `
    <div class="empty" style="padding:32px 20px">
        <div class="empty-icon">${IC('chart')}</div>
        <div class="empty-title">No stats on this device yet</div>
        <div class="empty-sub">Your grooms live in this phone's storage — opening the folder on a PC starts fresh. Restore a backup below, or start tracking here.</div>
        <button data-action="go-tab" data-tab="timer" class="btn-primary" style="max-width:260px;margin:0 auto 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px">${IC('stopwatch')} Start Tracking</button>
    </div>` : `
    ${p.length ? `
    <div class="c" style="padding:20px;margin-bottom:16px">
        <div class="sec-lbl" style="color:var(--hn);display:flex;align-items:center;gap:6px">${IC('trophy')} Bests</div>
        ${p.map((l,i) => `
        <div style="display:flex;justify-content:space-between;padding:10px 0;${i < p.length-1 ? 'border-bottom:1px solid var(--bl)' : ''}">
            <span style="font-size:15px;font-weight:500;text-transform:capitalize">${esc(l.breed)}</span>
            <span style="font-family:Fraunces,serif;font-size:18px;font-weight:600;color:${tc(l.min)}">${l.min}m</span>
        </div>`).join('')}
    </div>` : ''}
    
    <div class="c" style="padding:20px;margin-bottom:20px">
        <div class="sec-lbl" style="color:var(--co);display:flex;align-items:center;gap:6px">${IC('chart')} Overall</div>
        <div style="font-size:14px;color:var(--tm);line-height:1.8">
            <p>Total: <strong>${S.logs.length}</strong> · Breeds: <strong>${new Set(S.logs.map(l => (l.breed || '').toLowerCase()).filter(Boolean)).size}</strong> · Dogs: <strong>${getDogNames().length}</strong></p>
            <p>Avg: <strong>${a ? a + 'm' : '—'}</strong> · Best: <strong style="color:var(--sg)">${Math.min(...S.logs.map(l => l.min))}m</strong></p>
            <p>Timed: <strong>${S.logs.filter(l => l.timed).length}</strong> · Photos: <strong>${S.logs.filter(l => l.before || l.after).length}</strong></p>
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bl);display:flex;gap:14px">
                <span style="display:inline-flex;align-items:center;gap:5px">${diffDot(1)} ${S.logs.filter(l => l.diff === 1).length}</span>
                <span style="display:inline-flex;align-items:center;gap:5px">${diffDot(2)} ${S.logs.filter(l => l.diff === 2).length}</span>
                <span style="display:inline-flex;align-items:center;gap:5px">${diffDot(3)} ${S.logs.filter(l => l.diff === 3).length}</span>
            </div>
        </div>
    </div>
    ${renderInsights()}`}
    
    <div class="c" style="padding:20px;margin-bottom:20px">
        <div class="sec-lbl" style="color:var(--lv);display:flex;align-items:center;gap:6px">${IC('palette')} Appearance</div>
        <div style="display:flex;gap:6px">
            ${[{k:'auto', i:'phone', l:'Auto'}, {k:'light', i:'sun', l:'Light'}, {k:'dark', i:'moon', l:'Dark'}].map(t =>
                `<button class="pill ${S.theme === t.k ? 'on' : ''}" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px" data-action="set-theme" data-theme="${t.k}">${IC(t.i)} ${t.l}</button>`).join('')}
        </div>
        <p style="font-size:12px;color:var(--di);margin-top:10px;line-height:1.5">Auto follows your phone's setting.</p>
    </div>

    <div class="c" style="padding:20px;margin-bottom:20px">
        <div class="sec-lbl" style="color:var(--di);display:flex;align-items:center;gap:6px">${IC('disk')} Backup & Restore</div>
        <p style="font-size:13px;color:var(--mu);line-height:1.5;margin-bottom:12px">Move your data between devices: Save on your phone, Restore here (or vice versa).</p>
        <div style="display:flex;gap:10px;margin-bottom:10px">
            <button data-action="export-data" class="btn-secondary" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px">${IC('download')} Save Backup</button>
            <label class="btn-secondary" style="flex:1;text-align:center;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
                ${IC('upload')} Restore<input type="file" accept=".json" style="display:none" onchange="importData(event)">
            </label>
        </div>
    </div>

    <div class="c" style="padding:20px;margin-bottom:20px">
        <div class="sec-lbl" style="color:var(--sg);display:flex;align-items:center;gap:6px">${IC('phone')} Install App</div>
        <div style="font-size:13px;color:var(--tm);line-height:1.6">
            <p><strong>iPhone (Safari):</strong> Share → Add to Home Screen</p>
            <p style="margin-top:8px"><strong>Android (Chrome):</strong> Menu → Install app</p>
        </div>
    </div>
    
    <div style="text-align:center;padding:10px 20px 40px">
        <div style="font-size:11px;color:var(--di);margin-bottom:8px">GroomPace v${APP_VERSION}</div>
        <button data-action="reset-all" style="font-size:13px;color:var(--di);text-decoration:underline;padding:10px">Reset All Data</button>
    </div>`;
}

// ── Before/After Share Image ──
function loadImg(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image failed to load'));
        img.src = src;
    });
}

// drawImage with cover-crop: fills the destination rect, cropping overflow
function coverDraw(ctx, img, dx, dy, dw, dh) {
    const ir = img.width / img.height, dr = dw / dh;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (ir > dr) { sw = img.height * dr; sx = (img.width - sw) / 2; }
    else { sh = img.width / dr; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function rrPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

async function shareBeforeAfter(id) {
    vib();
    const l = S.logs.find(x => x.id === id);
    if (!l || !l.before || !l.after) return;
    try {
        const [bSrc, aSrc] = await Promise.all([loadPhoto(l.before), loadPhoto(l.after)]);
        if (!bSrc || !aSrc) { showToast('Could not load those photos.', 'error'); return; }
        try { await document.fonts.ready; } catch (e) {}
        const [bImg, aImg] = await Promise.all([loadImg(bSrc), loadImg(aSrc)]);

        const W = 1080, H = 1350, PH = 1020; // 4:5 portrait; photos fill top 1020px
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#FBF7F2';
        ctx.fillRect(0, 0, W, H);
        coverDraw(ctx, bImg, 0, 0, W / 2 - 3, PH);
        coverDraw(ctx, aImg, W / 2 + 3, 0, W / 2 - 3, PH);

        const pill = (text, x) => {
            ctx.font = '700 30px "DM Sans", sans-serif';
            const w = ctx.measureText(text).width + 48;
            ctx.fillStyle = 'rgba(46,38,39,0.65)';
            rrPath(ctx, x, 28, w, 56, 28);
            ctx.fill();
            ctx.fillStyle = '#FFF';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x + 24, 58);
            ctx.textBaseline = 'alphabetic';
        };
        pill('BEFORE', 28);
        pill('AFTER', W / 2 + 31);

        const title = [l.dogName, l.breed].filter(Boolean).join(' · ') || l.style || 'Fresh groom';
        ctx.fillStyle = '#2E2627';
        ctx.font = '600 54px "Fraunces", Georgia, serif';
        ctx.fillText(title, 48, PH + 96, W - 340);
        ctx.fillStyle = '#8E7C7F';
        ctx.font = '400 32px "DM Sans", sans-serif';
        ctx.fillText(l.date || '', 48, PH + 150);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#B8667E';
        ctx.font = '600 84px "Fraunces", Georgia, serif';
        ctx.fillText(l.min + 'm', W - 48, PH + 118);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#D4849A';
        ctx.font = '600 30px "DM Sans", sans-serif';
        ctx.fillText('🐾 Tracked with GroomPace', 48, H - 56);

        const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
        if (!blob) throw new Error('Canvas produced no image');
        const fname = 'GroomPace_' + (l.dogName || l.breed || 'groom').replace(/[^a-z0-9]+/gi, '_') + '.jpg';
        const file = new File([blob], fname, { type: 'image/jpeg' });

        // Native OS share sheet (WKWebView has no navigator.share with files).
        if (await nativeShareFile(blob, fname, 'Before & After', `${title} — ${l.min} minute groom ✂️`)) return;

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: 'Before & After', text: `${title} — ${l.min} minute groom ✂️` });
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return; // user closed the share sheet
                console.warn('Native share failed, falling back to download:', err);
            }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Image downloaded — post that transformation! 🐾', 'info', 5000);
    } catch (err) {
        console.error('Share image failed:', err);
        showToast('Could not create the share image.', 'error');
    }
}

async function exportData() {
    vib();
    try {
        const resolvedLogs = await Promise.all(S.logs.map(async l => ({
            ...l,
            before: l.before && l.before.startsWith?.('idb:') ? await loadPhoto(l.before) : l.before,
            after:  l.after  && l.after.startsWith?.('idb:')  ? await loadPhoto(l.after)  : l.after
        })));
        const payload = { ...S, logs: resolvedLogs, schemaVersion: SCHEMA_VERSION };
        delete payload.timerBeforePhoto;
        const json = JSON.stringify(payload);
        const blob = new Blob([json], { type: 'application/json' });
        const fname = 'GroomPace_Backup_' + dk() + '.json';

        // Native: share the backup via the OS sheet (WKWebView has no <a download>).
        if (await nativeShareFile(blob, fname, 'GroomPace Backup', 'My GroomPace backup')) {
            showToast('Backup ready to save or send 🐾', 'info', 3000);
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Backup downloaded 🐾', 'info', 3000);
    } catch (err) {
        console.error('Export failed:', err);
        showToast('Could not create backup. Try again or restart the app.', 'error');
    }
}

function sanitizeImport(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!Array.isArray(raw.logs)) return null;
    
    const clean = {
        logs: raw.logs
            .filter(l => l && typeof l === 'object' && typeof l.breed === 'string' && typeof l.min === 'number')
            .map(l => ({
                id: Number(l.id) || Date.now() + Math.random(),
                ts: Number(l.ts) || Date.now(),
                date: String(l.date || ''),
                dogName: String(l.dogName || ''),
                breed: String(l.breed || ''),
                style: String(l.style || ''),
                size: ['small','medium','large'].includes(l.size) ? l.size : 'medium',
                min: Math.max(0, Number(l.min) || 0),
                // Every known step, current and retired, so a restore never
                // drops recorded times (invariant: import must stay lossless).
                ...Object.fromEntries(SECT_KEYS.map(({ k }) => [k, Math.max(0, Number(l[k]) || 0)])),
                diff: [1,2,3].includes(l.diff) ? l.diff : 1,
                notes: String(l.notes || ''),
                timed: !!l.timed,
                before: (typeof l.before === 'string' && l.before.startsWith('data:image/')) ? l.before : null,
                after:  (typeof l.after  === 'string' && l.after.startsWith('data:image/')) ? l.after : null,
                sect: (l.sect && typeof l.sect === 'object' && !Array.isArray(l.sect)) ? l.sect : null
            })),
        chk: (raw.chk && typeof raw.chk === 'object' && !Array.isArray(raw.chk)) ? raw.chk : {},
        breedNotes: (raw.breedNotes && typeof raw.breedNotes === 'object' && !Array.isArray(raw.breedNotes)) ? raw.breedNotes : {},
        goals: {
            dogsPerDay: Math.max(0, Number(raw.goals?.dogsPerDay) || 0),
            avgTarget:  Math.max(0, Number(raw.goals?.avgTarget)  || 0)
        },
        standards: Array.isArray(raw.standards) ? raw.standards.filter(s => s && typeof s === 'object' && typeof s.title === 'string') : [],
        onboarded: !!raw.onboarded
    };
    return clean;
}

function importData(e) {
    vib();
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    
    if (file.size > 20 * 1024 * 1024) {
        showToast('File is too large to import (over 20MB).', 'error', 6000);
        return;
    }
    
    showConfirm('Replace all current data with this backup?', () => {
        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const raw = JSON.parse(event.target.result);
                const clean = sanitizeImport(raw);
                if (!clean) {
                    showToast('That file doesn\'t look like a GroomPace backup.', 'error', 6000);
                    return;
                }
                for (const log of clean.logs) {
                    if (log.before && log.before.startsWith?.('data:image/')) {
                        log.before = await savePhoto(log.before);
                    }
                    if (log.after && log.after.startsWith?.('data:image/')) {
                        log.after = await savePhoto(log.after);
                    }
                }
                Object.assign(S, clean);
                save();
                hydratePhotosForView();
                R();
                showToast(`Restored ${clean.logs.length} grooms 🐾`, 'info', 4000);
            } catch(err) {
                console.error('Import failed:', err);
                showToast('Could not read that file. Is it valid JSON?', 'error', 6000);
            }
        };
        reader.onerror = function() {
            showToast('Could not read the file.', 'error', 6000);
        };
        reader.readAsText(file);
    });
}

// ── Background / Visibility Handling ──
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && S.timerRunning && !S.timerPausedAt) {
        paintTimer();
        tick();
    }
});

window.addEventListener('pageshow', () => {
    if (S.timerRunning && !S.timerPausedAt) {
        paintTimer();
        tick();
    }
});

window.addEventListener('beforeunload', () => {
    try { save(); } catch(e) {}
});

// ── PWA Service Worker Registration ──
// Only on the web. Inside the Capacitor wrapper the assets are bundled locally
// and iOS WKWebView doesn't support SW on the capacitor:// scheme — a SW there
// is pure downside (could only serve stale copies), so we skip it.
if ('serviceWorker' in navigator && !isNative()) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
    });
}

// ── Init ──
function boot() {
    load();
    applyTheme();
    // Manifest shortcuts ("Start Timer" / "Log a Groom" on the app icon) deep-link
    // via ?tab=. Whitelisted, and only once the user is onboarded.
    const _qTab = new URLSearchParams(location.search).get('tab');
    if (_qTab && ['home','timer','log','tools','me'].includes(_qTab) && S.onboarded) S.tab = _qTab;
    _prevTab = S.tab;
    R();
    if (S.timerRunning && !S.timerPausedAt) tick();
    hydratePhotosForView();
    // If native restore just rescued data from the device mirror, tell the user.
    if (_pendingRestoreToast) { _pendingRestoreToast = false; showToast('Restored your grooms from device backup 🐾', 'info', 5000); }
    // "You got the update" nudge: compare against the last version this device saw.
    // (SW controllerchange is racy — on fast loads the new worker activates before
    // this script even evaluates — so a version stamp is the reliable signal.)
    try {
        const _lastV = localStorage.getItem('groompace-last-version');
        if (_lastV && _lastV !== APP_VERSION && S.onboarded) {
            showToast(`GroomPace updated to v${APP_VERSION} ✂️`, 'info', 5000);
        }
        localStorage.setItem('groompace-last-version', APP_VERSION);
    } catch (e) {}
    // Kick off the weekly native photo backup (no-op on web / if run recently).
    nativeFullBackup();
}

// Web boots synchronously (path unchanged). Native tries a device restore first,
// then boots the same way — boot() always runs regardless of restore outcome.
if (isNative()) {
    nativeRestoreIfEmpty().catch(() => {}).finally(boot);
} else {
    boot();
}