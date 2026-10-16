'use strict';
const assert = require('assert/strict');
const model = require('./warranty-model');
const fs = require('fs');
const path = require('path');
const backendPath = path.join(__dirname, '../API/library/warrantyStats.js');
const backend = fs.existsSync(backendPath) ? require(backendPath) : {
    parseDay(value) {
        if (typeof value !== 'string') return null;
        const iso = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
        const vn = /^([0-9]{2})[/]([0-9]{2})[/]([0-9]{4})$/.exec(value);
        if (!iso && !vn) return null;
        const [y, m, d] = iso ? iso.slice(1).map(Number) : [Number(vn[3]), Number(vn[2]), Number(vn[1])];
        if (y < 1000 || y > 9999) return null;
        const utc = Date.UTC(y, m - 1, d), date = new Date(utc);
        return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? utc - 25200000 : null;
    },
    warrantyStatus(item, now) {
        const start = this.parseDay(item.startDate), end = this.parseDay(item.endDate);
        if (start === null || end === null || end < start) return 'unknown';
        return now < start ? 'upcoming' : now < end + 86400000 ? 'active' : 'expired';
    }
};
const originalTZ = process.env.TZ;
let cases = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); cases++; };
try {
    for (const timezone of ['UTC', 'Asia/Ho_Chi_Minh', 'America/Los_Angeles']) {
        process.env.TZ = timezone;
        for (const date of ['01/10/2026', '2026-10-01', '29/02/2024', '31/02/2026', '29/02/2025', '', null, '2026-13-01']) check(model.parseDay(date), backend.parseDay(date));
        for (const start of ['01/10/2026', '', '31/02/2026']) {
            for (const end of ['31/10/2026', '30/09/2026', '']) {
                for (const now of ['2026-09-30T16:59:59.999Z', '2026-09-30T17:00:00Z', '2026-10-31T16:59:59.999Z', '2026-10-31T17:00:00Z']) {
                    const customer = { startDate: start, endDate: end, duration: 0 };
                    check(model.warrantyStatus({ customerWarranty: customer }, Date.parse(now)), backend.warrantyStatus(customer, Date.parse(now)));
                }
            }
        }
    }
    const legacy = { date: '01/01/2020', endDate: '01/01/2021', duration: 12 };
    check(model.timelineFor(legacy), { startDate: legacy.date, endDate: legacy.endDate, duration: 12 });
    check(model.timelineFor({ ...legacy, customerWarranty: { startDate: '', duration: 0 }, sunbiiWarranty: { endDate: '01/01/2099' } }), { startDate: '', endDate: legacy.endDate, duration: 0 });
    check(model.warrantyStatus({ ...legacy, customerWarranty: { startDate: '' } }), 'unknown');
    check(model.normalizeResponse([]).kind, 'empty');
    check(model.normalizeResponse({ success: false, message: 'Không tìm thấy dữ liệu' }).kind, 'empty');
    check(model.normalizeResponse({ success: false, message: 'Loại tìm kiếm không được công khai' }).kind, 'error');
    for (const bad of [null, {}, { success: true }, [null], ['text'], [{}], [{ error: 'unavailable' }], [{ serviceCode: 'X', customerWarranty: [] }], [{ serviceCode: 'X', customerWarranty: { startDate: {} } }]]) { assert.throws(() => model.normalizeResponse(bad)); cases++; }
    const normalized = model.normalizeResponse([{ serviceCode: 'DEMO', note: 'PRIVATE', log: {}, treatmentPlan: 'PRIVATE', customerWarranty: { startDate: '', endDate: '', duration: 0 } }]);
    check(normalized.records[0].note, undefined);
    check(normalized.records[0].log, undefined);
    check(normalized.records[0].treatmentPlan, 'PRIVATE');
    const legacyFlat = model.normalizeResponse([{ serviceCode: 'LEGACY', phone: '0345696820', email: 'old@example.com', address: 'Ha Noi', processingError: 'Thay cell', treatmentPlan: 'Thay pin', date: '01/01/2025', endDate: '01/01/2026', duration: 12 }]);
    check(legacyFlat.records[0].contact.phone, '0345696820');
    check(legacyFlat.records[0].contact.email, 'old@example.com');
    check(legacyFlat.records[0].processingError, 'Thay cell');
    check(legacyFlat.records[0].treatmentPlan, 'Thay pin');
    const url = new URL(model.buildSearchUrl('https://api.sunbii.vn', 'QRCoder', 'A&B + /'));
    check(url.searchParams.get('keyword'), 'A&B + /');
    check(url.searchParams.get('type'), 'QRCoder');
    for (const bad of ['all', 'name', 'address', 'note']) { assert.throws(() => model.buildSearchUrl('https://api.sunbii.vn', bad, 'DEMO')); cases++; }
    console.log('PASS warranty-model: ' + cases + ' checks, including backend parity in 3 timezones');
} finally {
    if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
}
