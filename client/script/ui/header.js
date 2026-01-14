// /script/header.js - Optimized Header Functionality
'use strict';

class HeaderManager {
    constructor() {
        this.header = document.getElementById('header');
        this.mobileToggle = document.getElementById('mobileToggle');
        this.mobileMenu = document.getElementById('mobileMenu');
        this.mobileOverlay = document.getElementById('mobileOverlay');
        this.mobileClose = document.getElementById('mobileClose');
        this.searchInput = document.getElementById('searchInput');
        this.searchSuggestions = document.getElementById('searchSuggestions');
        this.voiceSearchBtn = document.getElementById('voiceSearchBtn');
        this.themeToggle = document.getElementById('themeToggle');
        this.profileBtn = document.getElementById('profileBtn');
        
        this.lastScroll = 0;
        this.scrollThreshold = 100;
        this.isMobileMenuOpen = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupScrollHandler();
        this.setupTheme();
        this.setupSearch();
        this.setupAccessibility();
        this.setupAuth();
        
        console.log('✅ Header initialized');
    }
    
    setupEventListeners() {
        // Mobile menu toggle
        if (this.mobileToggle) {
            this.mobileToggle.addEventListener('click', () => this.toggleMobileMenu(true));
        }
        
        if (this.mobileClose) {
            this.mobileClose.addEventListener('click', () => this.toggleMobileMenu(false));
        }
        
        if (this.mobileOverlay) {
            this.mobileOverlay.addEventListener('click', () => this.toggleMobileMenu(false));
        }
        
        // Theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('change', (e) => this.handleThemeToggle(e));
        }
        
        // Profile dropdown
        if (this.profileBtn) {
            this.profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleProfileDropdown();
            });
        }
        
        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profile-wrapper')) {
                this.closeProfileDropdown();
            }
            
            if (!e.target.closest('.notification-wrapper')) {
                this.closeNotificationDropdown();
            }
        });
        
        // Mark notifications as read
        document.querySelector('.mark-read-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.markAllNotificationsRead();
        });
        
        // Navigation scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                if (href !== '#') {
                    this.handleAnchorClick(e, href);
                }
            });
        });
    }
    
    setupScrollHandler() {
        let ticking = false;
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
    
    handleScroll() {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > this.scrollThreshold) {
            this.header.classList.add('scrolled');
            
            // Hide/show header on scroll
            if (currentScroll > this.lastScroll && currentScroll > 200) {
                this.header.classList.add('hidden');
            } else {
                this.header.classList.remove('hidden');
            }
        } else {
            this.header.classList.remove('scrolled', 'hidden');
        }
        
        this.lastScroll = currentScroll;
    }
    
    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        if (this.themeToggle) {
            this.themeToggle.checked = savedTheme === 'light';
        }
        
        // Mobile theme toggle
        const mobileThemeToggle = document.getElementById('themeToggleMobile');
        if (mobileThemeToggle) {
            mobileThemeToggle.checked = savedTheme === 'light';
            mobileThemeToggle.addEventListener('change', (e) => {
                this.setTheme(e.target.checked ? 'light' : 'dark');
            });
        }
    }
    
    handleThemeToggle(e) {
        this.setTheme(e.target.checked ? 'light' : 'dark');
    }
    
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update both toggles
        if (this.themeToggle) {
            this.themeToggle.checked = theme === 'light';
        }
        
        const mobileThemeToggle = document.getElementById('themeToggleMobile');
        if (mobileThemeToggle) {
            mobileThemeToggle.checked = theme === 'light';
        }
    }
    
    setupSearch() {
        if (!this.searchInput || !window.tmdbService) return;
        
        // Search input handler
        this.searchInput.addEventListener('input', this.debounce(async (e) => {
            const query = e.target.value.trim();
            
            if (query.length >= 2) {
                try {
                    const results = await window.tmdbService.searchMulti(query);
                    this.showSearchSuggestions(results.results.slice(0, 5));
                } catch (error) {
                    console.error('Search error:', error);
                    this.hideSearchSuggestions();
                }
            } else {
                this.hideSearchSuggestions();
            }
        }, 300));
        
        // Focus/Blur handlers
        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.trim().length >= 2) {
                this.searchSuggestions.classList.add('show');
            }
        });
        
        // Voice search
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (this.voiceSearchBtn && SpeechRecognition) {
            this.setupVoiceSearch();
        } else if (this.voiceSearchBtn) {
            this.voiceSearchBtn.style.display = 'none';
        }
        
        // Close suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) {
                this.hideSearchSuggestions();
            }
        });
    }
    
    async showSearchSuggestions(items) {
        if (!this.searchSuggestions || items.length === 0) {
            this.searchSuggestions.innerHTML = `
                <div class="suggestion-item">
                    <i class="fas fa-search"></i>
                    <div class="suggestion-info">
                        <p>No results found</p>
                    </div>
                </div>
            `;
            this.searchSuggestions.classList.add('show');
            return;
        }
        
        const suggestionsHTML = items.map(item => {
            const type = item.media_type || (item.title ? 'movie' : 'tv');
            const formatted = window.tmdbService.formatContent(item, type);
            const year = formatted.year ? new Date(formatted.year).getFullYear() : 'N/A';
            
            return `
                <div class="suggestion-item" 
                     onclick="window.location.href='details.html?id=${item.id}&type=${type}'"
                     role="option">
                    <img src="${formatted.poster}" 
                         alt="${formatted.title}"
                         class="suggestion-img"
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/36x54/1a1a1a/ffffff?text=+'">
                    <div class="suggestion-info">
                        <h5>${formatted.title}</h5>
                        <p>${type === 'movie' ? 'Movie' : 'TV Show'} • ${year}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        this.searchSuggestions.innerHTML = suggestionsHTML;
        this.searchSuggestions.classList.add('show');
    }
    
    hideSearchSuggestions() {
        if (this.searchSuggestions) {
            this.searchSuggestions.classList.remove('show');
        }
    }
    
    setupVoiceSearch() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition || !this.voiceSearchBtn) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let isListening = false;
        const stop = () => {
            isListening = false;
            this.voiceSearchBtn.classList.remove('listening');
            try { recognition.stop(); } catch (e) {}
        };

        this.voiceSearchBtn.addEventListener('click', () => {
            if (!this.searchInput) return;

            if (isListening) {
                stop();
                return;
            }

            try {
                isListening = true;
                this.voiceSearchBtn.classList.add('listening');
                recognition.start();

                // Timeout safety
                setTimeout(() => {
                    if (isListening) stop();
                }, 10000);
            } catch (e) {
                stop();
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript?.trim();
            if (transcript && this.searchInput) {
                this.searchInput.value = transcript;
                this.searchInput.dispatchEvent(new Event('input'));
            }
            // Let header-page.js auto-submit if it wants to
            try { this.voiceSearchBtn.dispatchEvent(new Event('voice-search-complete')); } catch (e) {}
            stop();
        };

        recognition.onerror = () => stop();
        recognition.onend = () => stop();
    }

    toggleMobileMenu(open) {
        this.isMobileMenuOpen = open ?? !this.isMobileMenuOpen;
        
        if (this.mobileMenu) {
            this.mobileMenu.classList.toggle('active', this.isMobileMenuOpen);
            this.mobileToggle?.setAttribute('aria-expanded', this.isMobileMenuOpen);
        }
        
        if (this.mobileOverlay) {
            this.mobileOverlay.classList.toggle('active', this.isMobileMenuOpen);
        }
        
        document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
        
        // Update mobile theme toggle
        if (this.isMobileMenuOpen) {
            const theme = localStorage.getItem('theme') || 'dark';
            const mobileThemeToggle = document.getElementById('themeToggleMobile');
            if (mobileThemeToggle) {
                mobileThemeToggle.checked = theme === 'light';
            }
        }
    }
    
    toggleProfileDropdown() {
        const dropdown = document.querySelector('.profile-dropdown');
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        }
    }
    
    closeProfileDropdown() {
        const dropdown = document.querySelector('.profile-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
    
    closeNotificationDropdown() {
        const dropdown = document.querySelector('.notification-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
    
    markAllNotificationsRead() {
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
        });
        
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            badge.style.display = 'none';
        }
    }
    
    handleAnchorClick(e, href) {
        e.preventDefault();
        
        const target = document.querySelector(href);
        if (target) {
            // Close mobile menu if open
            if (this.isMobileMenuOpen) {
                this.toggleMobileMenu(false);
            }
            
            // Smooth scroll to target
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
    

    setupAuth() {
        const authLink = document.querySelector('.profile-dropdown .dropdown-item .fa-sign-out-alt')?.closest('a');
        const nameEl = document.querySelector('.profile-dropdown .user-info h5');
        const statusEl = document.querySelector('.profile-dropdown .user-info span');
        const createAccountBtn = document.getElementById('createAccountBtn');
        const profileLinks = Array.from(document.querySelectorAll('.profile-dropdown .dropdown-item .fa-user'))
            .map(icon => icon.closest('a'))
            .filter(Boolean);
        const mobileProfileLinks = Array.from(document.querySelectorAll('.mobile-actions .fa-user'))
            .map(icon => icon.closest('a'))
            .filter(Boolean);

        const goAuth = (hash = '') => {
            window.location.href = `auth.html${hash}`;
        };

        if (createAccountBtn) {
            createAccountBtn.addEventListener('click', () => {
                goAuth('#register');
            });
        }

        const setProfileLinks = (href) => {
            profileLinks.forEach(link => link.setAttribute('href', href));
            mobileProfileLinks.forEach(link => link.setAttribute('href', href));
        };

        const bindAuthLink = (mode) => {
            if (!authLink) return;
            if (mode === 'logout') {
                authLink.innerHTML = '<i class="fas fa-sign-out-alt" aria-hidden="true"></i><span>Logout</span>';
                authLink.setAttribute('href', '#');
                authLink.onclick = (e) => {
                    e.preventDefault();
                    localStorage.removeItem('auth_token');
                    goAuth();
                };
            } else {
                authLink.innerHTML = '<i class="fas fa-sign-in-alt" aria-hidden="true"></i><span>Login / Register</span>';
                authLink.setAttribute('href', 'auth.html');
                authLink.onclick = (e) => {
                    e.preventDefault();
                    goAuth();
                };
            }
        };

        const token = localStorage.getItem('auth_token');
        if (!token) {
            if (nameEl) nameEl.textContent = 'Guest';
            if (statusEl) statusEl.textContent = 'Not signed in';
            bindAuthLink('login');
            setProfileLinks('auth.html');
            return;
        }

        fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => {
                if (nameEl && data?.user?.username) nameEl.textContent = data.user.username;
                if (statusEl) statusEl.textContent = 'Member';
                setProfileLinks('#');
                bindAuthLink('logout');
            })
            .catch(() => {
                localStorage.removeItem('auth_token');
                if (nameEl) nameEl.textContent = 'Guest';
                if (statusEl) statusEl.textContent = 'Not signed in';
                bindAuthLink('login');
                setProfileLinks('auth.html');
            });
    }

    setupAccessibility() {
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            // Escape key closes modals and dropdowns
            if (e.key === 'Escape') {
                if (this.isMobileMenuOpen) {
                    this.toggleMobileMenu(false);
                }
                this.closeProfileDropdown();
                this.closeNotificationDropdown();
                this.hideSearchSuggestions();
            }
            
            // Tab key management for dropdowns
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            }
        });
        
        // Focus trap for mobile menu
        if (this.mobileMenu) {
            this.setupFocusTrap(this.mobileMenu, this.mobileToggle);
        }
    }
    
    handleTabNavigation(e) {
        const activeElement = document.activeElement;
        const dropdowns = document.querySelectorAll('.profile-dropdown, .notification-dropdown');
        
        dropdowns.forEach(dropdown => {
            if (dropdown.style.display === 'block') {
                const focusable = dropdown.querySelectorAll('button, a, input, [tabindex]');
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                
                if (e.shiftKey && activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }
    
    setupFocusTrap(container, trigger) {
        const focusable = container.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        
        container.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
            
            if (e.key === 'Escape') {
                this.toggleMobileMenu(false);
                trigger?.focus();
            }
        });
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const headerManager = new HeaderManager();
    
    // Make accessible globally
    window.headerManager = headerManager;
    
    // Performance monitoring
    if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name.includes('header')) {
                    console.log(`Header loaded in ${entry.duration.toFixed(2)}ms`);
                }
            }
        });
        observer.observe({ entryTypes: ['measure'] });
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderManager;
}