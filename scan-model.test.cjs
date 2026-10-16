'use strict';
const assert = require('node:assert/strict');
const { parseScan } = require('./scan-model.js');
let checks = 0;
function match(raw, mode, expected) { assert.deepEqual(parseScan(raw, mode), expected); checks++; }
function reject(raw, mode) { assert.throws(() => parseScan(raw, mode)); checks++; }
match('  BAT-123/ABC  ', 'serialNumber', { type: 'serialNumber', keyword: 'BAT-123/ABC' });
match('SN:ABC-001', 'serialNumber', { type: 'serialNumber', keyword: 'SN:ABC-001' });
match('https://battery.example/SN?id=123', 'serialNumber', { type: 'serialNumber', keyword: 'https://battery.example/SN?id=123' });
match(' BH-001 ', 'warranty', { type: 'serviceCode', keyword: 'BH-001' });
for (const method of ['Method', 'method']) {
 match('https://services.sunbii.vn/tra-cuu.html?keyword=BH%2FABC%2B01&' + method + '=QRCoder', 'warranty', { type: 'QRCoder', keyword: 'BH/ABC+01' });
}
for (const raw of ['', '   ', null, 123, 'X'.repeat(4097), 'ABC' + String.fromCharCode(0)]) reject(raw, 'warranty');
for (const raw of ['https://evil.example/?keyword=X', 'javascript:alert(1)', 'https://services.sunbii.vn.evil.example/tra-cuu.html?keyword=X', 'https://services.sunbii.vn/other?keyword=X', 'https://user@services.sunbii.vn/tra-cuu.html?keyword=X', 'http://services.sunbii.vn/tra-cuu.html?keyword=X', 'https://services.sunbii.vn/tra-cuu.html?keyword=', 'https://services.sunbii.vn/tra-cuu.html?keyword=X&keyword=Y']) reject(raw, 'warranty');
reject('X', 'phone');
console.log('PASS scan-model: ' + checks + ' checks');
