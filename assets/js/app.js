/**
 * Dynamic Pricing Website Client Application
 * Vanilla JavaScript, zero dependencies, accessible, secure, and reactive.
 */

(function () {
  'use strict';

  // Configuration with safe defaults
  const config = window.__APP_CONFIG__ || {
    apiUrl: 'http://localhost:8787',
    brandName: 'Subscription Portal',
    contactUrl: 'https://t.me/your_telegram_bot',
    contactText: 'Support & Order',
    defaultLang: 'fa',
    cacheTtlMs: 60000,
    enableDemoModeOnFailure: false
  };

  // Translations dictionary
  const i18n = {
    fa: {
      siteTitle: 'پلن‌های اشتراک',
      badgeActive: 'سرویس فعال',
      heroTitle: 'پلن‌های ویژه',
      heroSubtitle: 'سریع، پایدار و با دسترسی نامحدود. پلن مناسب خود را انتخاب کنید.',
      loading: 'در حال بارگذاری پلن‌ها...',
      errorTitle: 'خطا در دریافت اطلاعات',
      errorMsg: 'امکان اتصال به سرور جهت دریافت تعرفه‌ها وجود ندارد. لطفاً اتصال اینترنت خود را بررسی کنید.',
      offlineMsg: 'دستگاه شما در حالت آفلاین است.',
      retryBtn: 'تلاش مجدد',
      emptyTitle: 'پلنی یافت نشد',
      emptyMsg: 'در حال حاضر هیچ پلنی تعریف نشده است. لطفاً بعداً بررسی نمایید.',
      orderBtn: 'سفارش و مشاوره',
      popularBadge: 'ویژه',
      lastUpdated: 'آخرین به‌روزرسانی: ',
      justNow: 'همین الان',
      features: [
        'کیفیت و پایداری بالا',
        'تحویل آنی پس از ثبت سفارش',
        'پشتیبانی فنی سریع'
      ],
      defaultCurrency: 'تومان'
    },
    en: {
      siteTitle: 'Subscription Plans',
      badgeActive: 'Service Active',
      heroTitle: 'Available Plans',
      heroSubtitle: 'Fast, stable, and highly reliable. Choose the subscription that fits your needs.',
      loading: 'Loading pricing plans...',
      errorTitle: 'Failed to Load Plans',
      errorMsg: 'Unable to retrieve the latest pricing from the server. Please check your connection.',
      offlineMsg: 'You are currently offline.',
      retryBtn: 'Try Again',
      emptyTitle: 'No Plans Available',
      emptyMsg: 'There are currently no active plans listed. Please check back later.',
      orderBtn: 'Order & Inquire',
      popularBadge: 'Popular',
      lastUpdated: 'Last updated: ',
      justNow: 'Just now',
      features: [
        'High speed & low latency',
        'Instant automated delivery',
        'Fast customer support'
      ],
      defaultCurrency: 'TOMAN'
    }
  };

  // State Management
  const state = {
    lang: localStorage.getItem('site_lang') || config.defaultLang || 'fa',
    theme: localStorage.getItem('site_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
    loading: true,
    error: null,
    data: null,
    lastFetchedAt: null,
    isOffline: !navigator.onLine
  };

  // Cache key in sessionStorage for quick load
  const CACHE_STORAGE_KEY = 'pricing_api_cache_v1';

  // DOM Elements
  const elements = {
    html: document.documentElement,
    brandName: document.getElementById('brand-name'),
    heroBadgeText: document.getElementById('hero-badge-text'),
    pageTitle: document.getElementById('page-title'),
    pageDescription: document.getElementById('page-description'),
    plansContainer: document.getElementById('plans-container'),
    alertBanner: document.getElementById('alert-banner'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    langToggleBtn: document.getElementById('lang-toggle-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    lastUpdatedEl: document.getElementById('last-updated'),
    contactLink: document.getElementById('contact-link'),
    footerBrand: document.getElementById('footer-brand'),
    footerYear: document.getElementById('footer-year')
  };

  /**
   * Safe text escaping helper for DOM elements
   */
  function setText(el, text) {
    if (el) {
      el.textContent = text == null ? '' : String(text);
    }
  }

  /**
   * Digits converter for Persian
   */
  function toPersianDigits(numStr) {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(numStr).replace(/[0-9]/g, (w) => persianDigits[+w]);
  }

  /**
   * Format numbers with commas (e.g., 99000 -> 99,000)
   */
  function formatNumber(num, isPersian) {
    const formatted = Number(num).toLocaleString('en-US');
    return isPersian ? toPersianDigits(formatted) : formatted;
  }

  /**
   * Format relative/absolute date
   */
  function formatDate(isoString, lang) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 2) {
        return i18n[lang].justNow;
      }

      if (lang === 'fa') {
        const pDate = new Intl.DateTimeFormat('fa-IR', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(date);
        return pDate;
      } else {
        return new Intl.DateTimeFormat('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(date);
      }
    } catch {
      return '';
    }
  }

  /**
   * Apply current theme (dark or light)
   */
  function applyTheme(theme) {
    state.theme = theme;
    elements.html.setAttribute('data-theme', theme);
    localStorage.setItem('site_theme', theme);

    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      elements.themeToggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      // Update sun/moon icon visibility
      const sunIcon = elements.themeToggleBtn.querySelector('.icon-sun');
      const moonIcon = elements.themeToggleBtn.querySelector('.icon-moon');
      if (sunIcon && moonIcon) {
        sunIcon.style.display = theme === 'dark' ? 'block' : 'none';
        moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
      }
    }
  }

  /**
   * Apply current language (fa or en)
   */
  function applyLanguage(lang) {
    state.lang = lang;
    elements.html.setAttribute('lang', lang);
    elements.html.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
    localStorage.setItem('site_lang', lang);

    const t = i18n[lang];

    if (elements.langToggleBtn) {
      elements.langToggleBtn.textContent = lang === 'fa' ? 'EN' : 'FA';
      elements.langToggleBtn.setAttribute('aria-label', lang === 'fa' ? 'Switch to English' : 'تغییر به فارسی');
    }

    if (elements.heroBadgeText) {
      setText(elements.heroBadgeText, t.badgeActive);
    }

    // Update title/description if not overridden by API response
    if (!state.data || !state.data.title) {
      setText(elements.pageTitle, t.heroTitle);
    }
    setText(elements.pageDescription, t.heroSubtitle);

    if (elements.contactLink) {
      setText(elements.contactLink, t.orderBtn);
    }

    // Re-render plans with current language settings
    if (state.data) {
      renderPlans(state.data);
    } else if (state.error) {
      renderError(state.error);
    }
  }

  /**
   * Render loading skeleton cards
   */
  function renderSkeleton() {
    if (!elements.plansContainer) return;
    elements.plansContainer.innerHTML = '';

    const count = 3;
    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'plan-card skeleton-card';
      card.setAttribute('aria-hidden', 'true');

      card.innerHTML = `
        <div class="skeleton-box skeleton-title"></div>
        <div class="skeleton-box skeleton-desc"></div>
        <div class="skeleton-box skeleton-price"></div>
        <div class="skeleton-box skeleton-line"></div>
        <div class="skeleton-box skeleton-line" style="width: 70%"></div>
        <div class="skeleton-box skeleton-btn"></div>
      `;
      elements.plansContainer.appendChild(card);
    }
  }

  /**
   * Render error state
   */
  function renderError(message) {
    if (!elements.plansContainer) return;
    elements.plansContainer.innerHTML = '';

    const t = i18n[state.lang];

    const container = document.createElement('div');
    container.className = 'state-container error';

    const icon = document.createElement('div');
    icon.className = 'state-icon';
    icon.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    const title = document.createElement('h3');
    title.className = 'state-title';
    setText(title, t.errorTitle);

    const desc = document.createElement('p');
    desc.className = 'state-msg';
    setText(desc, message || t.errorMsg);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'state-action';
    retryBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> <span>${t.retryBtn}</span>`;
    retryBtn.addEventListener('click', () => {
      fetchPrices(true);
    });

    container.appendChild(icon);
    container.appendChild(title);
    container.appendChild(desc);
    container.appendChild(retryBtn);

    elements.plansContainer.appendChild(container);
  }

  /**
   * Render empty state
   */
  function renderEmpty() {
    if (!elements.plansContainer) return;
    elements.plansContainer.innerHTML = '';

    const t = i18n[state.lang];

    const container = document.createElement('div');
    container.className = 'state-container';

    const icon = document.createElement('div');
    icon.className = 'state-icon';
    icon.innerHTML = `<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;

    const title = document.createElement('h3');
    title.className = 'state-title';
    setText(title, t.emptyTitle);

    const desc = document.createElement('p');
    desc.className = 'state-msg';
    setText(desc, t.emptyMsg);

    container.appendChild(icon);
    container.appendChild(title);
    container.appendChild(desc);

    elements.plansContainer.appendChild(container);
  }

  /**
   * Render pricing cards securely
   */
  function renderPlans(data) {
    if (!elements.plansContainer) return;
    elements.plansContainer.innerHTML = '';

    const t = i18n[state.lang];
    const isFa = state.lang === 'fa';

    // Update page title if provided from the server
    if (data && data.title) {
      setText(elements.pageTitle, data.title);
      document.title = `${data.title} | ${config.brandName || 'Portal'}`;
    } else {
      setText(elements.pageTitle, t.heroTitle);
      document.title = `${t.siteTitle} | ${config.brandName || 'Portal'}`;
    }

    // Update last updated timestamp
    if (data && data.updatedAt && elements.lastUpdatedEl) {
      const formattedDate = formatDate(data.updatedAt, state.lang);
      setText(elements.lastUpdatedEl, `${t.lastUpdated}${formattedDate}`);
    }

    const plans = (data && Array.isArray(data.plans)) ? data.plans : [];

    if (plans.length === 0) {
      renderEmpty();
      return;
    }

    // Determine featured plan (middle plan or the one with featured flag)
    const featuredIndex = Math.floor(plans.length / 2);

    plans.forEach((plan, index) => {
      const isFeatured = plan.featured === true || (!plans.some(p => p.featured) && index === featuredIndex);

      const card = document.createElement('article');
      card.className = `plan-card${isFeatured ? ' featured' : ''}`;

      // Featured badge
      if (isFeatured) {
        const badge = document.createElement('div');
        badge.className = 'card-badge';
        setText(badge, plan.badge || t.popularBadge);
        card.appendChild(badge);
      }

      // Card Header
      const header = document.createElement('div');
      header.className = 'card-header';

      const name = document.createElement('h2');
      name.className = 'plan-name';
      
      // Technical plan name (e.g. 50GB) wrapped with directional isolation
      const nameSpan = document.createElement('span');
      nameSpan.className = 'num-ltr';
      setText(nameSpan, plan.name);
      name.appendChild(nameSpan);
      header.appendChild(name);

      if (plan.description) {
        const desc = document.createElement('p');
        desc.className = 'plan-desc';
        setText(desc, plan.description);
        header.appendChild(desc);
      }
      card.appendChild(header);

      // Card Pricing
      const pricing = document.createElement('div');
      pricing.className = 'card-pricing';

      const amountSpan = document.createElement('span');
      amountSpan.className = 'plan-amount num-ltr';

      if (typeof plan.amount === 'number') {
        setText(amountSpan, formatNumber(plan.amount, isFa));
      } else {
        setText(amountSpan, String(plan.displayPrice || plan.amount || ''));
      }
      pricing.appendChild(amountSpan);

      const currencySpan = document.createElement('span');
      currencySpan.className = 'plan-currency';
      const currencyLabel = plan.currencyLabel || (data.currency === 'TOMAN' ? (isFa ? 'تومان' : 'Toman') : (data.currency || t.defaultCurrency));
      setText(currencySpan, currencyLabel);
      pricing.appendChild(currencySpan);

      card.appendChild(pricing);

      // Features list
      const featuresList = document.createElement('ul');
      featuresList.className = 'card-features';

      const features = Array.isArray(plan.features) && plan.features.length > 0 
        ? plan.features 
        : t.features;

      features.forEach((featText) => {
        const li = document.createElement('li');
        li.className = 'card-feature-item';
        
        // SVG checkmark
        li.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        
        const span = document.createElement('span');
        setText(span, featText);
        li.appendChild(span);
        featuresList.appendChild(li);
      });
      card.appendChild(featuresList);

      // Action CTA Button
      const actionDiv = document.createElement('div');
      actionDiv.className = 'card-action';

      const orderBtn = document.createElement('a');
      orderBtn.className = 'btn-order';
      
      // Generate order link with plan pre-filled if using Telegram
      let orderHref = config.contactUrl || '#';
      if (orderHref.includes('t.me') && plan.name) {
        const paramSymbol = orderHref.includes('?') ? '&' : '?';
        const orderParam = encodeURIComponent(`Order_${plan.name.replace(/\s+/g, '_')}`);
        orderHref = `${orderHref}${paramSymbol}text=${orderParam}`;
      }
      orderBtn.href = orderHref;
      orderBtn.target = '_blank';
      orderBtn.rel = 'noopener noreferrer';
      setText(orderBtn, t.orderBtn);

      actionDiv.appendChild(orderBtn);
      card.appendChild(actionDiv);

      elements.plansContainer.appendChild(card);
    });
  }

  /**
   * Realistic fallback demo data (only used if explicitly enabled on failure)
   */
  function getDemoData() {
    return {
      title: state.lang === 'fa' ? 'تعرفه‌های ویژه' : 'Special Plans',
      currency: 'TOMAN',
      updatedAt: new Date().toISOString(),
      plans: [
        { id: '10gb', name: '10GB', amount: 99000, displayPrice: '99,000 تومان' },
        { id: '20gb', name: '20GB', amount: 169000, displayPrice: '169,000 تومان' },
        { id: '30gb', name: '30GB', amount: 229000, displayPrice: '229,000 تومان', featured: true },
        { id: '50gb', name: '50GB', amount: 349000, displayPrice: '349,000 تومان' },
        { id: '100gb', name: '100GB', amount: 649000, displayPrice: '649,000 تومان' }
      ]
    };
  }

  /**
   * Fetch prices from Cloudflare Worker API
   */
  async function fetchPrices(forceRefresh = false) {
    state.loading = true;
    state.error = null;

    if (elements.refreshBtn) {
      elements.refreshBtn.classList.add('spin');
      elements.refreshBtn.disabled = true;
    }

    // Try reading from cache if not force refreshing
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(CACHE_STORAGE_KEY);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          const age = Date.now() - (parsedCache.timestamp || 0);
          if (age < (config.cacheTtlMs || 60000)) {
            state.data = parsedCache.data;
            state.loading = false;
            if (elements.refreshBtn) {
              elements.refreshBtn.classList.remove('spin');
              elements.refreshBtn.disabled = false;
            }
            renderPlans(state.data);
            return;
          }
        }
      } catch {
        // Ignore cache parse errors
      }
    }

    // If no existing data in memory, show loading skeleton
    if (!state.data) {
      renderSkeleton();
    }

    // Check offline state
    if (!navigator.onLine) {
      state.isOffline = true;
      showOfflineAlert(true);
      if (!state.data) {
        state.error = i18n[state.lang].offlineMsg;
        renderError(state.error);
      }
      if (elements.refreshBtn) {
        elements.refreshBtn.classList.remove('spin');
        elements.refreshBtn.disabled = false;
      }
      return;
    }

    const apiUrl = (config.apiUrl || '').replace(/\/+$/, '');
    const endpoint = `${apiUrl}/api/prices`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const json = await response.json();

      if (!json || typeof json !== 'object') {
        throw new Error('Invalid JSON format from API');
      }

      state.data = json;
      state.lastFetchedAt = Date.now();

      // Save to sessionStorage
      try {
        sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({
          data: json,
          timestamp: Date.now()
        }));
      } catch {
        // Ignore storage quota errors
      }

      showOfflineAlert(false);
      renderPlans(json);
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Pricing API request failed:', err.message);

      if (config.enableDemoModeOnFailure) {
        showDemoAlert(true);
        state.data = getDemoData();
        renderPlans(state.data);
      } else {
        state.error = i18n[state.lang].errorMsg;
        if (!state.data) {
          renderError(state.error);
        }
      }
    } finally {
      state.loading = false;
      if (elements.refreshBtn) {
        elements.refreshBtn.classList.remove('spin');
        elements.refreshBtn.disabled = false;
      }
    }
  }

  /**
   * Banner alert helpers
   */
  function showOfflineAlert(visible) {
    if (!elements.alertBanner) return;
    if (visible) {
      elements.alertBanner.className = 'alert-banner offline visible';
      elements.alertBanner.textContent = i18n[state.lang].offlineMsg;
    } else if (!elements.alertBanner.classList.contains('demo')) {
      elements.alertBanner.className = 'alert-banner';
    }
  }

  function showDemoAlert(visible) {
    if (!elements.alertBanner) return;
    if (visible) {
      elements.alertBanner.className = 'alert-banner demo visible';
      elements.alertBanner.textContent = 'Showing demo data (API is unreachable)';
    } else {
      elements.alertBanner.className = 'alert-banner';
    }
  }

  /**
   * Initialize DOM event listeners
   */
  function initEvents() {
    // Theme toggle
    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.addEventListener('click', () => {
        const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
      });
    }

    // Language toggle
    if (elements.langToggleBtn) {
      elements.langToggleBtn.addEventListener('click', () => {
        const nextLang = state.lang === 'fa' ? 'en' : 'fa';
        applyLanguage(nextLang);
      });
    }

    // Refresh button
    if (elements.refreshBtn) {
      elements.refreshBtn.addEventListener('click', () => {
        fetchPrices(true);
      });
    }

    // Online / Offline events
    window.addEventListener('online', () => {
      state.isOffline = false;
      showOfflineAlert(false);
      fetchPrices(true);
    });

    window.addEventListener('offline', () => {
      state.isOffline = true;
      showOfflineAlert(true);
    });
  }

  /**
   * Boot the client application
   */
  function init() {
    // Setup footer and brand labels
    if (elements.brandName) {
      setText(elements.brandName, config.brandName);
    }
    if (elements.footerBrand) {
      setText(elements.footerBrand, config.brandName);
    }
    if (elements.footerYear) {
      setText(elements.footerYear, String(new Date().getFullYear()));
    }
    if (elements.contactLink && config.contactUrl) {
      elements.contactLink.href = config.contactUrl;
    }

    initEvents();
    applyTheme(state.theme);
    applyLanguage(state.lang);
    fetchPrices();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
