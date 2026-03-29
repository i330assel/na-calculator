// dashboard.js — личный кабинет: сохранение и загрузка расчётов

import { supabase } from './supabase.js'

// ── Текущий пользователь ──
let currentUser = null

// Проверяем авторизацию при загрузке страницы
export async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        // Не залогинен — отправляем на страницу входа
        window.location.href = 'auth.html'
        return
    }

    currentUser = session.user
    updateUserUI(currentUser.email)
    await loadCalculations()
}

// Показываем email пользователя в навбаре
function updateUserUI(email) {
    const el = document.getElementById('userEmail')
    if (el) el.textContent = email
}

// ── Выход ──
export async function logout() {
    await supabase.auth.signOut()
    window.location.href = 'auth.html'
}

// ── Сохранить расчёт ──
export async function saveCalculation(data) {
    if (!currentUser) return

    const { error } = await supabase
        .from('calculations')
        .insert({
            user_id:   currentUser.id,
            name:      data.name,
            k:         data.k,
            lambda:    data.lambda,
            calc_type: data.calc_type,
            result:    data.result
        })

    if (error) {
        console.error('Ошибка сохранения:', error)
        return false
    }

    await loadCalculations() // обновляем список
    return true
}

// ── Загрузить все расчёты пользователя ──
export async function loadCalculations() {
    if (!currentUser) return

    const { data, error } = await supabase
        .from('calculations')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Ошибка загрузки:', error)
        return
    }

    renderCalculations(data)
}

// ── Удалить расчёт ──
export async function deleteCalculation(id) {
    const { error } = await supabase
        .from('calculations')
        .delete()
        .eq('id', id)

    if (!error) await loadCalculations()
}

// ── Отрисовать список расчётов ──
function renderCalculations(items) {
    const container = document.getElementById('calculationsList')
    if (!container) return

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="text-center text-secondary py-4">
                <i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>
                <p class="small mb-0">Нет сохранённых расчётов</p>
            </div>`
        return
    }

    container.innerHTML = items.map(item => `
        <div class="calc-item d-flex align-items-center justify-content-between gap-3 p-3 mb-2 rounded">
            <div class="flex-grow-1">
                <div class="fw-medium">${item.name || 'Без названия'}</div>
                <div class="font-mono small text-secondary mt-1">
                    k=${item.k} · λ=${item.lambda} · ${item.calc_type.toUpperCase()}
                    ${item.result !== null ? `· результат: ${Number(item.result).toFixed(4)}` : ''}
                </div>
                <div class="text-muted" style="font-size:0.72rem">
                    ${new Date(item.created_at).toLocaleString('ru-RU')}
                </div>
            </div>
            <button 
                onclick="window.deleteCalc('${item.id}')" 
                class="btn btn-sm btn-outline-danger flex-shrink-0">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `).join('')
}

// Делаем deleteCalc доступной глобально
window.deleteCalc = async function(id) {
    if (confirm('Удалить этот расчёт?')) {
        await deleteCalculation(id)
    }
}