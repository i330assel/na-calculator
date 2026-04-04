// ============================================================
//  script.js
//  Часть 1: Математика (оригинальный код)
//  Часть 2: Загрузка Excel
//  Часть 3: Расчёт и график Вейбулла
//  Часть 4: Монте-Карло
//  Часть 5: Кнопка Очистить
// ============================================================

// ── Глобальные переменные ──
let weibullChartInstance   = null;
let monteCarloChartInstance = null;
let loadedSheet = null;  // хранит загруженный лист Excel


// ============================================================
// ЧАСТЬ 1: МАТЕМАТИКА (оригинальный код без изменений)
// ============================================================

function weibullPdf(x, k, lambda) {
    if (lambda <= 0 || k <= 0 || x < 0) return NaN;
    if (x === 0 && k < 1) return Infinity;
    if (x === 0 && k === 1) return 1 / lambda;
    if (x === 0 && k > 1) return 0;
    return (k / lambda) * Math.pow(x / lambda, k - 1) * Math.exp(-Math.pow(x / lambda, k));
}

function weibullCdf(x, k, lambda) {
    if (lambda <= 0 || k <= 0 || x < 0) return NaN;
    return 1 - Math.exp(-Math.pow(x / lambda, k));
}

function weibullSf(x, k, lambda) {
    if (lambda <= 0 || k <= 0 || x < 0) return NaN;
    return Math.exp(-Math.pow(x / lambda, k));
}

function inverseWeibull(k, lambda, uniform) {
    if (lambda <= 0 || k <= 0 || uniform <= 0 || uniform >= 1) return NaN;
    return lambda * Math.pow(-Math.log(1 - uniform), 1 / k);
}


// ============================================================
// ЧАСТЬ 2: ЗАГРУЗКА EXCEL
// ============================================================

const uploadZone     = document.getElementById('uploadZone');
const excelFileInput = document.getElementById('excelFile');

// Drag & Drop
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

// Клик по зоне — открывает диалог выбора файла
uploadZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
        excelFileInput.click();
    }
});

// Выбор файла через диалог
excelFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processExcelFile(file);
});

/**
 * Читает Excel-файл через библиотеку SheetJS (подключена в index.html).
 * FileReader — встроенный браузерный API для чтения файлов.
 */
function processExcelFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data     = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Берём первый лист книги
            const sheetName = workbook.SheetNames[0];
            loadedSheet     = workbook.Sheets[sheetName];

            document.getElementById('fileName').textContent =
                `✓ ${file.name}  (лист: "${sheetName}")`;

            renderPreview(loadedSheet);

            document.getElementById('previewSection').classList.remove('d-none');
            document.getElementById('mappingSection').classList.remove('d-none');

        } catch (err) {
            document.getElementById('fileName').textContent =
                '✗ Ошибка чтения файла. Убедитесь что это .xlsx или .xls';
            console.error(err);
        }
    };

    reader.readAsArrayBuffer(file);
}

/**
 * Рисует таблицу-превью: первые 10 строк и первые 8 колонок.
 */
function renderPreview(sheet) {
    const range  = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const maxRow = Math.min(range.e.r, 9);   // строки 0–9
    const maxCol = Math.min(range.e.c, 7);   // колонки 0–7

    const table = document.getElementById('previewTable');
    table.innerHTML = '';

    // Заголовок: # + буквы колонок (A, B, C…)
    const thead     = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>#</th>';
    for (let c = 0; c <= maxCol; c++) {
        const th = document.createElement('th');
        th.textContent = XLSX.utils.encode_col(c);  // 0→A, 1→B
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Строки данных
    const tbody = document.createElement('tbody');
    for (let r = 0; r <= maxRow; r++) {
        const tr = document.createElement('tr');

        // Номер строки как в Excel (1, 2, 3…)
        const numTd = document.createElement('td');
        numTd.textContent    = r + 1;
        numTd.style.color    = 'var(--accent)';
        numTd.style.opacity  = '0.6';
        tr.appendChild(numTd);

        for (let c = 0; c <= maxCol; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = sheet[addr];
            const td   = document.createElement('td');
            td.textContent = cell ? cell.v : '';
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
}

/**
 * Читает одно числовое значение из ячейки (напр. "B2").
 * Возвращает число или null если ячейка пустая / не число.
 */
function readSingleCell(sheet, address) {
    const cell = sheet[address.trim().toUpperCase()];
    if (!cell) return null;
    const val  = parseFloat(cell.v);
    return isNaN(val) ? null : val;
}

/**
 * Читает диапазон ячеек (напр. "C2:C50") и возвращает массив чисел.
 * Нечисловые ячейки пропускает.
 */
function readCellRange(sheet, rangeStr) {
    let range;
    try {
        range = XLSX.utils.decode_range(rangeStr.trim().toUpperCase());
    } catch {
        return null;
    }
    const values = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            if (cell) {
                const val = parseFloat(cell.v);
                if (!isNaN(val)) values.push(val);
            }
        }
    }
    return values;
}

// Кнопка "Загрузить данные из файла"
document.getElementById('load-from-excel').addEventListener('click', function () {
    const statusEl   = document.getElementById('excel-status');

    if (!loadedSheet) {
        setStatus(statusEl, 'error', '✗ Сначала загрузите Excel-файл');
        return;
    }

    const cellK      = document.getElementById('cell-k').value.trim();
    const cellLambda = document.getElementById('cell-lambda').value.trim();
    const cellX      = document.getElementById('cell-x').value.trim();
    const loaded     = [];

    // Загружаем k
    if (cellK) {
        const val = readSingleCell(loadedSheet, cellK);
        if (val === null || val <= 0) {
            setStatus(statusEl, 'error', `✗ Ячейка ${cellK.toUpperCase()}: нет числа > 0`);
            return;
        }
        document.getElementById('shape-param').value = val;
        loaded.push(`k = ${val}`);
    }

    // Загружаем lambda
    if (cellLambda) {
        const val = readSingleCell(loadedSheet, cellLambda);
        if (val === null || val <= 0) {
            setStatus(statusEl, 'error', `✗ Ячейка ${cellLambda.toUpperCase()}: нет числа > 0`);
            return;
        }
        document.getElementById('scale-param').value = val;
        loaded.push(`λ = ${val}`);
    }

    // Загружаем x (одна ячейка или первое значение из диапазона)
    if (cellX) {
        let xVal = readSingleCell(loadedSheet, cellX);
        if (xVal === null) {
            const arr = readCellRange(loadedSheet, cellX);
            xVal = arr && arr.length > 0 ? arr[0] : null;
        }
        if (xVal === null || xVal < 0) {
            setStatus(statusEl, 'error', `✗ Ячейки x: нет числа ≥ 0`);
            return;
        }
        document.getElementById('x-value').value = xVal;
        loaded.push(`x = ${xVal}`);
    }

    if (loaded.length === 0) {
        setStatus(statusEl, 'error', '✗ Укажите хотя бы одну ячейку');
        return;
    }

    setStatus(statusEl, 'success', `✓ Загружено: ${loaded.join('  ·  ')}`);
});

/** Устанавливает текст и CSS-класс для статусного сообщения */
function setStatus(el, type, text) {
    el.textContent = text;
    el.className   = `mt-2 small font-mono ${type}`;
}


// ============================================================
// ЧАСТЬ 3: РАСЧЁТ И ГРАФИК ВЕЙБУЛЛА
// ============================================================

document.getElementById('calculate-button').addEventListener('click', function () {
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

    if (isNaN(k) || k <= 0) {
        showResult('Ошибка: введите корректное положительное значение для k', true);
        return;
    }
    if (isNaN(lambda) || lambda <= 0) {
        showResult('Ошибка: введите корректное положительное значение для λ', true);
        return;
    }

    const x        = parseFloat(xInput);
    const isXValid = !isNaN(x) && x >= 0;

    // Подсказка когда x не введён
    const noXHint = document.getElementById('no-x-hint');
    if (noXHint) {
        if (!isXValid) noXHint.classList.remove('d-none');
        else           noXHint.classList.add('d-none');
    }

    if (isXValid) {
        // Показываем x в заголовке результата
        const resultXValue = document.getElementById('result-x-value');
        if (resultXValue) resultXValue.textContent = x;

        let result;
        if (calculationType === 'pdf')      result = weibullPdf(x, k, lambda);
        else if (calculationType === 'cdf') result = weibullCdf(x, k, lambda);
        else                                result = weibullSf(x, k, lambda);

        if (result === Infinity)                     showResult('∞ (бесконечность)', false);
        else if (!isNaN(result) && isFinite(result)) showResult(result.toFixed(6), false);
        else                                         showResult('Ошибка при расчёте. Проверьте данные.', true);
    } else {
        resultArea.classList.add('d-none');
    }

    buildWeibullChart(k, lambda, calculationType);
});

function buildWeibullChart(k, lambda, calculationType) {
    const ctx    = document.getElementById('weibullChart').getContext('2d');
    const points = 100;
    const range  = Math.max(lambda * 5, 5);
    const step   = range / points;

    const labels = [];
    const data   = [];
    let yMax     = 0;

    for (let i = 0; i < points; i++) {
        const xVal = i * step;
        let yVal;
        if (calculationType === 'pdf')      yVal = weibullPdf(xVal, k, lambda);
        else if (calculationType === 'cdf') yVal = weibullCdf(xVal, k, lambda);
        else                                yVal = weibullSf(xVal, k, lambda);

        labels.push(xVal.toFixed(2));

        if (!isNaN(yVal) && isFinite(yVal) && yVal > -1e-9) {
            data.push(yVal);
            if (yVal > yMax) yMax = yVal;
        } else {
            data.push(null);
        }
    }

    // Берём единицы измерения которые ввёл пользователь
    const xUnits = document.getElementById('x-units')
        ? document.getElementById('x-units').value.trim() || 'x'
        : 'x';

    // Умные названия осей
    const yAxisLabels = {
        pdf: 'Плотность вероятности',
        cdf: 'Вероятность отказа (0–1)',
        sf:  'Вероятность выживания (0–1)'
    };

    const chartTitles = {
        pdf: 'PDF — Плотность вероятности отказа',
        cdf: 'CDF — Накопленная вероятность отказа',
        sf:  'SF — Функция надёжности'
    };

    const yLabel    = yAxisLabels[calculationType];
    const titleText = chartTitles[calculationType];
    const monoFont  = { family: 'JetBrains Mono', size: 11 };

    if (weibullChartInstance) {
        weibullChartInstance.data.labels                 = labels;
        weibullChartInstance.data.datasets[0].data       = data;
        weibullChartInstance.data.datasets[0].label      = `Weibull ${calculationType.toUpperCase()} (k=${k.toFixed(2)}, λ=${lambda.toFixed(2)})`;
        weibullChartInstance.options.scales.y.max        = yMax * 1.1;
        weibullChartInstance.options.plugins.title.text  = titleText;
        weibullChartInstance.options.scales.x.title.text = xUnits;
        weibullChartInstance.options.scales.y.title.text = yLabel;
        weibullChartInstance.update();
    } else {
        weibullChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label:           `Weibull ${calculationType.toUpperCase()} (k=${k.toFixed(2)}, λ=${lambda.toFixed(2)})`,
                    data,
                    borderColor:     '#5b6ef5',
                    backgroundColor: 'rgba(91,110,245,0.07)',
                    tension:         0.3,
                    fill:            true,
                    pointRadius:     0,
                    borderWidth:     2
                }]
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                plugins: {
                    title:  { display: true, text: titleText, color: '#6b7280', font: { family: 'JetBrains Mono', size: 12 } },
                    legend: { labels: { color: '#6b7280', font: monoFont } }
                },
                scales: {
                    x: {
                        title: { display: true, text: xUnits, color: '#6b7280' },
                        ticks: { color: '#6b7280', font: monoFont },
                        grid:  { color: 'rgba(0,0,0,0.05)' },
                        min:   0
                    },
                    y: {
                        title: { display: true, text: yLabel, color: '#6b7280' },
                        ticks: { color: '#6b7280', font: monoFont },
                        grid:  { color: 'rgba(0,0,0,0.05)' },
                        max:   yMax * 1.1
                    }
                }
            }
        });
    }
}

// Глобальная функция для dashboard.js
window.buildWeibullChartGlobal = buildWeibullChart;

// Подсказки при смене типа расчёта
const calcTypeHints = {
    pdf: 'Показывает в какой момент чаще всего происходят отказы',
    cdf: 'Вероятность отказа ДО момента x (растёт от 0 до 1)',
    sf:  'Вероятность что изделие ПЕРЕЖИВЁТ момент x (падает от 1 до 0)'
};

document.getElementById('calculation-type').addEventListener('change', function () {
    const hint = document.getElementById('calcTypeHint');
    if (hint) hint.innerHTML = `<span class="hint-item">${calcTypeHints[this.value]}</span>`;
});

// Делаем функцию доступной глобально для dashboard.js
window.buildWeibullChartGlobal = buildWeibullChart


// ============================================================
// ЧАСТЬ 4: МОНТЕ-КАРЛО
// ============================================================

document.getElementById('monte-carlo-button').addEventListener('click', function () {
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

    // Генерация выборок методом обратного преобразования
    const samples = [];
    for (let i = 0; i < numSamples; i++) {
        const u = Math.random();
        const s = inverseWeibull(k, lambda, u);
        if (!isNaN(s) && isFinite(s) && s >= 0) samples.push(s);
    }

    if (samples.length === 0) {
        showMcResult('Не удалось сгенерировать корректные выборки', true);
        return;
    }

    // Статистика
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const std  = samples.length > 1
        ? Math.sqrt(samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (samples.length - 1))
        : 0;

    showMcResult(
        `Среднее: ${mean.toFixed(4)}   |   Ст. отклонение: ${std.toFixed(4)}   |   Выборок: ${samples.length}`,
        false
    );

    // Гистограмма — правило Стерджеса для числа корзин
    let binSize;
    if (samples.length < 100) {
        binSize = 1;
    } else {
        const nBins = Math.ceil(1 + 3.322 * Math.log(samples.length));
        binSize = Math.max(0.1, (Math.max(...samples) - Math.min(...samples)) / nBins);
    }
    if (binSize === 0) binSize = 1;

    const effMax    = Math.max(...samples);
    const nBins     = Math.max(1, Math.ceil((effMax - 0) / binSize));
    const histogram = new Array(nBins).fill(0);
    const binLabels = [];

    samples.forEach(v => {
        const idx = Math.floor(v / binSize);
        if (idx >= 0 && idx < nBins) histogram[idx]++;
    });

    for (let i = 0; i < nBins; i++) {
        binLabels.push((i * binSize).toFixed(1));
    }

    const mcCtx = document.getElementById('monteCarloChart').getContext('2d');
    if (monteCarloChartInstance) monteCarloChartInstance.destroy();

    const monoFont = { family: 'JetBrains Mono', size: 11 };

    monteCarloChartInstance = new Chart(mcCtx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label:           'Частота',
                data:            histogram,
                backgroundColor: 'rgba(56,189,248,0.55)',
                borderColor:     'rgba(56,189,248,0.9)',
                borderWidth:     1
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text:    `Монте-Карло (k=${k.toFixed(2)}, λ=${lambda.toFixed(2)}, N=${numSamples})`,
                    color:   '#9ca3af',
                    font:    { family: 'JetBrains Mono', size: 12 }
                },
                legend:  { labels: { color: '#9ca3af', font: monoFont } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} раз(а)` } }
            },
            scales: {
                x: {
                    title: { display: true, text: document.getElementById('x-units').value.trim() || 'Значение выборки', color: '#6b7280' },
                    ticks: { color: '#6b7280', font: monoFont },
                    grid:  { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    title:        { display: true, text: 'Количество', color: '#6b7280' },
                    ticks:        { color: '#6b7280', font: monoFont },
                    grid:         { color: 'rgba(255,255,255,0.05)' },
                    beginAtZero:  true
                }
            }
        }
    });
});


// ============================================================
// ЧАСТЬ 5: КНОПКА ОЧИСТИТЬ
// ============================================================

document.getElementById('clear-button').addEventListener('click', function () {
    document.getElementById('shape-param').value        = '1';
    document.getElementById('scale-param').value        = '1';
    document.getElementById('x-value').value            = '';
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


// ============================================================
// ВКЛАДКИ
// ============================================================

window.switchTab = function(tab, btn) {
    ['weibull', 'monte', 'reliability'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('d-none');
    });
    document.querySelectorAll('.app-tabs .nav-link').forEach(b => {
        b.classList.remove('active');
    });
    document.getElementById(`tab-${tab}`).classList.remove('d-none');
    if (btn) btn.classList.add('active');
}

// ============================================================
// ВКЛАДКА 3: НАДЁЖНОСТЬ R(t) и MTBF
// ============================================================

let reliabilityChartInstance = null;

document.getElementById('reliability-button').addEventListener('click', function() {
    const lambda  = parseFloat(document.getElementById('rel-lambda').value);
    const tInput  = document.getElementById('rel-t').value;
    const units   = document.getElementById('rel-units').value.trim() || 'единиц времени';

    if (isNaN(lambda) || lambda <= 0) {
        alert('Введите корректное значение λ > 0');
        return;
    }

    // MTBF = 1/λ
    const mtbf = 1 / lambda;

    // Показываем блок результатов
    document.getElementById('rel-result-area').classList.remove('d-none');
    document.getElementById('rel-mtbf').textContent = mtbf.toFixed(2) + ' ' + units;

    // R(t) и F(t) — только если t введено
    const t       = parseFloat(tInput);
    const isTValid = !isNaN(t) && t >= 0;

    if (isTValid) {
        const rt = Math.exp(-lambda * t);
        const ft = 1 - rt;

        document.getElementById('rel-rt').textContent = (rt * 100).toFixed(2) + '%';
        document.getElementById('rel-ft').textContent = (ft * 100).toFixed(2) + '%';

        document.getElementById('rel-rt-hint').textContent =
            `${(rt * 100).toFixed(1)}% изделий проработают дольше ${t} ${units}`;
        document.getElementById('rel-ft-hint').textContent =
            `${(ft * 100).toFixed(1)}% изделий откажут до ${t} ${units}`;

        // Интерпретация
        document.getElementById('rel-interpretation').innerHTML = `
            <i class="bi bi-lightbulb me-2"></i>
            При интенсивности отказов λ = ${lambda},
            из 100 изделий примерно <strong>${Math.round(rt * 100)}</strong>
            проработают дольше ${t} ${units},
            и примерно <strong>${Math.round(ft * 100)}</strong> откажут раньше.
            Среднее время между отказами — <strong>${mtbf.toFixed(1)} ${units}</strong>.
        `;
    } else {
        document.getElementById('rel-rt').textContent = '—';
        document.getElementById('rel-ft').textContent = '—';
        document.getElementById('rel-interpretation').innerHTML = `
            <i class="bi bi-info-circle me-2"></i>
            MTBF = <strong>${mtbf.toFixed(2)} ${units}</strong>.
            Введите значение t чтобы рассчитать вероятность выживания R(t).
        `;
    }

    // График R(t)
    buildReliabilityChart(lambda, units, isTValid ? t : null);
});

document.getElementById('reliability-clear').addEventListener('click', function() {
    document.getElementById('rel-lambda').value  = '0.001';
    document.getElementById('rel-t').value       = '';
    document.getElementById('rel-units').value   = '';
    document.getElementById('rel-result-area').classList.add('d-none');
    if (reliabilityChartInstance) {
        reliabilityChartInstance.destroy();
        reliabilityChartInstance = null;
    }
});

function buildReliabilityChart(lambda, units, tMark) {
    const ctx    = document.getElementById('reliabilityChart').getContext('2d');
    const points = 100;
    const mtbf   = 1 / lambda;
    const range  = mtbf * 4; // показываем 4 MTBF
    const step   = range / points;

    const labels = [];
    const data   = [];

    for (let i = 0; i <= points; i++) {
        const t = i * step;
        labels.push(t.toFixed(1));
        data.push(Math.exp(-lambda * t));
    }

    const monoFont = { family: 'JetBrains Mono', size: 11 };

    // Вертикальная линия в точке t если введено
    const annotations = {};
    if (tMark !== null) {
        annotations.tLine = {
            type:        'line',
            xMin:        tMark.toFixed(1),
            xMax:        tMark.toFixed(1),
            borderColor: 'rgba(239,68,68,0.7)',
            borderWidth: 2,
            borderDash:  [4, 4],
            label: {
                display:     true,
                content:     `t = ${tMark}`,
                color:       '#ef4444',
                font:        monoFont
            }
        };
    }

    if (reliabilityChartInstance) {
        reliabilityChartInstance.destroy();
    }

    reliabilityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label:           `R(t) = e^(-${lambda}·t)`,
                data,
                borderColor:     '#10b981',
                backgroundColor: 'rgba(16,185,129,0.07)',
                tension:         0.3,
                fill:            true,
                pointRadius:     0,
                borderWidth:     2
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text:    'Функция надёжности R(t) = e^(-λt)',
                    color:   '#6b7280',
                    font:    { family: 'JetBrains Mono', size: 12 }
                },
                legend: { labels: { color: '#6b7280', font: monoFont } }
            },
            scales: {
                x: {
                    title: { display: true, text: units, color: '#6b7280' },
                    ticks: { color: '#6b7280', font: monoFont },
                    grid:  { color: 'rgba(0,0,0,0.05)' }
                },
                y: {
                    title: { display: true, text: 'Вероятность выживания', color: '#6b7280' },
                    ticks: {
                        color: '#6b7280',
                        font:  monoFont,
                        callback: (v) => (v * 100).toFixed(0) + '%'
                    },
                    grid:  { color: 'rgba(0,0,0,0.05)' },
                    min:   0,
                    max:   1
                }
            }
        }
    });
}