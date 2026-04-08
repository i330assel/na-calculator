import {
    weibullPdf, weibullCdf, weibullSf
} from './weibull-math.js';

// ── Общие настройки для всех графиков
const CHART_STYLE = {
    font:      { family: 'JetBrains Mono', size: 11 },
    color:     '#6b7280',
    gridColor: 'rgba(0,0,0,0.05)',
    titleFont: { family: 'JetBrains Mono', size: 12 }
};

// Вспомогательная функция для настроек оси
function axisConfig(title) {
    return {
        title: { display: true, text: title, color: CHART_STYLE.color },
        ticks: { color: CHART_STYLE.color, font: CHART_STYLE.font },
        grid:  { color: CHART_STYLE.gridColor }
    };
}

// ── График Вейбулла (линейный) ────────────────────────────

export function buildWeibullChart(instance, k, lambda, calcType, xUnits) {
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
        if (calcType === 'pdf')      yVal = weibullPdf(xVal, k, lambda);
        else if (calcType === 'cdf') yVal = weibullCdf(xVal, k, lambda);
        else                         yVal = weibullSf(xVal, k, lambda);

        labels.push(xVal.toFixed(2));
        if (!isNaN(yVal) && isFinite(yVal) && yVal > -1e-9) {
            data.push(yVal);
            if (yVal > yMax) yMax = yVal;
        } else {
            data.push(null);
        }
    }

    const yLabels = {
        pdf: 'Плотность вероятности',
        cdf: 'Вероятность отказа (0–1)',
        sf:  'Вероятность выживания (0–1)'
    };
    const titles = {
        pdf: 'PDF — Плотность вероятности отказа',
        cdf: 'CDF — Накопленная вероятность отказа',
        sf:  'SF — Функция надёжности'
    };

    const chartLabel = `Weibull ${calcType.toUpperCase()} (k=${k.toFixed(2)}, λ=${lambda.toFixed(2)})`;

    if (instance) {
        instance.data.labels                 = labels;
        instance.data.datasets[0].data       = data;
        instance.data.datasets[0].label      = chartLabel;
        instance.options.scales.y.max        = yMax * 1.1;
        instance.options.plugins.title.text  = titles[calcType];
        instance.options.scales.x.title.text = xUnits || 'x';
        instance.options.scales.y.title.text = yLabels[calcType];
        instance.update();
        return instance;
    }

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label:           chartLabel,
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
                title:  { display: true, text: titles[calcType], color: CHART_STYLE.color, font: CHART_STYLE.titleFont },
                legend: { labels: { color: CHART_STYLE.color, font: CHART_STYLE.font } }
            },
            scales: {
                x: { ...axisConfig(xUnits || 'x'), min: 0 },
                y: { ...axisConfig(yLabels[calcType]), max: yMax * 1.1 }
            }
        }
    });
}

// ── График Монте-Карло (гистограмма) ─────────────────────

export function buildMonteCarloChart(instance, mcData, k, lambda, numSamples, xUnits) {
    const ctx = document.getElementById('monteCarloChart').getContext('2d');
    if (instance) instance.destroy();

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: mcData.binLabels,
            datasets: [{
                label:           'Частота',
                data:            mcData.histogram,
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
                    color:   CHART_STYLE.color,
                    font:    CHART_STYLE.titleFont
                },
                legend:  { labels: { color: CHART_STYLE.color, font: CHART_STYLE.font } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} раз(а)` } }
            },
            scales: {
                x: axisConfig(xUnits || 'Значение выборки'),
                y: { ...axisConfig('Количество'), beginAtZero: true }
            }
        }
    });
}

// ── График надёжности R(t) ────────────────────────────────

export function buildReliabilityChart(instance, lambda, units, tMark) {
    const ctx   = document.getElementById('reliabilityChart').getContext('2d');
    const mtbf  = 1 / lambda;
    const range = mtbf * 4;
    const step  = range / 100;

    const labels = [];
    const data   = [];

    for (let i = 0; i <= 100; i++) {
        const t = i * step;
        labels.push(t.toFixed(1));
        data.push(Math.exp(-lambda * t));
    }

    if (instance) instance.destroy();

    return new Chart(ctx, {
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
                title:  { display: true, text: 'Функция надёжности R(t) = e^(-λt)', color: CHART_STYLE.color, font: CHART_STYLE.titleFont },
                legend: { labels: { color: CHART_STYLE.color, font: CHART_STYLE.font } }
            },
            scales: {
                x: axisConfig(units || 'время'),
                y: {
                    ...axisConfig('Вероятность выживания'),
                    min: 0,
                    max: 1,
                    ticks: {
                        color:    CHART_STYLE.color,
                        font:     CHART_STYLE.font,
                        callback: (v) => (v * 100).toFixed(0) + '%'
                    }
                }
            }
        }
    });
}

// ── График анализа данных (точки + кривая) ────────────────

export function buildFittingChart(instance, sorted, ranks, k, lambda, units) {
    const ctx = document.getElementById('fittingChart').getContext('2d');

    const scatterPoints = sorted.map((x, i) => ({
        x, y: ranks[i] * 100
    }));

    const maxX       = sorted[sorted.length - 1] * 1.3;
    const linePoints = [];
    for (let i = 0; i <= 100; i++) {
        const x   = (maxX / 100) * i;
        const cdf = (1 - Math.exp(-Math.pow(x / lambda, k))) * 100;
        linePoints.push({ x, y: cdf });
    }

    if (instance) instance.destroy();

    return new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label:           `Вейбулл CDF (k=${k.toFixed(2)}, λ=${lambda.toFixed(1)})`,
                    data:            linePoints,
                    type:            'line',
                    borderColor:     '#5b6ef5',
                    backgroundColor: 'rgba(91,110,245,0.06)',
                    fill:            true,
                    tension:         0.4,
                    pointRadius:     0,
                    borderWidth:     2,
                    order:           2
                },
                {
                    label:            'Данные об отказах',
                    data:             scatterPoints,
                    backgroundColor:  '#ef4444',
                    borderColor:      '#ef4444',
                    pointRadius:      6,
                    pointHoverRadius: 8,
                    order:            1
                }
            ]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                title:  { display: true, text: 'Вейбулл-анализ: данные vs теоретическая кривая', color: CHART_STYLE.color, font: CHART_STYLE.titleFont },
                legend: { labels: { color: CHART_STYLE.color, font: CHART_STYLE.font } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ctx.datasetIndex === 1
                            ? `t=${ctx.parsed.x.toFixed(1)} ${units || ''} · F=${ctx.parsed.y.toFixed(1)}%`
                            : `F(${ctx.parsed.x.toFixed(1)}) = ${ctx.parsed.y.toFixed(1)}%`
                    }
                }
            },
            scales: {
                x: { ...axisConfig(units || 'Время до отказа'), min: 0 },
                y: {
                    ...axisConfig('Вероятность отказа (%)'),
                    min: 0,
                    max: 100,
                    ticks: {
                        color:    CHART_STYLE.color,
                        font:     CHART_STYLE.font,
                        callback: (v) => v + '%'
                    }
                }
            }
        }
    });
}