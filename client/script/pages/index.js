// /script/pages/index.js - Optimized Homepage
import tmdbService from '../api/tmdb.js';
import { getPlatformUrl } from '../core/platformRouter.js';
import { getTaste, updateTaste, bumpMedia } from '../core/taste.js';

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildContentSlug(title, year) {
    const base = slugify(title);
    if (!base) return '';
    const yearValue = Number.isFinite(Number(year)) ? String(year) : '';
    return yearValue ? `${base}-${yearValue}` : base;
}

function getDetailsUrl({ id, type, title, year }) {
    const safeType = type === 'tv' ? 'tv' : 'movie';
    const slug = buildContentSlug(title, year);
    if (slug) return `/${safeType}/${slug}`;
    return `/details.html?id=${id}&type=${safeType}`;
}

function getTopTasteKey(map) {
    if (!map || typeof map !== 'object') return '';
    let bestKey = '';
    let bestValue = -Infinity;
    Object.entries(map).forEach(([key, value]) => {
        const score = Number(value) || 0;
        if (score > bestValue) {
            bestValue = score;
            bestKey = key;
        }
    });
    return bestKey;
}

function isDebugAnalyticsEnabled() {
    try {
        if (localStorage.getItem('debug_analytics') === '1') return true;
    } catch (e) {}
    try {
        return new URLSearchParams(window.location.search).get('debug') === '1';
    } catch (e) {}
    return false;
}

function track(event, meta = {}) {
    if (isDebugAnalyticsEnabled()) {
        console.log('[analytics]', event, meta);
    }
    fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event,
            meta,
            ts: Date.now()
        })
    }).catch(() => {});
}

class Homepage {
    constructor() {
        this.heroSlider = null;
        this.isLoading = false;
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes

        // UI/filters state
        this.currentMediaType = 'all'; // 'all' | 'movie' | 'tv'
        this.activeQuickFilter = 'trending'; // 'trending' | 'new' | 'popular' | 'top'
        this.activeGenreId = null;
        this.activeGenreName = null;

        // Base datasets (used for filtering without re-fetching)
        this.trendingBase = [];
        this.newReleasesBase = [];
        this.topRatedBase = [];

        // Search studio suggestions
        this.searchHints = [
            'space adventure',
            '90s comedy',
            'mind-bending thriller',
            'K-drama romance',
            'animated family movie',
            'true crime series'
        ];

        // Decide-for-me state
        this.decide = {
            step: 1,
            mood: null,
            format: 'all',
            time: 'any'
        };
        this.decideUI = {
            bound: false,
            isOpen: false,
            lastToggle: 0,
            isRunning: false
        };
        this.sliderInteractionsBound = false;
    }
    
    async init() {
        try {
            console.log('🚀 Homepage initialization started');
            
            // Load critical content first
            await Promise.allSettled([
                this.initHeroSlider(),
                this.loadTrendingContent()
            ]);
            
            // Load secondary content
            this.loadLazyContent();
            
            // Setup interactions
            this.setupInteractions();
            this.setupSearchStudio();
            this.setupDecideForMe();
            this.setupDecideIntro();
            this.setupCategoryBrowse();
            this.setupRevealAnimations();
            
            console.log('✅ Homepage initialized');
        } catch (error) {
            console.error('❌ Homepage initialization failed:', error);
            this.showErrorState();
        }
    }
    
    async initHeroSlider() {
        const sliderContent = document.getElementById('sliderContent');
        if (!sliderContent) return;
        
        try {
            const cacheKey = 'hero_slider';
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                this.renderSliderContent(cached);
            } else {
                this.showSliderLoading();
                const trending = await tmdbService.getTrending('movie', 'week');
                this.saveToCache(cacheKey, trending.results.slice(0, 5));
                this.renderSliderContent(trending.results.slice(0, 5));
            }
            
            this.initSwiper();
        } catch (error) {
            console.error('Slider error:', error);
            this.loadFallbackSlider();
        }
    }
    
    renderSliderContent(movies) {
        const sliderContent = document.getElementById('sliderContent');
        if (!sliderContent) return;
        
        sliderContent.innerHTML = movies.map((movie, index) => {
            const formatted = tmdbService.formatContent(movie, 'movie');
            const background = formatted.backdrop || formatted.poster || 
                              'https://images.unsplash.com/photo-1536440136628-849c177e76a1';
            
            return `
                <div class="swiper-slide" role="group" aria-roledescription="slide" aria-label="Slide ${index + 1}">
                    <div class="slide-background" 
                         style="background-image: url('${background}')"
                         aria-hidden="true">
                        <div class="slide-overlay"></div>
                    </div>
                    <div class="slide-content">
                        <div class="slide-info">
                            <h2 class="slide-title">${formatted.title}</h2>
                            <div class="slide-meta">
                                <span><i class="fas fa-calendar-alt" aria-hidden="true"></i> ${formatted.year || 'N/A'}</span>
                                <span><i class="fas fa-star" aria-hidden="true"></i> ${formatted.rating || 'N/A'}</span>
                                <span><i class="fas fa-film" aria-hidden="true"></i> Movie</span>
                            </div>
                            <p class="slide-description">${this.truncateText(formatted.overview, 150)}</p>
                            <div class="slide-actions">
                                <button class="slide-btn primary" 
                                        data-id="${movie.id}" 
                                        data-title="${this.escapeHtml(formatted.title)}"
                                        data-year="${formatted.year || ''}"
                                        aria-label="Watch ${formatted.title}">
                                    <i class="fas fa-play" aria-hidden="true"></i> Watch Now
                                </button>
                                <button class="slide-btn secondary" 
                                        data-id="${movie.id}"
                                        data-title="${this.escapeHtml(formatted.title)}"
                                        data-year="${formatted.year || ''}"
                                        aria-label="More info about ${formatted.title}">
                                    <i class="fas fa-info-circle" aria-hidden="true"></i> More Info
                                </button>
                            </div>
                            <div class="slide-badges">
                                <span class="badge rating">
                                    <i class="fas fa-star" aria-hidden="true"></i> ${formatted.rating !== 'N/A' ? `${formatted.rating}/10` : 'N/A'}
                                </span>
                                <span class="badge trending">
                                    <i class="fas fa-fire" aria-hidden="true"></i> Trending
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        this.setupSliderInteractions();
    }
    
    
    initSwiper() {
        // Index swiper uses the same core behavior as Movies/Series,
        // but stays independent (separate instance + selectors).
        this.heroSlider = new Swiper('.hero-slider', {
            direction: 'horizontal',
            loop: true,
            speed: 800,
            autoplay: {
                delay: 5000,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.slider-pagination',
                clickable: true,
                dynamicBullets: true,
            },
            navigation: {
                nextEl: '.next-slide',
                prevEl: '.prev-slide',
            },
            effect: 'fade',
            fadeEffect: {
                crossFade: true
            },
            on: {
                init: (swiper) => this.updateProgressBar(swiper),
                slideChange: (swiper) => this.updateProgressBar(swiper),
            }
        });
    }
    
    updateProgressBar(swiper) {
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.style.transition = 'none';
            
            requestAnimationFrame(() => {
                progressBar.style.transition = `width ${swiper.params.autoplay.delay}ms linear`;
                progressBar.style.width = '100%';
            });
        }
    }
    
    setupSliderInteractions() {
        if (this.sliderInteractionsBound) return;
        this.sliderInteractionsBound = true;
        document.addEventListener('click', (e) => {
            const slideBtn = e.target.closest('.slide-btn');
            if (!slideBtn) return;
            
            const movieId = slideBtn.dataset.id;
            const title = slideBtn.dataset.title;
            const year = slideBtn.dataset.year;
            
            if (!movieId) return;
            
            if (slideBtn.classList.contains('primary')) {
                this.showPlatformSelection(movieId, title);
            } else {
                window.location.href = getDetailsUrl({
                    id: movieId,
                    type: 'movie',
                    title,
                    year
                });
            }
        });
    }
    
    
    async loadTrendingContent() {
        const container = document.getElementById('trendingContent');
        if (!container) return;

        try {
            const cacheKey = `trending_${this.currentMediaType}`;
            const cached = this.getFromCache(cacheKey);

            if (cached) {
                this.trendingBase = cached;
                this.renderTrendingWithFilters(container);
            } else {
                this.showLoading(container);
                const trending = await tmdbService.getTrending(this.currentMediaType, 'week');
                this.trendingBase = trending.results || [];
                this.saveToCache(cacheKey, this.trendingBase);
                this.renderTrendingWithFilters(container);
            }

            // Update the "Tonight's pick" card
            this.updatePickCard();
    } catch (error) {
        console.error('Trending error:', error);
        this.showError(container, 'Failed to load trending content');
    }
}
    
    async loadLazyContent() {
        // Load non-critical content with lower priority
        const promises = [
            this.lazyLoadSection('newReleasesContent', 'new_releases', () => 
                tmdbService.getTrending('movie', 'week').then(data => 
                    [...data.results].sort((a, b) => 
                        (b.release_date || '').localeCompare(a.release_date || '')
                    ).slice(0, 6)
                )
            ),
            this.lazyLoadSection('topRatedContent', 'top_rated', () => 
                tmdbService.getTrending('movie', 'week').then(data => 
                    [...data.results].sort((a, b) => 
                        (b.vote_average || 0) - (a.vote_average || 0)
                    ).slice(0, 8)
                )
            )
        ];
        
        // Use requestIdleCallback for better performance
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                Promise.allSettled(promises).then(results => {
                    console.log('Lazy loading completed:', results);
                });
            });
        } else {
            setTimeout(() => {
                Promise.allSettled(promises);
            }, 1000);
        }
    }
    
    
    async lazyLoadSection(containerId, cacheKey, fetchFn) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const cached = this.getFromCache(cacheKey);
            let data;

            if (cached) {
                data = cached;
            } else {
                data = await fetchFn();
                this.saveToCache(cacheKey, data);
            }

            // Store base data for filtering
            if (containerId === 'newReleasesContent') this.newReleasesBase = data || [];
            if (containerId === 'topRatedContent') this.topRatedBase = data || [];

            // Render with current filters
            const filtered = this.applyQuickFilterSort(this.applyGenreFilter(data || []));
            const limit = containerId === 'newReleasesContent' ? 6 : 8;
            this.renderContentGrid(filtered.slice(0, limit), container);
        } catch (error) {
            console.error(`Error loading ${containerId}:`, error);
            // Don't show error for non-critical sections
        }
    }
    
    renderContentGrid(items, container) {
        if (!container) return;
        
        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1">
                    <i class="fas fa-film"></i>
                    <h3>No content available</h3>
                    <p>Please check back later</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = items.map(item => {
            const type = item.media_type || (item.title ? 'movie' : 'tv');
            const formatted = tmdbService.formatContent(item, type);
            
            return `
                <article class="content-card" role="article" aria-label="${formatted.title}" data-id="${item.id}" data-type="${type}" data-title="${this.escapeHtml(formatted.title)}" data-year="${formatted.year || ''}" tabindex="0">
                    <div class="card-poster">
                        <img src="${formatted.poster}" 
                             alt="${formatted.title}"
                             loading="lazy"
                             width="500"
                             height="750"
                             onerror="this.src='https://via.placeholder.com/500x750/1a1a1a/ffffff?text=+'">
                        <div class="card-overlay">
                            <button class="watch-btn" 
                                    onclick="window.showPlatformSelection(${item.id}, '${this.escapeString(formatted.title)}', '${type}')"
                                    aria-label="Watch ${formatted.title}">
                                <i class="fas fa-play" aria-hidden="true"></i>
                                Watch Now
                            </button>
                        </div>
                    </div>
                    <div class="card-info">
                        <h3 class="card-title">${formatted.title}</h3>
                        <div class="card-meta">
                            <span>${type === 'movie' ? 'Movie' : 'TV Show'}</span>
                            <span class="card-rating">
                                <i class="fas fa-star" aria-hidden="true"></i>
                                ${formatted.rating || 'N/A'}
                            </span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
        
        // Setup card click handlers
        container.querySelectorAll('.content-card').forEach(card => {
            const id = card.dataset.id;
            const type = card.dataset.type;
            const title = card.dataset.title;
            const year = card.dataset.year;

            card.addEventListener('click', (e) => {
                if (!id || !type) return;
                if (!e.target.closest('button')) {
                    window.location.href = getDetailsUrl({
                        id,
                        type,
                        title,
                        year
                    });
                }
            });
            
            // Keyboard navigation
            card.addEventListener('keydown', (e) => {
                if (!id || !type) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    window.location.href = getDetailsUrl({
                        id,
                        type,
                        title,
                        year
                    });
                }
            });
        });
    }
    

    // --- Filtering helpers ---
    applyGenreFilter(items) {
        if (!this.activeGenreId) return items;
        const gid = Number(this.activeGenreId);
        return (items || []).filter(item => Array.isArray(item.genre_ids) && item.genre_ids.includes(gid));
    }

    applyQuickFilterSort(items) {
        const list = [...(items || [])];
        switch (this.activeQuickFilter) {
            case 'new':
                return list.sort((a, b) => (b.release_date || b.first_air_date || '').localeCompare(a.release_date || a.first_air_date || ''));
            case 'popular':
                return list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            case 'top':
                return list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
            case 'trending':
            default:
                return list;
        }
    }

    renderTrendingWithFilters(container) {
        if (!container) return;

        let items = this.trendingBase || [];
        items = this.applyGenreFilter(items);
        items = this.applyQuickFilterSort(items);

        const visible = items.slice(0, 8);
        this.renderContentGrid(visible, container);

        if (this.activeGenreId) {
            const label = this.activeGenreName || 'Category';
            this.setStudioHint(`Now showing: ${label} • ${items.length} match${items.length !== 1 ? 'es' : ''}`);
        }
    }

    renderSecondarySectionsWithFilters() {
        // New releases
        const newContainer = document.getElementById('newReleasesContent');
        if (newContainer && Array.isArray(this.newReleasesBase) && this.newReleasesBase.length) {
            const filtered = this.applyQuickFilterSort(this.applyGenreFilter(this.newReleasesBase)).slice(0, 6);
            this.renderContentGrid(filtered, newContainer);
        }

        // Top rated
        const topContainer = document.getElementById('topRatedContent');
        if (topContainer && Array.isArray(this.topRatedBase) && this.topRatedBase.length) {
            const filtered = this.applyQuickFilterSort(this.applyGenreFilter(this.topRatedBase)).slice(0, 8);
            this.renderContentGrid(filtered, topContainer);
        }
    }

    // --- Search studio ---
    setupSearchStudio() {
        const hintEl = document.getElementById('studioHint');
        if (hintEl) {
            // Rotate lightweight hints
            let idx = 0;
            setInterval(() => {
                const input = document.getElementById('mainSearchInput');
                if (!input || input.value.trim()) return;
                const hint = this.searchHints[idx % this.searchHints.length];
                this.setStudioHint(`Try: “${hint}”`);
                idx++;
            }, 3200);
        }

        // Pick card click => use suggestion
        const pickCard = document.getElementById('pickCard');
        const applyPick = () => {
            const q = pickCard?.dataset?.query;
            const input = document.getElementById('mainSearchInput');
            if (q && input) {
                input.value = q;
                this.performSearch(q);
            }
        };
        pickCard?.addEventListener('click', applyPick);
        pickCard?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                applyPick();
            }
        });
    }

    setStudioHint(text) {
        const hintEl = document.getElementById('studioHint');
        if (!hintEl) return;
        hintEl.textContent = text || '';
    }

    updatePickCard() {
        const pickTitle = document.getElementById('pickTitle');
        const pickSub = document.getElementById('pickSub');
        const pickCard = document.getElementById('pickCard');
        if (!pickTitle || !pickSub || !pickCard) return;

        const pool = (this.trendingBase || []).filter(i => (i.title || i.name));
        const pick = pool[Math.floor(Math.random() * Math.max(pool.length, 1))];
        const title = pick?.title || pick?.name || 'Try a trending title';
        pickTitle.textContent = title;
        pickSub.textContent = 'Tap to search';
        pickCard.dataset.query = title;
    }

    setupMainVoiceSearch(inputEl, buttonEl, onComplete) {
        if (!buttonEl || !inputEl) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            buttonEl.style.display = 'none';
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let isListening = false;

        const stop = () => {
            isListening = false;
            buttonEl.classList.remove('listening');
            try { recognition.stop(); } catch (e) {}
        };

        buttonEl.addEventListener('click', () => {
            if (isListening) return stop();
            try {
                isListening = true;
                buttonEl.classList.add('listening');
                recognition.start();

                setTimeout(() => {
                    if (isListening) stop();
                }, 10000);
            } catch (e) {
                stop();
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript?.trim();
            if (transcript) {
                inputEl.value = transcript;
                this.setStudioHint(`🎙️ Heard: ${transcript}`);
                onComplete?.();
            }
            stop();
        };

        recognition.onerror = () => stop();
        recognition.onend = () => stop();
    }

    // --- Browse by category ---
    setupCategoryBrowse() {
        const cards = document.querySelectorAll('.category-card[data-genre-id]');
        const clearBtn = document.getElementById('clearGenreFilter');

        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                // allow open-in-new-tab behavior
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;

                e.preventDefault();
                const gid = Number(card.dataset.genreId);
                const name = card.dataset.genreName || card.querySelector('h3')?.textContent || 'Category';
                this.setActiveGenre(gid, name);

                // Scroll to content
                document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        clearBtn?.addEventListener('click', () => {
            this.setActiveGenre(null, null);
        });
    }

    setActiveGenre(genreId, genreName) {
        this.activeGenreId = genreId ? Number(genreId) : null;
        this.activeGenreName = genreName || null;

        // UI state
        document.querySelectorAll('.category-card').forEach(c => c.classList.toggle('is-active', Number(c.dataset.genreId) === this.activeGenreId));
        const pill = document.getElementById('activeGenreFilter');
        const nameEl = document.getElementById('activeGenreName');
        if (pill && nameEl) {
            if (this.activeGenreId) {
                pill.hidden = false;
                nameEl.textContent = this.activeGenreName || 'Category';
            } else {
                pill.hidden = true;
                nameEl.textContent = '—';
                this.setStudioHint('');
            }
        }

        // Re-render sections with the new genre filter
        const trendingContainer = document.getElementById('trendingContent');
        if (trendingContainer) this.renderTrendingWithFilters(trendingContainer);
        this.renderSecondarySectionsWithFilters();
        this.updatePickCard();
    }

    // --- Reveal animations ---
    setupRevealAnimations() {
        const sections = document.querySelectorAll('main section');
        sections.forEach(sec => sec.classList.add('reveal'));

        if (!('IntersectionObserver' in window)) {
            sections.forEach(sec => sec.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        sections.forEach(sec => observer.observe(sec));
    }

    setupInteractions() {
        // Main search (Search Studio)
        const mainSearchInput = document.getElementById('mainSearchInput');
        const mainSearchBtn = document.getElementById('mainSearchBtn');
        const mainVoiceBtn = document.getElementById('mainVoiceBtn');
        const mainRandomBtn = document.getElementById('mainRandomBtn');

        if (mainSearchInput && mainSearchBtn) {
            const go = () => this.performSearch(mainSearchInput.value);

            mainSearchBtn.addEventListener('click', go);
            mainSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') go();
            });

            // Mood chips => prefill and search
            document.querySelectorAll('.mood-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const q = chip.dataset.query || '';
                    if (q) {
                        mainSearchInput.value = q;
                        go();
                    }
                });
            });

            // "Surprise" => pick a random hint or trending title
            mainRandomBtn?.addEventListener('click', () => {
                const pool = [];
                if (Array.isArray(this.trendingBase)) {
                    this.trendingBase.slice(0, 10).forEach(item => {
                        const title = item.title || item.name;
                        if (title) pool.push(title);
                    });
                }
                this.searchHints.forEach(h => pool.push(h));
                const pick = pool[Math.floor(Math.random() * pool.length)] || 'popular movies';
                mainSearchInput.value = pick;
                this.setStudioHint(`🎲 Surprise: ${pick}`);
                go();
            });

    // Voice search (Web Speech API)
    this.setupMainVoiceSearch(mainSearchInput, mainVoiceBtn, () => go());
}
        
        // Quick filters
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.filterQuickSearch(chip.dataset.filter);
                this.renderSecondarySectionsWithFilters();
            });
        });
        
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterContentByType(btn.dataset.type);
            });
        });
        
        // Platform cards
        document.querySelectorAll('.platform-card').forEach(card => {
            card.addEventListener('click', () => {
                const platform = card.dataset.platform;
                const url = getPlatformUrl({
                    platformKey: platform,
                    title: '',
                    type: 'movie',
                    year: null,
                    region: 'US'
                });
                if (url) {
                    window.open(url, '_blank', 'noopener');
                }
            });
        });
        
        // CTA buttons
        document.getElementById('enableNotificationsBtn')?.addEventListener('click', () => {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        });
        
        // Back to top
        document.getElementById('backToTop')?.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        // Setup scroll for back to top
        window.addEventListener('scroll', () => {
            const backToTop = document.getElementById('backToTop');
            if (backToTop) {
                backToTop.classList.toggle('visible', window.scrollY > 500);
            }
        });
    }

    // =============================
    // Decide For Me (Homepage CTA)
    // =============================

    setupDecideForMe() {
        const modal = document.getElementById('decideModal');
        const openBtn = document.getElementById('decideBtn');
        if (!modal || !openBtn) return;
        if (this.decideUI?.bound) return;
        this.decideUI.bound = true;

        const closeEls = modal.querySelectorAll('[data-decide-close]');
        const backBtn = document.getElementById('decideBackBtn');
        const againBtn = document.getElementById('decideAgainBtn');

        const onClose = (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            this.closeDecideModal();
        };
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openDecideModal();
        });
        closeEls.forEach(el => el.addEventListener('click', onClose));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) this.closeDecideModal();
        });

        backBtn?.addEventListener('click', () => {
            if (this.decide.step > 1) this.showDecideStep(this.decide.step - 1);
        });

        againBtn?.addEventListener('click', () => {
            // Re-roll results with the same selections
            this.runDecideSearch();
        });

        // Delegate chip clicks
        modal.addEventListener('click', (e) => {
            const chip = e.target.closest('.decide-chip');
            if (!chip) return;

            const mood = chip.dataset.mood;
            const format = chip.dataset.format;
            const time = chip.dataset.time;

            if (this.decide.step === 1 && mood) {
                this.decide.mood = mood;
                this.syncDecideSelection(modal);
                this.showDecideStep(2);
            } else if (this.decide.step === 2 && format) {
                this.decide.format = format;
                this.syncDecideSelection(modal);
                this.showDecideStep(3);
            } else if (this.decide.step === 3 && time) {
                this.decide.time = time;
                this.runDecideSearch();
            }
        });
    }


    setupDecideIntro() {
        const intro = document.getElementById('decideIntro');
        if (!intro) return;
        if (this.decideIntro?.bound) return;

        this.decideIntro = { bound: true, isOpen: false, timer: null };

        const startBtn = document.getElementById('decideIntroStart');
        const laterBtn = document.getElementById('decideIntroLater');
        const closeEls = intro.querySelectorAll('[data-decide-intro-close]');

        const markSeen = () => {
            try {
                localStorage.setItem('decide_intro_seen', '1');
            } catch (e) {
                // Ignore storage failures (e.g., private mode)
            }
        };

        const closeIntro = (openDecide = false) => {
            if (!intro.hidden) {
                intro.hidden = true;
                intro.setAttribute('aria-hidden', 'true');
                this.decideIntro.isOpen = false;
            }
            markSeen();
            if (openDecide) this.openDecideModal();
        };

        startBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeIntro(true);
        });

        laterBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeIntro(false);
        });

        closeEls.forEach((el) => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeIntro(false);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !intro.hidden) {
                closeIntro(false);
            }
        });

        const shouldShow = () => {
            try {
                return localStorage.getItem('decide_intro_seen') !== '1';
            } catch (e) {
                return false;
            }
        };

        if (shouldShow()) {
            this.decideIntro.timer = window.setTimeout(() => {
                if (!shouldShow()) return;
                const decideModal = document.getElementById('decideModal');
                if (decideModal && !decideModal.hidden) return;
                intro.hidden = false;
                intro.setAttribute('aria-hidden', 'false');
                this.decideIntro.isOpen = true;
            }, 650);
        }
    }

    openDecideModal() {
        const modal = document.getElementById('decideModal');
        if (!modal) return;
        const intro = document.getElementById('decideIntro');
        if (this.decideIntro?.timer) {
            clearTimeout(this.decideIntro.timer);
            this.decideIntro.timer = null;
        }
        if (intro && !intro.hidden) {
            intro.hidden = true;
            intro.setAttribute('aria-hidden', 'true');
            if (this.decideIntro) this.decideIntro.isOpen = false;
            try {
                localStorage.setItem('decide_intro_seen', '1');
            } catch (e) {
                // Ignore storage failures (e.g., private mode)
            }
        }
        if (!this.decideUI) {
            this.decideUI = { bound: false, isOpen: false, lastToggle: 0 };
        }
        const now = performance.now();
        if (now - this.decideUI.lastToggle < 150) return;
        if (this.decideUI.isOpen && !modal.hidden) return;
        this.decideUI.isOpen = true;
        this.decideUI.lastToggle = now;

        // Ensure we have some data to pick from (best effort)
        if (!Array.isArray(this.trendingBase) || this.trendingBase.length === 0) {
            // Kick off fetch without blocking the UI
            this.loadTrendingContent().catch(() => {});
        }

        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        track('decide_open');

        // Reset state
        this.decide = { step: 1, mood: null, format: 'all', time: 'any' };
        this.showDecideStep(1);
        this.applyTasteDefaults(modal);
    }

    closeDecideModal() {
        const modal = document.getElementById('decideModal');
        if (!modal) return;
        if (!this.decideUI) {
            this.decideUI = { bound: false, isOpen: false, lastToggle: 0 };
        }
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        this.decideUI.isOpen = false;
        this.decideUI.lastToggle = performance.now();
    }

    showDecideStep(step) {
        const modal = document.getElementById('decideModal');
        if (!modal) return;

        this.decide.step = step;

        modal.querySelectorAll('.decide-step').forEach(el => {
            el.hidden = String(el.dataset.step) !== String(step);
        });

        // Dots
        modal.querySelectorAll('.decide-progress .dot').forEach(dot => {
            dot.classList.toggle('is-active', String(dot.dataset.dot) === String(step));
        });

        // Back button
        const backBtn = document.getElementById('decideBackBtn');
        if (backBtn) backBtn.hidden = step <= 1;

        // Subtitle
        const sub = document.getElementById('decideSubtitle');
        if (sub) {
            const lines = {
                1: 'Pick a vibe.',
                2: 'Choose the format.',
                3: 'Choose your time.',
                4: 'Here are your picks.'
            };
            sub.textContent = lines[step] || 'Answer a few quick questions.';
        }
    }

    async runDecideSearch() {
        if (this.decideUI?.isRunning) return;
        this.decideUI.isRunning = true;
        this.showDecideStep(4);
        const loading = document.getElementById('decideLoading');
        const resultsEl = document.getElementById('decideResults');
        if (loading) loading.hidden = false;
        if (resultsEl) resultsEl.innerHTML = '';

        try {
            const picks = await this.getDecidePicks();
            this.renderDecideResults(picks);
            track('decide_complete', { picks: Array.isArray(picks) ? picks.length : 0 });
            if (this.decide.mood) {
                updateTaste({ moods: { [this.decide.mood]: 1 } });
            }
            if (this.decide.format && this.decide.format !== 'all') {
                bumpMedia(this.decide.format);
            }
        } catch (e) {
            console.error('Decide-for-me failed:', e);
            if (resultsEl) {
                resultsEl.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1">
                        <i class="fas fa-triangle-exclamation"></i>
                        <h3>Couldn’t generate picks</h3>
                        <p>Try again in a moment.</p>
                    </div>
                `;
            }
        } finally {
            if (loading) loading.hidden = true;
            if (this.decideUI) this.decideUI.isRunning = false;
        }
    }

    getMoodGenres(mood) {
        // TMDB Movie/TV genre IDs (common)
        const map = {
            boom: [28, 12],          // Action, Adventure
            laugh: [35],             // Comedy
            brainy: [53, 9648],      // Thriller, Mystery
            sci: [878, 14],          // Sci-Fi, Fantasy
            romance: [10749],        // Romance
            spooky: [27],            // Horror
            chill: [18],             // Drama
            family: [10751, 16]      // Family, Animation
        };
        return map[mood] || [];
    }

    applyTasteDefaults(modal) {
        const taste = getTaste();
        if (!this.decide.mood) {
            const topMood = getTopTasteKey(taste.moods);
            if (topMood) this.decide.mood = topMood;
        }
        if (this.decide.format === 'all') {
            const topMedia = getTopTasteKey(taste.media);
            if (topMedia === 'movie' || topMedia === 'tv') {
                this.decide.format = topMedia;
            }
        }
        this.syncDecideSelection(modal);
    }

    syncDecideSelection(modal) {
        if (!modal) return;
        modal.querySelectorAll('.decide-chip').forEach((chip) => {
            const mood = chip.dataset.mood;
            const format = chip.dataset.format;
            if (mood) {
                chip.classList.toggle('is-selected', this.decide.mood === mood);
            }
            if (format) {
                chip.classList.toggle('is-selected', this.decide.format === format);
            }
        });
    }

    timeMatches(minutes, timeChoice) {
        if (!minutes || !Number.isFinite(minutes)) return timeChoice === 'any';
        switch (timeChoice) {
            case 'short': return minutes < 90;
            case 'medium': return minutes >= 90 && minutes <= 120;
            case 'long': return minutes > 120;
            case 'any':
            default: return true;
        }
    }

    shuffle(arr) {
        const a = [...(arr || [])];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    async getDecidePicks() {
        const taste = getTaste();
        const moodGenres = this.getMoodGenres(this.decide.mood);
        let format = this.decide.format || 'all';
        if (format === 'all') {
            const topMedia = getTopTasteKey(taste.media);
            if (topMedia === 'movie' || topMedia === 'tv') format = topMedia;
        }
        const timeChoice = this.decide.time || 'any';

        const base = Array.isArray(this.trendingBase) ? this.trendingBase : [];

        // Filter by format
        const byFormat = base.filter(item => {
            const type = item.media_type || (item.title ? 'movie' : 'tv');
            if (format === 'all') return true;
            return type === format;
        });

        // Filter by mood (genre)
        let byMood = moodGenres.length
            ? byFormat.filter(item => {
                const ids = Array.isArray(item.genre_ids) ? item.genre_ids : [];
                return moodGenres.some(g => ids.includes(g));
            })
            : byFormat;

        if (!moodGenres.length && taste.genres && Object.keys(taste.genres).length) {
            const tasteIds = this.getTasteGenreIds(taste.genres);
            if (tasteIds.length) {
                byMood = byFormat.filter(item => {
                    const ids = Array.isArray(item.genre_ids) ? item.genre_ids : [];
                    return tasteIds.some(g => ids.includes(g));
                });
            }
        }

        const pool = byMood.length ? byMood : byFormat.length ? byFormat : base;
        const candidates = this.getTasteWeightedCandidates(pool, taste.genres || {}).slice(0, 14);

        const picks = [];

        for (const item of candidates) {
            if (picks.length >= 3) break;

            const type = item.media_type || (item.title ? 'movie' : 'tv');
            try {
                let minutes = null;
                let details = null;
                if (type === 'movie') {
                    details = await tmdbService.getMovieDetails(item.id);
                    minutes = Number(details?.runtime) || null;
                } else {
                    details = await tmdbService.getTVDetails(item.id);
                    const er = details?.episode_run_time;
                    minutes = Array.isArray(er) ? Number(er[0]) || null : null;
                }

                if (!this.timeMatches(minutes, timeChoice)) continue;

                picks.push({
                    item,
                    type,
                    minutes,
                    details
                });
            } catch (e) {
                // If details fail, still allow a pick when time = any
                if (timeChoice === 'any' && picks.length < 3) {
                    picks.push({ item, type, minutes: null, details: null });
                }
            }
        }

        // Fallback if we couldn't fill 3
        if (picks.length < 3) {
            const fill = this.shuffle(pool)
                .filter(i => !picks.some(p => p.item?.id === i.id))
                .slice(0, 3 - picks.length)
                .map(i => ({ item: i, type: i.media_type || (i.title ? 'movie' : 'tv'), minutes: null, details: null }));
            picks.push(...fill);
        }

        return picks.slice(0, 3);
    }

    getTasteGenreIds(genreWeights) {
        const map = {
            action: 28,
            adventure: 12,
            comedy: 35,
            drama: 18,
            thriller: 53,
            mystery: 9648,
            'sci-fi': 878,
            scifi: 878,
            fantasy: 14,
            romance: 10749,
            horror: 27,
            family: 10751,
            animation: 16,
            crime: 80,
            documentary: 99
        };
        const ids = [];
        Object.keys(genreWeights || {}).forEach((key) => {
            const id = map[String(key || '').toLowerCase()];
            if (id) ids.push(id);
        });
        return Array.from(new Set(ids));
    }

    getTasteWeightedCandidates(items, genreWeights) {
        const weights = {};
        Object.entries(genreWeights || {}).forEach(([key, value]) => {
            const normalized = String(key || '').toLowerCase();
            const id = this.getTasteGenreIds({ [normalized]: 1 })[0];
            if (id) weights[id] = (Number(value) || 0);
        });

        if (!Object.keys(weights).length) return this.shuffle(items);

        const scored = items.map((item) => {
            const ids = Array.isArray(item.genre_ids) ? item.genre_ids : [];
            let score = 0;
            ids.forEach((gid) => {
                const weight = weights[gid] || 0;
                if (weight) score += weight;
            });
            return { item, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const top = scored.filter((entry) => entry.score > 0).map((entry) => entry.item);
        const rest = scored.filter((entry) => entry.score === 0).map((entry) => entry.item);
        const mixed = [...this.shuffle(top), ...this.shuffle(rest)];
        return mixed;
    }

    renderDecideResults(picks) {
        const resultsEl = document.getElementById('decideResults');
        if (!resultsEl) return;

        if (!Array.isArray(picks) || picks.length === 0) {
            resultsEl.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1">
                    <i class="fas fa-film"></i>
                    <h3>No matches found</h3>
                    <p>Try a different mood or time.</p>
                </div>
            `;
            return;
        }

        resultsEl.innerHTML = picks.map(({ item, type, minutes }) => {
            const formatted = tmdbService.formatContent(item, type);
            const year = formatted.year || 'N/A';
            const rating = formatted.rating || 'N/A';
            const runtime = minutes ? `${minutes}m` : (this.decide.time === 'any' ? '—' : '—');
            const safeTitle = this.escapeString(formatted.title);
            const detailsUrl = getDetailsUrl({
                id: item.id,
                type,
                title: formatted.title,
                year
            });

            return `
                <div class="decide-card" role="article" aria-label="${this.escapeHtml(formatted.title)}">
                    <img src="${formatted.backdrop || formatted.poster}" alt="${this.escapeHtml(formatted.title)}" loading="lazy"
                        onerror="this.src='https://via.placeholder.com/800x450/1a1a1a/ffffff?text=+'">
                    <div class="decide-card-body">
                        <div class="decide-card-title">${this.escapeHtml(formatted.title)}</div>
                        <div class="decide-card-meta">
                            <span><i class="fas fa-calendar-alt" aria-hidden="true"></i> ${year}</span>
                            <span><i class="fas fa-star" aria-hidden="true"></i> ${rating}</span>
                            <span><i class="fas fa-${type === 'movie' ? 'film' : 'tv'}" aria-hidden="true"></i> ${type === 'movie' ? 'Movie' : 'TV'}</span>
                            <span><i class="fas fa-clock" aria-hidden="true"></i> ${runtime}</span>
                        </div>
                        <div class="decide-card-actions">
                            <button class="decide-action primary" type="button"
                                onclick="window.showPlatformSelection(${item.id}, '${safeTitle}', '${type}')">
                                <i class="fas fa-play" aria-hidden="true"></i> Watch
                            </button>
                            <button class="decide-action secondary" type="button"
                                onclick="window.location.href='${detailsUrl}'">
                                <i class="fas fa-info-circle" aria-hidden="true"></i> Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    
filterQuickSearch(filter) {
    this.activeQuickFilter = filter || 'trending';
    const container = document.getElementById('trendingContent');
    if (!container) return;

    this.renderTrendingWithFilters(container);
}
    
    
    async filterContentByType(type) {
        const container = document.getElementById('trendingContent');
        if (!container) return;

        this.showLoading(container);

        try {
            const mediaType = type === 'all' ? 'all' : (type === 'movies' ? 'movie' : 'tv');
            this.currentMediaType = mediaType;

            const cacheKey = `trending_${mediaType}`;
            const cached = this.getFromCache(cacheKey);

            if (cached) {
                this.trendingBase = cached;
            } else {
                const trending = await tmdbService.getTrending(mediaType, 'week');
                this.trendingBase = trending.results || [];
                this.saveToCache(cacheKey, this.trendingBase);
            }

        this.renderTrendingWithFilters(container);
        this.updatePickCard();
    } catch (error) {
        this.showError(container, `Failed to load ${type} content`);
    }
}
    
    performSearch(query) {
        const trimmedQuery = query.trim();
        if (trimmedQuery) {
            window.location.href = `/search?q=${encodeURIComponent(trimmedQuery)}`;
        }
    }
    
    showPlatformSelection(id, title, type = 'movie') {
        // Remove any existing modal
        const existingModal = document.querySelector('.platform-modal');
        if (existingModal) existingModal.remove();
        
        // Create modal for platform selection
        const modalHTML = `
            <div class="platform-modal">
                <div class="platform-modal-content">
                    <button class="modal-close">&times;</button>
                    <h3>Where to Watch "${this.escapeHtml(title)}"</h3>
                    <div class="platforms-list">
                        <div class="platform-option" data-platform="netflix">
                            <i class="fab fa-netflix"></i>
                            <span>Netflix</span>
                        </div>
                        <div class="platform-option" data-platform="prime">
                            <i class="fab fa-amazon"></i>
                            <span>Amazon Prime</span>
                        </div>
                        <div class="platform-option" data-platform="disney">
                            <i class="fab fa-disney"></i>
                            <span>Disney+</span>
                        </div>
                        <div class="platform-option" data-platform="hulu">
                            <i class="fab fa-hulu"></i>
                            <span>Hulu</span>
                        </div>
                        <div class="platform-option" data-platform="hbo">
                            <i class="fab fa-hbo"></i>
                            <span>HBO Max</span>
                        </div>
                        <div class="platform-option" data-platform="apple">
                            <i class="fab fa-apple"></i>
                            <span>Apple TV+</span>
                        </div>
                        <div class="platform-option" data-platform="oneshows">
                            <i class="fas fa-globe"></i>
                            <span>1Shows</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add modal styles if not already added
        if (!document.getElementById('platform-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'platform-modal-styles';
            styles.textContent = `
                .platform-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.95);
                    z-index: 9999;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    animation: fadeIn 0.3s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .platform-modal-content {
                    background: #1a1a1a;
                    border-radius: 15px;
                    padding: 40px;
                    max-width: 500px;
                    width: 100%;
                    position: relative;
                    border: 1px solid rgba(229, 9, 20, 0.3);
                    animation: slideUp 0.3s ease;
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .platform-modal-content h3 {
                    font-size: 1.8rem;
                    margin-bottom: 30px;
                    text-align: center;
                    color: white;
                }
                .platforms-list {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .platform-option {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 2px solid transparent;
                }
                .platform-option:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: #E50914;
                    transform: translateY(-2px);
                }
                .platform-option i {
                    font-size: 2rem;
                    width: 40px;
                    text-align: center;
                }
                .platform-option[data-platform="netflix"] i { color: #E50914; }
                .platform-option[data-platform="prime"] i { color: #00A8E1; }
                .platform-option[data-platform="disney"] i { color: #0063e5; }
                .platform-option[data-platform="hulu"] i { color: #1ce783; }
                .platform-option[data-platform="hbo"] i { color: #00a8e1; }
                .platform-option[data-platform="apple"] i { color: #A2AAAD; }
                .platform-option[data-platform="oneshows"] i { color: #F4B400; }
                .platform-option span {
                    font-size: 1.2rem;
                    color: white;
                    font-weight: 600;
                }
                .modal-close {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: #E50914;
                    color: white;
                    border: none;
                    width: 35px;
                    height: 35px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 1.2rem;
                    transition: all 0.3s ease;
                }
                .modal-close:hover {
                    background: #b20710;
                    transform: scale(1.1);
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Add event listeners
        const modal = document.querySelector('.platform-modal');
        const closeBtn = modal.querySelector('.modal-close');
        
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        // Platform selection
        modal.querySelectorAll('.platform-option').forEach(option => {
            option.addEventListener('click', () => {
                const platform = option.getAttribute('data-platform');
                const url = getPlatformUrl({
                    platformKey: platform,
                    title,
                    type,
                    year: null,
                    region: 'US',
                    id
                });
                if (url) {
                    window.open(url, '_blank', 'noopener');
                }
                modal.remove();
            });
        });
        
        // Escape key to close
        document.addEventListener('keydown', function closeOnEscape(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', closeOnEscape);
            }
        });
    }
    
    showSliderLoading() {
        const sliderContent = document.getElementById('sliderContent');
        if (sliderContent) {
            sliderContent.innerHTML = `
                <div class="swiper-slide">
                    <div class="slide-loading">
                        <div class="loading-spinner"></div>
                        <p>Loading featured content...</p>
                    </div>
                </div>
            `;
        }
    }
    
    showLoading(container) {
        if (container) {
            container.innerHTML = `
                <div class="loading-state" style="grid-column: 1 / -1">
                    <div class="loading-spinner"></div>
                    <p>Loading content...</p>
                </div>
            `;
        }
    }
    
    showError(container, message) {
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="grid-column: 1 / -1">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Content</h3>
                    <p>${message || 'Please try again later'}</p>
                    <button class="retry-btn" onclick="location.reload()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }
    
    showErrorState() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = `
                <section class="error-section">
                    <div class="container">
                        <i class="fas fa-exclamation-circle"></i>
                        <h2>Something went wrong</h2>
                        <p>We're having trouble loading the content. Please try refreshing the page.</p>
                        <button onclick="location.reload()" class="cta-btn primary">
                            <i class="fas fa-redo"></i> Refresh Page
                        </button>
                    </div>
                </section>
            `;
        }
    }
    
    loadFallbackSlider() {
        const sliderContent = document.getElementById('sliderContent');
        if (!sliderContent) return;
        
        sliderContent.innerHTML = `
            <div class="swiper-slide">
                <div class="slide-background" 
                     style="background-image: url('https://images.unsplash.com/photo-1536440136628-849c177e76a1')">
                    <div class="slide-overlay"></div>
                </div>
                <div class="slide-content">
                    <div class="slide-info">
                        <h2 class="slide-title">Welcome to StreamFinder</h2>
                        <p class="slide-description">Discover movies and TV shows across all streaming platforms.</p>
                        <div class="slide-actions">
                            <button class="slide-btn primary" onclick="window.location.href='/movies'">
                                <i class="fas fa-play"></i> Browse Movies
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getFromCache(key) {
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < this.cacheDuration) {
            return item.data;
        }
        this.cache.delete(key);
        return null;
    }
    
    saveToCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    escapeString(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
    
    truncateText(text, length) {
        if (!text) return 'No description available.';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }
}

// Initialize homepage
document.addEventListener('DOMContentLoaded', async () => {
    const homepage = new Homepage();
    await homepage.init();
    
    // Make methods available globally
    window.showPlatformSelection = homepage.showPlatformSelection.bind(homepage);
    window.performSearch = homepage.performSearch.bind(homepage);
    
    // Performance mark
    performance.mark('homepage_loaded');
});
