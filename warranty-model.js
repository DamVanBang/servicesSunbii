(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.WarrantyModel = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const DAY = 86400000;
    const OFFSET = 7 * 3600000;
    const TYPES = ['serviceCode', 'serialNumber', 'phone', 'email', 'auto', 'QRCoder'];
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

    function parseDay(value) {
        if (typeof value !== 'string') return null;
        let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) {
            const vn = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
            if (vn) match = [vn[0], vn[3], vn[2], vn[1]];
        }
        if (!match) return null;
        const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
        if (y < 1000 || y > 9999) return null;
        const utc = Date.UTC(y, m - 1, d);
        const date = new Date(utc);
        return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? utc - OFFSET : null;
    }

    function timelineFor(item) {
        const source = object(item.customerWarranty) ? item.customerWarranty : {};
        return {
            startDate: source.startDate !== undefined ? source.startDate : item.date !== undefined ? item.date : item.startDate,
            endDate: source.endDate !== undefined ? source.endDate : item.endDate,
            duration: source.duration !== undefined ? source.duration : item.duration
        };
    }

    function warrantyStatus(item, now = Date.now()) {
        const timeline = timelineFor(item);
        const start = parseDay(timeline.startDate), end = parseDay(timeline.endDate);
        if (start === null || end === null || end < start || !Number.isFinite(now)) return 'unknown';
        if (now < start) return 'upcoming';
        return now < end + DAY ? 'active' : 'expired';
    }

    function pick(source, keys) {
        const result = {};
        for (const key of keys) {
            const value = source[key];
            if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) result[key] = value;
        }
        return result;
    }

    function normalizeResponse(payload) {
        if (Array.isArray(payload)) {
            if (!payload.every(object)) throw new TypeError('Malformed public response');
            const records = payload.map(item => {
                if (typeof item.serviceCode !== 'string' || !item.serviceCode.trim()) throw new TypeError('Missing public record identifier');
                for (const key of ['customerWarranty', 'contact', 'partner']) {
                    if (item[key] !== undefined && !object(item[key])) throw new TypeError('Malformed public record section');
                }
                const timeline = timelineFor(item);
                for (const key of ['startDate', 'endDate']) {
                    if (timeline[key] !== undefined && timeline[key] !== null && typeof timeline[key] !== 'string') throw new TypeError('Malformed warranty date');
                }
                if (timeline.duration !== undefined && timeline.duration !== null && typeof timeline.duration !== 'number' && typeof timeline.duration !== 'string') throw new TypeError('Malformed warranty duration');
                const result = pick(item, ['serviceCode', 'group', 'warrantyType', 'processingError', 'treatmentPlan', 'Name', 'productName', 'serialNumber', 'partnerName', 'sunbiiName', 'sunbiiPhone', 'sunbiiEmail', 'sunbiiAddress', 'sunbiiIdentity', 'sunbiiPartnerName']);
                result.customerWarranty = timelineFor(item);
                if (object(item.contact)) result.contact = pick(item.contact, ['phone', 'email', 'address']);
                else {
                    const legacyContact = pick(item, ['phone', 'email', 'address']);
                    if (Object.keys(legacyContact).length) result.contact = legacyContact;
                }
                for (const key of ['partner']) {
                    if (object(item[key])) result[key] = pick(item[key], ['phone', 'email', 'address']);
                }
                return result;
            });
            return { kind: records.length ? 'results' : 'empty', records, message: '' };
        }
        if (object(payload) && payload.success === false && typeof payload.message === 'string') {
            return { kind: payload.message.trim() === 'Không tìm thấy dữ liệu' ? 'empty' : 'error', records: [], message: payload.message };
        }
        throw new TypeError('Malformed public response');
    }

    function buildSearchUrl(base, type, keyword) {
        if (!TYPES.includes(type)) throw new TypeError('Unsupported public search type');
        if (typeof keyword !== 'string' || !keyword.trim()) throw new TypeError('Empty keyword');
        const url = new URL('/api/servicesCheck', base);
        url.searchParams.set('type', type);
        url.searchParams.set('keyword', keyword.trim());
        return url.href;
    }

    return Object.freeze({ parseDay, timelineFor, warrantyStatus, normalizeResponse, buildSearchUrl });
}));
