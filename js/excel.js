// Используется библиотека SheetJS (XLSX)

// Глобальная переменная — текущий загруженный лист
export let loadedSheet = null;

export function setLoadedSheet(sheet) {
    loadedSheet = sheet;
}

export function readSingleCell(sheet, address) {
    const cell = sheet[address.trim().toUpperCase()];
    if (!cell) return null;
    const val  = parseFloat(cell.v);
    return isNaN(val) ? null : val;
}

export function readCellRange(sheet, rangeStr) {
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

export function renderPreview(sheet) {
    const range  = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const maxRow = Math.min(range.e.r, 9);
    const maxCol = Math.min(range.e.c, 7);

    const table = document.getElementById('previewTable');
    table.innerHTML = '';

    const thead     = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>#</th>';
    for (let c = 0; c <= maxCol; c++) {
        const th      = document.createElement('th');
        th.textContent = XLSX.utils.encode_col(c);
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 0; r <= maxRow; r++) {
        const tr    = document.createElement('tr');
        const numTd = document.createElement('td');
        numTd.textContent   = r + 1;
        numTd.style.color   = 'var(--accent)';
        numTd.style.opacity = '0.6';
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