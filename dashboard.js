// dashboard.js — личный кабинет

import { supabase } from './supabase.js'

let currentUser = null

// ── Инициализация ──
export async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        window.location.href = 'auth.html'
        return
    }

    currentUser = session.user
    updateUserUI(currentUser.email)
    await loadCalculations()
}

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
    if (!currentUser) return false

    const { error } = await supabase
        .from('calculations')
        .insert({
            user_id:    currentUser.id,
            name:       data.name,
            k:          data.k,
            lambda:     data.lambda,
            calc_type:  data.calc_type,
            result:     data.result   ?? null,
            x:          data.x        ?? null,
            mc_samples: data.mc_samples ?? null
        })

    if (error) {
        console.error('Ошибка сохранения:', error)
        return false
    }

    await loadCalculations()
    return true
}

// ── Загрузить расчёты ──
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

// ── Открыть расчёт — подставить параметры и перестроить график ──
export function openCalculation(item) {
    // Подставляем параметры в поля формы
    document.getElementById('shape-param').value      = item.k
    document.getElementById('scale-param').value      = item.lambda
    document.getElementById('calculation-type').value = item.calc_type
    document.getElementById('x-value').value          = item.x ?? ''

    // Показываем результат если он есть
    const resultArea = document.getElementById('result-area')
    const resultText = document.getElementById('result-text')
    if (item.result !== null && item.result !== undefined) {
        resultArea.classList.remove('d-none')
        resultText.textContent = Number(item.result).toFixed(6)
        resultText.style.color = 'var(--accent)'
    } else {
        resultArea.classList.add('d-none')
    }

    // Подставляем N для Монте-Карло если есть
    if (item.mc_samples) {
        document.getElementById('monte-carlo-samples').value = item.mc_samples
    }

    // Перестраиваем график
    // Вызываем глобальную функцию из script.js
    if (typeof window.buildWeibullChartGlobal === 'function') {
        window.buildWeibullChartGlobal(item.k, item.lambda, item.calc_type)
    }

    // Прокручиваем страницу вверх к графику
    document.getElementById('weibullChart')
        .scrollIntoView({ behavior: 'smooth', block: 'center' })
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
        <div class="calc-item d-flex align-items-start justify-content-between gap-3 p-3 mb-2 rounded">
            <div class="flex-grow-1">
                <div class="fw-medium">${item.name || 'Без названия'}</div>
                <div class="font-mono small text-secondary mt-1">
                    k=${item.k} · λ=${item.lambda} · ${item.calc_type.toUpperCase()}
                    ${item.x !== null && item.x !== undefined
                        ? `· x=${item.x}` : ''}
                    ${item.result !== null && item.result !== undefined
                        ? `· результат=${Number(item.result).toFixed(4)}` : ''}
                    ${item.mc_samples
                        ? `· N=${item.mc_samples}` : ''}
                </div>
                <div class="text-muted" style="font-size:0.72rem">
                    ${new Date(item.created_at).toLocaleString('ru-RU')}
                </div>
            </div>
            <div class="d-flex gap-2 flex-shrink-0">
                <button 
                    onclick="window.openCalc(${JSON.stringify(item).replace(/"/g, '&quot;')})"
                    class="btn btn-sm btn-outline-warning font-mono">
                    <i class="bi bi-arrow-up-right-circle"></i> Открыть
                </button>
                <button 
                    onclick="window.deleteCalc('${item.id}')"
                    class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join('')
}

// Глобальные функции
window.deleteCalc = async function(id) {
    if (confirm('Удалить этот расчёт?')) {
        await deleteCalculation(id)
    }
}

window.openCalc = function(item) {
    openCalculation(item)
}