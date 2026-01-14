// Series Page JavaScript with Modern Slider
import tmdbService from '../api/tmdb.js';
import { getPlatformUrl } from '../core/platformRouter.js';
import { initCustomDropdowns } from '../components/customDropdown.js';

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

// Current state
let currentPage = 1;
let currentView = 'popular';
let currentFilters = {};
let isLoading = false;
let heroSlider = null;
let progressInterval = null;

document.addEventListener('DOMContentLoaded', async function() {
    initCustomDropdowns();
    console.log('Series page loaded, initializing...');
    
    // Check URL parameters for filters
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam) currentView = viewParam;
    setActiveHeaderView(currentView);

    const genreParam = urlParams.get('genre');
    
    // Setup filters
    setupYearFilter();
    setupEventListeners();
    
    // Set initial filters from URL params
    if (genreParam) {
        const genreId = getGenreIdFromName(genreParam);
        if (genreId) {
            document.getElementById('genre-filter').value = genreId;
        }
    }
    
    // Load hero slider and series
    await loadHeroSlider();
    await loadSeries();
});


function setActiveHeaderView(view) {
    document.querySelectorAll('.nav-container .nav-item[data-view]').forEach(item => {
        const v = item.getAttribute('data-view');
        if (v === view) item.classList.add('active');
        else item.classList.remove('active');
    });
}


async function loadHeroSlider() {
    try {
        console.log('Loading hero slider...');
        
        // Fetch trending series for slider
        const trending = await tmdbService.getTrending('tv', 'week');
        
        if (!trending.results || trending.results.length === 0) {
            console.warn('No trending series for slider');
            return;
        }
        
        // Take first 5 trending series for slider
        const sliderSeries = trending.results.slice(0, 5);
        
        // Create slider slides
        const sliderContent = document.getElementById('sliderContent');
        if (!sliderContent) return;
        
        sliderContent.innerHTML = '';
        
        sliderSeries.forEach((series, index) => {
            const formatted = tmdbService.formatContent(series, 'tv');
            const seasons = series.seasons ? series.seasons.length : 1;
            const status = series.status || 'Returning Series';
            
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            
            slide.innerHTML = `
                <div class="slide-background" 
                     style="background-image: url('${formatted.backdrop || formatted.poster || 'https://via.placeholder.com/1920x1080/2f2f2f/ffffff?text=No+Backdrop'}')">
                </div>
                <div class="slide-content">
                    <div class="slide-info">
                        <h2 class="slide-title">${formatted.title}</h2>
                        <div class="slide-meta">
                            <span><i class="fas fa-calendar-alt"></i> ${formatted.year || 'N/A'}</span>
                            <span><i class="fas fa-star"></i> ${formatted.rating}</span>
                            <span><i class="fas fa-layer-group"></i> ${seasons} ${seasons === 1 ? 'Season' : 'Seasons'}</span>
                        </div>
                        <p class="slide-description">${formatted.overview || 'No description available.'}</p>
                        <div class="slide-actions">
                            <button class="slide-btn primary" data-id="${series.id}" data-title="${formatted.title}" data-year="${formatted.year || ''}">
                                <i class="fas fa-play"></i> Watch Now
                            </button>
                            <button class="slide-btn secondary" data-id="${series.id}" data-title="${formatted.title}" data-year="${formatted.year || ''}">
                                <i class="fas fa-info-circle"></i> More Info
                            </button>
                        </div>
                        <div class="slide-badges">
                            <span class="seasons-badge">
                                <i class="fas fa-layer-group"></i> ${seasons} ${seasons === 1 ? 'Season' : 'Seasons'}
                            </span>
                            <span class="status-badge">
                                <i class="fas fa-broadcast-tower"></i> ${formatStatus(status)}
                            </span>
                        </div>
                    </div>
                </div>
            `;
            
            sliderContent.appendChild(slide);
        });
        
        // Initialize Swiper slider
        initializeSwiper();
        
        // Add event listeners to slider buttons
        setupSliderButtonListeners();
        
    } catch (error) {
        console.error('Error loading hero slider:', error);
        loadFallbackSlider();
    }
}

function initializeSwiper() {
    heroSlider = new Swiper('.hero-slider .swiper', {
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
            init: function() {
                updateProgressBar();
                forceClickability();
            },
            slideChange: function() {
                updateProgressBar();
            }
        }
    });
    
    forceClickability();
}

function forceClickability() {
    // Force slider navigation buttons to be clickable
    const prevBtn = document.querySelector('.prev-slide');
    const nextBtn = document.querySelector('.next-slide');
    
    if (prevBtn) {
        prevBtn.style.pointerEvents = 'auto';
        prevBtn.style.zIndex = '1001';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            heroSlider.slidePrev();
        };
    }
    
    if (nextBtn) {
        nextBtn.style.pointerEvents = 'auto';
        nextBtn.style.zIndex = '1001';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            heroSlider.slideNext();
        };
    }
    
    // Force slide buttons to be clickable
    setTimeout(() => {
        document.querySelectorAll('.slide-btn').forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.zIndex = '1001';
            btn.style.position = 'relative';
        });
    }, 100);
}

function setupSliderButtonListeners() {
    // Use event delegation for slide buttons
    document.addEventListener('click', function(e) {
        const slideBtn = e.target.closest('.slide-btn');
        if (!slideBtn) return;
        
        e.stopPropagation();
        e.preventDefault();
        
        const movieId = slideBtn.getAttribute('data-id');
        const title = slideBtn.getAttribute('data-title') || 
                     slideBtn.closest('.swiper-slide')?.querySelector('.slide-title')?.textContent;
        
        if (!movieId) return;
        
        if (slideBtn.classList.contains('primary')) {
            // Watch Now
            showPlatformSelection(movieId, title);
        } else if (slideBtn.classList.contains('secondary')) {
            // More Info
            window.location.href = getDetailsUrl({
                id: movieId,
                type: 'tv',
                title: slideBtn.getAttribute('data-title'),
                year: slideBtn.getAttribute('data-year')
            });
        }
    }, true); // Use capture phase to ensure event is caught
    
    // Also attach direct listeners as backup
    setTimeout(() => {
        document.querySelectorAll('.slide-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                
                const movieId = this.getAttribute('data-id');
                const title = this.getAttribute('data-title') || 
                            this.closest('.swiper-slide')?.querySelector('.slide-title')?.textContent;
                
                if (this.classList.contains('primary')) {
                    showPlatformSelection(movieId, title);
                } else {
                    window.location.href = getDetailsUrl({
                        id: movieId,
                        type: 'tv',
                        title: button.getAttribute('data-title'),
                        year: button.getAttribute('data-year')
                    });
                }
            }, { capture: true });
        });
    }, 500);
}

function showPlatformSelection(seriesId, title) {
    // Remove any existing modal
    const existingModal = document.querySelector('.platform-modal');
    if (existingModal) existingModal.remove();
    
    // Create modal
    const modalHTML = `
        <div class="platform-modal">
            <div class="platform-modal-content">
                <button class="modal-close">&times;</button>
                <h3>Where to Watch "${title}"</h3>
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
                border: 1px solid rgba(0, 168, 225, 0.3);
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
                border-color: #00A8E1;
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
                background: #00A8E1;
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
                background: #0088b8;
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
                type: 'tv',
                year: null,
                region: 'US',
                id: seriesId
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

function updateProgressBar() {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.style.transition = 'none';
        
        setTimeout(() => {
            progressBar.style.transition = 'width 5s linear';
            progressBar.style.width = '100%';
        }, 50);
    }
}

function formatStatus(status) {
    if (!status) return 'Unknown';
    
    const statusMap = {
        'Returning Series': 'Returning',
        'Ended': 'Ended',
        'Canceled': 'Canceled',
        'In Production': 'In Production',
        'Pilot': 'Pilot',
        'Planned': 'Planned'
    };
    
    return statusMap[status] || status;
}

// Setup functions
function setupYearFilter() {
    const yearFilter = document.getElementById('year-filter');
    if (!yearFilter) return;
    
    // Clear existing options except "All Years"
    while (yearFilter.options.length > 1) {
        yearFilter.remove(1);
    }
    
    // Add years from current year down to 2000
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 2000; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    }
}

function setupEventListeners() {
    // Filter change listeners
    document.getElementById('genre-filter')?.addEventListener('change', () => {
        currentPage = 1;
        loadSeries();
    });
    
    document.getElementById('status-filter')?.addEventListener('change', () => {
        currentPage = 1;
        loadSeries();
    });
    
    document.getElementById('year-filter')?.addEventListener('change', () => {
        currentPage = 1;
        loadSeries();
    });
    
    // Clear filters button
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
    
    // Retry button
    document.getElementById('retryButton')?.addEventListener('click', () => {
        currentPage = 1;
        loadSeries();
    });
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.getElementById('searchIcon');
    
    if (searchInput && searchIcon) {
        searchIcon.addEventListener('click', () => performSearch(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch(searchInput.value);
        });
    }
}

// Load series grid
async function loadSeries() {
    if (isLoading) return;
    
    console.log('Loading series, page:', currentPage);
    
    const seriesGrid = document.getElementById('series-grid');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const pagination = document.getElementById('pagination');
    
    // Show loading, hide error and pagination
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (errorMessage) errorMessage.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (seriesGrid) seriesGrid.innerHTML = '';
    
    isLoading = true;
    
    try {
        // Get current filter values
        const genreValue = document.getElementById('genre-filter')?.value || 'all';
        const statusValue = document.getElementById('status-filter')?.value || 'all';
        const yearValue = document.getElementById('year-filter')?.value || 'all';
        
        // Store current filters
        currentFilters = { genre: genreValue, status: statusValue, year: yearValue };
        
        // Fetch series from TMDB
        const seriesData = await fetchSeries(currentPage, currentFilters);
        
        // Display series
        displaySeries(seriesData);
        
        // Setup pagination
        if (seriesData.length >= 20) {
            setupPagination(currentPage);
        }
        
    } catch (error) {
        console.error('Error loading series:', error);
        showErrorState(error.message);
    } finally {
        isLoading = false;
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}



async function fetchSeries(page, filters) {
    try {
        let data;
        try {
            data = await tmdbService.getTVList(currentView || 'popular', page);
        } catch (e) {
            console.warn('Falling back to trending TV (list endpoint failed):', e?.message);
            data = await tmdbService.getTrending('tv', 'week');
        }

        if (!data.results) {
            throw new Error('No TV shows found');
        }

        let filtered = [...data.results];

        // Genre filter
        if (filters.genre !== 'all') {
            filtered = filtered.filter(show =>
                show.genre_ids && show.genre_ids.includes(parseInt(filters.genre))
            );
        }

        // Status filter (best-effort; list results don't include status, so we default)
        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(show => {
                const status = (show.status || 'Returning Series').toLowerCase();
                if (filters.status === 'returning') return status.includes('returning');
                if (filters.status === 'ended') return status.includes('ended');
                return true;
            });
        }

        // Year filter
        if (filters.year !== 'all') {
            filtered = filtered.filter(show => {
                const y = show.first_air_date ? show.first_air_date.split('-')[0] : null;
                return y === filters.year;
            });
        }

        // Default sort by popularity (client-side)
        filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        return filtered;
    } catch (error) {
        console.error('Error fetching TV shows:', error);
        throw error;
    }
}



function displaySeries(series) {
    const seriesGrid = document.getElementById('series-grid');
    if (!seriesGrid) return;
    
    if (!series || series.length === 0) {
        seriesGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-tv fa-3x"></i>
                <h3>No TV Series Found</h3>
                <p>Try adjusting your filters or search for something else</p>
                <button class="primary-button" id="clearFiltersBtn2">
                    <i class="fas fa-times"></i> Clear All Filters
                </button>
            </div>
        `;
        
        document.getElementById('clearFiltersBtn2')?.addEventListener('click', clearFilters);
        return;
    }
    
    // Clear and populate grid
    seriesGrid.innerHTML = '';
    
    series.forEach(show => {
        const seriesCard = createSeriesCard(show);
        seriesGrid.appendChild(seriesCard);
    });
}

function createSeriesCard(series) {
    const formatted = tmdbService.formatContent(series, 'tv');
    const seasonCount = series.seasons ? series.seasons.length : 1;
    const status = series.status || 'Returning Series';
    
    const card = document.createElement('div');
    card.className = 'series-card';
    card.dataset.id = series.id;
    
    card.innerHTML = `
        <div class="series-card-inner">
            <div class="series-poster">
                <img src="${formatted.poster || 'https://via.placeholder.com/500x750/2f2f2f/ffffff?text=No+Poster'}" 
                     alt="${formatted.title}" 
                     loading="lazy"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/500x750/2f2f2f/ffffff?text=No+Image'">
                <div class="series-overlay">
                    <button class="view-details-btn">
                        <i class="fas fa-play-circle"></i> View Details
                    </button>
                </div>
                <div class="season-badge">
                    <i class="fas fa-layer-group"></i> ${seasonCount} ${seasonCount === 1 ? 'Season' : 'Seasons'}
                </div>
            </div>
            <div class="series-info">
                <h3 class="series-title">${formatted.title}</h3>
                <div class="series-meta">
                    <span class="series-year">
                        <i class="fas fa-calendar-alt"></i> ${formatted.year || 'N/A'}
                    </span>
                    <span class="series-rating">
                        <i class="fas fa-star"></i> ${formatted.rating}
                    </span>
                </div>
                <div class="series-status">
                    <span class="status-badge ${status.toLowerCase().replace(' ', '_')}">
                        ${formatStatus(status)}
                    </span>
                </div>
            </div>
        </div>
    `;
    
    // Add click event for details
    const viewDetailsBtn = card.querySelector('.view-details-btn');
    if (viewDetailsBtn) {
        viewDetailsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.location.href = getDetailsUrl({
                id: series.id,
                type: 'tv',
                title: formatted.title,
                year: formatted.year
            });
        });
    }
    
    // Click on card itself goes to details
    card.addEventListener('click', function(e) {
        if (!e.target.closest('button') && !e.target.closest('.season-badge')) {
            window.location.href = getDetailsUrl({
                id: series.id,
                type: 'tv',
                title: formatted.title,
                year: formatted.year
            });
        }
    });
    
    return card;
}

function setupPagination(currentPage) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    pagination.style.display = 'flex';
    pagination.innerHTML = '';
    
    // Previous button
    const prevBtn = createPageButton('prev', currentPage <= 1, () => {
        if (currentPage > 1) {
            currentPage--;
            loadSeries();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    pagination.appendChild(prevBtn);
    
    // Current page indicator
    const pageIndicator = createPageButton(currentPage.toString(), true, null, true);
    pagination.appendChild(pageIndicator);
    
    // Next button
    const nextBtn = createPageButton('next', false, () => {
        currentPage++;
        loadSeries();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    pagination.appendChild(nextBtn);
}

function createPageButton(content, disabled, onClick, isActive = false) {
    const button = document.createElement('button');
    button.className = `page-btn ${isActive ? 'active' : ''}`;
    button.disabled = disabled;
    
    if (content === 'prev') {
        button.innerHTML = '<i class="fas fa-chevron-left"></i>';
    } else if (content === 'next') {
        button.innerHTML = '<i class="fas fa-chevron-right"></i>';
    } else {
        button.textContent = content;
    }
    
    if (!disabled && onClick) {
        button.addEventListener('click', onClick);
    }
    
    return button;
}

function clearFilters() {
    document.getElementById('genre-filter').value = 'all';
    document.getElementById('status-filter').value = 'all';
    document.getElementById('year-filter').value = 'all';
    currentPage = 1;
    
    // Reload series
    loadSeries();
}

function showErrorState(errorMessage = 'Unknown error') {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'flex';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-2x"></i>
            <div>
                <h3>Error Loading TV Series</h3>
                <p>${errorMessage}</p>
                <button class="retry-button" id="retryButton">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
        
        // Re-attach event listener
        document.getElementById('retryButton')?.addEventListener('click', () => {
            currentPage = 1;
            loadSeries();
        });
    }
}

function performSearch(query) {
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
        window.location.href = `/search?q=${encodeURIComponent(trimmedQuery)}`;
    }
}

function getGenreIdFromName(genreName) {
    const genreMap = {
        'action': '10759',
        'comedy': '35',
        'drama': '18',
        'sci-fi': '10765',
        'crime': '80',
        'documentary': '99',
        'kids': '10762',
        'mystery': '9648',
        'family': '10751',
        'soap': '10766'
    };
    return genreMap[genreName.toLowerCase()];
}
