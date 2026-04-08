//обработка событий кнопок и переключение вкладок
//связь UI с математикой и графиками

import {
    weibullPdf, weibullCdf, weibullSf,
    reliabilityRt, reliabilityMtbf,
    runMonteCarlo, fitWeibull
} from './weibull-math.js';

import {
    buildWeibullChart, buildMonteCarloChart,
    buildReliabilityChart, buildFittingChart,
    buildComparisonChart
} from './charts.js';

import {
    loadedSheet, setLoadedSheet,
    readSingleCell, readCellRange, renderPreview
} from './excel.js';

// ── Экземпляры графиков ───────────────────────────────────
let weibullChartInstance     = null;
let monteCarloChartInstance  = null;
let reliabilityChartInstance = null;
let fittingChartInstance     = null;
let comparisonChartInstance = null;

// ── Вкладки ───────────────────────────────────────────────
window.switchTab = function(tab, btn) {
    ['weibull', 'monte', 'reliability', 'fitting', 'comparison'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('d-none');
    });
    document.querySelectorAll('.app-tabs .nav-link').forEach(b => {
        b.classList.remove('active');
    });
    document.getElementById(`tab-${tab}`).classList.remove('d-none');
    if (btn) btn.classList.add('active');
};

// ── Загрузка Excel ────────────────────────────────────────
const uploadZone     = document.getElementById('uploadZone');
const excelFileInput = document.getElementById('excelFile');

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processExcelFile(file);
});
uploadZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
        excelFileInput.click();
    }
});
excelFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processExcelFile(file);
});

function processExcelFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data     = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet     = workbook.Sheets[sheetName];
            setLoadedSheet(sheet);

            document.getElementById('fileName').textContent =
                `✓ ${file.name}  (лист: "${sheetName}")`;
            renderPreview(sheet);
            document.getElementById('previewSection').classList.remove('d-none');
            document.getElementById('mappingSection').classList.remove('d-none');
        } catch (err) {
            document.getElementById('fileName').textContent =
                '✗ Ошибка чтения файла';
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
}

document.getElementById('load-from-excel').addEventListener('click', function() {
    const statusEl   = document.getElementById('excel-status');
    const sheet      = loadedSheet;

    if (!sheet) {
        setStatus(statusEl, 'error', '✗ Сначала загрузите Excel-файл');
        return;
    }

    const cellK      = document.getElementById('cell-k').value.trim();
    const cellLambda = document.getElementById('cell-lambda').value.trim();
    const cellX      = document.getElementById('cell-x').value.trim();
    const loaded     = [];

    if (cellK) {
        const val = readSingleCell(sheet, cellK);
        if (!val || val <= 0) { setStatus(statusEl, 'error', `✗ Ячейка ${cellK}: нет числа > 0`); return; }
        document.getElementById('shape-param').value = val;
        loaded.push(`k = ${val}`);
    }
    if (cellLambda) {
        const val = readSingleCell(sheet, cellLambda);
        if (!val || val <= 0) { setStatus(statusEl, 'error', `✗ Ячейка ${cellLambda}: нет числа > 0`); return; }
        document.getElementById('scale-param').value = val;
        loaded.push(`λ = ${val}`);
    }
    if (cellX) {
        let xVal = readSingleCell(sheet, cellX);
        if (xVal === null) {
            const arr = readCellRange(sheet, cellX);
            xVal = arr && arr.length > 0 ? arr[0] : null;
        }
        if (xVal === null) { setStatus(statusEl, 'error', `✗ Ячейки x: нет числа`); return; }
        document.getElementById('x-value').value = xVal;
        loaded.push(`x = ${xVal}`);
    }

    if (loaded.length === 0) { setStatus(statusEl, 'error', '✗ Укажите хотя бы одну ячейку'); return; }
    setStatus(statusEl, 'success', `✓ Загружено: ${loaded.join('  ·  ')}`);
});

// ── Вейбулл ───────────────────────────────────────────────
document.getElementById('calculate-button').addEventListener('click', function() {
    const k               = parseFloat(document.getElementById('shape-param').value);
    const lambda          = parseFloat(document.getElementById('scale-param').value);
    const xInput          = document.getElementById('x-value').value;
    const calculationType = document.getElementById('calculation-type').value;
    const resultArea      = document.getElementById('result-area');
    const resultText      = document.getElementById('result-text');

    function showResult(text, isError) {
        resultArea.classList.remove('d-none');
        resultText.textContent = text;
        resultText.style.color = isError ? '#f87171' : 'var(--accent)';
    }

    if (isNaN(k) || k <= 0)      { showResult('Ошибка: введите корректное k', true); return; }
    if (isNaN(lambda) || lambda <= 0) { showResult('Ошибка: введите корректное λ', true); return; }

    const x        = parseFloat(xInput);
    const isXValid = !isNaN(x) && x >= 0;

    // Подсказка про x
    const noXHint = document.getElementById('no-x-hint');
    if (noXHint) {
        if (!isXValid) noXHint.classList.remove('d-none');
        else           noXHint.classList.add('d-none');
    }

    if (isXValid) {
        const resultXValue = document.getElementById('result-x-value');
        if (resultXValue) resultXValue.textContent = x;

        let result;
        if (calculationType === 'pdf')      result = weibullPdf(x, k, lambda);
        else if (calculationType === 'cdf') result = weibullCdf(x, k, lambda);
        else                                result = weibullSf(x, k, lambda);

        if (result === Infinity)                     showResult('∞ (бесконечность)', false);
        else if (!isNaN(result) && isFinite(result)) showResult(result.toFixed(6), false);
        else                                         showResult('Ошибка при расчёте', true);
    } else {
        resultArea.classList.add('d-none');
    }

    const xUnits = document.getElementById('x-units').value.trim();
    weibullChartInstance = buildWeibullChart(
        weibullChartInstance, k, lambda, calculationType, xUnits
    );
});

// Глобальная функция для dashboard.js
window.buildWeibullChartGlobal = function(k, lambda, calcType) {
    const xUnits = document.getElementById('x-units').value.trim();
    weibullChartInstance = buildWeibullChart(
        weibullChartInstance, k, lambda, calcType, xUnits
    );
};

// Подсказки типа расчёта
const calcTypeHints = {
    pdf: 'Показывает в какой момент чаще всего происходят отказы',
    cdf: 'Вероятность отказа ДО момента x (растёт от 0 до 1)',
    sf:  'Вероятность что изделие ПЕРЕЖИВЁТ момент x (падает от 1 до 0)'
};
document.getElementById('calculation-type').addEventListener('change', function() {
    const hint = document.getElementById('calcTypeHint');
    if (hint) hint.innerHTML = `<span class="hint-item">${calcTypeHints[this.value]}</span>`;
});

// ── Монте-Карло ───────────────────────────────────────────
document.getElementById('monte-carlo-button').addEventListener('click', function() {
    const k          = parseFloat(document.getElementById('shape-param').value);
    const lambda     = parseFloat(document.getElementById('scale-param').value);
    const numSamples = parseInt(document.getElementById('monte-carlo-samples').value);
    const mcArea     = document.getElementById('mc-result-area');
    const mcText     = document.getElementById('monte-carlo-text');

    function showMcResult(text, isError) {
        mcArea.classList.remove('d-none');
        mcText.textContent = text;
        mcText.style.color = isError ? '#f87171' : '#38bdf8';
    }

    if (isNaN(k) || k <= 0)               { showMcResult('Ошибка: введите корректное k', true); return; }
    if (isNaN(lambda) || lambda <= 0)      { showMcResult('Ошибка: введите корректное λ', true); return; }
    if (isNaN(numSamples) || numSamples <= 0) { showMcResult('Ошибка: введите корректное N', true); return; }

    const mcData = runMonteCarlo(k, lambda, numSamples);
    if (!mcData) { showMcResult('Не удалось сгенерировать выборки', true); return; }

    showMcResult(
        `Среднее: ${mcData.mean.toFixed(4)}   |   Ст. отклонение: ${mcData.std.toFixed(4)}   |   Выборок: ${mcData.count}`,
        false
    );

    const xUnits = document.getElementById('x-units').value.trim();
    monteCarloChartInstance = buildMonteCarloChart(
        monteCarloChartInstance, mcData, k, lambda, numSamples, xUnits
    );
});

// ── Надёжность R(t) ───────────────────────────────────────
document.getElementById('reliability-button').addEventListener('click', function() {
    const lambda = parseFloat(document.getElementById('rel-lambda').value);
    const tInput = document.getElementById('rel-t').value;
    const units  = document.getElementById('rel-units').value.trim() || 'единиц времени';

    if (isNaN(lambda) || lambda <= 0) { alert('Введите корректное λ > 0'); return; }

    const mtbf = reliabilityMtbf(lambda);
    document.getElementById('rel-result-area').classList.remove('d-none');
    document.getElementById('rel-mtbf').textContent = mtbf.toFixed(2) + ' ' + units;

    const t       = parseFloat(tInput);
    const isTValid = !isNaN(t) && t >= 0;

    if (isTValid) {
        const rt = reliabilityRt(lambda, t);
        const ft = 1 - rt;
        document.getElementById('rel-rt').textContent      = (rt * 100).toFixed(2) + '%';
        document.getElementById('rel-ft').textContent      = (ft * 100).toFixed(2) + '%';
        document.getElementById('rel-rt-hint').textContent = `${(rt * 100).toFixed(1)}% изделий проработают дольше ${t} ${units}`;
        document.getElementById('rel-ft-hint').textContent = `${(ft * 100).toFixed(1)}% изделий откажут до ${t} ${units}`;
        document.getElementById('rel-interpretation').innerHTML = `
            <i class="bi bi-lightbulb me-2"></i>
            При λ = ${lambda}, из 100 изделий примерно <strong>${Math.round(rt * 100)}</strong>
            проработают дольше ${t} ${units},
            и <strong>${Math.round(ft * 100)}</strong> откажут раньше.
            MTBF = <strong>${mtbf.toFixed(1)} ${units}</strong>.`;
    } else {
        document.getElementById('rel-rt').textContent = '—';
        document.getElementById('rel-ft').textContent = '—';
        document.getElementById('rel-interpretation').innerHTML = `
            <i class="bi bi-info-circle me-2"></i>
            MTBF = <strong>${mtbf.toFixed(2)} ${units}</strong>.
            Введите t для расчёта R(t).`;
    }

    reliabilityChartInstance = buildReliabilityChart(
        reliabilityChartInstance, lambda, units, isTValid ? t : null
    );
});

document.getElementById('reliability-clear').addEventListener('click', function() {
    document.getElementById('rel-lambda').value = '0.001';
    document.getElementById('rel-t').value      = '';
    document.getElementById('rel-units').value  = '';
    document.getElementById('rel-result-area').classList.add('d-none');
    if (reliabilityChartInstance) {
        reliabilityChartInstance.destroy();
        reliabilityChartInstance = null;
    }
});

// ── Анализ данных (MLE) ───────────────────────────────────
function parseInputData(raw) {
    return raw
        .split(/[,;\s\n]+/)
        .map(s => parseFloat(s.trim()))
        .filter(v => !isNaN(v) && v > 0);
}

window.loadFittingFromExcel = function() {
    const rangeStr = document.getElementById('fitting-cell-range').value.trim();
    const sheet    = loadedSheet;
    if (!sheet) { alert('Сначала загрузите Excel файл'); return; }
    if (!rangeStr) { alert('Введите диапазон ячеек'); return; }
    const values = readCellRange(sheet, rangeStr);
    if (!values || values.length === 0) { alert('Нет числовых данных в диапазоне'); return; }
    document.getElementById('fitting-data').value = values.join(', ');
};

document.getElementById('fitting-button').addEventListener('click', function() {
    const raw   = document.getElementById('fitting-data').value;
    const units = document.getElementById('fitting-units').value.trim();
    const data  = parseInputData(raw);

    if (data.length < 3) { alert('Введите минимум 3 значения больше нуля'); return; }

    const { k, lambda, r2, sorted, ranks } = fitWeibull(data);

    document.getElementById('fitting-result').classList.remove('d-none');
    document.getElementById('fitting-k').textContent      = k.toFixed(3);
    document.getElementById('fitting-lambda').textContent  = lambda.toFixed(2);
    document.getElementById('fitting-r2').textContent      = r2.toFixed(4);
    document.getElementById('fitting-n').textContent       = data.length;

    // Интерпретация
    let qualityText = r2 >= 0.95 ? '✓ Отличное совпадение'
                    : r2 >= 0.85 ? '~ Хорошее совпадение'
                    : r2 >= 0.70 ? '⚠ Приемлемое совпадение — используйте с осторожностью'
                    :              '✗ Слабое совпадение — проверьте данные';

    let kText = k < 1   ? `k < 1 (${k.toFixed(2)}) — ранние отказы`
              : k < 1.5 ? `k ≈ 1 (${k.toFixed(2)}) — случайные отказы`
              : k < 3   ? `k = ${k.toFixed(2)} — нормальный износ`
              :            `k > 3 (${k.toFixed(2)}) — быстрый износ`;

    document.getElementById('fitting-interpretation').innerHTML = `
        <div class="mb-1"><i class="bi bi-info-circle me-2"></i><strong>${qualityText}</strong></div>
        <div class="mt-1 text-secondary">${kText}</div>`;

    fittingChartInstance = buildFittingChart(
        fittingChartInstance, sorted, ranks, k, lambda, units
    );
});

document.getElementById('fitting-use-params').addEventListener('click', function() {
    const k      = document.getElementById('fitting-k').textContent;
    const lambda = document.getElementById('fitting-lambda').textContent;
    const units  = document.getElementById('fitting-units').value.trim();
    if (k === '—' || lambda === '—') return;

    document.getElementById('shape-param').value = k;
    document.getElementById('scale-param').value = lambda;
    if (units) document.getElementById('x-units').value = units;

    const weibullBtn = document.querySelector('.app-tabs .nav-link');
    if (weibullBtn) window.switchTab('weibull', weibullBtn);
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('fitting-clear').addEventListener('click', function() {
    document.getElementById('fitting-data').value       = '';
    document.getElementById('fitting-units').value      = '';
    document.getElementById('fitting-cell-range').value = '';
    document.getElementById('fitting-result').classList.add('d-none');
    if (fittingChartInstance) {
        fittingChartInstance.destroy();
        fittingChartInstance = null;
    }
});

// ── Очистить всё ──────────────────────────────────────────
document.getElementById('clear-button').addEventListener('click', function() {
    document.getElementById('shape-param').value         = '1';
    document.getElementById('scale-param').value         = '1';
    document.getElementById('x-value').value             = '';
    document.getElementById('monte-carlo-samples').value = '1000';
    document.getElementById('result-area').classList.add('d-none');
    document.getElementById('mc-result-area').classList.add('d-none');

    if (weibullChartInstance) {
        weibullChartInstance.data.labels            = [];
        weibullChartInstance.data.datasets[0].data  = [];
        weibullChartInstance.update();
    }
    if (monteCarloChartInstance) {
        monteCarloChartInstance.destroy();
        monteCarloChartInstance = null;
    }
});

// ── Экспорт ───────────────────────────────────────────────
window.exportChartPNG = function(canvasId, filename) {
    const canvas       = document.getElementById(canvasId);
    if (!canvas) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width  = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, 0, 0);
    const link      = document.createElement('a');
    link.download   = `${filename}-${new Date().toISOString().slice(0,10)}.png`;
    link.href       = exportCanvas.toDataURL('image/png');
    link.click();
};

window.exportChartCSV = function(type) {
    let chartInstance = null;
    let headers       = '';

    if (type === 'weibull') {
        chartInstance = weibullChartInstance;
        const calcType = document.getElementById('calculation-type').value.toUpperCase();
        const units    = document.getElementById('x-units').value.trim() || 'x';
        headers = `${units},${calcType}\n`;
    } else if (type === 'reliability') {
        chartInstance = reliabilityChartInstance;
        const units = document.getElementById('rel-units').value.trim() || 't';
        headers = `${units},R(t)\n`;
    }

    if (!chartInstance) { alert('Сначала постройте график'); return; }

    const labels = chartInstance.data.labels;
    const data   = chartInstance.data.datasets[0].data;
    let csv      = headers;
    labels.forEach((label, i) => {
        csv += `${label},${data[i] !== null ? data[i] : ''}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `${type}-${new Date().toISOString().slice(0,10)}.csv`;
    link.href     = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
};

// ── Вспомогательная функция статуса ──────────────────────
function setStatus(el, type, text) {
    el.textContent = text;
    el.className   = `mt-2 small font-mono ${type}`;
}

// ── Сравнение распределений ───────────────────────────────

// Взять параметры из вкладки "Анализ данных"
window.useFromFitting = function(slot) {
    const k      = document.getElementById('fitting-k').textContent;
    const lambda = document.getElementById('fitting-lambda').textContent;
    if (k === '—' || lambda === '—') {
        alert('Сначала выполните анализ данных');
        return;
    }
    document.getElementById(`comp-${slot}-k`).value      = k;
    document.getElementById(`comp-${slot}-lambda`).value = lambda;
};

// Взять параметры из вкладки "Вейбулл"
window.useFromWeibull = function(slot) {
    const k      = document.getElementById('shape-param').value;
    const lambda = document.getElementById('scale-param').value;
    document.getElementById(`comp-${slot}-k`).value      = k;
    document.getElementById(`comp-${slot}-lambda`).value = lambda;
};

document.getElementById('comparison-button').addEventListener('click', function() {
    const aK      = parseFloat(document.getElementById('comp-a-k').value);
    const aLambda = parseFloat(document.getElementById('comp-a-lambda').value);
    const bK      = parseFloat(document.getElementById('comp-b-k').value);
    const bLambda = parseFloat(document.getElementById('comp-b-lambda').value);
    const aName   = document.getElementById('comp-a-name').value.trim() || 'Распределение А';
    const bName   = document.getElementById('comp-b-name').value.trim() || 'Распределение Б';
    const calcType = document.getElementById('comp-type').value;
    const units    = document.getElementById('comp-units').value.trim();

    // Валидация
    if (isNaN(aK) || aK <= 0 || isNaN(aLambda) || aLambda <= 0) {
        alert('Проверьте параметры распределения А'); return;
    }
    if (isNaN(bK) || bK <= 0 || isNaN(bLambda) || bLambda <= 0) {
        alert('Проверьте параметры распределения Б'); return;
    }

    const dataA = { k: aK, lambda: aLambda, name: aName };
    const dataB = { k: bK, lambda: bLambda, name: bName };

    // Строим график
    comparisonChartInstance = buildComparisonChart(
        comparisonChartInstance, dataA, dataB, calcType, units
    );

    // Считаем итоги
    // MTTF = λ * Γ(1 + 1/k) ≈ λ * (1 + 1/k - 1)! для простоты используем λ
    // Для сравнения используем λ как характерную жизнь
    const aB10 = aLambda * Math.pow(-Math.log(0.9), 1 / aK); // время когда 10% откажут
    const bB10 = bLambda * Math.pow(-Math.log(0.9), 1 / bK);

    const aB50 = aLambda * Math.pow(-Math.log(0.5), 1 / aK); // медиана
    const bB50 = bLambda * Math.pow(-Math.log(0.5), 1 / bK);

    // Показываем итоги
    document.getElementById('comparison-summary').classList.remove('d-none');
    document.getElementById('comp-a-name-display').textContent = aName;
    document.getElementById('comp-b-name-display').textContent = bName;

    document.getElementById('comp-a-stats').innerHTML = `
        k = ${aK} · λ = ${aLambda} ${units}<br>
        B10 = ${aB10.toFixed(1)} ${units}<br>
        <span class="text-secondary">10% откажут к этому моменту</span><br>
        Медиана = ${aB50.toFixed(1)} ${units}<br>
        <span class="text-secondary">50% откажут к этому моменту</span>
    `;

    document.getElementById('comp-b-stats').innerHTML = `
        k = ${bK} · λ = ${bLambda} ${units}<br>
        B10 = ${bB10.toFixed(1)} ${units}<br>
        <span class="text-secondary">10% откажут к этому моменту</span><br>
        Медиана = ${bB50.toFixed(1)} ${units}<br>
        <span class="text-secondary">50% откажут к этому моменту</span>
    `;

    // Интерпретация
    const betterB10  = aB10 > bB10 ? aName : bName;
    const betterLong = aLambda > bLambda ? aName : bName;
    const worseShort = aB10 < bB10 ? aName : bName;

    document.getElementById('comparison-interpretation').innerHTML = `
        <i class="bi bi-lightbulb me-2"></i>
        <strong>${betterB10}</strong> надёжнее в начале срока службы (выше B10).
        На длинном горизонте лучше <strong>${betterLong}</strong> (выше λ).
        ${aB10 !== bB10
            ? `<strong>${worseShort}</strong> имеет больше ранних отказов.`
            : ''}
    `;
});

document.getElementById('comparison-clear').addEventListener('click', function() {
    document.getElementById('comp-a-name').value   = '';
    document.getElementById('comp-b-name').value   = '';
    document.getElementById('comp-a-k').value      = '1.5';
    document.getElementById('comp-a-lambda').value = '1000';
    document.getElementById('comp-b-k').value      = '2.5';
    document.getElementById('comp-b-lambda').value = '1500';
    document.getElementById('comparison-summary').classList.add('d-none');
    if (comparisonChartInstance) {
        comparisonChartInstance.destroy();
        comparisonChartInstance = null;
    }
});

// Экспорт CSV для сравнительного графика
window.exportChartCSV = function(type) {
    let chartInstance = null;
    let headers       = '';

    if (type === 'weibull') {
        chartInstance = weibullChartInstance;
        const calcType = document.getElementById('calculation-type').value.toUpperCase();
        const units    = document.getElementById('x-units').value.trim() || 'x';
        headers = `${units},${calcType}\n`;
    } else if (type === 'reliability') {
        chartInstance = reliabilityChartInstance;
        const units = document.getElementById('rel-units').value.trim() || 't';
        headers = `${units},R(t)\n`;
    } else if (type === 'comparison') {
        chartInstance = comparisonChartInstance;
        const units  = document.getElementById('comp-units').value.trim() || 'x';
        const aName  = document.getElementById('comp-a-name').value.trim() || 'А';
        const bName  = document.getElementById('comp-b-name').value.trim() || 'Б';
        headers = `${units},${aName},${bName}\n`;

        if (!chartInstance) { alert('Сначала постройте график'); return; }

        const pointsA = chartInstance.data.datasets[0].data;
        const pointsB = chartInstance.data.datasets[1].data;
        const maxLen  = Math.max(pointsA.length, pointsB.length);

        let csv = headers;
        for (let i = 0; i < maxLen; i++) {
            const x  = pointsA[i]?.x ?? pointsB[i]?.x ?? '';
            const yA = pointsA[i]?.y ?? '';
            const yB = pointsB[i]?.y ?? '';
            csv += `${x},${yA},${yB}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.download = `comparison-${new Date().toISOString().slice(0,10)}.csv`;
        link.href     = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        return;
    }

    if (!chartInstance) { alert('Сначала постройте график'); return; }

    const labels = chartInstance.data.labels;
    const data   = chartInstance.data.datasets[0].data;
    let csv      = headers;
    labels.forEach((label, i) => {
        csv += `${label},${data[i] !== null ? data[i] : ''}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `${type}-${new Date().toISOString().slice(0,10)}.csv`;
    link.href     = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
};