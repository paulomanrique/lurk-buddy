import { APP_NAME } from '@shared/constants';

const GA_MEASUREMENT_ID = 'G-20M514BLMM';
const GA_SCRIPT_ID = 'google-analytics';

let initialized = false;

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
}

function injectAnalyticsScript(): void {
  if (document.getElementById(GA_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement('script');
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function sanitizeParams(params: AnalyticsParams = {}): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  ) as Record<string, string | number | boolean>;
}

export function initializeAnalytics(): void {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  ensureDataLayer();
  injectAnalyticsScript();
  window.gtag?.('js', new Date());
  window.gtag?.('config', GA_MEASUREMENT_ID, {
    app_name: APP_NAME,
    send_page_view: false
  });
  initialized = true;
}

export function trackEvent(name: string, params: AnalyticsParams = {}): void {
  initializeAnalytics();
  window.gtag?.('event', name, sanitizeParams(params));
}

export function trackScreenView(screenName: string, params: AnalyticsParams = {}): void {
  trackEvent('screen_view', {
    app_name: APP_NAME,
    screen_name: screenName,
    ...params
  });
}
