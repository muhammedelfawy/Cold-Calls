const STORAGE_KEY = 'salesDialer_v1';

let contacts = [];
let currentIdx = 0;
let activeFilter = 'all';
let filteredIndices = [];
let columns = [];
let rawData = [];

// ── PERSISTENCE ──────────────────────────────────────────
function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ contacts, currentIdx, activeFilter }));
    } catch (e) { }
}

function loadSession() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return false;
        const data = JSON.parse(saved);
        if (!data.contacts || data.contacts.length === 0) return false;
        contacts = data.contacts;
        currentIdx = Math.min(data.currentIdx || 0, contacts.length - 1);
        activeFilter = data.activeFilter || 'all';
        return true;
    } catch (e) { return false; }
}

function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
}

// ── BOOT ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    if (loadSession()) {
        applyFilter();
        showScreen('dialerScreen');
        renderCard();
        showResumeToast();
    }
});

function showResumeToast() {
    const toast = document.createElement('div');
    toast.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:var(--surface); border:1px solid var(--border);
    color:var(--text); padding:0.65rem 1.25rem; border-radius:30px;
    font-size:0.85rem; font-weight:600; z-index:200;
    box-shadow:0 8px 30px rgba(0,0,0,0.4);
    display:flex; align-items:center; gap:0.5rem;
    animation: fadeup 0.3s ease;
  `;
    const pend = contacts.filter(c => c.status === 'pending').length;
    toast.innerHTML = `<span style="color:var(--accent)">↩</span> تم استعادة الجلسة — ${pend} متبقي`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
    const style = document.createElement('style');
    style.textContent = `@keyframes fadeup { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
    document.head.appendChild(style);
}

// ── FILE UPLOAD ───────────────────────────────────────────
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            if (rawData.length < 2) { alert('الملف فارغ أو لا يحتوي على بيانات!'); return; }
            columns = rawData[0].map((c, i) => ({ label: c || `عمود ${i + 1}`, idx: i }));
            populateSelects();
            document.getElementById('colSetup').style.display = 'block';
            document.getElementById('startBtn').disabled = false;
            dropzone.querySelector('p').innerHTML = `<strong style="color:var(--green)">✓ ${file.name}</strong>`;
        } catch (err) { alert('خطأ في قراءة الملف. تأكد أنه Excel أو CSV.'); }
    };
    reader.readAsArrayBuffer(file);
}

function populateSelects() {
    const selects = ['nameCol', 'phoneCol', 'extraCol'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        const keep = id === 'nameCol' || id === 'extraCol' ? sel.children[0].outerHTML : '';
        sel.innerHTML = keep;
        columns.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.idx; opt.textContent = c.label;
            sel.appendChild(opt);
        });
    });
    const guess = columns.findIndex(c => /phone|tel|mob|رقم|تليفون|موبايل|هاتف/i.test(c.label));
    if (guess >= 0) document.getElementById('phoneCol').value = guess;
    const nameGuess = columns.findIndex(c => /name|اسم/i.test(c.label));
    if (nameGuess >= 0) document.getElementById('nameCol').value = nameGuess;
}

function startDialer() {
    const phoneColIdx = parseInt(document.getElementById('phoneCol').value);
    const nameColIdx = document.getElementById('nameCol').value;
    const extraColIdx = document.getElementById('extraCol').value;
    const startRow = parseInt(document.getElementById('startRow').value) - 1;

    contacts = [];
    for (let i = startRow; i < rawData.length; i++) {
        const row = rawData[i];
        const phone = String(row[phoneColIdx] || '').trim();
        if (!phone) continue;
        contacts.push({
            phone,
            name: nameColIdx !== '' ? String(row[parseInt(nameColIdx)] || '').trim() : '',
            extra: extraColIdx !== '' ? String(row[parseInt(extraColIdx)] || '').trim() : '',
            status: 'pending',
            note: '',
            rowIdx: i
        });
    }
    if (contacts.length === 0) { alert('لم يتم العثور على أرقام في العمود المحدد!'); return; }
    currentIdx = 0;
    activeFilter = 'all';
    applyFilter();
    persist();
    showScreen('dialerScreen');
    renderCard();
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function applyFilter() {
    if (activeFilter === 'all') {
        filteredIndices = contacts.map((_, i) => i);
    } else {
        filteredIndices = contacts.map((_, i) => i).filter(i => contacts[i].status === activeFilter);
    }
}

function renderCard() {
    if (contacts.length === 0) return;
    const c = contacts[currentIdx];
    document.getElementById('contactIndex').textContent = `#${currentIdx + 1} من ${contacts.length}`;
    document.getElementById('contactName').textContent = c.name || 'بدون اسم';
    document.getElementById('contactPhone').textContent = c.phone;
    document.getElementById('contactExtra').textContent = c.extra;
    document.getElementById('contactExtra').style.display = c.extra ? 'block' : 'none';
    document.getElementById('callBtn').href = `tel:${c.phone}`;
    document.getElementById('noteField').value = c.note || '';
    const initials = c.name ? c.name.trim().split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '؟';
    document.getElementById('contactAvatar').textContent = initials;
    updateStatusUI(c.status);
    updateProgress();
    document.getElementById('prevBtn').disabled = currentIdx === 0;
    document.getElementById('nextBtn').textContent = currentIdx >= contacts.length - 1 ? 'إنهاء ✓' : 'التالي →';
}

function updateStatusUI(status) {
    const tags = { called: 'NI', noanswer: 'NA', callback: 'Closed', busy: 'Busy', pending: 'معلق' };
    const tag = document.getElementById('statusTag');
    tag.textContent = tags[status];
    tag.className = 'status-tag ' + status;
    ['btnCalled', 'btnNo', 'btnCB', 'btnBusy'].forEach(id => {
        document.getElementById(id).className = 'status-btn';
    });
    if (status === 'called') document.getElementById('btnCalled').classList.add('sel-called');
    if (status === 'noanswer') document.getElementById('btnNo').classList.add('sel-noanswer');
    if (status === 'callback') document.getElementById('btnCB').classList.add('sel-callback');
    if (status === 'busy') document.getElementById('btnBusy').classList.add('sel-busy');
}

function setStatus(s) {
    contacts[currentIdx].status = contacts[currentIdx].status === s ? 'pending' : s;
    updateStatusUI(contacts[currentIdx].status);
    updateProgress();
    persist();
}

function saveNote() {
    contacts[currentIdx].note = document.getElementById('noteField').value;
    persist();
}

function navigate(dir) {
    saveNote();
    const newIdx = currentIdx + dir;
    if (newIdx < 0) return;
    if (newIdx >= contacts.length) {
        const pending = contacts.filter(c => c.status === 'pending').length;
        if (pending > 0) {
            if (!confirm(`لا يزال هناك ${pending} معلق. هل تريد الإنهاء؟`)) return;
        }
        showDone(); return;
    }
    currentIdx = newIdx;
    persist();
    renderCard();
}

function updateProgress() {
    const total = contacts.length;
    const called = contacts.filter(c => c.status === 'called').length;
    const no = contacts.filter(c => c.status === 'noanswer').length;
    const cb = contacts.filter(c => c.status === 'callback').length;
    const pend = contacts.filter(c => c.status === 'pending').length;
    const busy = contacts.filter(c => c.status === 'busy').length;
    const done = called + no + cb + busy;
    const pct = total ? Math.round(done / total * 100) : 0;
    document.getElementById('progText').innerHTML = `<span>${done}</span> / ${total} تم التعامل معهم`;
    document.getElementById('progPct').textContent = pct + '%';
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('pillCalled').textContent = `NI ${called}`;
    document.getElementById('pillNo').textContent = `NA ${no}`;
    document.getElementById('pillCB').textContent = `Closed ${cb}`;
    document.getElementById('pillBusy').textContent = `Busy ${busy}`;
    document.getElementById('pillPend').textContent = `⋯ ${pend} معلق`;
}

// ── LIST ─────────────────────────────────────────────────
function showList() { renderList(); showScreen('listScreen'); }
function showDialer() { showScreen('dialerScreen'); renderCard(); }

function renderList() {
    const q = (document.getElementById('searchInput').value || '').toLowerCase();
    const container = document.getElementById('listItems');
    container.innerHTML = '';
    contacts.forEach((c, i) => {
        if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return;
        const div = document.createElement('div');
        div.className = 'list-item';
        const initials = c.name ? c.name.trim().split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '#';
        const statusColors = { called: 'var(--green)', noanswer: 'var(--red)', callback: 'var(--blue)', busy: 'var(--orange)', pending: 'var(--text2)' };
        const statusLabels = { called: 'NI', noanswer: 'NA', callback: '🔒', busy: '📳', pending: '⋯' };
        div.innerHTML = `
      <div class="list-item-avatar">${initials}</div>
      <div class="list-item-info">
        <div class="list-item-name">${c.name || 'بدون اسم'}</div>
        <div class="list-item-phone">${c.phone}</div>
      </div>
      <div class="list-item-status" style="color:${statusColors[c.status]};font-size:1.2rem">${statusLabels[c.status]}</div>
    `;
        div.onclick = () => { currentIdx = i; persist(); showDialer(); };
        container.appendChild(div);
    });
    if (container.children.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text2);padding:2rem">لا توجد نتائج</div>';
    }
}

// ── FILTER ───────────────────────────────────────────────
function openFilter() { document.getElementById('filterOverlay').classList.add('open'); }
function closeFilter(e) { if (e.target === document.getElementById('filterOverlay')) document.getElementById('filterOverlay').classList.remove('open'); }
function setFilter(f) {
    activeFilter = f;
    document.querySelectorAll('.filter-option').forEach(el => el.classList.remove('active'));
    document.getElementById('f-' + f).classList.add('active');
    applyFilter();
    document.getElementById('filterToggle').className = 'filter-btn' + (f !== 'all' ? ' active' : '');
    document.getElementById('filterOverlay').classList.remove('open');
    if (filteredIndices.length > 0) currentIdx = filteredIndices[0];
    persist();
    renderCard();
}

// ── DONE ─────────────────────────────────────────────────
function showDone() {
    const called = contacts.filter(c => c.status === 'called').length;
    const no = contacts.filter(c => c.status === 'noanswer').length;
    const cb = contacts.filter(c => c.status === 'callback').length;
    const busy = contacts.filter(c => c.status === 'busy').length;
    document.getElementById('doneCalledN').textContent = called;
    document.getElementById('doneNoN').textContent = no;
    document.getElementById('doneCBN').textContent = cb;
    document.getElementById('doneBusyN').textContent = busy;
    showScreen('doneScreen');
}

// ── EXPORT ───────────────────────────────────────────────
function exportResults() {
    const statusLabels = { called: 'NI - Not Interested', noanswer: 'NA - No Answer', callback: 'Closed', busy: 'Busy - مشغول', pending: 'معلق' };
    const rows = [['الاسم', 'التليفون', 'معلومة إضافية', 'الحالة', 'ملاحظات']];
    contacts.forEach(c => {
        rows.push([c.name, c.phone, c.extra, statusLabels[c.status], c.note]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نتائج الاتصالات');
    XLSX.writeFile(wb, `نتائج_الاتصالات_${new Date().toLocaleDateString('ar')}.xlsx`);
}

// ── RESTART ──────────────────────────────────────────────
function restartApp() {
    if (!confirm('هتتمسح كل البيانات. متأكد؟')) return;
    clearSession();
    contacts = []; currentIdx = 0; rawData = []; activeFilter = 'all';
    document.getElementById('fileInput').value = '';
    document.getElementById('colSetup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    dropzone.querySelector('p').innerHTML = '<strong>اختر ملف Excel</strong>';
    showScreen('uploadScreen');
}
