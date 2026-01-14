// Formatter utilities
export function formatGenreName(genre) {
    const genreMap = {
        'action': 'Action',
        'comedy': 'Comedy',
        'drama': 'Drama',
        'horror': 'Horror',
        'sci-fi': 'Sci-Fi',
        'romance': 'Romance',
        'thriller': 'Thriller',
        'fantasy': 'Fantasy',
        'crime': 'Crime',
        'documentary': 'Documentary',
        'animation': 'Animation',
        'family': 'Family'
    };
    return genreMap[genre] || genre.charAt(0).toUpperCase() + genre.slice(1);
}

export function formatPlatformName(platform) {
    const platformMap = {
        'netflix': 'Netflix',
        'prime': 'Amazon Prime',
        'hulu': 'Hulu',
        'disney': 'Disney+',
        'hbo': 'HBO Max',
        'apple': 'Apple TV+'
    };
    return platformMap[platform] || platform;
}

export function formatDuration(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.getFullYear();
}