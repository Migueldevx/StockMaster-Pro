// ─── SYSTEM STATE ─────────────────────────────────────────────────────────────
let items          = JSON.parse(localStorage.getItem('sm-products')  || '[]');
let movements      = JSON.parse(localStorage.getItem('sm-movements') || '[]');
let purchaseOrders = JSON.parse(localStorage.getItem('sm-po') || '[]');
let salesOrders    = JSON.parse(localStorage.getItem('sm-so') || '[]');
let nextId   = items.length          ? Math.max(...items.map(i=>i.id))          + 1 : 1;
let nextMvId = movements.length      ? Math.max(...movements.map(m=>m.id))      + 1 : 1;
let nextPoId = purchaseOrders.length ? Math.max(...purchaseOrders.map(p=>p.id)) + 1 : 1;
let nextSoId = salesOrders.length    ? Math.max(...salesOrders.map(s=>s.id))    + 1 : 1;
let sortBy = 'name', sortAsc = true;
let mvFilter = 'all';
let currentPage = 'dashboard';

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
function save() {
    localStorage.setItem('sm-products',  JSON.stringify(items));
    localStorage.setItem('sm-movements', JSON.stringify(movements));
    localStorage.setItem('sm-po', JSON.stringify(purchaseOrders));
    localStorage.setItem('sm-so', JSON.stringify(salesOrders));
}

// ─── UTILITY HELPERS ──────────────────────────────────────────────────────────
function getStatus(qty, threshold) {
    if (qty === 0) return 'empty';
    if (qty <= threshold) return 'low';
    return 'ok';
}
function barWidth(qty, threshold) {
    const max = Math.max(threshold * 4, qty, 1);
    return Math.round(Math.min(100, (qty / max) * 100));
}
function sku(id)   { return 'SKU-' + String(id).padStart(4, '0'); }
function poNum(id) { return 'PO-'  + String(id).padStart(5, '0'); }
function soNum(id) { return 'SO-'  + String(id).padStart(5, '0'); }
function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
    if (!iso) return '—';
    // "2026-10-15" must be read as a LOCAL date, otherwise it shows one day earlier in US time zones
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00') : new Date(iso);
    return d.toLocaleDateString('en-US', { day:'2-digit', month:'short', year:'2-digit' });
}
function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { day:'2-digit', month:'short' }) + ' ' +
        d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
}
// Local date as YYYY-MM-DD (toISOString() uses UTC and can give tomorrow's date at night)
function localISODate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
// Value used to sort the products table (status has no field of its own)
function sortValue(item, col) {
    if (col === 'status') return { empty:0, low:1, ok:2 }[getStatus(item.qty, item.threshold)];
    const v = item[col];
    return typeof v === 'string' ? v.toLowerCase() : v;
}

// ─── TOAST NOTIFICATIONS ──────────────────────────────────────────────────────
function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.className = 'toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── ROUTING & NAVIGATION ─────────────────────────────────────────────────────
function navigate(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) { pageEl.classList.remove('active'); void pageEl.offsetWidth; pageEl.classList.add('active'); }

    const navMap = { dashboard:0, products:1, movements:2, purchase:3, sales:4 };
    const navItems = document.querySelectorAll('.nav-item');
    if (navMap[page] !== undefined) navItems[navMap[page]].classList.add('active');

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');

    if (page === 'dashboard') renderDashboard();
    if (page === 'products')  renderTable();
    if (page === 'movements') { populateProductSelect('mv-product'); renderMovements(); }
    if (page === 'purchase')  { populateProductSelect('po-product'); renderPurchaseOrders(); }
    if (page === 'sales')     { populateProductSelect('so-product'); renderSalesOrders(); }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
}

function populateProductSelect(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Select product...</option>' +
        items.map(i => `<option value="${i.id}"${i.id==cur?' selected':''}>${escHtml(i.name)} (${sku(i.id)})</option>`).join('');
}

// ─── DASHBOARD GENERATOR ──────────────────────────────────────────────────────
function renderDashboard() {
    const low   = items.filter(i => getStatus(i.qty, i.threshold) === 'low').length;
    const empty = items.filter(i => i.qty === 0).length;
    const value = items.reduce((s,i) => s + (i.qty * (i.price||0)), 0);

    document.getElementById('d-total').textContent = items.length;
    document.getElementById('d-low').textContent   = low;
    document.getElementById('d-empty').textContent = empty;
    document.getElementById('d-value').textContent = '$' + value.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0});

    // Recent activity stream
    const actEl = document.getElementById('d-activity');
    const recentMv = [...movements].sort((a,b) => b.id - a.id).slice(0, 6);
    if (!recentMv.length) {
        actEl.innerHTML = '<div class="empty-state" style="padding:24px"><p>No activity recorded</p></div>';
    } else {
        const typeColor = { in:'green', out:'red', adj:'blue', ret:'warn' };
        const typeLabel = { in:'Entry', out:'Exit', adj:'Adjustment', ret:'Return' };
        actEl.innerHTML = recentMv.map(m => {
            const item = items.find(i => i.id === m.productId);
            const col  = typeColor[m.type] || 'blue';
            return `<div class="activity-item">
                <div class="activity-dot ${col}"></div>
                <div>
                    <div class="activity-text">${typeLabel[m.type]||m.type}: <strong>${escHtml(item ? item.name : m.productName)}</strong> ×${m.qty}</div>
                    <div class="activity-time">${fmtDateTime(m.date)}${m.note ? ' · '+escHtml(m.note) : ''}</div>
                </div>
            </div>`;
        }).join('');
    }

    // CRITICAL STOCK PANEL
    const critEl   = document.getElementById('d-critical');
    const critical = items.filter(i => i.qty <= i.threshold).sort((a,b) => a.qty - b.qty).slice(0,6);
    if (!critical.length) {
        critEl.innerHTML = '<div class="empty-state" style="padding:24px"><p>All stock is at optimal levels</p></div>';
    } else {
        critEl.innerHTML = '<table class="mini-table">' +
            critical.map(i => {
                const st = getStatus(i.qty, i.threshold);
                const bw = barWidth(i.qty, i.threshold);
                return `<tr>
                    <td style="width:55%">
                        <div class="mt-name">${escHtml(i.name)}</div>
                        <div class="mt-sub">${sku(i.id)}</div>
                        <div class="mini-bar-wrap"><div class="mini-bar-track"><div class="mini-bar-fill ${st}" style="width:${bw}%"></div></div></div>
                    </td>
                    <td class="mt-right">
                        <div class="mt-val" style="color:${st==='empty'?'#dc3545':'#e0a800'}">${i.qty}</div>
                        <div class="mt-sub">/ ${i.threshold} min.</div>
                    </td>
                </tr>`;
            }).join('') + '</table>';
    }

    // TOP DISTRIBUTION CHART
    const chartEl  = document.getElementById('d-chart');
    const topItems = [...items].sort((a,b) => b.qty - a.qty).slice(0,8);
    if (!topItems.length) {
        chartEl.innerHTML = '<div class="empty-state" style="padding:16px;width:100%"><p>Add products to view the chart.</p></div>';
    } else {
        const maxQty = Math.max(...topItems.map(i => i.qty), 1);
        chartEl.innerHTML = topItems.map(i => {
            const pct   = Math.round((i.qty / maxQty) * 100);
            const st    = getStatus(i.qty, i.threshold);
            const col   = st==='ok' ? '#0056b3' : st==='low' ? '#ffc107' : '#dc3545';
            return `<div class="bar-col">
                <div class="bar-fill" style="height:${pct}%;background:${col}" title="${escHtml(i.name)}: ${i.qty} units"></div>
                <div class="bar-label">${escHtml(i.name.length>6 ? i.name.substring(0,6)+'…' : i.name)}</div>
            </div>`;
        }).join('');
    }

    updateNavBadges();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateNavBadges() {
    const low      = items.filter(i => getStatus(i.qty,i.threshold)==='low' || i.qty===0).length;
    const poPending = purchaseOrders.filter(p => p.status==='pending').length;
    const soPending = salesOrders.filter(s => s.status==='pending').length;

    const lb = document.getElementById('nav-low-badge');
    const pb = document.getElementById('nav-po-badge');
    const sb = document.getElementById('nav-so-badge');

    lb.textContent = low;      lb.style.display = low      ? 'inline-flex' : 'none';
    pb.textContent = poPending; pb.style.display = poPending ? 'inline-flex' : 'none';
    sb.textContent = soPending; sb.style.display = soPending ? 'inline-flex' : 'none';
}

// ─── PRODUCT MANAGEMENT CONTROLLER ────────────────────────────────────────────
function renderTable() {
    const query = (document.getElementById('search')?.value || '').toLowerCase().trim();
    const tbody = document.getElementById('inventory-body');

    let list = items.filter(i => i.name.toLowerCase().includes(query));
    list.sort((a,b) => {
        const valA = sortValue(a, sortBy), valB = sortValue(b, sortBy);
        if (valA === valB) return 0;
        return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    const badgeClass = { ok:'badge-ok', low:'badge-low', empty:'badge-empty' };
    const badgeLabel = { ok:'Optimal', low:'Restock', empty:'Out of stock' };

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon"><i data-lucide="package-open" style="width:24px;height:24px;"></i></div>
            <p>${query ? 'No matching products found' : 'No products yet. Add the first one!'}</p></div></td></tr>`;
        updateNavBadges();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    tbody.innerHTML = list.map((item, idx) => {
        const st = getStatus(item.qty, item.threshold);
        const bw = barWidth(item.qty, item.threshold);
        return `<tr style="animation:rowIn 0.3s ${idx*0.04}s ease both">
            <td data-label="Product">
                <div class="prod-name">${escHtml(item.name)}</div>
                <div class="prod-sku">${sku(item.id)}</div>
            </td>
            <td data-label="Quantity">
                <div class="qty-controls">
                    <button class="qty-btn" onclick="changeQty(${item.id},-1)">−</button>
                    <span class="qty-val" id="qty-display-${item.id}">${item.qty}</span>
                    <button class="qty-btn" onclick="changeQty(${item.id},1)">+</button>
                </div>
            </td>
            <td data-label="Level">
                <div class="stock-bar-wrap">
                    <div class="stock-bar-track">
                        <div class="stock-bar-fill ${st}" style="width:${bw}%"></div>
                    </div>
                </div>
            </td>
            <td data-label="Status"><span class="badge ${badgeClass[st]}">${badgeLabel[st]}</span></td>
            <td data-label="Price">$${parseFloat(item.price||0).toFixed(2)}</td>
            <td data-label="Threshold">
                <input class="threshold-input" type="number" min="1" value="${item.threshold}"
                    onchange="updateThreshold(${item.id},this.value)">
            </td>
            <td data-label="Actions">
                <div class="actions">
                    <button class="action-btn edit" onclick="startEdit(${item.id})" title="Edit"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
                    <button class="action-btn del"  onclick="deleteItem(${item.id})" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    updateNavBadges();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function addItem() {
    const nameEl   = document.getElementById('name');
    const qtyEl    = document.getElementById('qty');
    const priceEl  = document.getElementById('price');
    const threshEl = document.getElementById('thresh');
    const name     = nameEl.value.trim();
    const qty      = parseInt(qtyEl.value);
    const price    = parseFloat(priceEl?.value || 0);
    const thresh   = parseInt(threshEl.value) || 5;

    if (!name || isNaN(qty) || qty < 0) { toast('Product name and valid quantity are required'); return; }
    items.unshift({ id: nextId++, name, qty, price, threshold: thresh });
    save(); renderTable(); renderDashboard();
    toast(`"${name}" added successfully`);
    nameEl.value=''; qtyEl.value=''; if(priceEl) priceEl.value=''; threshEl.value='';
    nameEl.focus();
}

function deleteItem(id) {
    const item = items.find(i=>i.id===id);
    if (!item || !confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    items = items.filter(i=>i.id!==id);
    save(); renderTable(); renderDashboard(); toast('Product deleted');
}

function changeQty(id, delta) {
    const item = items.find(i=>i.id===id);
    if (!item) return;
    const prev = item.qty;
    item.qty = Math.max(0, item.qty + delta);
    movements.unshift({ id:nextMvId++, productId:id, productName:item.name, type:delta>0?'in':'out',
        qty:Math.abs(delta), prevQty:prev, newQty:item.qty, date:new Date().toISOString(), note:'Quick adjustment' });
    save(); renderTable();
    if (currentPage==='movements') renderMovements();
    if (currentPage==='dashboard') renderDashboard();
}

function updateThreshold(id, val) {
    const n = parseInt(val);
    if (isNaN(n)||n<1) return;
    const item = items.find(i=>i.id===id);
    if (item) { item.threshold=n; save(); renderTable(); updateNavBadges(); }
}

// Inline quantity edit: Enter saves, Esc cancels
function startEdit(id) {
    const item = items.find(i=>i.id===id);
    const cell = document.getElementById(`qty-display-${id}`);
    if (!item || !cell) return;

    const inp = document.createElement('input');
    inp.className = 'edit-input';
    inp.id = `edit-${id}`;
    inp.type = 'number';
    inp.min = '0';
    inp.value = item.qty;
    cell.replaceWith(inp);

    // Prevents Enter + blur from saving twice, and makes Esc really cancel
    let done = false;
    function finish(shouldSave) {
        if (done) return;
        done = true;
        if (shouldSave) commitEdit(id, inp.value);
        else renderTable();
    }

    inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter')       { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    inp.addEventListener('blur', function () { finish(true); });

    inp.focus(); inp.select();
}

function commitEdit(id, raw) {
    const n = parseInt(raw);
    const item = items.find(i=>i.id===id);
    if (item && !isNaN(n) && n >= 0 && n !== item.qty) {
        const prev = item.qty;
        item.qty = n;
        movements.unshift({ id:nextMvId++, productId:id, productName:item.name, type:'adj',
            qty:Math.abs(n-prev), prevQty:prev, newQty:n, date:new Date().toISOString(), note:'Manual inline edit' });
        save();
        renderTable();                      // update the screen first...
        toast('Stock quantity updated');    // ...then show the notice
        return;
    }
    renderTable();
}

function setSort(col) {
    if (sortBy===col) sortAsc=!sortAsc; else { sortBy=col; sortAsc=true; }
    document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
    const map = { name:'sort-name', qty:'sort-qty', status:'sort-status' };
    if (map[col]) document.getElementById(map[col]).classList.add('active');
    renderTable();
}

// ─── MOVEMENT CONTROLLER ──────────────────────────────────────────────────────
function openMovementModal() {
    const panel = document.getElementById('mv-panel');
    panel.style.display = panel.style.display==='none' ? 'block' : 'none';
    populateProductSelect('mv-product');
}

function addMovement() {
    const productId = parseInt(document.getElementById('mv-product').value);
    const type      = document.getElementById('mv-type').value;
    const qty       = parseInt(document.getElementById('mv-qty').value);
    const note      = document.getElementById('mv-note').value.trim();

    if (!productId || isNaN(qty) || qty < 1) { toast('Select a product and enter a valid quantity'); return; }
    const item = items.find(i=>i.id===productId);
    if (!item) return;

    const prev = item.qty;
    if (type==='in'  || type==='ret') item.qty += qty;
    else if (type==='out')            item.qty = Math.max(0, item.qty - qty);
    else                              item.qty = qty;

    const newQty = item.qty;
    movements.unshift({ id:nextMvId++, productId, productName:item.name, type, qty, prevQty:prev, newQty, date:new Date().toISOString(), note });
    save(); renderMovements(); renderTable();
    if (currentPage==='dashboard') renderDashboard();
    toast('Stock movement logged successfully');
    document.getElementById('mv-qty').value=''; document.getElementById('mv-note').value='';
}

function setMvFilter(f) {
    mvFilter = f;
    document.querySelectorAll('[id^="mvf-"]').forEach(b=>b.classList.remove('active'));
    document.getElementById('mvf-'+f).classList.add('active');
    renderMovements();
}

function deleteMovement(id) {
    if (!confirm('Are you sure you want to delete this movement record?')) return;
    movements = movements.filter(m => m.id !== id);
    save();
    renderMovements();
    if (currentPage === 'dashboard') renderDashboard();
    toast('Movement deleted');
}

function clearAllMovements() {
    if (!movements.length) {
        toast('No movements to clear');
        return;
    }
    if (!confirm('Are you sure you want to delete ALL movement history? This action cannot be undone.')) return;
    movements = [];
    save();
    renderMovements();
    if (currentPage === 'dashboard') renderDashboard();
    toast('Movement history cleared');
}

function renderMovements() {
    const query     = (document.getElementById('mv-search')?.value || '').toLowerCase();
    const tbody     = document.getElementById('movements-body');
    const typeLabel = { in:'Entry', out:'Exit', adj:'Adjustment', ret:'Return' };
    const typeCls   = { in:'mv-in', out:'mv-out', adj:'mv-adj', ret:'mv-ret' };

    let list = [...movements];
    if (mvFilter !== 'all') list = list.filter(m=>m.type===mvFilter);
    if (query) list = list.filter(m=>m.productName.toLowerCase().includes(query)||(m.note||'').toLowerCase().includes(query));

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon"><i data-lucide="repeat" style="width:24px;height:24px;"></i></div><p>No movements logged</p></div></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    tbody.innerHTML = list.map((m, idx) => {
        const sign = m.type==='out' ? '-' : '+';
        return `<tr style="animation:rowIn 0.3s ${idx*0.03}s ease both">
            <td data-label="Date"><span style="font-size:0.78rem">${fmtDateTime(m.date)}</span></td>
            <td data-label="Product"><div class="prod-name">${escHtml(m.productName)}</div></td>
            <td data-label="Type"><span class="mv-type ${typeCls[m.type]||'mv-adj'}">${typeLabel[m.type]||m.type}</span></td>
            <td data-label="Quantity"><span style="font-weight:700;color:${m.type==='out'?'#dc3545':'#28a745'}">${sign}${m.qty}</span></td>
            <td data-label="Transition"><span style="font-size:0.8rem;color:#666666">${m.prevQty} → ${m.newQty}</span></td>
            <td data-label="Notes"><span style="color:#666666;font-size:0.82rem">${escHtml(m.note||'—')}</span></td>
            <td data-label="Actions">
                <div class="actions">
                    <button class="action-btn del" onclick="deleteMovement(${m.id})" title="Delete record"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── PURCHASE ORDER CONTROLLER ────────────────────────────────────────────────
function openPOPanel() {
    const panel = document.getElementById('po-panel');
    panel.style.display = panel.style.display==='none' ? 'block' : 'none';
    populateProductSelect('po-product');
    const d = new Date(); d.setDate(d.getDate()+7);
    document.getElementById('po-date').value = localISODate(d);
}

function addPurchaseOrder() {
    const supplier  = document.getElementById('po-supplier').value.trim();
    const productId = parseInt(document.getElementById('po-product').value);
    const qty       = parseInt(document.getElementById('po-qty').value);
    const price     = parseFloat(document.getElementById('po-price').value) || 0;
    const date      = document.getElementById('po-date').value;

    if (!supplier || !productId || isNaN(qty) || qty < 1) { toast('Please complete all required PO fields'); return; }
    const item = items.find(i=>i.id===productId);

    purchaseOrders.unshift({ id:nextPoId++, supplier, productId, productName:item?.name||'—', qty,
        unitPrice:price, total:qty*price, deliveryDate:date, status:'pending', createdAt:new Date().toISOString() });
    save(); renderPurchaseOrders(); updateNavBadges();
    toast(`Order ${poNum(purchaseOrders[0].id)} created`);
    document.getElementById('po-supplier').value=''; document.getElementById('po-qty').value=''; document.getElementById('po-price').value='';
    document.getElementById('po-panel').style.display='none';
}

function renderPurchaseOrders() {
    const query  = (document.getElementById('po-search')?.value || '').toLowerCase();
    const tbody  = document.getElementById('po-body');
    const statusLabel = { pending:'Pending', approved:'Approved', received:'Received', partial:'Partial', cancelled:'Cancelled' };
    const statusDot   = { pending:'pending', approved:'approved', received:'received', partial:'partial', cancelled:'cancelled' };

    let list = [...purchaseOrders];
    if (query) list = list.filter(p=>p.supplier.toLowerCase().includes(query)||p.productName.toLowerCase().includes(query)||poNum(p.id).toLowerCase().includes(query));

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon"><i data-lucide="shopping-bag" style="width:24px;height:24px;"></i></div><p>No purchase orders found</p></div></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    tbody.innerHTML = list.map((p,idx) => `
        <tr style="animation:rowIn 0.3s ${idx*0.03}s ease both">
            <td data-label="Order"><span style="font-size:0.78rem;font-weight:700;color:#0056b3">${poNum(p.id)}</span></td>
            <td data-label="Supplier"><div class="prod-name">${escHtml(p.supplier)}</div></td>
            <td data-label="Product"><span style="font-size:0.83rem">${escHtml(p.productName)}</span></td>
            <td data-label="Quantity"><span style="font-weight:700">${p.qty}</span></td>
            <td data-label="Total"><span>$${p.total.toFixed(2)}</span></td>
            <td data-label="Delivery"><span style="font-size:0.8rem;color:#666666">${fmtDate(p.deliveryDate)}</span></td>
            <td data-label="Status">
                <div class="order-status">
                    <span class="status-dot ${statusDot[p.status]||'pending'}"></span>
                    <span style="font-size:0.8rem">${statusLabel[p.status]||p.status}</span>
                </div>
            </td>
            <td data-label="Actions">
                <div class="actions">
                    ${['pending', 'approved'].includes(p.status)?`<button class="action-btn edit" onclick="advancePO(${p.id})" title="Advance workflow status"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></button>`:''}
                    ${['pending', 'approved'].includes(p.status)?`<button class="action-btn del" onclick="cancelPO(${p.id})" title="Cancel purchase order"><i data-lucide="x" style="width:14px;height:14px;"></i></button>`:''}
                    <button class="action-btn del" onclick="deletePO(${p.id})" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>
            </td>
        </tr>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function advancePO(id) {
    const po = purchaseOrders.find(p=>p.id===id);
    if (!po) return;
    const cycle = { pending:'approved', approved:'received' };
    if (cycle[po.status]) {
        po.status = cycle[po.status];
        if (po.status === 'received') {
            const item = items.find(i=>i.id===po.productId);
            if (item) {
                const prev = item.qty;
                item.qty += po.qty;
                movements.unshift({ id:nextMvId++, productId:item.id, productName:item.name, type:'in',
                    qty:po.qty, prevQty:prev, newQty:item.qty, date:new Date().toISOString(), note:`PO Receipt ${poNum(po.id)} ${po.supplier}` });
            }
        }
        save(); renderPurchaseOrders(); renderTable(); updateNavBadges();
        toast(`Order ${poNum(id)} updated to ${po.status}`);
    }
}

function cancelPO(id) {
    const po = purchaseOrders.find(p=>p.id===id);
    if (!po) return;
    if (po.status === 'received') {
        toast('Cannot cancel an already received order');
        return;
    }
    po.status = 'cancelled';
    save(); renderPurchaseOrders(); updateNavBadges();
    toast(`Purchase order ${poNum(id)} cancelled`);
}

function deletePO(id) {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;
    purchaseOrders = purchaseOrders.filter(p=>p.id!==id);
    save(); renderPurchaseOrders(); updateNavBadges();
    toast('Purchase order deleted');
}

// ─── SALES ORDER CONTROLLER ───────────────────────────────────────────────────
function openSOPanel() {
    const panel = document.getElementById('so-panel');
    panel.style.display = panel.style.display==='none' ? 'block' : 'none';
    populateProductSelect('so-product');
    const d = new Date(); d.setDate(d.getDate()+3);
    document.getElementById('so-date').value = localISODate(d);
}

function addSalesOrder() {
    const customer  = document.getElementById('so-customer').value.trim();
    const productId = parseInt(document.getElementById('so-product').value);
    const qty       = parseInt(document.getElementById('so-qty').value);
    const discount  = parseFloat(document.getElementById('so-discount').value) || 0;
    const date      = document.getElementById('so-date').value;

    if (!customer || !productId || isNaN(qty) || qty < 1) { toast('Please fill out all required sales fields'); return; }
    const item = items.find(i=>i.id===productId);
    if (!item) return;
    if (qty > item.qty) { toast(`Insufficient stock. Only ${item.qty} available.`); return; }

    const unitPrice = item.price || 0;
    const total = qty * unitPrice * (1 - discount/100);

    salesOrders.unshift({ id:nextSoId++, customer, productId, productName:item.name, qty, unitPrice, discount, total,
        deliveryDate:date, status:'pending', createdAt:new Date().toISOString() });
    save(); renderSalesOrders(); updateNavBadges();
    toast(`Order ${soNum(salesOrders[0].id)} created`);
    document.getElementById('so-customer').value=''; document.getElementById('so-qty').value=''; document.getElementById('so-discount').value='';
    document.getElementById('so-panel').style.display='none';
}

function renderSalesOrders() {
    const query  = (document.getElementById('so-search')?.value || '').toLowerCase();
    const tbody  = document.getElementById('so-body');
    const statusLabel = { pending:'Pending', approved:'Approved', shipped:'Shipped', delivered:'Delivered', cancelled:'Cancelled' };
    const statusDot   = { pending:'pending', approved:'approved', shipped:'shipped', delivered:'delivered', cancelled:'cancelled' };

    let list = [...salesOrders];
    if (query) list = list.filter(s=>s.customer.toLowerCase().includes(query)||s.productName.toLowerCase().includes(query)||soNum(s.id).toLowerCase().includes(query));

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon"><i data-lucide="briefcase" style="width:24px;height:24px;"></i></div><p>No sales orders found</p></div></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    tbody.innerHTML = list.map((s,idx) => `
        <tr style="animation:rowIn 0.3s ${idx*0.03}s ease both">
            <td data-label="Order"><span style="font-size:0.78rem;font-weight:700;color:#0056b3">${soNum(s.id)}</span></td>
            <td data-label="Customer"><div class="prod-name">${escHtml(s.customer)}</div></td>
            <td data-label="Product"><span style="font-size:0.83rem">${escHtml(s.productName)}</span></td>
            <td data-label="Quantity"><span style="font-weight:700">${s.qty}</span></td>
            <td data-label="Total">
                <span>$${s.total.toFixed(2)}</span>
                ${s.discount>0?`<span style="font-size:0.68rem;color:#28a745;margin-left:4px">-${s.discount}%</span>`:''}
            </td>
            <td data-label="Delivery"><span style="font-size:0.8rem;color:#666666">${fmtDate(s.deliveryDate)}</span></td>
            <td data-label="Status">
                <div class="order-status">
                    <span class="status-dot ${statusDot[s.status]||'pending'}"></span>
                    <span style="font-size:0.8rem">${statusLabel[s.status]||s.status}</span>
                </div>
            </td>
            <td data-label="Actions">
                <div class="actions">
                    ${['pending','approved','shipped'].includes(s.status)?`<button class="action-btn edit" onclick="advanceSO(${s.id})" title="Advance workflow status"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></button>`:''}
                    ${['pending','approved','shipped'].includes(s.status)?`<button class="action-btn del" onclick="cancelSO(${s.id})" title="Cancel sales order"><i data-lucide="x" style="width:14px;height:14px;"></i></button>`:''}
                    <button class="action-btn del" onclick="deleteSO(${s.id})" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>
            </td>
        </tr>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function advanceSO(id) {
    const so = salesOrders.find(s=>s.id===id);
    if (!so) return;
    const cycle = { pending:'approved', approved:'shipped', shipped:'delivered' };
    if (!cycle[so.status]) return;

    // Shipping takes the units out of the inventory (check the stock first)
    if (cycle[so.status] === 'shipped') {
        const item = items.find(i=>i.id===so.productId);
        if (!item) { toast('This product no longer exists'); return; }
        if (so.qty > item.qty) { toast(`Insufficient stock. Only ${item.qty} available.`); return; }
        const prev = item.qty;
        item.qty = prev - so.qty;
        movements.unshift({ id:nextMvId++, productId:item.id, productName:item.name, type:'out',
            qty:so.qty, prevQty:prev, newQty:item.qty, date:new Date().toISOString(), note:`SO Dispatch ${soNum(so.id)} ${so.customer}` });
    }

    so.status = cycle[so.status];
    save(); renderSalesOrders(); renderTable(); updateNavBadges();
    toast(`Order ${soNum(id)} advanced to ${so.status}`);
}

function cancelSO(id) {
    const so = salesOrders.find(s=>s.id===id);
    if (!so) return;
    if (so.status === 'delivered') {
        toast('Cannot cancel a delivered order');
        return;
    }

    // If it was already shipped, the units go back to the inventory
    if (so.status === 'shipped') {
        const item = items.find(i=>i.id===so.productId);
        if (item) {
            const prev = item.qty;
            item.qty = prev + so.qty;
            movements.unshift({ id:nextMvId++, productId:item.id, productName:item.name, type:'ret',
                qty:so.qty, prevQty:prev, newQty:item.qty, date:new Date().toISOString(), note:`SO Cancelled ${soNum(so.id)} ${so.customer}` });
        }
    }

    so.status = 'cancelled';
    save(); renderSalesOrders(); renderTable(); updateNavBadges();
    toast(`Sales order ${soNum(id)} cancelled`);
}

function deleteSO(id) {
    if (!confirm('Are you sure you want to delete this sales order?')) return;
    salesOrders = salesOrders.filter(s=>s.id!==id);
    save(); renderSalesOrders(); updateNavBadges();
    toast('Sales order deleted');
}

// ─── DATA EXPORT ─────────────────────────────────────────────────────────────
async function exportExcel() {
    if (!items.length) { 
        toast('No inventory records available to export'); 
        return; 
    }

    // 1. Create the workbook and the worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory Report');

    // 2. Main Title (Rows 1 and 2)
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'STOCKMASTER PRO - INVENTORY REPORT';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Azul oscuro elegante
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 35;

    // Subtitle with date (Row 2)
    worksheet.mergeCells('A2:G2');
    const subTitle = worksheet.getCell('A2');
    subTitle.value = `Generated on: ${new Date().toLocaleString()}`;
    subTitle.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    // Blank space (Row 3)
    worksheet.getRow(3).height = 10;

    // 3. Table Headers (Row 4)
    const headers = ['SKU', 'Product Name', 'Quantity', 'Unit Price', 'Threshold', 'Status', 'Total Value'];
    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0056B3' } }; // Azul Corporativo
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF003366' } }
        };
    });

    // 4. Add the data (Starting from Row 5)
    items.forEach((i) => {
        const statusMap = { ok: 'Optimal', low: 'Restock', empty: 'Out of stock' };
        const currentStatus = statusMap[getStatus(i.qty, i.threshold)] || 'Unknown';
        const unitPrice = parseFloat(i.price || 0);
        const totalVal = i.qty * unitPrice;

        const row = worksheet.addRow([
            sku(i.id),
            i.name,
            i.qty,
            unitPrice,
            i.threshold,
            currentStatus,
            totalVal
        ]);

        row.height = 22;

        // Basic styles and alignments
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // SKU
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };   // Name
        row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };  // Qty
        
        // Unit Price with explicit Currency formatting
        const priceCell = row.getCell(4);
        priceCell.value = unitPrice;
        priceCell.numFmt = '"$"#,##0.00';
        priceCell.alignment = { horizontal: 'right', vertical: 'middle' };
        
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };  // Threshold
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }; // Status
        
        // Total Value with explicit Currency formatting
        const totalCell = row.getCell(7);
        totalCell.value = totalVal;
        totalCell.numFmt = '"$"#,##0.00';
        totalCell.alignment = { horizontal: 'right', vertical: 'middle' };  // Total Value

        // Clean style for the Status cell
        const statusCell = row.getCell(6);
        if (currentStatus === 'Optimal') {
            statusCell.font = { color: { argb: 'FF15803D' }, bold: true };
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        } else if (currentStatus === 'Restock') {
            statusCell.font = { color: { argb: 'FFB45309' }, bold: true };
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        } else {
            statusCell.font = { color: { argb: 'FFB91C1C' }, bold: true };
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        }

        // Soft borders on data cells
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    // 5. Adjust column width
    worksheet.columns = [
        { width: 14 }, // SKU
        { width: 28 }, // Product Name
        { width: 12 }, // Quantity
        { width: 16 }, // Unit Price
        { width: 12 }, // Threshold
        { width: 16 }, // Status
        { width: 18 }  // Total Value
    ];

    // 6. Download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockmaster-inventory-${localISODate(new Date())}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    toast('Excel report generated!');
}

// ─── DATA IMPORT ───────────────────────────────────────────────────────────────

const CSV_COLUMNS = {
    name:      ['product', 'name', 'productname'],
    qty:       ['quantity', 'qty'],
    price:     ['price', 'unitprice'],
    threshold: ['threshold', 'minimum', 'min']
};
const CSV_MAX_ROWS  = 1000;
const CSV_MAX_BYTES = 1024 * 1024;   // 1 MB

// Picks the separator used by the file: comma (default), semicolon or tab
function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/)[0];
    let best = ',', bestCount = 0;
    [',', ';', '\t'].forEach(d => {
        const count = firstLine.split(d).length - 1;
        if (count > bestCount) { best = d; bestCount = count; }
    });
    return best;
}

// Turns the CSV text into rows of cells. It respects quotes, separators and line breaks inside quotes, and both \n and \r\n line endings.
function parseCSV(text, delimiter) {
    const rows = [];
    let row = [], field = '', inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === delimiter) {
            row.push(field); field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(field); rows.push(row);
            row = []; field = '';
        } else {
            field += ch;
        }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}


function parseCSVNumber(raw, decimalComma) {
    let s = String(raw).trim().replace(/[$\s]/g, '');
    if (s === '') return null;
    s = decimalComma ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
}

// Checks one row. Returns { error: '...' } or { product: {...} } ready to be added
function validateCSVRow(cells, col, decimalComma) {
    // Safe cell reader: empty text if the column does not exist in the file
    const cell = idx => (idx === -1 || cells[idx] === undefined) ? '' : cells[idx].trim();

    const name = cell(col.name);
    if (!name) return { error: 'missing product name' };
    if (name.length > 100) return { error: 'product name too long (max 100 characters)' };

    const qty = parseCSVNumber(cell(col.qty), decimalComma);
    if (qty === null || isNaN(qty) || !Number.isInteger(qty) || qty < 0) {
        return { error: 'quantity must be a whole number (0 or more)' };
    }

    let price = parseCSVNumber(cell(col.price), decimalComma);
    if (price === null) price = 0;
    if (isNaN(price) || price < 0) return { error: 'invalid price' };

    let threshold = parseCSVNumber(cell(col.threshold), decimalComma);
    if (threshold === null) threshold = 5;
    if (isNaN(threshold) || !Number.isInteger(threshold) || threshold < 1) {
        return { error: 'threshold must be a whole number (1 or more)' };
    }

    return { product: { name, qty, price: Math.round(price * 100) / 100, threshold } };
}

function showImportProblems(title, problems) {
    const shown = problems.slice(0, 10).join('\n');
    const more  = problems.length > 10 ? `\n...and ${problems.length - 10} more` : '';
    alert(title + '\n\n' + shown + more);
}

function importCSV(text) {
    const hadEncodingIssue = text.includes('\uFFFD');
    text = text.replace(/^\uFEFF/, '');          // remove the BOM that Excel adds

    const delimiter = detectDelimiter(text);
    const rows = parseCSV(text, delimiter);
    if (!rows.length) { toast('The file is empty'); return; }
    if (rows.length > CSV_MAX_ROWS + 1) { toast(`Too many rows (max ${CSV_MAX_ROWS})`); return; }

    // Find which column is which from the header row
    const header = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const col = {};
    Object.keys(CSV_COLUMNS).forEach(key => {
        col[key] = header.findIndex(h => CSV_COLUMNS[key].includes(h));
    });
    if (col.name === -1 || col.qty === -1) {
        alert('Invalid file: the first row must include the columns "Product" and "Quantity".\n\nTip: use the "Download template" button.');
        return;
    }

    // Validate row by row
    const existing = new Set(items.map(i => i.name.toLowerCase()));
    const valid = [];
    const problems = [];

    for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        if (cells.every(c => c.trim() === '')) continue;   // blank line
        const rowNum = r + 1;                               // same row number you see in Excel

        const result = validateCSVRow(cells, col, delimiter === ';');
        if (result.error) { problems.push(`Row ${rowNum}: ${result.error}`); continue; }

        const key = result.product.name.toLowerCase();
        if (existing.has(key)) {
            problems.push(`Row ${rowNum}: "${result.product.name}" already exists (skipped)`);
            continue;
        }
        existing.add(key);
        valid.push(result.product);
    }

    if (!valid.length && !problems.length) { toast('No data rows found'); return; }
    if (!valid.length) { showImportProblems('Nothing to import.', problems); return; }

    // Confirm before changing anything
    let msg = `Import ${valid.length} product${valid.length === 1 ? '' : 's'}?`;
    if (problems.length) msg += `\n${problems.length} row${problems.length === 1 ? '' : 's'} will be skipped.`;
    if (hadEncodingIssue) msg += '\nWarning: the file is not UTF-8, some characters may look wrong.';
    if (!confirm(msg)) return;

    // Apply: create the products and log one "Entry" movement for each one with stock
    valid.forEach(p => {
        const item = { id: nextId++, name: p.name, qty: p.qty, price: p.price, threshold: p.threshold };
        items.unshift(item);
        if (p.qty > 0) {
            movements.unshift({ id: nextMvId++, productId: item.id, productName: item.name, type: 'in',
                qty: p.qty, prevQty: 0, newQty: p.qty, date: new Date().toISOString(), note: 'CSV import' });
        }
    });
    save(); renderTable(); renderDashboard();
    toast(`${valid.length} imported` + (problems.length ? `, ${problems.length} skipped` : ''));
    if (problems.length) showImportProblems('These rows were skipped:', problems);
}

// Called by the hidden <input type="file">
function handleCSVFile(input) {
    const file = input.files[0];
    input.value = '';                      // lets you pick the same file again later
    if (!file) return;
    if (file.size > CSV_MAX_BYTES) { toast('File too large (max 1 MB)'); return; }

    const reader = new FileReader();
    reader.onload  = () => importCSV(reader.result);
    reader.onerror = () => toast('Could not read the file');
    reader.readAsText(file);
}

// Downloads an empty template with the right columns
function downloadTemplate() {
    const csv = 'Product,Quantity,Price,Threshold\r\n';
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'stockmaster-import-template.csv';
    a.click(); URL.revokeObjectURL(url);
    toast('Template downloaded');
}

// ─── INITIALIZATION ON PAGE LOAD ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    navigate('dashboard');
    document.body.classList.add('loaded');
});