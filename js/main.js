'use strict';

function initializeTheme() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
    loadSavedTheme();
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
        localStorage.setItem('theme', newTheme);
    } catch (e) {
        console.warn('Could not save theme preference');
    }
}

function loadSavedTheme() {
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            // Default to dark if no theme is saved
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    } catch (e) {
        console.warn('Could not load theme preference');
         document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// Run the theme initializer when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTheme);
} else {
    initializeTheme();
}

