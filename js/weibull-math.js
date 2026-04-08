// Константы для формулы Бернарда (медианный ранг)
const BERNARD_A = 0.3;
const BERNARD_B = 0.4;

// ── Формулы Вейбулла
export function weibullPdf(x, k, lambda) {
    if (lambda <= 0 || k <= 0 || x < 0) return NaN;
    if (x === 0 && k < 1) return Infinity;
    if (x === 0 && k === 1) return 1 / lambda;
    return (k / lambda) * Math.pow(x / lambda, k - 1) * Math.exp(-Math.pow(x / lambda, k));
}

export function weibullCdf(x, k, lambda) {
    if (lambda <= 0 || k <= 0 || x < 0) return NaN;
    return 1 - Math.exp(-Math.pow(x / lambda, k));
}

export function weibullSf(x, k, lambda) {
    if (lambda <= 0 || k <= 0 || x < 0) return NaN;
    return Math.exp(-Math.pow(x / lambda, k));
}

export function weibullInverse(k, lambda, uniform) {
    if (lambda <= 0 || k <= 0 || uniform <= 0 || uniform >= 1) return NaN;
    return lambda * Math.pow(-Math.log(1 - uniform), 1 / k);
}

// ── Формулы надёжности (вероятность безотказной работы)
export function reliabilityRt(lambda, t) {
    return Math.exp(-lambda * t);
}

export function reliabilityMtbf(lambda) {
    return 1 / lambda;
}


// ── Алгоритм MLE (подбор параметров из данных) ────────────

export function fitWeibull(data) {
    const n      = data.length;
    const sorted = [...data].sort((a, b) => a - b);

    // Медианный ранг по формуле Бернарда
    const ranks = sorted.map((_, i) =>
        (i + 1 - BERNARD_A) / (n + BERNARD_B)
    );

    // Линеаризация: Y = k * X + b
    const X = sorted.map(x => Math.log(x));
    const Y = ranks.map(f => Math.log(Math.log(1 / (1 - f))));

    // Метод наименьших квадратов
    const sumX  = X.reduce((a, b) => a + b, 0);
    const sumY  = Y.reduce((a, b) => a + b, 0);
    const sumXY = X.reduce((s, x, i) => s + x * Y[i], 0);
    const sumX2 = X.reduce((s, x) => s + x * x, 0);

    const k      = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b      = (sumY - k * sumX) / n;
    const lambda = Math.exp(-b / k);

    // R² — качество подбора
    const yMean = sumY / n;
    const yPred = X.map(x => k * x + b);
    const ssTot = Y.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
    const ssRes = Y.reduce((s, y, i) => s + Math.pow(y - yPred[i], 2), 0);
    const r2    = 1 - ssRes / ssTot;

    return { k, lambda, r2, sorted, ranks };
}

// ── Монте-Карло ───────────────────────────────────────────

export function runMonteCarlo(k, lambda, numSamples) {
    const samples = [];
    for (let i = 0; i < numSamples; i++) {
        const u = Math.random();
        const s = weibullInverse(k, lambda, u);
        if (!isNaN(s) && isFinite(s) && s >= 0) samples.push(s);
    }

    if (samples.length === 0) return null;

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const std  = samples.length > 1
        ? Math.sqrt(samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (samples.length - 1))
        : 0;

    // Гистограмма по правилу Стерджеса
    let binSize;
    if (samples.length < 100) {
        binSize = 1;
    } else {
        const nBins = Math.ceil(1 + 3.322 * Math.log(samples.length));
        binSize = Math.max(0.1, (Math.max(...samples) - Math.min(...samples)) / nBins);
    }
    if (binSize === 0) binSize = 1;

    const effMax    = Math.max(...samples);
    const nBins     = Math.max(1, Math.ceil(effMax / binSize));
    const histogram = new Array(nBins).fill(0);
    const binLabels = [];

    samples.forEach(v => {
        const idx = Math.floor(v / binSize);
        if (idx >= 0 && idx < nBins) histogram[idx]++;
    });

    for (let i = 0; i < nBins; i++) {
        binLabels.push((i * binSize).toFixed(1));
    }

    return { mean, std, histogram, binLabels, count: samples.length };
}