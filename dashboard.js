// dashboard.js

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
    const el = document.getElementById('userEmail')
    if (el) el.textContent = currentUser.email
    await loadCalculations()
}

// ── Выход ──
export async function logout() {
    await supabase.auth.signOut()
    window.location.href = 'auth.html'
}

// ── Собрать данные всех вкладок ──
export function collectAllData(name) {
    // Вейбулл
    const k         = parseFloat(document.getElementById('shape-param').value)
    const lambda    = parseFloat(document.getElementById('scale-param').value)
    const calcType  = document.getElementById('calculation-type').value
    const xVal      = parseFloat(document.getElementById('x-value').value)
    const resultRaw = document.getElementById('result-text').textContent
    const result    = parseFloat(resultRaw)
    const xUnits    = document.getElementById('x-units').value.trim() || null
    const mcSamples = parseInt(document.getElementById('monte-carlo-samples').value)

    // Монте-Карло — парсим текст результата
    // Формат: "Среднее: 1063.4   |   Ст. отклонение: 512.3   |   Выборок: 10000"
    let mcMean = null
    let mcStd  = null
    const mcTextEl = document.getElementById('monte-carlo-text')
    if (mcTextEl && mcTextEl.textContent) {
        const meanMatch = mcTextEl.textContent.match(/Среднее:\s*([\d.]+)/)
        const stdMatch  = mcTextEl.textContent.match(/отклонение:\s*([\d.]+)/)
        if (meanMatch) mcMean = parseFloat(meanMatch[1])
        if (stdMatch)  mcStd  = parseFloat(stdMatch[1])
    }

    // Надёжность
    const relLambda = parseFloat(document.getElementById('rel-lambda').value)
    const relT      = parseFloat(document.getElementById('rel-t').value)
    const relUnits  = document.getElementById('rel-units').value.trim() || null

    // Берём результаты надёжности из DOM если они показаны
    let relMtbf = null
    let relRt   = null
    const relMtbfEl = document.getElementById('rel-mtbf')
    const relRtEl   = document.getElementById('rel-rt')

    if (relMtbfEl && relMtbfEl.textContent !== '—') {
        // Убираем единицы измерения из текста "1000.00 часов"
        relMtbf = parseFloat(relMtbfEl.textContent)
    }
    if (relRtEl && relRtEl.textContent !== '—') {
        // Убираем % из текста "63.76%"
        relRt = parseFloat(relRtEl.textContent.replace('%', ''))
    }

    return {
        name,
        // Вейбулл
        k:          isNaN(k)         ? null : k,
        lambda:     isNaN(lambda)    ? null : lambda,
        calc_type:  calcType,
        x:          isNaN(xVal)      ? null : xVal,
        result:     isNaN(result)    ? null : result,
        x_units:    xUnits,
        // Монте-Карло
        mc_samples: isNaN(mcSamples) ? null : mcSamples,
        mc_mean:    mcMean,
        mc_std:     mcStd,
        // Надёжность
        rel_lambda: isNaN(relLambda) ? null : relLambda,
        rel_t:      isNaN(relT)      ? null : relT,
        rel_mtbf:   relMtbf,
        rel_rt:     relRt,
        rel_units:  relUnits
    }
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
            x:          data.x,
            result:     data.result,
            x_units:    data.x_units,
            mc_samples: data.mc_samples,
            mc_mean:    data.mc_mean,
            mc_std:     data.mc_std,
            rel_lambda: data.rel_lambda,
            rel_t:      data.rel_t,
            rel_mtbf:   data.rel_mtbf,
            rel_rt:     data.rel_rt,
            rel_units:  data.rel_units
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

// ── Открыть расчёт ──
export function openCalculation(item) {
    // Подставляем параметры Вейбулла
    if (item.k)      document.getElementById('shape-param').value      = item.k
    if (item.lambda) document.getElementById('scale-param').value      = item.lambda
    if (item.calc_type) document.getElementById('calculation-type').value = item.calc_type
    if (item.x)      document.getElementById('x-value').value          = item.x
    if (item.x_units) document.getElementById('x-units').value         = item.x_units || ''
    if (item.mc_samples) document.getElementById('monte-carlo-samples').value = item.mc_samples

    // Подставляем параметры надёжности
    if (item.rel_lambda) document.getElementById('rel-lambda').value = item.rel_lambda
    if (item.rel_t)      document.getElementById('rel-t').value      = item.rel_t
    if (item.rel_units)  document.getElementById('rel-units').value  = item.rel_units || ''

    // Показываем результат Вейбулла
    if (item.result !== null && item.result !== undefined) {
        const resultArea = document.getElementById('result-area')
        const resultText = document.getElementById('result-text')
        const resultX    = document.getElementById('result-x-value')
        resultArea.classList.remove('d-none')
        resultText.textContent = Number(item.result).toFixed(6)
        if (item.x) resultX.textContent = item.x
    }

    // Перестраиваем график Вейбулла
    if (item.k && item.lambda && item.calc_type) {
        if (typeof window.buildWeibullChartGlobal === 'function') {
            window.buildWeibullChartGlobal(item.k, item.lambda, item.calc_type)
        }
    }

    // Переключаем на вкладку Вейбулл
    const weibullBtn = document.querySelector('.app-tabs .nav-link')
    if (weibullBtn) window.switchTab('weibull', weibullBtn)

    // Скролл к графику
    document.getElementById('weibullChart')
        .scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// ── Отрисовать карточки расчётов ──
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

    container.innerHTML = items.map(item => {

        // Строка Вейбулл
        let weibullLine = ''
        if (item.k && item.lambda) {
            weibullLine = `
                <div class="calc-section">
                    <span class="calc-section-label">Вейбулл</span>
                    k=${item.k} · λ=${item.lambda} · ${(item.calc_type || '').toUpperCase()}
                    ${item.x_units ? `· ${item.x_units}` : ''}
                    ${item.x !== null && item.x !== undefined
                        ? `· x=${item.x}` : ''}
                    ${item.result !== null && item.result !== undefined
                        ? `→ <strong>${Number(item.result).toFixed(4)}</strong>` : ''}
                </div>`
        }

        // Строка Монте-Карло
        let monteLine = ''
        if (item.mc_samples) {
            monteLine = `
                <div class="calc-section">
                    <span class="calc-section-label">Монте-Карло</span>
                    N=${item.mc_samples}
                    ${item.mc_mean !== null && item.mc_mean !== undefined
                        ? `· среднее=<strong>${Number(item.mc_mean).toFixed(2)}</strong>` : ''}
                    ${item.mc_std !== null && item.mc_std !== undefined
                        ? `· σ=${Number(item.mc_std).toFixed(2)}` : ''}
                </div>`
        }

        // Строка Надёжность
        let reliabilityLine = ''
        if (item.rel_lambda) {
            reliabilityLine = `
                <div class="calc-section">
                    <span class="calc-section-label">Надёжность</span>
                    λ=${item.rel_lambda}
                    ${item.rel_mtbf !== null && item.rel_mtbf !== undefined
                        ? `· MTBF=<strong>${Number(item.rel_mtbf).toFixed(1)}</strong>
                           ${item.rel_units || ''}` : ''}
                    ${item.rel_rt !== null && item.rel_rt !== undefined
                        ? `· R(${item.rel_t || 't'})=<strong>${Number(item.rel_rt).toFixed(2)}%</strong>` : ''}
                </div>`
        }

        return `
            <div class="calc-card-item mb-3">
                <div class="d-flex align-items-start justify-content-between gap-3">
                    <div class="flex-grow-1">
                        <div class="calc-item-name">
                            <i class="bi bi-calculator me-2 opacity-50"></i>
                            ${item.name || 'Без названия'}
                        </div>
                        <div class="calc-item-date">
                            ${new Date(item.created_at).toLocaleString('ru-RU')}
                        </div>
                        <div class="calc-details mt-2">
                            ${weibullLine}
                            ${monteLine}
                            ${reliabilityLine}
                        </div>
                    </div>
                    <div class="d-flex flex-column gap-2 flex-shrink-0">
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
            </div>`
    }).join('')
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