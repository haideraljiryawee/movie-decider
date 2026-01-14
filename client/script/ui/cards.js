// Card creation utilities
import { formatGenreName, formatPlatformName } from '../utils/formatters.js';

export function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.id = movie.id;
    card.dataset.genre = movie.genre;
    card.dataset.year = movie.year;
    
    card.innerHTML = `
        <img src="${movie.image}" alt="${movie.title}" class="movie-poster" loading="lazy">
        <div class="movie-info">
            <h3 class="movie-title">${movie.title}</h3>
            <div class="movie-meta">
                <span>${movie.year}</span>
                <span>${formatGenreName(movie.genre)}</span>
                ${movie.rating ? `<span>⭐ ${movie.rating}</span>` : ''}
            </div>
            <div class="movie-platforms">
                ${movie.platforms.map(platform => 
                    `<span class="platform-tag ${platform}">${formatPlatformName(platform)}</span>`
                ).join('')}
            </div>
        </div>
    `;
    
    return card;
}

export function createSeriesCard(series) {
    const card = document.createElement('div');
    card.className = 'series-card';
    card.dataset.id = series.id;
    card.dataset.genre = series.genre;
    card.dataset.status = series.status;
    
    card.innerHTML = `
        <div class="season-badge">${series.status === 'completed' ? 'Completed' : `S${series.seasons}`}</div>
        <img src="${series.image}" alt="${series.title}" class="series-poster" loading="lazy">
        <div class="series-info">
            <h3 class="series-title">${series.title}</h3>
            <div class="series-meta">
                <span>${series.year}</span>
                <span>${formatGenreName(series.genre)}</span>
                ${series.rating ? `<span>⭐ ${series.rating}</span>` : ''}
            </div>
            <div class="series-platforms">
                ${series.platforms.map(platform => 
                    `<span class="platform-tag ${platform}">${formatPlatformName(platform)}</span>`
                ).join('')}
            </div>
        </div>
    `;
    
    return card;
}