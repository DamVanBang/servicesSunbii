(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ScanModel = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function valid(value) {
        return typeof value === 'string' && value.length <= 4096 && !/[\x00-\x1f\x7f]/.test(value) && value.trim() !== '';
    }
    function parseScan(value, mode) {
        if (!valid(value)) throw new Error('Mã trống, quá dài hoặc chứa ký tự điều khiển.');
        const keyword = value.trim();
        if (mode === 'serialNumber') return { type: 'serialNumber', keyword };
        if (mode !== 'warranty') throw new Error('Vui lòng chọn loại tem cần quét.');
        const linkLike = /^[a-z][a-z0-9+.-]*:/i.test(keyword) || /^(?:[\/\\]|www\.|services\.sunbii\.vn|tra-cuu\.html)/i.test(keyword) || keyword.includes('://');
        if (!linkLike) return { type: 'serviceCode', keyword };
        if (!/^https:\/\/services\.sunbii\.vn\/tra-cuu\.html\?/.test(keyword) || /%(?![0-9a-f]{2})/i.test(keyword) || /[\\\s]/.test(keyword)) {
            throw new Error('Liên kết tem không hợp lệ. Chỉ nhận link HTTPS tra cứu SUNBII.');
        }
        let url;
        try { url = new URL(keyword); } catch (_) { throw new Error('Liên kết tem không hợp lệ.'); }
        const values = url.searchParams.getAll('keyword');
        if (url.origin !== 'https://services.sunbii.vn' || url.pathname !== '/tra-cuu.html' || url.username || url.password || url.hash || values.length !== 1 || !valid(values[0]) || values[0].includes('\ufffd')) {
            throw new Error('Link tem cần đúng một keyword hợp lệ, không rỗng.');
        }
        return { type: 'QRCoder', keyword: values[0].trim() };
    }
    return { parseScan };
}));
