// Movies Page JavaScript - OPTIMIZED
import tmdbService from '../api/tmdb.js';
import { getPlatformUrl } from '../core/platformRouter.js';

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
import { initCustomDropdowns } from '../components/customDropdown.js';

let heroSlider = null;
let currentPage = 1;
let currentView = 'popular';
let currentFilters = {};
let isLoading = false;

document.addEventListener('DOMContentLoaded', async function() {
    initCustomDropdowns();
    console.log('Movies page loaded');
    
    setupYearFilter();
    setupEventListeners();

    // URL parameters (from index "Browse by Category")
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam) currentView = viewParam;
    setActiveHeaderView(currentView);

    const genreParam = urlParams.get('genre');
    if (genreParam) {
        const genreId = /^\d+$/.test(genreParam) ? parseInt(genreParam, 10) : getGenreIdFromName(genreParam);
        if (genreId) {
            const genreSelect = document.getElementById('genre-filter');
            if (genreSelect) genreSelect.value = String(genreId);
        }
    }

    await loadHeroSlider();
    await loadMovies();
});


function setActiveHeaderView(view) {
    // Highlight the matching header link (data-view)
    document.querySelectorAll('.nav-container .nav-item[data-view]').forEach(item => {
        const v = item.getAttribute('data-view');
        if (v === view) item.classList.add('active');
        else item.classList.remove('active');
    });
}


async function loadHeroSlider() {
    try {
        const trending = await tmdbService.getTrending('movie', 'week');
        
        if (!trending.results || trending.results.length === 0) {
            loadFallbackSlider();
            return;
        }
        
        const sliderMovies = trending.results.slice(0, 5);
        const sliderContent = document.getElementById('sliderContent');
        
        if (!sliderContent) return;
        
        sliderContent.innerHTML = '';
        
        sliderMovies.forEach((movie, index) => {
            const formatted = tmdbService.formatContent(movie, 'movie');
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            
            // Shorten description
            let description = formatted.overview || 'No description available.';
            if (description.length > 150) {
                description = description.substring(0, 150) + '...';
            }
            
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
                            <span><i class="fas fa-clock"></i> ${getRandomDuration()}</span>
                        </div>
                        <p class="slide-description">${description}</p>
                        <div class="slide-actions">
                            <button class="slide-btn primary watch-now-btn" 
                                    data-id="${movie.id}" 
                                    data-title="${formatted.title}"
                                    data-year="${formatted.year || ''}"
                                    style="pointer-events: auto; z-index: 1001; position: relative;">
                                <i class="fas fa-play"></i> Watch Now
                            </button>
                            <button class="slide-btn secondary more-info-btn" 
                                    data-id="${movie.id}"
                                    data-title="${formatted.title}"
                                    data-year="${formatted.year || ''}"
                                    style="pointer-events: auto; z-index: 1001; position: relative;">
                                <i class="fas fa-info-circle"></i> More Info
                            </button>
                        </div>
                        <div class="slide-badges">
                            <span class="badge rating">
                                <i class="fas fa-star"></i> ${formatted.rating}/10
                            </span>
                            <span class="badge trending">
                                <i class="fas fa-fire"></i> Trending
                            </span>
                        </div>
                    </div>
                </div>
            `;
            
            sliderContent.appendChild(slide);
        });
        
        initializeSwiper();
        setupButtonListeners();
        forceClickability();
        
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
            },
            slideChange: function() {
                updateProgressBar();
            }
        }
    });
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
            heroSlider?.slidePrev();
        };
    }
    
    if (nextBtn) {
        nextBtn.style.pointerEvents = 'auto';
        nextBtn.style.zIndex = '1001';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            heroSlider?.slideNext();
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

// ROBUST BUTTON LISTENERS
function setupButtonListeners() {
    // Use event delegation on the entire document
    document.addEventListener('click', function(e) {
        // Watch Now buttons
        if (e.target.closest('.watch-now-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const button = e.target.closest('.watch-now-btn');
            const movieId = button.getAttribute('data-id');
            const title = button.getAttribute('data-title');
            
            console.log('Watch Now clicked:', title);
            showPlatformSelection(movieId, title);
            return false;
        }
        
        // More Info buttons
        if (e.target.closest('.more-info-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const button = e.target.closest('.more-info-btn');
            const movieId = button.getAttribute('data-id');
            const title = button.getAttribute('data-title');
            const year = button.getAttribute('data-year');
            
            console.log('More Info clicked for movie:', movieId);
            window.location.href = getDetailsUrl({
                id: movieId,
                type: 'movie',
                title,
                year
            });
            return false;
        }
        
        // Navigation buttons
        if (e.target.closest('.prev-slide')) {
            e.preventDefault();
            e.stopPropagation();
            heroSlider?.slidePrev();
            return false;
        }
        
        if (e.target.closest('.next-slide')) {
            e.preventDefault();
            e.stopPropagation();
            heroSlider?.slideNext();
            return false;
        }
    }, true); // Use capture phase
    
    // Also attach direct listeners as backup
    setTimeout(() => {
        document.querySelectorAll('.watch-now-btn, .more-info-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                
                const movieId = this.getAttribute('data-id');
                const title = this.getAttribute('data-title');
                const year = this.getAttribute('data-year');
                
                if (this.classList.contains('watch-now-btn')) {
                    showPlatformSelection(movieId, title);
                } else {
                    window.location.href = getDetailsUrl({
                        id: movieId,
                        type: 'movie',
                        title,
                        year
                    });
                }
            }, { capture: true });
        });
    }, 500);
}

function showPlatformSelection(movieId, title) {
    // Remove any existing modal
    const existingModal = document.querySelector('.platform-modal');
    if (existingModal) existingModal.remove();
    
    // Create modal for platform selection
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
                type: 'movie',
                year: null,
                region: 'US',
                id: movieId
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

function getRandomDuration() {
    const durations = ['1h 28min', '2h 15min', '1h 42min', '2h 5min', '1h 56min'];
    return durations[Math.floor(Math.random() * durations.length)];
}

// Setup functions
function setupYearFilter() {
    const yearFilter = document.getElementById('year-filter');
    if (!yearFilter) return;
    
    while (yearFilter.options.length > 1) {
        yearFilter.remove(1);
    }
    
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 2000; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    }
}

function setupEventListeners() {
    document.getElementById('genre-filter')?.addEventListener('change', () => {
        currentPage = 1;
        loadMovies();
    });
    
    document.getElementById('year-filter')?.addEventListener('change', () => {
        currentPage = 1;
        loadMovies();
    });
    
    document.getElementById('sort-filter')?.addEventListener('change', () => {
        currentPage = 1;
        loadMovies();
    });
    
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
    
    document.getElementById('retryButton')?.addEventListener('click', () => {
        currentPage = 1;
        loadMovies();
    });
    
    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.getElementById('searchIcon');
    
    if (searchInput && searchIcon) {
        searchIcon.addEventListener('click', () => performSearch(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch(searchInput.value);
        });
    }
}

// Load movies grid
async function loadMovies() {
    if (isLoading) return;
    
    console.log('Loading movies, page:', currentPage);
    
    const moviesGrid = document.getElementById('movies-grid');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const pagination = document.getElementById('pagination');
    
    // Show loading, hide error and pagination
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (errorMessage) errorMessage.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (moviesGrid) moviesGrid.innerHTML = '';
    
    isLoading = true;
    
    try {
        // Get current filter values
        const genreValue = document.getElementById('genre-filter')?.value || 'all';
        const yearValue = document.getElementById('year-filter')?.value || 'all';
        const sortValue = document.getElementById('sort-filter')?.value || 'popularity.desc';
        
        // Store current filters
        currentFilters = { genre: genreValue, year: yearValue, sort: sortValue };
        
        console.log('Loading movies with filters:', currentFilters);
        
        // Fetch movies from TMDB
        const moviesData = await fetchMovies(currentPage, currentFilters);
        
        console.log('Movies data received:', moviesData.length || 0, 'movies');
        
        // Display movies
        displayMovies(moviesData);
        
        // Setup pagination
        if (moviesData.length >= 20) {
            setupPagination(currentPage);
        }
        
    } catch (error) {
        console.error('Error loading movies:', error);
        showErrorState(error.message);
    } finally {
        isLoading = false;
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}


async function fetchMovies(page, filters) {
    try {
        // Fetch list based on currentView (header quick links)
        let data;
        try {
            data = await tmdbService.getMovieList(currentView || 'popular', page);
        } catch (e) {
            console.warn('Falling back to trending movies (list endpoint failed):', e?.message);
            data = await tmdbService.getTrending('movie', 'week');
        }

        if (!data.results) {
            throw new Error('No movies found');
        }

        let filteredMovies = [...data.results];

        // Filter by genre if specified
        if (filters.genre !== 'all') {
            filteredMovies = filteredMovies.filter(movie =>
                movie.genre_ids && movie.genre_ids.includes(parseInt(filters.genre))
            );
        }

        // Filter by year if specified
        if (filters.year !== 'all') {
            filteredMovies = filteredMovies.filter(movie => {
                const releaseYear = movie.release_date ?
                    movie.release_date.split('-')[0] : null;
                return releaseYear === filters.year;
            });
        }

        // Sort movies (client-side)
        if (filters.sort === 'vote_average.desc') {
            filteredMovies.sort((a, b) => b.vote_average - a.vote_average);
        } else if (filters.sort === 'primary_release_date.desc') {
            filteredMovies.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
        } else if (filters.sort === 'primary_release_date.asc') {
            filteredMovies.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
        } else {
            // default popularity
            filteredMovies.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }

        return filteredMovies;

    } catch (error) {
        console.error('Error fetching movies:', error);
        throw error;
    }
}


function displayMovies(movies) {
    const moviesGrid = document.getElementById('movies-grid');
    if (!moviesGrid) return;
    
    if (!movies || movies.length === 0) {
        moviesGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-film fa-3x"></i>
                <h3>No Movies Found</h3>
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
    moviesGrid.innerHTML = '';
    
    movies.forEach(movie => {
        const movieCard = createMovieCard(movie);
        moviesGrid.appendChild(movieCard);
    });
}

function createMovieCard(movie) {
    const formatted = tmdbService.formatContent(movie, 'movie');
    
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.id = movie.id;
    
    card.innerHTML = `
        <div class="movie-card-inner">
            <div class="movie-poster">
                <img src="${formatted.poster || 'https://via.placeholder.com/500x750/2f2f2f/ffffff?text=No+Poster'}" 
                     alt="${formatted.title}" 
                     loading="lazy"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/500x750/2f2f2f/ffffff?text=No+Image'">
                <div class="movie-overlay">
                    <button class="view-details-btn">
                        <i class="fas fa-play-circle"></i> View Details
                    </button>
                </div>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${formatted.title}</h3>
                <div class="movie-meta">
                    <span class="movie-year">
                        <i class="fas fa-calendar-alt"></i> ${formatted.year || 'N/A'}
                    </span>
                    <span class="movie-rating">
                        <i class="fas fa-star"></i> ${formatted.rating}
                    </span>
                </div>
                <div class="movie-genres">
                    ${movie.genre_ids && movie.genre_ids.slice(0, 2).map(genreId => 
                        `<span class="genre-tag">${getGenreName(genreId)}</span>`
                    ).join('') || ''}
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
                id: movie.id,
                type: 'movie',
                title: formatted.title,
                year: formatted.year
            });
        });
    }
    
    // Click on card itself goes to details
    card.addEventListener('click', function(e) {
        if (!e.target.closest('button')) {
            window.location.href = getDetailsUrl({
                id: movie.id,
                type: 'movie',
                title: formatted.title,
                year: formatted.year
            });
        }
    });
    
    return card;
}


function getGenreIdFromName(genreName) {
    if (!genreName) return null;
    const name = String(genreName).toLowerCase().trim();

    const map = {
        'action': 28,
        'adventure': 12,
        'animation': 16,
        'comedy': 35,
        'crime': 80,
        'documentary': 99,
        'drama': 18,
        'family': 10751,
        'fantasy': 14,
        'history': 36,
        'horror': 27,
        'music': 10402,
        'mystery': 9648,
        'romance': 10749,
        'science fiction': 878,
        'sci-fi': 878,
        'scifi': 878,
        'thriller': 53,
        'war': 10752,
        'western': 37
    };

    return map[name] || null;
}

function getGenreName(genreId) {
    const genreMap = {
        28: 'Action',
        35: 'Comedy',
        18: 'Drama',
        27: 'Horror',
        878: 'Sci-Fi',
        10749: 'Romance',
        53: 'Thriller',
        16: 'Animation',
        10751: 'Family'
    };
    return genreMap[genreId] || 'Movie';
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
            loadMovies();
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
        loadMovies();
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
    document.getElementById('year-filter').value = 'all';
    document.getElementById('sort-filter').value = 'popularity.desc';
    currentPage = 1;
    loadMovies();
}

function showErrorState(errorMessage = 'Unknown error') {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'flex';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-2x"></i>
            <div>
                <h3>Error Loading Movies</h3>
                <p>${errorMessage}</p>
                <button class="retry-button" id="retryButton">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
        
        // Re-attach event listener
        document.getElementById('retryButton')?.addEventListener('click', () => {
            currentPage = 1;
            loadMovies();
        });
    }
}

function performSearch(query) {
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
        window.location.href = `/search?q=${encodeURIComponent(trimmedQuery)}`;
    }
}

// Fallback functions
function loadFallbackSlider() {
    const sliderContent = document.getElementById('sliderContent');
    if (!sliderContent) return;
    
    const fallbackMovies = [
        {
            title: "Spider-Man: No Way Home",
            year: "2021",
            rating: "8.2",
            description: "With Spider-Man's identity now revealed, Peter asks Doctor Strange for help. When a spell goes wrong, dangerous foes from other worlds start to appear.",
            duration: "2h 28min"
        },
        {
            title: "The Batman",
            year: "2022",
            rating: "7.8",
            description: "When a sadistic serial killer begins murdering key political figures in Gotham, Batman is forced to investigate the city's hidden corruption.",
            duration: "2h 56min"
        }
    ];
    
    sliderContent.innerHTML = '';
    
    fallbackMovies.forEach((movie, index) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        
        slide.innerHTML = `
            <div class="slide-background" 
                 style="background-image: url('https://via.placeholder.com/1920x1080/2f2f2f/ffffff?text=StreamFinder+Movies')">
            </div>
            <div class="slide-content">
                <div class="slide-info">
                    <h2 class="slide-title">${movie.title}</h2>
                    <div class="slide-meta">
                        <span><i class="fas fa-calendar-alt"></i> ${movie.year}</span>
                        <span><i class="fas fa-star"></i> ${movie.rating}</span>
                        <span><i class="fas fa-clock"></i> ${movie.duration}</span>
                    </div>
                    <p class="slide-description">${movie.description}</p>
                    <div class="slide-actions">
                        <button class="slide-btn primary watch-now-btn" data-id="${index + 1000}" data-title="${movie.title}">
                            <i class="fas fa-play"></i> Watch Now
                        </button>
                        <button class="slide-btn secondary more-info-btn" data-id="${index + 1000}">
                            <i class="fas fa-info-circle"></i> More Info
                        </button>
                    </div>
                    <div class="slide-badges">
                        <span class="badge rating">
                            <i class="fas fa-star"></i> ${movie.rating}/10
                        </span>
                        <span class="badge trending">
                            <i class="fas fa-fire"></i> Trending
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        sliderContent.appendChild(slide);
    });
    
    if (heroSlider) {
        heroSlider.destroy();
    }
    initializeSwiper();
}
