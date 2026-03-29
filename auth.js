// auth.js — логика авторизации

import { supabase } from './supabase.js'

// Если пользователь уже залогинен — сразу на главную
const { data: { session } } = await supabase.auth.getSession()
if (session) window.location.href = 'index.html'

// Переключение вкладок Вход / Регистрация
window.showTab = function(tab) {
    const isLogin = tab === 'login'
    document.getElementById('loginForm').classList.toggle('d-none', !isLogin)
    document.getElementById('registerForm').classList.toggle('d-none', isLogin)
    document.getElementById('loginTab').classList.toggle('active', isLogin)
    document.getElementById('registerTab').classList.toggle('active', !isLogin)
    document.getElementById('authStatus').textContent = ''
}

// Показать статус
function setStatus(text, isError) {
    const el = document.getElementById('authStatus')
    el.textContent = text
    el.style.color = isError ? '#ef4444' : '#10b981'
}

// Вход
window.login = async function() {
    const email    = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPassword').value

    if (!email || !password) {
        setStatus('Заполните все поля', true)
        return
    }

    setStatus('Входим...', false)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        setStatus('Ошибка: неверный email или пароль', true)
    } else {
        setStatus('Успешно! Переходим...', false)
        setTimeout(() => window.location.href = 'index.html', 800)
    }
}

// Регистрация
window.register = async function() {
    const email    = document.getElementById('registerEmail').value.trim()
    const password = document.getElementById('registerPassword').value

    if (!email || !password) {
        setStatus('Заполните все поля', true)
        return
    }

    if (password.length < 6) {
        setStatus('Пароль минимум 6 символов', true)
        return
    }

    setStatus('Регистрируем...', false)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
        setStatus('Ошибка регистрации: ' + error.message, true)
    } else {
        setStatus('✓ Проверьте email — отправили письмо для подтверждения', false)
    }
}