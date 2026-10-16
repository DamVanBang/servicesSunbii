(function () {
    'use strict';
    const model = window.WarrantyModel;
    const config = window.SUNBII_CONFIG;
    const form = document.getElementById('lookupForm');
    const input = document.getElementById('searchInput');
    const type = document.getElementById('searchType');
    const submit = document.getElementById('searchButton');
    const retry = document.getElementById('retryButton');
    const status = document.getElementById('lookupStatus');
    const results = document.getElementById('resultContainer');
    let controller, generation = 0;
    const labels = { active: 'Còn hạn', expired: 'Hết hạn', upcoming: 'Chưa đến ngày bắt đầu', unknown: 'Chưa xác định thời hạn' };
    const groupLabels = { BY: 'Pin xe điện', B5: 'Pin B5', B1: 'Pin B1', BT: 'Thiết bị / phụ tùng', SV: 'Dịch vụ sửa chữa' };
    const visible = value => typeof value === 'string' ? value.trim() !== '' : typeof value === 'number' && Number.isFinite(value);
    function node(tag, text, className) {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        if (className) element.className = className;
        return element;
    }
    function section(card, title, rows) {
        const available = rows.filter(row => visible(row[1]));
        if (!available.length) return;
        const element = node('section', undefined, 'lookup-section');
        const heading = node('h3', undefined);
        const icons = { 'Sản phẩm': 'fa-box-open', 'Khách hàng': 'fa-user', 'Thông tin dịch vụ': 'fa-screwdriver-wrench', 'Bảo hành dành cho khách hàng': 'fa-shield-halved', 'Cửa hàng đối tác': 'fa-store', 'Thông tin đơn vị được công khai': 'fa-building-shield' };
        heading.append(node('i', undefined, 'fas ' + (icons[title] || 'fa-circle-info')), node('span', title));
        element.append(heading);
        const list = node('dl');
        for (const [label, value] of available) {
            const row = node('div', undefined, 'lookup-row');
            row.append(node('dt', label), node('dd', value));
            list.append(row);
        }
        element.append(list);
        card.append(element);
    }
    function dateText(value) {
        const day = model.parseDay(value);
        if (day === null) return visible(value) ? 'Ngày không hợp lệ' : undefined;
        const date = new Date(day + 7 * 3600000);
        return String(date.getUTCDate()).padStart(2, '0') + '/' + String(date.getUTCMonth() + 1).padStart(2, '0') + '/' + date.getUTCFullYear();
    }
    function groupText(value) { return groupLabels[value] || value; }
    function cardFor(item, index) {
        const card = node('article', undefined, 'lookup-card');
        card.classList.add('lookup-card-' + model.warrantyStatus(item));
        const heading = node('h2', undefined);
        heading.append(node('span', 'PHIẾU BẢO HÀNH', 'lookup-card-kicker'), node('strong', visible(item.serviceCode) ? item.serviceCode : 'Bản ghi ' + (index + 1)));
        heading.id = 'warranty-record-' + index;
        card.setAttribute('aria-labelledby', heading.id);
        const state = model.warrantyStatus(item);
        const timeline = model.timelineFor(item);
        const end = dateText(timeline.endDate);
        const duration = visible(timeline.duration) && Number.isFinite(Number(timeline.duration)) && Number(timeline.duration) >= 0 ? timeline.duration + ' tháng' : undefined;
        const header = node('div', undefined, 'lookup-card-header');
        const identity = node('div', undefined, 'lookup-card-identity');
        identity.append(heading);
        if (visible(item.warrantyType)) identity.append(node('span', item.warrantyType === 'partner' ? 'Đối tác' : 'Cá nhân', 'lookup-type-badge'));
        header.append(identity, node('span', labels[state], 'lookup-badge lookup-badge-' + state));
        card.append(header);
        const summary = node('div', undefined, 'lookup-card-summary');
        summary.append(
            summaryCell('Loại bảo hành', groupText(item.group), 'fa-box-open'),
            summaryCell('Hạn bảo hành', end || 'Chưa có dữ liệu', 'fa-calendar-check'),
            summaryCell('Thời hạn', duration || 'Chưa có dữ liệu', 'fa-clock')
        );
        card.append(summary);
        section(card, 'Sản phẩm', [['Nhóm sản phẩm', item.group], ['Tên sản phẩm', item.productName], ['Số serial (S/N)', item.serialNumber]]);
        const contact = item.contact || {};
        section(card, 'Khách hàng', [['Tên khách hàng', item.Name], ['Số điện thoại', contact.phone], ['Email', contact.email], ['Địa chỉ', contact.address]]);
        section(card, 'Thông tin dịch vụ', [['Lỗi xử lý', item.processingError], ['Phương án xử lý', item.treatmentPlan]]);
        section(card, 'Bảo hành dành cho khách hàng', [['Ngày kích hoạt', dateText(timeline.startDate)], ['Ngày hết hạn', dateText(timeline.endDate)], ['Thời hạn bảo hành', duration]]);
        const partner = item.partner || {};
        section(card, 'Cửa hàng đối tác', [['Tên cửa hàng', item.partnerName], ['Số điện thoại', partner.phone], ['Email', partner.email], ['Địa chỉ', partner.address]]);
        section(card, 'Thông tin đơn vị được công khai', [['Tên', item.sunbiiName], ['Định danh', item.sunbiiIdentity], ['Đơn vị liên kết', item.sunbiiPartnerName], ['Số điện thoại', item.sunbiiPhone], ['Email', item.sunbiiEmail], ['Địa chỉ', item.sunbiiAddress]]);
        return card;
    }
    function summaryCell(label, value, icon) {
        const cell = node('div', undefined, 'lookup-summary-cell');
        cell.append(node('i', undefined, 'fas ' + icon), node('span', label), node('strong', value));
        return cell;
    }
    function feedback(text, state, canRetry = false) {
        status.textContent = text;
        status.parentElement.dataset.state = state;
        retry.hidden = !canRetry;
    }
    async function search() {
        const current = ++generation;
        if (controller) controller.abort();
        results.replaceChildren();
        results.setAttribute('aria-busy', 'false');
        submit.textContent = 'Tra cứu';
        const keyword = input.value.trim();
        if (!keyword) {
            feedback('Vui lòng nhập thông tin cần tra cứu.', 'error');
            input.focus();
            return;
        }
        const request = new AbortController();
        controller = request;
        let timedOut = false;
        const timeout = window.setTimeout(() => { timedOut = true; request.abort(); }, config.timeoutMs);
        feedback('Đang tra cứu thông tin bảo hành…', 'loading');
        results.setAttribute('aria-busy', 'true');
        submit.textContent = 'Tra cứu lại';
        let phase = 'network';
        try {
            const response = await fetch(model.buildSearchUrl(config.apiBase, type.value, keyword), { signal: request.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
            if (current !== generation) return;
            if (!response.ok) {
                feedback('Máy chủ trả về lỗi HTTP ' + response.status + '. Vui lòng thử lại.', 'error', true);
                return;
            }
            phase = 'json';
            const payload = await response.json();
            if (current !== generation) return;
            phase = 'shape';
            const data = model.normalizeResponse(payload);
            if (data.kind === 'empty') {
                feedback('Không tìm thấy thông tin bảo hành phù hợp.', 'empty');
                results.append(node('p', 'Kiểm tra lại thông tin đã nhập hoặc chọn cách tra cứu khác.', 'lookup-empty'));
            } else if (data.kind === 'error') {
                feedback(data.message || 'Máy chủ chưa thể xử lý yêu cầu.', 'error', true);
            } else {
                const fragment = document.createDocumentFragment();
                data.records.forEach((item, index) => fragment.append(cardFor(item, index)));
                results.append(fragment);
                feedback('Tìm thấy ' + data.records.length + ' bản ghi bảo hành. Thời hạn được tính theo GMT+7, gồm cả ngày kết thúc.', 'results');
            }
        } catch (error) {
            if (current !== generation) return;
            if (timedOut) feedback('Máy chủ phản hồi quá lâu. Vui lòng thử lại.', 'error', true);
            else if (phase === 'json' && error instanceof SyntaxError) feedback('Máy chủ trả về dữ liệu JSON không hợp lệ. Vui lòng thử lại sau.', 'error', true);
            else if (phase === 'shape') feedback('Dữ liệu phản hồi không đúng định dạng. Vui lòng thử lại sau.', 'error', true);
            else feedback(navigator.onLine === false ? 'Thiết bị đang ngoại tuyến. Kiểm tra kết nối rồi thử lại.' : 'Không thể kết nối máy chủ. Kiểm tra kết nối rồi thử lại.', 'error', true);
        } finally {
            window.clearTimeout(timeout);
            if (current === generation) {
                results.setAttribute('aria-busy', 'false');
                submit.textContent = 'Tra cứu';
                controller = null;
            }
        }
    }
    function invalidate() {
        generation++;
        if (controller) controller.abort();
        controller = null;
        results.replaceChildren();
        results.setAttribute('aria-busy', 'false');
        submit.textContent = 'Tra cứu';
        feedback('Thông tin đã thay đổi. Nhấn Tra cứu để kiểm tra.', 'idle');
    }
    input.addEventListener('input', invalidate);
    type.addEventListener('change', invalidate);
    form.addEventListener('submit', event => { event.preventDefault(); search(); });
    retry.addEventListener('click', search);
    const params = new URLSearchParams(window.location.search);
    const keyword = params.get('keyword');
    const requested = params.get('type');
    const method = params.get('Method') || params.get('method');
    const allowed = Array.from(type.options, option => option.value);
    if (keyword) {
        input.value = keyword;
        if (requested !== null && !allowed.includes(requested)) {
            feedback('Liên kết có loại tra cứu không được hỗ trợ. Vui lòng chọn cách tra cứu công khai.', 'error');
        } else {
            type.value = method === 'QRCoder' ? 'QRCoder' : requested || 'auto';
            search();
        }
    }
}());
