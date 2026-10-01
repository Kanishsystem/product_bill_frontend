import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

type Language = 'en' | 'ta';
type Theme = 'red' | 'berry';

const COPY = {
  en: {
    tagline: 'Mobiles & home appliances',
    navProducts: 'Products',
    navAbout: 'Our store',
    navVisit: 'Visit us',
    call: 'Call the store',
    language: 'Language',
    theme: 'Color theme',
    welcome: 'Your neighbourhood electronics store',
    heroSlideLabels: ['Our showroom', 'Mobiles', 'Televisions', 'Air conditioners', 'Audio', 'Home appliances'],
    heroGallery: 'Featured products and showroom',
    headline: 'Good choices.\nRasi Time Center.',
    intro: 'Explore mobiles and home appliances at Rasi Time Center, Marakkanam. Find the right product in person, with clear pricing and a GST invoice for every sale.',
    explore: 'Explore products',
    about: 'A local store, thoughtfully run',
    gst: 'GSTIN 33BEVPR0802PIZY',
    invoice: 'GST invoice on every sale',
    collectionEyebrow: 'The collection',
    collectionTitle: 'Tech for every part of your day.',
    collectionText: 'From a new phone to the sound, comfort, and convenience of home, explore the collections available at our Marakkanam showroom.',
    collectionHighlights: ['Stay connected', 'Listen closer', 'Everyday essentials', 'Home entertainment', 'Cool comfort', 'Laundry made simple', 'Everyday kitchen prep', 'Fresh blends', 'Comfort in every corner'],
    collectionDescriptions: [
      'Explore smartphones for calls, photos, study, work, and entertainment. Compare the models available in store, get help choosing what suits you, and take home your phone with a GST invoice.',
      'Wireless earbuds and audio picks for music, calls, and downtime.',
      'Chargers and useful extras to keep your devices ready.',
      'Explore televisions for movie nights, sport, and shared moments.',
      'Discover cooling options for a more comfortable home.',
      'Easy-to-use washing machines for everyday laundry.',
      'Reliable mixer-grinders for everyday kitchen prep.',
      'Blend smoothies, shakes, and more at home.',
      'Find a table fan for a refreshing breeze at home or work.',
    ],
    categories: ['Mobiles', 'Audio', 'Accessories', 'Televisions', 'Air conditioners', 'Washing machines', 'Mixer-grinders', 'Blenders', 'Table fans'],
    promiseEyebrow: 'Why customers choose us',
    promiseTitle: 'Practical products, honest advice, and a local store you can trust.',
    promiseText: 'From smartphones to home essentials, we keep everyday living simple with dependable products, friendly guidance, and clear pricing at every step.',
    promiseReasonOneTitle: 'Trusted local service',
    promiseReasonOneText: 'Friendly support from a familiar store in Marakkanam, with advice that actually helps.',
    promiseReasonTwoTitle: 'Clear bills & warranty',
    promiseReasonTwoText: 'Every purchase is backed by proper documentation, GST billing, and easy follow-up.',
    promiseReasonThreeTitle: 'Products for real life',
    promiseReasonThreeText: 'Mobiles, appliances, accessories, and home essentials selected for daily convenience.',
    storyEyebrow: 'About Rasi Time Center',
    storyTitle: 'A familiar face, one helpful counter.',
    storyText: 'We bring mobiles, televisions, appliances and everyday accessories together in one neighbourhood showroom. Take your time comparing options, ask us questions, and leave with a proper bill for your purchase.',
    featureOneTitle: 'A proper GST bill',
    featureOneText: 'Every sale comes with a GST invoice for your records and warranty needs.',
    featureTwoTitle: 'Products you can see',
    featureTwoText: 'Visit in person to explore available models and get help choosing what suits you.',
    featureThreeTitle: 'Straightforward service',
    featureThreeText: 'One local store for product enquiries, purchases and support.',
    visitEyebrow: 'Find our showroom',
    visitTitle: 'Come by. We’re in Marakkanam.',
    visitText: 'Visit our showroom to compare products in person and get friendly help choosing what fits your needs.',
    mapTitle: 'Map showing Rasi Time Center in Marakkanam',
    address: 'No.5/2, Pondy Road, Marakkanam - 604303, Tamil Nadu',
    phoneLabel: 'Call us',
    addressLabel: 'Address',
    openMaps: 'Open directions',
    footer: 'Mobiles and home appliances, right here in Marakkanam.',
    redTheme: 'Signal red',
    berryTheme: 'Berry',
  },
  ta: {
    tagline: 'மொபைல்கள் மற்றும் வீட்டு உபகரணங்கள்',
    navProducts: 'பொருட்கள்',
    navAbout: 'எங்கள் கடை',
    navVisit: 'வருகை',
    call: 'கடையை அழைக்கவும்',
    language: 'மொழி',
    theme: 'வண்ணத் தீம்',
    welcome: 'உங்கள் அருகிலுள்ள மின்னணுப் பொருள் கடை',
    heroSlideLabels: ['எங்கள் ஷோரூம்', 'மொபைல்கள்', 'தொலைக்காட்சிகள்', 'ஏர் கண்டிஷனர்கள்', 'ஆடியோ', 'வீட்டு உபகரணங்கள்'],
    heroGallery: 'முக்கிய பொருட்கள் மற்றும் ஷோரூம்',
    headline: 'சிறந்த தேர்வுகள்.\nராசி டைம் சென்டர்.',
    intro: 'மரக்காணம் ராசி டைம் சென்டரில் மொபைல்கள் மற்றும் வீட்டு உபகரணங்களைப் பாருங்கள். நேரில் பொருட்களைத் தேர்வு செய்து, தெளிவான விலை மற்றும் ஒவ்வொரு விற்பனைக்கும் GST இன்வாய்ஸ் பெறுங்கள்.',
    explore: 'பொருட்களைப் பாருங்கள்',
    about: 'அக்கறையுடன் நடத்தப்படும் உள்ளூர் கடை',
    gst: 'GSTIN 33BEVPR0802PIZY',
    invoice: 'ஒவ்வொரு விற்பனைக்கும் GST இன்வாய்ஸ்',
    collectionEyebrow: 'எங்கள் பொருட்கள்',
    collectionTitle: 'ஒவ்வொரு நாளுக்கும் ஏற்ற தொழில்நுட்பம்.',
    collectionText: 'புதிய மொபைல் முதல் வீட்டின் ஒலி, வசதி மற்றும் அன்றாடத் தேவைகள் வரை, மரக்காணம் ஷோரூமில் உள்ள பொருட்களைப் பாருங்கள்.',
    collectionHighlights: ['எப்போதும் இணைப்பில்', 'இசையை நெருக்கமாக', 'அன்றாடத் துணைப் பொருட்கள்', 'வீட்டு பொழுதுபோக்கு', 'குளிர்ந்த வசதி', 'எளிய சலவை', 'அன்றாட சமையல்', 'புதிய பானங்கள்', 'எல்லா இடத்திலும் குளிர்ச்சி'],
    collectionDescriptions: [
      'அழைப்புகள், புகைப்படங்கள், படிப்பு, வேலை மற்றும் பொழுதுபோக்கிற்கு ஏற்ற ஸ்மார்ட்போன்களைப் பாருங்கள். கடையில் உள்ள மாடல்களை ஒப்பிட்டு, உங்களுக்கு ஏற்றதைத் தேர்வு செய்ய உதவி பெற்று, GST இன்வாய்ஸுடன் வாங்கிச் செல்லுங்கள்.',
      'இசை, அழைப்புகள் மற்றும் ஓய்வு நேரத்திற்கான வயர்லெஸ் ஆடியோ.',
      'உங்கள் சாதனங்களைத் தயாராக வைத்திருக்க சார்ஜர்கள் மற்றும் பயனுள்ள பொருட்கள்.',
      'திரைப்படம், விளையாட்டு மற்றும் குடும்ப நேரத்திற்கான தொலைக்காட்சிகள்.',
      'வீட்டில் அதிக வசதிக்கான குளிரூட்டும் சாதனங்களைப் பாருங்கள்.',
      'அன்றாட சலவைக்குப் பயன்படுத்த எளிதான சலவை இயந்திரங்கள்.',
      'தினசரி சமையலுக்கான நம்பகமான மிக்ஸி கிரைண்டர்கள்.',
      'வீட்டிலேயே ஸ்மூத்தி, ஷேக் மற்றும் பலவற்றைத் தயாரிக்கலாம்.',
      'வீட்டிலும் பணியிடத்திலும் இதமான காற்றுக்கான டேபிள் ஃபேன்கள்.',
    ],
    categories: ['மொபைல்கள்', 'ஆடியோ', 'துணைப் பொருட்கள்', 'தொலைக்காட்சிகள்', 'ஏர் கண்டிஷனர்கள்', 'சலவை இயந்திரங்கள்', 'மிக்ஸி கிரைண்டர்கள்', 'பிளெண்டர்கள்', 'டேபிள் ஃபேன்கள்'],
    promiseEyebrow: 'வாடிக்கையாளர்கள் எங்களைத் தேர்வு செய்வது ஏன்',
    promiseTitle: 'பயனுள்ள பொருட்கள், நேர்மையான ஆலோசனை, நம்பகமான உள்ளூர் கடை.',
    promiseText: 'ஸ்மார்ட்போன்கள் முதல் வீட்டு அத்தியாவசியங்கள் வரை, நம்பகமான பொருட்கள், அன்பான வழிகாட்டுதல் மற்றும் தெளிவான விலையுடன் அன்றாட வாழ்க்கையை எளிதாக்குகிறோம்.',
    promiseReasonOneTitle: 'நம்பகமான உள்ளூர் சேவை',
    promiseReasonOneText: 'மரக்காணத்தில் உங்களுக்கு அறிமுகமான கடையிலிருந்து பயனுள்ள ஆலோசனையுடன் அன்பான சேவை.',
    promiseReasonTwoTitle: 'தெளிவான பில் மற்றும் வாரண்டி',
    promiseReasonTwoText: 'ஒவ்வொரு வாங்குதலுக்கும் முறையான ஆவணங்கள், GST பில் மற்றும் தொடர்ந்த உதவி வழங்கப்படும்.',
    promiseReasonThreeTitle: 'அன்றாட வாழ்க்கைக்கான பொருட்கள்',
    promiseReasonThreeText: 'தினசரி வசதிக்காக மொபைல்கள், வீட்டு உபகரணங்கள், துணைப் பொருட்கள் மற்றும் அத்தியாவசியங்கள் தேர்ந்தெடுக்கப்பட்டுள்ளன.',
    storyEyebrow: 'ராசி டைம் சென்டர் பற்றி',
    storyTitle: 'பழக்கமான முகம், உதவும் ஒரே கவுண்டர்.',
    storyText: 'மொபைல்கள், தொலைக்காட்சிகள், வீட்டு உபகரணங்கள் மற்றும் அன்றாடத் துணைப் பொருட்கள் அனைத்தையும் ஒரே உள்ளூர் ஷோரூமில் வழங்குகிறோம். நிதானமாக ஒப்பிட்டு, கேள்விகளைக் கேட்டு, முறையான பில்லுடன் உங்கள் பொருளைப் பெற்றுச் செல்லுங்கள்.',
    featureOneTitle: 'முறையான GST பில்',
    featureOneText: 'உங்கள் பதிவுகளுக்கும் வாரண்டி தேவைகளுக்கும் ஒவ்வொரு விற்பனைக்கும் GST இன்வாய்ஸ் வழங்கப்படும்.',
    featureTwoTitle: 'நேரில் பார்த்துத் தேர்வு செய்யுங்கள்',
    featureTwoText: 'கிடைக்கும் மாடல்களைப் பார்த்து, உங்களுக்கு ஏற்றதைத் தேர்வு செய்ய உதவி பெறுங்கள்.',
    featureThreeTitle: 'எளிமையான சேவை',
    featureThreeText: 'பொருள் விவரம், வாங்குதல் மற்றும் உதவிக்கு ஒரே உள்ளூர் கடை.',
    visitEyebrow: 'எங்கள் ஷோரூம்',
    visitTitle: 'மரக்காணத்தில் எங்களைச் சந்தியுங்கள்.',
    visitText: 'பொருட்களை நேரில் ஒப்பிட்டு, உங்கள் தேவைக்கு ஏற்றதைத் தேர்வு செய்ய எங்கள் ஷோரூமிற்கு வாருங்கள்.',
    mapTitle: 'மரக்காணத்தில் உள்ள ராசி டைம் சென்டர் வரைபடம்',
    address: 'No.5/2, Pondy Road, Marakkanam - 604303, Tamil Nadu',
    phoneLabel: 'தொலைபேசி',
    addressLabel: 'முகவரி',
    openMaps: 'வழியைத் திறக்கவும்',
    footer: 'மரக்காணத்தில் மொபைல்கள் மற்றும் வீட்டு உபகரணங்கள்.',
    redTheme: 'சிகப்பு',
    berryTheme: 'பெர்ரி',
  },
} as const;

const PRODUCTS = [
  { image: 'assets/hero-showcase/phone.webp', fallback: 'assets/hero-showcase/phone.png', position: 'phone' },
  { image: 'assets/hero-showcase/earbuds.webp', fallback: 'assets/hero-showcase/earbuds.png', position: 'audio' },
  { image: 'assets/hero-showcase/charger.webp', fallback: 'assets/hero-showcase/charger.png', position: 'accessories' },
  { image: 'assets/hero-showcase-appliances/tv.png', fallback: 'assets/hero-showcase-appliances/tv.png', position: 'tv' },
  { image: 'assets/hero-showcase-appliances/ac.png', fallback: 'assets/hero-showcase-appliances/ac.png', position: 'ac' },
  { image: 'assets/hero-showcase-appliances/washing-machine.png', fallback: 'assets/hero-showcase-appliances/washing-machine.png', position: 'home' },
] as const;

const COLLECTION_PRODUCTS = [
  ...PRODUCTS,
  { image: 'assets/hero-showcase-appliances/mixer-grinder.webp', fallback: 'assets/hero-showcase-appliances/mixer-grinder.png', position: 'mixer-grinder' },
  { image: 'assets/hero-showcase-appliances/blender.webp', fallback: 'assets/hero-showcase-appliances/blender.png', position: 'blender' },
  { image: 'assets/hero-showcase-appliances/table-fan.jpg', fallback: 'assets/hero-showcase-appliances/table-fan.jpg', position: 'table-fan' },
] as const;

const HERO_SLIDES = [
  { image: 'assets/about/showroom-interior-900.webp', position: 'showroom' },
  { image: 'assets/hero-showcase/phone.webp', position: 'phone' },
  { image: 'assets/hero-showcase-appliances/tv.png', position: 'television' },
  { image: 'assets/hero-showcase-appliances/ac.png', position: 'air-conditioner' },
  { image: 'assets/hero-showcase/earbuds.webp', position: 'audio' },
  { image: 'assets/hero-showcase-appliances/washing-machine.png', position: 'appliances' },
] as const;

const SHOP_ADDRESS = 'No.5/2, Pondy Road, Marakkanam - 604303, Tamil Nadu';
const LANGUAGE_KEY = 'rasi_landing_lang';
const THEME_KEY = 'rasi_landing_theme';

@Component({
  selector: 'app-landing-new',
  styleUrl: './landing-new.scss',
  templateUrl: './landing-new.html',
  host: {
    '[attr.data-theme]': 'theme()',
    '[attr.lang]': "language() === 'ta' ? 'ta' : 'en'",
  },
})
export class LandingNew {
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  readonly language = signal<Language>(this.readLanguage());
  readonly theme = signal<Theme>(this.readTheme());
  readonly activeHeroSlide = signal(0);
  readonly copy = computed(() => COPY[this.language()]);
  readonly products = PRODUCTS;
  readonly collectionProducts = COLLECTION_PRODUCTS;
  readonly heroSlides = HERO_SLIDES;
  readonly year = new Date().getFullYear();
  readonly mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP_ADDRESS)}`;
  readonly mapEmbedUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    `https://www.google.com/maps?q=${encodeURIComponent(SHOP_ADDRESS)}&output=embed`,
  );

  constructor() {
    this.title.setTitle('Rasi Time Center | Mobiles & Home Appliances');
    interval(5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.showNextHeroSlide());
  }

  setHeroSlide(index: number): void {
    this.activeHeroSlide.set(index);
  }

  private showNextHeroSlide(): void {
    this.activeHeroSlide.update((index) => (index + 1) % this.heroSlides.length);
  }

  setLanguage(language: Language): void {
    this.language.set(language);
    this.persist(LANGUAGE_KEY, language);
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    this.persist(THEME_KEY, theme);
  }

  private readLanguage(): Language {
    return this.readPreference(LANGUAGE_KEY) === 'ta' ? 'ta' : 'en';
  }

  private readTheme(): Theme {
    return this.readPreference(THEME_KEY) === 'berry' ? 'berry' : 'red';
  }

  private readPreference(key: string): string | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private persist(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Browser storage is optional; the current selection still applies.
    }
  }
}
