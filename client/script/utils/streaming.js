// script/utils/streaming.js

// Streaming platform configurations
export const PLATFORMS = {
    netflix: {
        name: 'Netflix',
        color: '#E50914',
        icon: 'fab fa-netflix',
        searchUrl: (title) => `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
        affiliateTag: '?netflixref=streamfinder' // Example affiliate tag
    },
    prime: {
        name: 'Amazon Prime Video',
        color: '#00A8E1',
        icon: 'fab fa-amazon',
        searchUrl: (title) => `https://www.amazon.com/s?k=${encodeURIComponent(title)}+prime+video&i=instant-video`,
        affiliateTag: '?tag=streamfinder-20'
    },
    hulu: {
        name: 'Hulu',
        color: '#1CE783',
        icon: 'fab fa-hulu',
        searchUrl: (title) => `https://www.hulu.com/search?q=${encodeURIComponent(title)}`,
        affiliateTag: ''
    },
    disney: {
        name: 'Disney+',
        color: '#113CCF',
        icon: 'fab fa-disney',
        searchUrl: (title) => `https://www.disneyplus.com/search?q=${encodeURIComponent(title)}`,
        affiliateTag: ''
    },
    hbo: {
        name: 'HBO Max',
        color: '#421C5D',
        icon: 'fab fa-hbo',
        searchUrl: (title) => `https://play.hbomax.com/search?q=${encodeURIComponent(title)}`,
        affiliateTag: ''
    },
    apple: {
        name: 'Apple TV+',
        color: '#000000',
        icon: 'fab fa-apple',
        searchUrl: (title) => `https://tv.apple.com/search?term=${encodeURIComponent(title)}`,
        affiliateTag: ''
    },
    oneshows: {
        name: '1Shows',
        color: '#F4B400',
        icon: 'fas fa-globe',
        searchUrl: (title) => `https://www.1shows.nl/?s=${encodeURIComponent(title)}`,
        affiliateTag: ''
    }
};

// Guess platforms based on content type and popularity
export function guessPlatforms(content, watchProviders = {}) {
    const platforms = [];
    
    // If we have real watch provider data from TMDB
    if (watchProviders.flatrate) {
        watchProviders.flatrate.forEach(provider => {
            const platformKey = provider.provider_name.toLowerCase().replace(/\s+/g, '');
            if (PLATFORMS[platformKey]) {
                platforms.push(platformKey);
            }
        });
    }
    
    // Fallback: Make educated guesses
    if (platforms.length === 0) {
        // Popular movies/shows often on Netflix
        if (content.popularity > 50) {
            platforms.push('netflix');
        }
        
        // Recent content often on original platforms
        if (content.type === 'tv') {
            platforms.push('hbo', 'hulu', 'prime');
        } else {
            platforms.push('prime', 'disney', 'apple');
        }
    }
    
    // Remove duplicates and return
    return [...new Set(platforms)].slice(0, 3); // Max 3 platforms
}

// Generate streaming link with affiliate tag
export function generateStreamingLink(content, platformKey) {
    const platform = PLATFORMS[platformKey];
    if (!platform) return '#';
    
    let url = platform.searchUrl(content.title);
    
    // Add affiliate tag if available
    if (platform.affiliateTag) {
        url += platform.affiliateTag;
    }
    
    return url;
}

// Format platform name for display
export function formatPlatformName(platformKey) {
    return PLATFORMS[platformKey]?.name || platformKey;
}
