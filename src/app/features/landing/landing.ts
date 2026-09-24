import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl, Title } from '@angular/platform-browser';
import { ThemeService } from '../../core/services/theme.service';

type Lang = 'en' | 'ta';

interface ShowcaseProduct {
  key: string;
  icon: SafeHtml;
}

interface LandingCopy {
  nav: { tagline: string; call: string; langToggleLabel: string };
  hero: {
    badge: string;
    titleLine1: string;
    titleLine2: string;
    tagline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    chipGstin: string;
    chipInvoice: string;
    tagNew: string;
    tagGst: string;
    billTitle: string;
    billFooter: string;
    /** Alt text / screen-reader labels for the hero's scrolling product
     * photos (see HERO_SHOWCASE_ITEMS below) - keyed the same way. */
    showcaseItems: Record<string, string>;
  };
  trust: {
    kicker: string;
    items: { value: string; label: string }[];
  };
  ads: {
    kicker: string;
    title: string;
    labels: Record<string, string>;
  };
  showcase: {
    kicker: string;
    title: string;
    desc: string;
    showAria: string;
    products: Record<string, string>;
  };
  about: {
    kicker: string;
    title: string;
    body: string;
    cats: { mobiles: string; tvs: string; appliances: string; accessories: string };
  };
  why: { title: string; body: string }[];
  steps: {
    kicker: string;
    title: string;
    desc: string;
    items: { title: string; body: string }[];
  };
  cta: { title: string; body: string };
  visit: {
    kicker: string;
    title: string;
    addressLabel: string;
    phoneLabel: string;
    hoursLabel: string;
    hoursValue: string;
    callBtn: string;
    mapsBtn: string;
  };
  footer: {
    desc: string;
    contactHeading: string;
    whatsapp: string;
    visitHeading: string;
    hours: string;
    copyrightName: string;
    tag: string;
  };
}

/** Raw SVG markup for each showcase tile - hand-drawn line icons (same
 * stroke-icon convention as the rest of this page) rather than photography.
 * This page ships inside the billing app's own Angular build with no image
 * hosting/upload pipeline behind it, and hot-linking third-party stock
 * photos onto a client's live shop site is a fragile choice (broken images
 * the moment a hotlink policy changes) - a crisp, on-brand vector actually
 * holds up better here, and it renders instantly with zero extra network
 * requests. Swap in real product photography later (e.g. img tags pointing
 * at the shop's own uploaded photos) if/when that's available - the
 * `.sc-art`/`.floater` containers are sized to take either one. */
const ICONS = {
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.4"/><path d="M11 18h2"/><path d="M9.5 5h5"/></svg>`,
  watch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="8" width="10" height="8" rx="2.2"/><path d="M9 8V5.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V8M9 16v2.4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V16"/></svg>`,
  buds: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="9" r="2.6"/><path d="M8.5 11.6v4.4a2 2 0 0 0 2 2"/><circle cx="16" cy="8" r="2.6"/><path d="M16 10.6V15"/></svg>`,
  tv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  fridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 9.5h12"/><path d="M9 4.6v2M9 12.2v2"/></svg>`,
  wash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.4"/><circle cx="12" cy="13.5" r="5.2"/><circle cx="12" cy="13.5" r="2"/><path d="M7 6h.01M10 6h.01"/></svg>`,
  ac: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="7" rx="3"/><path d="M6 17.5 5 21M11 17.5l-.6 3.4M16 17.5l-1 3M20 17.5l-1.4 2.6"/><circle cx="18" cy="9.5" r="1"/></svg>`,
  kitchen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 4h7l-1 5h-5l-1-5Z"/><path d="M7.3 9h9.4l-1.28 9.6A2 2 0 0 1 13.44 20h-2.88a2 2 0 0 1-1.98-1.4L7.3 9Z"/><path d="M8.6 13h6.8"/></svg>`,
};

/** Fixed display order for the showcase strip - same order the client asked
 * for originally. Each key doubles as the lookup into
 * LandingCopy.showcase.products for that item's localized name. */
const PRODUCT_KEYS: (keyof typeof ICONS)[] = ['phone', 'watch', 'buds', 'tv', 'fridge', 'wash', 'ac', 'kitchen'];

/** Icons for the "offers & updates" strip below the trust section - a
 * structural placeholder (see the `ads` block in COPY and `.ads-strip` in
 * landing.html/scss) built now, ahead of the actual promotional images the
 * client hasn't sent yet. Deliberately generic line icons + non-specific
 * copy (never a fabricated "50% off" or similar claim this session can't
 * verify - same principle documented on `products` above and the
 * trust-strip in landing.scss), so the strip reads fine even if it ships
 * before real banner images/offer text are swapped in via `adItems`
 * below. */
const AD_ICONS = {
  megaphone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4a1 1 0 0 0 1 1h2l3.5 3.5V5.5L6 9H4a1 1 0 0 0-1 1Z"/><path d="M14 8.5a4 4 0 0 1 0 7"/><path d="M17 6a7.5 7.5 0 0 1 0 12"/></svg>`,
  gift: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="4" rx="1"/><rect x="4.5" y="13" width="15" height="7.5" rx="1"/><path d="M12 9v11.5"/><path d="M12 9C9.5 9 8 7.6 8 6a2.2 2.2 0 0 1 4-1.3M12 9c2.5 0 4-1.4 4-3a2.2 2.2 0 0 0-4-1.3"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 3.5 20 12l-8.5 8.5L3 12V3.5h8.5Z"/><circle cx="7.2" cy="7.2" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5Z"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
};

/** Display order for the ads strip - see AD_ICONS above. */
const AD_KEYS: (keyof typeof AD_ICONS)[] = ['megaphone', 'gift', 'tag', 'star', 'calendar'];

interface HeroShowcaseItem {
  key: string;
  webp: string;
  png: string;
}

/** Real product photos (sent by the shop) that scroll continuously in the
 * hero's right-side showcase (see .hero-scroll in landing.html/scss) -
 * public/assets/hero-showcase/<key>.{webp,png}. Add another product later
 * by dropping its two image files in that folder, adding an entry here,
 * and a matching key in `showcaseItems` under each language in COPY. */
const HERO_SHOWCASE_ITEMS: HeroShowcaseItem[] = [
  { key: 'phone', webp: 'assets/hero-showcase/phone.webp', png: 'assets/hero-showcase/phone.png' },
  { key: 'headphones', webp: 'assets/hero-showcase/headphones.webp', png: 'assets/hero-showcase/headphones.png' },
  { key: 'earbuds', webp: 'assets/hero-showcase/earbuds.webp', png: 'assets/hero-showcase/earbuds.png' },
  { key: 'charger', webp: 'assets/hero-showcase/charger.webp', png: 'assets/hero-showcase/charger.png' },
];

/** Second hero showcase "scene" - real home-appliance photos (sent by
 * the shop) that the hero cycles to after the mobile set above, on the
 * same right-side stage - public/assets/hero-showcase-appliances/<key>.{webp,png}.
 * See startHeroShowcaseSequence() for the mobile <-> appliance swap, and a
 * matching key in `showcaseItems` under each language in COPY. */
const APPLIANCE_SHOWCASE_ITEMS: HeroShowcaseItem[] = [
  { key: 'ac', webp: 'assets/hero-showcase-appliances/ac.webp', png: 'assets/hero-showcase-appliances/ac.png' },
  {
    key: 'washingMachine',
    webp: 'assets/hero-showcase-appliances/washing-machine.webp',
    png: 'assets/hero-showcase-appliances/washing-machine.png',
  },
  { key: 'tv', webp: 'assets/hero-showcase-appliances/tv.webp', png: 'assets/hero-showcase-appliances/tv.png' },
  { key: 'blender', webp: 'assets/hero-showcase-appliances/blender.webp', png: 'assets/hero-showcase-appliances/blender.png' },
  {
    key: 'mixerGrinder',
    webp: 'assets/hero-showcase-appliances/mixer-grinder.webp',
    png: 'assets/hero-showcase-appliances/mixer-grinder.png',
  },
];

const SHOP_ADDRESS = 'No.5/2, Pondy Road, Marakkanam - 604303, Tamil Nadu';

/** Remembers the visitor's Tamil/English choice across visits on this
 * device - a plain localStorage read/write (not the in-conversation-artifact
 * kind of browser storage restriction; this is a real shipped Angular app).
 * Wrapped in try/catch everywhere it's touched since private browsing /
 * storage-disabled visitors should still get a working page, just without
 * the choice persisting. */
const LANG_STORAGE_KEY = 'rasi_landing_lang';

/** Full bilingual copy for the page. English is the source of truth for
 * structure; Tamil is a natural (not machine-literal) translation aimed at
 * how a Marakkanam shop would actually talk to a walk-in customer - plain,
 * warm, not overly formal. Proper nouns (shop name, address, phone, GSTIN)
 * are deliberately left unchanged in both languages - a postal address and
 * a phone number aren't "translated", and a brand name reads the same way
 * to every customer regardless of which language they're browsing in. */
const COPY: Record<Lang, LandingCopy> = {
  en: {
    nav: { tagline: 'Mobiles & Home Appliances', call: 'Call Now', langToggleLabel: 'Language' },
    hero: {
      badge: 'Welcome to our store',
      titleLine1: 'Everything you need.',
      titleLine2: 'All in one place.',
      tagline:
        'Discover the latest mobiles and quality home appliances from RASI TIME CENTER — a trusted local showroom in Marakkanam, with a proper GST invoice on every single sale.',
      ctaPrimary: 'Explore Our Products',
      ctaSecondary: 'About Our Shop',
      chipGstin: 'GSTIN 33BEVPR0802PIZY',
      chipInvoice: 'GST invoice on every sale',
      tagNew: 'New arrivals',
      tagGst: 'GST billed',
      billTitle: 'Sample Bill',
      billFooter: 'GST Included',
      showcaseItems: {
        phone: 'Smartphone',
        headphones: 'Headphones',
        earbuds: 'Wireless earbuds',
        charger: 'Fast charger',
        ac: 'Air conditioner',
        washingMachine: 'Washing machine',
        tv: 'Smart TV',
        blender: 'Blender',
        mixerGrinder: 'Mixer grinder',
      },
    },
    trust: {
      kicker: 'Why shop with us',
      items: [
        { value: '8', label: 'Product categories' },
        { value: '100%', label: 'Sales GST billed' },
        { value: '1', label: 'Counter for sales & service' },
        { value: 'Marakkanam', label: 'Local, trusted showroom' },
      ],
    },
    ads: {
      kicker: 'Offers & updates',
      title: "What's new at the showroom",
      labels: {
        megaphone: 'New Offers',
        gift: 'Special Deals',
        tag: 'Latest Arrivals',
        star: 'Featured Picks',
        calendar: 'Updated Often',
      },
    },
    showcase: {
      kicker: 'Explore our products',
      title: 'A showroom worth walking into',
      desc: "A quick look at what's on the shelves — every category below is stocked, demonstrated and billed properly at the counter.",
      showAria: 'Show',
      products: {
        phone: 'Smartphones',
        watch: 'Smartwatches',
        buds: 'Earbuds',
        tv: 'Televisions',
        fridge: 'Refrigerators',
        wash: 'Washing Machines',
        ac: 'Air Conditioners',
        kitchen: 'Kitchen Appliances',
      },
    },
    about: {
      kicker: 'About our shop',
      title: 'A neighbourhood showroom, run the proper way',
      body: "RASI TIME CENTER has been Marakkanam's go-to stop for mobiles and home appliances — mobiles, TVs, refrigerators, washing machines and everyday accessories, all from one counter. No showroom theatrics, just genuine products, fair prices, and a bill you can actually use for warranty and service.",
      cats: { mobiles: 'Mobiles', tvs: 'TVs', appliances: 'Appliances', accessories: 'Accessories' },
    },
    why: [
      {
        title: 'Every sale, billed properly',
        body: 'A GST tax invoice for every purchase — the paperwork you need for warranty claims is handed to you at the counter, not chased down later.',
      },
      {
        title: 'One stop, less running around',
        body: "From a phone charger to a new washing machine, it's one shop and one familiar face behind the counter.",
      },
      {
        title: 'Clear pricing, no surprises',
        body: "Every bill shows the GST breakdown plainly, so the total you're quoted is the total you pay.",
      },
    ],
    steps: {
      kicker: 'How it works',
      title: 'Shopping here is simple',
      desc: 'From walking in to walking out with your bill — three straightforward steps, no pressure.',
      items: [
        {
          title: 'Walk in or call ahead',
          body: "Visit the showroom or call to check what's in stock before you come.",
        },
        {
          title: 'Compare & choose',
          body: 'See the models side by side and ask us anything — no pressure, no rush.',
        },
        {
          title: 'Pay & get your GST bill',
          body: 'Cash, UPI or card — walk out with your product and a proper invoice.',
        },
      ],
    },
    cta: {
      title: 'Come see it for yourself',
      body: 'The best way to choose a phone or appliance is to hold it. Drop by the showroom today.',
    },
    visit: {
      kicker: 'Find us',
      title: 'Visit the store',
      addressLabel: 'Address',
      phoneLabel: 'Phone',
      hoursLabel: 'Store timings',
      hoursValue: "Call ahead to confirm today's hours.",
      callBtn: 'Call the store',
      mapsBtn: 'Open in Maps',
    },
    footer: {
      desc: 'Your trusted neighbourhood destination for mobiles and home appliances in Marakkanam — genuine products, straightforward pricing, and a proper GST invoice on every sale.',
      contactHeading: 'Contact',
      whatsapp: 'WhatsApp us',
      visitHeading: 'Visit',
      hours: "Call ahead to confirm today's hours",
      copyrightName: 'Rasi Time Center. All rights reserved.',
      tag: 'Billed with GST, every time.',
    },
  },
  ta: {
    nav: { tagline: 'மொபைல் & வீட்டு உபகரணங்கள்', call: 'இப்போது அழைக்கவும்', langToggleLabel: 'மொழி' },
    hero: {
      badge: 'எங்கள் கடைக்கு வரவேற்கிறோம்',
      titleLine1: 'நீங்கள் தேடும் அனைத்தும்.',
      titleLine2: 'ஒரே இடத்தில்.',
      tagline:
        'மரக்காணத்தின் நம்பகமான உள்ளூர் ஷோரூமான ராசி டைம் சென்டரில், சமீபத்திய மொபைல்கள் மற்றும் தரமான வீட்டு உபகரணங்களை கண்டறியுங்கள் — ஒவ்வொரு விற்பனைக்கும் முறையான GST இன்வாய்ஸுடன்.',
      ctaPrimary: 'எங்கள் பொருட்களைப் பார்க்க',
      ctaSecondary: 'எங்கள் கடை பற்றி',
      chipGstin: 'GSTIN 33BEVPR0802PIZY',
      chipInvoice: 'ஒவ்வொரு விற்பனைக்கும் GST இன்வாய்ஸ்',
      tagNew: 'புதிய வரவு',
      tagGst: 'GST பில்',
      billTitle: 'மாதிரி பில்',
      billFooter: 'GST சேர்க்கப்பட்டது',
      showcaseItems: {
        phone: 'மொபைல் போன்',
        headphones: 'ஹெட்·போன்கள்',
        earbuds: 'வயர்லெஸ் இயர்பட்ஸ்',
        charger: 'ஃபாஸ்ட் சார்ஜர்',
        ac: 'ஏர் கண்டிஷனர்',
        washingMachine: 'வாஷிங் மெஷின்',
        tv: 'ஸ்மார்ட் டிவி',
        blender: 'பிளெண்டர்',
        mixerGrinder: 'மிக்சர் கிரைண்டர்',
      },
    },
    trust: {
      kicker: 'எங்களிடம் ஏன் வாங்க வேண்டும்',
      items: [
        { value: '8', label: 'பொருள் வகைகள்' },
        { value: '100%', label: 'GST பில் செய்யப்பட்ட விற்பனை' },
        { value: '1', label: 'விற்பனை & சர்வீஸுக்கு ஒரே கவுண்டர்' },
        { value: 'மரக்காணம்', label: 'உள்ளூர், நம்பகமான ஷோரூம்' },
      ],
    },
    ads: {
      kicker: 'சலுகைகள் & புதுப்பிப்புகள்',
      title: 'ஷோரூமில் புதியது என்ன',
      labels: {
        megaphone: 'புதிய சலுகைகள்',
        gift: 'சிறப்பு டீல்கள்',
        tag: 'புதிய வரவுகள்',
        star: 'சிறப்பு தேர்வுகள்',
        calendar: 'அடிக்கடி புதுப்பிக்கப்படும்',
      },
    },
    showcase: {
      kicker: 'எங்கள் பொருட்களைப் பார்வையிடுங்கள்',
      title: 'நடந்து பார்க்க வேண்டிய ஷோரூம்',
      desc: 'அலமாரியில் என்ன இருக்கிறது என்பதை ஒரு பார்வையில் காணுங்கள் — கீழே உள்ள ஒவ்வொரு வகையும் கடையில் கையிருப்பில் உள்ளது, விளக்கப்பட்டு, கவுண்டரில் முறையாக பில் செய்யப்படுகிறது.',
      showAria: 'காட்டு',
      products: {
        phone: 'ஸ்மார்ட்போன்கள்',
        watch: 'ஸ்மார்ட் வாட்ச்கள்',
        buds: 'இயர்பட்ஸ்',
        tv: 'டிவிக்கள்',
        fridge: 'குளிர்சாதன பெட்டிகள்',
        wash: 'வாஷிங் மெஷின்கள்',
        ac: 'ஏர் கண்டிஷனர்கள்',
        kitchen: 'சமையலறை உபகரணங்கள்',
      },
    },
    about: {
      kicker: 'எங்கள் கடை பற்றி',
      title: 'முறையாக நடத்தப்படும் ஒரு பகுதி ஷோரூம்',
      body: 'மொபைல் மற்றும் வீட்டு உபகரணங்களுக்கு மரக்காணம் மக்கள் நம்பி வரும் இடமாக ராசி டைம் சென்டர் உள்ளது — மொபைல்கள், டிவிக்கள், குளிர்சாதன பெட்டிகள், வாஷிங் மெஷின்கள் மற்றும் அன்றாட துணைபொருட்கள், அனைத்தும் ஒரே கவுண்டரில். ஆடம்பரம் இல்லை, உண்மையான பொருட்கள், நியாயமான விலை, மற்றும் வாரண்டி மற்றும் சர்வீஸுக்கு உண்மையில் பயன்படும் முறையான பில் மட்டுமே.',
      cats: { mobiles: 'மொபைல்கள்', tvs: 'டிவிக்கள்', appliances: 'உபகரணங்கள்', accessories: 'துணைபொருட்கள்' },
    },
    why: [
      {
        title: 'ஒவ்வொரு விற்பனையும், முறையாக பில் செய்யப்படுகிறது',
        body: 'ஒவ்வொரு கொள்முதலுக்கும் GST வரி இன்வாய்ஸ் — வாரண்டி கோரிக்கைகளுக்கு தேவையான ஆவணங்கள் கவுண்டரிலேயே உங்கள் கையில் கொடுக்கப்படும், பின்னர் தேடி அலைய வேண்டாம்.',
      },
      {
        title: 'ஒரே இடம், அலைய வேண்டாம்',
        body: 'போன் சார்ஜரில் இருந்து புதிய வாஷிங் மெஷின் வரை, ஒரே கடை, கவுண்டரில் ஒரே பழக்கமான முகம்.',
      },
      {
        title: 'தெளிவான விலை, ஆச்சரியங்கள் இல்லை',
        body: 'ஒவ்வொரு பில்லிலும் GST விவரம் தெளிவாக காட்டப்படும், எனவே சொல்லப்பட்ட தொகையே நீங்கள் செலுத்தும் தொகையாக இருக்கும்.',
      },
    ],
    steps: {
      kicker: 'இது எப்படி செயல்படுகிறது',
      title: 'இங்கு வாங்குவது எளிது',
      desc: 'உள்ளே நுழைவதில் இருந்து பில்லுடன் வெளியேறுவது வரை — மூன்று எளிய படிகள், எந்த அழுத்தமும் இல்லை.',
      items: [
        {
          title: 'நேரில் வாருங்கள் அல்லது முன்பே அழைக்கவும்',
          body: 'ஷோரூமுக்கு வாருங்கள் அல்லது வருவதற்கு முன் கையிருப்பை சரிபார்க்க அழைக்கவும்.',
        },
        {
          title: 'ஒப்பிட்டு தேர்வு செய்யுங்கள்',
          body: 'மாடல்களை பக்கத்திற்கு பக்கம் பார்த்து, எங்களிடம் எதுவும் கேளுங்கள் — அழுத்தமும் இல்லை, அவசரமும் இல்லை.',
        },
        {
          title: 'பணம் செலுத்தி உங்கள் GST பில் பெறுங்கள்',
          body: 'பணம், UPI அல்லது கார்டு — உங்கள் பொருளுடன் முறையான இன்வாய்ஸுடன் வெளியேறுங்கள்.',
        },
      ],
    },
    cta: {
      title: 'நேரில் வந்து பாருங்கள்',
      body: 'ஒரு போன் அல்லது உபகரணத்தை தேர்வு செய்ய சிறந்த வழி அதை கையில் பிடிப்பதுதான். இன்றே ஷோரூமுக்கு வாருங்கள்.',
    },
    visit: {
      kicker: 'எங்களை கண்டறியுங்கள்',
      title: 'கடைக்கு வாருங்கள்',
      addressLabel: 'முகவரி',
      phoneLabel: 'தொலைபேசி',
      hoursLabel: 'கடை நேரம்',
      hoursValue: 'இன்றைய நேரத்தை உறுதிசெய்ய முன்பே அழைக்கவும்.',
      callBtn: 'கடையை அழைக்கவும்',
      mapsBtn: 'மேப்ஸில் திற',
    },
    footer: {
      desc: 'மரக்காணத்தில் மொபைல் மற்றும் வீட்டு உபகரணங்களுக்கு நீங்கள் நம்பக்கூடிய பகுதி இடம் — உண்மையான பொருட்கள், நேரடியான விலை, ஒவ்வொரு விற்பனைக்கும் முறையான GST இன்வாய்ஸ்.',
      contactHeading: 'தொடர்பு',
      whatsapp: 'WhatsApp-இல் தொடர்பு கொள்ளுங்கள்',
      visitHeading: 'வருகை',
      hours: 'இன்றைய நேரத்தை உறுதிசெய்ய முன்பே அழைக்கவும்',
      copyrightName: 'ராசி டைம் சென்டர். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.',
      tag: 'எப்போதும் GST உடன் பில்.',
    },
  },
};

/**
 * Public, unauthenticated marketing page for the shop's own customers -
 * lives at the app's root path ("/"), separate from the Login screen at
 * "/login" and everything behind the auth guard. Content/design mirrors the
 * standalone rasi-time-center.html landing page (also served statically at
 * public/welcome.html) - kept here too as a real Angular route so it's
 * reachable at a clean root URL without any static-file/SPA-fallback
 * quirks, and so it stays in the same build/deploy pipeline as the rest of
 * the app.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements OnInit, AfterViewInit, OnDestroy {
  /** True once the page has been scrolled past the hero - toggles the
   * topbar's frosted/scrolled look (see .topbar.scrolled in landing.scss). */
  scrolled = false;

  /** Tamil/English - see the language switcher in the topbar. Read from
   * localStorage on first load (falls back to English) so a returning
   * visitor sees the page in whichever language they picked last time. */
  lang: Lang;

  @ViewChild('showcaseTrack') private showcaseTrackRef?: ElementRef<HTMLElement>;

  /** The 8 categories the "Explore our products" scroller advertises, in
   * the same order the client asked for. Only icon + a lookup key live here
   * - the displayed name comes from `t.showcase.products[key]` so it stays
   * in sync with the language switcher without rebuilding this array. */
  readonly products: ShowcaseProduct[];
  /** products, twice back to back - the actual DOM the scroller renders.
   * Auto-scroll and manual scroll/swipe both operate on this doubled strip;
   * once scrollLeft passes one full set's width, onShowcaseScroll() silently
   * subtracts that width so it looks like the strip loops forever without
   * ever visibly snapping back to the start. */
  readonly loopedProducts: ShowcaseProduct[];
  /** Which of the 8 *logical* products is currently front-and-center -
   * drives the active dot under the scroller. */
  activeShowcaseIndex = 0;

  /** The "offers & updates" strip's placeholder tiles - see AD_ICONS/
   * AD_KEYS above. Rendered twice back-to-back in landing.html (same
   * doubled-strip idea as loopedProducts) so the pure-CSS marquee
   * (`.ads-track` in landing.scss) can loop by translating exactly -50%,
   * with no scroll-position JS needed the way the showcase scroller above
   * requires. */
  readonly adItems: ShowcaseProduct[];

  /** The hero's right-side product showcase, "scene" 1 of 2 - see
   * HERO_SHOWCASE_ITEMS above. Rendered once each (no doubling - this is an
   * animated one-at-a-time sequence, not a scrolling marquee); see
   * startHeroShowcaseSequence() below for how it cycles through them. */
  readonly heroShowcaseItems = HERO_SHOWCASE_ITEMS;

  /** Scene 2 - see APPLIANCE_SHOWCASE_ITEMS above and
   * startHeroShowcaseSequence() below for the mobile <-> appliance
   * crossfade once each scene's products have all had their turn. */
  readonly applianceShowcaseItems = APPLIANCE_SHOWCASE_ITEMS;

  /** Google's no-API-key "output=embed" form of a normal Maps search URL -
   * a real, live map of the shop's actual address, not a static image. */
  readonly mapEmbedUrl: SafeResourceUrl;

  readonly currentYear = new Date().getFullYear();

  private showcasePaused = false;
  private showcaseResumeTimer?: ReturnType<typeof setTimeout>;
  private showcaseRafId?: number;
  private revealObserver?: IntersectionObserver;
  private revealFallbackTimer?: ReturnType<typeof setTimeout>;
  /** Drives the hero showcase's one-at-a-time product sequence and its
   * mobile <-> appliance scene crossfade - see startHeroShowcaseSequence()
   * below. A chain of setTimeout calls (each one schedules the next) rather
   * than a single setInterval, since the delay differs between "show the
   * next product" and "crossfade to the next scene" - clearing whichever
   * timeout is currently pending stops the whole chain. */
  private heroSequenceTimer?: ReturnType<typeof setTimeout>;
  private heroSceneIndex = 0;
  private heroItemIndex = 0;
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  constructor(
    private titleService: Title,
    private themeService: ThemeService,
    private elementRef: ElementRef<HTMLElement>,
    private sanitizer: DomSanitizer,
  ) {
    // The icon strings above are fixed developer-authored constants (never
    // user input), so trusting them as HTML is safe - Angular's default
    // innerHTML sanitizer is otherwise inconsistent about which inline SVG
    // attributes it keeps.
    const trust = (svg: string) => this.sanitizer.bypassSecurityTrustHtml(svg);
    this.products = PRODUCT_KEYS.map((key) => ({ key, icon: trust(ICONS[key]) }));
    this.loopedProducts = [...this.products, ...this.products];
    this.adItems = AD_KEYS.map((key) => ({ key, icon: trust(AD_ICONS[key]) }));
    this.mapEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.google.com/maps?q=${encodeURIComponent(SHOP_ADDRESS)}&output=embed`,
    );
    this.lang = this.detectInitialLang();
  }

  /** All copy for the currently-selected language - the template reads
   * every piece of text through this one getter (`t.hero.title`, etc.)
   * instead of hardcoding English, so flipping `lang` re-renders the whole
   * page in the other language on the next change-detection pass (the
   * language switcher's own (click) binding triggers that, same as the
   * showcase's existing arrow/dot buttons already do in this zoneless-CD
   * app). */
  get t(): LandingCopy {
    return COPY[this.lang];
  }

  ngOnInit(): void {
    this.titleService.setTitle('Rasi Time Center - Mobiles & Home Appliances');
    this.applyShopTheme();
    this.elementRef.nativeElement.setAttribute('lang', this.lang);
  }

  ngAfterViewInit(): void {
    this.setUpScrollReveal();
    if (!this.prefersReducedMotion) {
      this.startShowcaseAutoScroll();
      this.startHeroShowcaseSequence();
    }
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    if (this.revealFallbackTimer) {
      clearTimeout(this.revealFallbackTimer);
    }
    if (this.showcaseRafId !== undefined) {
      cancelAnimationFrame(this.showcaseRafId);
    }
    if (this.showcaseResumeTimer) {
      clearTimeout(this.showcaseResumeTimer);
    }
    if (this.heroSequenceTimer) {
      clearTimeout(this.heroSequenceTimer);
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled = window.scrollY > 8;
  }

  // ---------------------------------------------------------------------
  // Language switcher
  // ---------------------------------------------------------------------

  setLang(lang: Lang): void {
    if (this.lang === lang) {
      return;
    }
    this.lang = lang;
    this.elementRef.nativeElement.setAttribute('lang', lang);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Private browsing / storage disabled - the choice just won't persist
      // across reloads; the page still works fine for this visit.
    }
    // Some `.reveal` sections are built by an `@for` over this language's
    // copy (why-cards, steps) - even though those loops now track by
    // `$index` rather than the translated text itself (so Angular reuses
    // the same DOM nodes across a language switch instead of recreating
    // them), re-arming here is a deliberate safety net: it costs nothing
    // when nothing was recreated (setUpScrollReveal() is a no-op once every
    // `.reveal` element already has `is-visible`), and it means a future
    // `@for` that genuinely does need to key on translated text - or any
    // other structural change tied to `lang` - can't quietly reintroduce
    // this same "section recreated, never re-revealed" bug. `setTimeout`
    // (rather than calling this synchronously) gives the zoneless
    // change-detection pass the `lang` mutation just triggered time to
    // actually finish re-rendering the template before this re-queries the
    // DOM.
    setTimeout(() => this.setUpScrollReveal(), 0);
  }

  private detectInitialLang(): Lang {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'ta') {
        return saved;
      }
    } catch {
      // Private browsing / storage disabled - fall through to the default.
    }
    return 'en';
  }

  // ---------------------------------------------------------------------
  // Product showcase scroller
  // ---------------------------------------------------------------------

  pauseShowcase(): void {
    this.showcasePaused = true;
  }

  resumeShowcase(): void {
    this.showcasePaused = false;
  }

  /** Arrow-button handler - scrolls by exactly one card, pauses the
   * auto-scroll briefly afterwards so a click doesn't immediately get
   * overridden by the marquee still nudging forward underneath it. */
  scrollShowcase(direction: 1 | -1): void {
    const track = this.showcaseTrackRef?.nativeElement;
    if (!track) {
      return;
    }
    const cardWidth = this.cardWidth(track);
    track.scrollBy({ left: direction * cardWidth, behavior: 'smooth' });
    this.pauseForInteraction();
  }

  /** Dot-button handler - jumps to the Nth logical product (within the
   * first copy of the doubled strip). */
  goToShowcaseSlide(index: number): void {
    const track = this.showcaseTrackRef?.nativeElement;
    if (!track) {
      return;
    }
    const cardWidth = this.cardWidth(track);
    track.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
    this.pauseForInteraction();
  }

  /** Fired on every scroll of the track, whether driven by the user
   * (swipe/drag/wheel) or by the auto-scroll loop below - keeps the loop
   * seamless and the active dot in sync either way. */
  onShowcaseScroll(): void {
    const track = this.showcaseTrackRef?.nativeElement;
    if (!track) {
      return;
    }
    this.wrapShowcase(track);
    const cardWidth = this.cardWidth(track);
    if (cardWidth > 0) {
      const setWidth = track.scrollWidth / 2;
      const raw = Math.round((track.scrollLeft % setWidth) / cardWidth);
      this.activeShowcaseIndex = ((raw % this.products.length) + this.products.length) % this.products.length;
    }
  }

  private pauseForInteraction(): void {
    this.pauseShowcase();
    if (this.showcaseResumeTimer) {
      clearTimeout(this.showcaseResumeTimer);
    }
    this.showcaseResumeTimer = setTimeout(() => this.resumeShowcase(), 2600);
  }

  private cardWidth(track: HTMLElement): number {
    return track.scrollWidth / (this.loopedProducts.length || 1);
  }

  /** Once scrollLeft passes (or drops below) one full copy of the product
   * list, silently jump back by exactly that width - since the second copy
   * is pixel-identical to the first, this is invisible to the eye and turns
   * a finite doubled strip into what reads as an infinite loop. */
  private wrapShowcase(track: HTMLElement): void {
    const setWidth = track.scrollWidth / 2;
    if (setWidth <= 0) {
      return;
    }
    if (track.scrollLeft >= setWidth) {
      track.scrollLeft -= setWidth;
    } else if (track.scrollLeft < 0) {
      track.scrollLeft += setWidth;
    }
  }

  /** A slow, continuous marquee-style drift - paused whenever the pointer
   * or a touch is over the strip (see pauseShowcase()/resumeShowcase(),
   * wired from landing.html) or right after the user has interacted with an
   * arrow/dot. Skipped entirely under prefers-reduced-motion (ngAfterViewInit
   * never calls this then), matching every other continuous animation on
   * this page. */
  private startShowcaseAutoScroll(): void {
    const step = () => {
      const track = this.showcaseTrackRef?.nativeElement;
      if (track && !this.showcasePaused) {
        track.scrollLeft += 0.55;
        this.onShowcaseScroll();
      }
      this.showcaseRafId = requestAnimationFrame(step);
    };
    this.showcaseRafId = requestAnimationFrame(step);
  }

  /** Drives the hero's right-side product showcase: within a "scene"
   * (mobiles/accessories or home appliances - see .hero-scroll-category in
   * landing.html), shows exactly one product at a time, holds it for
   * HERO_ITEM_HOLD_MS, then crossfades to the next (.hero-stage-item's
   * `.is-active` class, see landing.scss for the fade/rise/scale/rotateY
   * transition). Once a scene has shown every one of its products, it
   * crossfades the *whole scene* - photos and glow tint together - over to
   * the other category (HERO_SCENE_TRANSITION_MS), then starts that scene's
   * products from the first one again, looping the two scenes back and
   * forth forever: Mobile -> Appliances -> Mobile -> ... The exact same
   * scene swap also crossfades the full-bleed hero background underneath
   * (see bgLayerEls below) - real showroom photo for mobile, the CSS/SVG
   * appliance tableau for appliances - so the background and the corner
   * showcase always change scene at the same moment.
   *
   * Every step is a direct DOM classList change (the same approach as
   * setUpScrollReveal()'s classList.add() below), never a bound template
   * property - this is what makes it work correctly under zoneless change
   * detection without needing a signal: nothing here depends on Angular
   * re-rendering the template, the browser just runs the CSS transition.
   *
   * Skipped entirely under prefers-reduced-motion (ngAfterViewInit never
   * calls this then) - the mobile scene's first product (already marked
   * `.is-active` in the template, so there's no flash of empty stage on
   * load either way) is what stays permanently visible in that case, same
   * as every other continuous animation on this page defaulting to its
   * resting state. */
  private startHeroShowcaseSequence(): void {
    const HERO_ITEM_HOLD_MS = 2600;
    const HERO_SCENE_TRANSITION_MS = 900;

    const sceneEls = Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.hero-scroll-category'),
    );
    const itemElsByScene = sceneEls.map((sceneEl) =>
      Array.from(sceneEl.querySelectorAll<HTMLElement>('.hero-stage-item')),
    );
    if (sceneEls.length < 2 || itemElsByScene.some((items) => items.length === 0)) {
      return;
    }

    // The full-bleed hero background has its own two layers (the real
    // showroom photo for mobile, the CSS/SVG appliance tableau below it) -
    // see .hero-bg-inner/.hero-bg-scene in landing.html/scss. They crossfade
    // in lockstep with sceneEls above: [0] is always the mobile layer, [1]
    // the appliance one, matching heroSceneIndex's own 0/1 meaning.
    const bgEl = this.elementRef.nativeElement.querySelector<HTMLElement>('.hero-bg');
    const bgLayerEls = bgEl
      ? [bgEl.querySelector<HTMLElement>('.hero-bg-inner'), bgEl.querySelector<HTMLElement>('.hero-bg-scene')]
      : [];

    const advance = (): void => {
      const items = itemElsByScene[this.heroSceneIndex];
      const nextItemIndex = this.heroItemIndex + 1;

      if (nextItemIndex < items.length) {
        // Still more products left in this scene - just crossfade to the
        // next one; the scene itself (and its glow) stays put.
        items[this.heroItemIndex].classList.remove('is-active');
        items[nextItemIndex].classList.add('is-active');
        this.heroItemIndex = nextItemIndex;
        this.heroSequenceTimer = setTimeout(advance, HERO_ITEM_HOLD_MS);
        return;
      }

      // This scene has shown all of its products - crossfade the whole
      // scene out, then swap to the other one.
      const finishedScene = sceneEls[this.heroSceneIndex];
      const finishedItems = items;
      finishedScene.classList.remove('is-active');
      bgLayerEls[this.heroSceneIndex]?.classList.remove('is-active');

      this.heroSequenceTimer = setTimeout(() => {
        // Reset the scene that just finished back to its first product,
        // ready for its next turn.
        finishedItems[this.heroItemIndex].classList.remove('is-active');
        finishedItems[0].classList.add('is-active');

        this.heroSceneIndex = (this.heroSceneIndex + 1) % sceneEls.length;
        this.heroItemIndex = 0;
        sceneEls[this.heroSceneIndex].classList.add('is-active');
        bgLayerEls[this.heroSceneIndex]?.classList.add('is-active');

        this.heroSequenceTimer = setTimeout(advance, HERO_ITEM_HOLD_MS);
      }, HERO_SCENE_TRANSITION_MS);
    };

    this.heroSequenceTimer = setTimeout(advance, HERO_ITEM_HOLD_MS);
  }

  // ---------------------------------------------------------------------

  /** Syncs this page's own --accent/--accent-2/--accent-deep tokens (see
   * landing.scss) to the shop's chosen Settings > Appearance color, instead
   * of always staying the hardcoded pink/magenta this page launched with.
   * This page is unauthenticated (see the class doc above), so it can't
   * call the protected `company/get` endpoint itself the way the rest of
   * the app does - but it's also already documented as a local-only link
   * (only reachable via this same machine's `ng serve`/build, not a public
   * internet URL), so reusing ThemeService's cached last-applied color
   * (populated by any admin login on this machine) is a reasonable stand-in
   * for "the shop's current theme" here. When the shop has never changed
   * their color (still the default), this deliberately leaves the page's
   * own hardcoded values in the DOM untouched - including the dark-mode
   * media query's own brighter pink shades - rather than overwriting them
   * with an inline style that would win over that @media block for every
   * visitor, customized or not. */
  private applyShopTheme(): void {
    const color = this.themeService.cachedThemeColor();
    if (color === ThemeService.DEFAULT_COLOR) {
      return;
    }
    const { base, light, deep } = this.themeService.accentPalette(color);
    const host = this.elementRef.nativeElement.style;
    host.setProperty('--accent', base);
    host.setProperty('--accent-2', light);
    host.setProperty('--accent-deep', deep);
  }

  /** Fades/slides each `.reveal` section into place as it scrolls into
   * view, instead of everything being visible (and static) the instant the
   * page loads - the hero already had its own load-in animation; this
   * extends the same idea down the page. Skipped entirely under
   * prefers-reduced-motion: every `.reveal` element is just marked visible
   * immediately, same as landing.scss's own reduced-motion override for the
   * hero. Uses IntersectionObserver rather than a scroll-position
   * calculation - cheaper, and correct regardless of each section's exact
   * height.
   *
   * Idempotent and safe to call more than once (see setLang() above): it
   * only ever looks at `.reveal:not(.is-visible)` elements, so re-running it
   * after every `.reveal` has already been revealed is a cheap no-op, and it
   * re-queries the DOM live each time rather than working off a snapshot
   * captured on the first call - so it also correctly picks up any
   * `.reveal` element that shows up in the DOM *after* the first call (a
   * language switch recreating a section, a future conditionally-rendered
   * block, etc.) instead of only ever knowing about what existed at
   * ngAfterViewInit() time. The observer itself is created once and reused
   * across calls (IntersectionObserver.disconnect() stops watching current
   * targets but leaves the instance usable for new ones).
   *
   * Safety net: a `.reveal` section only ever gets its `is-visible` class
   * from a real scroll/intersection event, and a section below the fold
   * that scroll never reaches - a "capture the full page" screenshot tool
   * that renders the DOM without dispatching real scroll events, a very
   * short window, a visitor whose JS is slow to attach the observer - would
   * otherwise stay invisible (opacity: 0, still taking up its layout
   * height) indefinitely, which reads as a broken blank gap rather than "a
   * section that just hasn't animated in yet". `revealFallbackTimer` forces
   * every remaining `.reveal` element visible a couple of seconds after
   * this runs, same outcome as the reduced-motion path above - a visitor
   * scrolling normally never notices it (their sections have already
   * revealed for real well before it fires), and anyone/anything that
   * never triggers a real intersection still sees the full page shortly
   * after load instead of large empty gaps. The fallback re-queries the DOM
   * live when it fires too, rather than closing over the `revealEls`
   * captured at call time, so it still catches anything that was added
   * in between. */
  private setUpScrollReveal(): void {
    const revealEls = this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)');
    if (revealEls.length === 0) {
      return;
    }
    if (this.prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    if (!this.revealObserver) {
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              this.revealObserver?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
      );
    }
    revealEls.forEach((el) => this.revealObserver?.observe(el));

    if (this.revealFallbackTimer) {
      clearTimeout(this.revealFallbackTimer);
    }
    this.revealFallbackTimer = setTimeout(() => {
      this.elementRef.nativeElement
        .querySelectorAll<HTMLElement>('.reveal:not(.is-visible)')
        .forEach((el) => el.classList.add('is-visible'));
    }, 1800);
  }
}
