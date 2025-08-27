'use strict';

/**
 * Toggles the theme between light and dark and saves the choice.
 */
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    // Save the user's choice in their browser
    localStorage.setItem('surveyToolsTheme', newTheme);
}

/**
 * Loads the saved theme from localStorage or defaults to system preference.
 */
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('surveyToolsTheme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
    } else if (prefersDark) {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.setAttribute('data-theme', 'light');
    }
}

/**
 * Main initialization function for all global scripts.
 */
function initGlobal() {
    // --- Theme Handling ---
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
    loadSavedTheme();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobal);
} else {
    initGlobal();
}