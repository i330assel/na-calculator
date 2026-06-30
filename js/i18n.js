// ============================================================
// i18n.js — простая система переводов
// ============================================================

let currentLang  = localStorage.getItem('lang') || 'ru';
let translations = {};

async function loadTranslations(lang) {
    const response = await fetch(`locales/${lang}.json`);
    translations = await response.json();
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[key] !== undefined) {
            el.textContent = translations[key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[key] !== undefined) {
            el.placeholder = translations[key];
        }
    });

    document.documentElement.lang = currentLang;

    // Подсвечиваем активную кнопку языка
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
}

export async function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    await loadTranslations(lang);
    applyTranslations();
}

export async function initI18n() {
    await loadTranslations(currentLang);
    applyTranslations();
}