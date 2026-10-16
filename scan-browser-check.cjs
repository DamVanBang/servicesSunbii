async (page) => {
    const errors = [], calls = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/servicesCheck?*', route => { calls.push(route.request().url()); return route.fulfill({ json: [] }); });
    page.setDefaultTimeout(4000);
    await page.goto('http://127.0.0.1:8082/tra-cuu.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
        window.scanMock = { starts: 0, stops: 0, clears: 0, text: 'BAT-DEMO', fail: false, pending: false };
        window.Html5QrcodeSupportedFormats = { QR_CODE: 0, CODE_128: 1 };
        window.Html5Qrcode = class {
            start(config, options, callback) {
                const m = window.scanMock; m.starts++; m.callback = callback;
                if (m.fail) return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
                if (m.pending) return new Promise(resolve => { m.resolve = resolve; });
                return Promise.resolve();
            }
            stop() { window.scanMock.stops++; return Promise.resolve(); }
            clear() { window.scanMock.clears++; }
            scanFile() { return Promise.resolve(window.scanMock.text); }
        };
    });
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    assert(await page.evaluate(() => window.scanMock.starts === 0), 'Camera started on page load');
    await page.locator('#scanToggle').click();
    await page.waitForFunction(() => window.scanMock.starts === 1);
    await page.locator('#scanClose').click();
    await page.waitForFunction(() => window.scanMock.stops >= 1);
    const scan = async (text, mode, expected) => {
        if (await page.locator('#scanPanel').isHidden()) await page.locator('#scanToggle').click();
        await page.locator('#scanMode').selectOption(mode);
        await page.locator('#scanCamera').click();
        await page.waitForFunction(() => document.getElementById('scanStatus').textContent.includes('Đưa tem'));
        await page.evaluate(value => window.scanMock.callback(value), text);
        await page.waitForFunction(() => document.getElementById('scanReader').hidden);
        assert(await page.locator('#searchInput').inputValue() === expected.keyword, 'Wrong decoded value');
        assert(await page.locator('#searchType').inputValue() === expected.type, 'Wrong lookup type');
    };
    await scan('SN:BAT-001', 'serialNumber', { type: 'serialNumber', keyword: 'SN:BAT-001' });
    await scan('DEMO-128', 'warranty', { type: 'serviceCode', keyword: 'DEMO-128' });
    await scan('https://services.sunbii.vn/tra-cuu.html?keyword=DEMO%2BQR&Method=QRCoder', 'warranty', { type: 'QRCoder', keyword: 'DEMO+QR' });
    assert(calls.length === 0, 'Scanning submitted without confirmation');
    await page.locator('#searchButton').click();
    await page.waitForFunction(() => document.getElementById('lookupStatus').textContent.includes('Không tìm thấy'));
    assert(calls.length === 1 && new URL(calls[0]).searchParams.get('type') === 'QRCoder', 'Confirmed lookup wrong');
    await scan('https://evil.example/?keyword=X', 'warranty', { type: 'QRCoder', keyword: 'DEMO+QR' });
    assert((await page.locator('#scanStatus').textContent()).includes('hợp lệ'), 'Unsafe URL not rejected');
    await page.evaluate(() => { window.scanMock.fail = true; });
    await page.locator('#scanCamera').click();
    await page.waitForFunction(() => document.getElementById('scanStatus').textContent.includes('cấp quyền'));
    await page.evaluate(() => { window.scanMock.fail = false; window.scanMock.pending = true; window.scanMock.resolve = null; });
    await page.locator('#scanCamera').click();
    await page.waitForFunction(() => typeof window.scanMock.resolve === 'function');
    await page.locator('#scanStop').click();
    const before = await page.evaluate(() => window.scanMock.stops);
    await page.evaluate(() => { window.scanMock.text = 'FALLBACK-WHILE-PENDING'; });
    await page.locator('#scanMode').selectOption('serialNumber');
    await page.locator('#scanFile').setInputFiles({ name: 'fallback.png', mimeType: 'image/png', buffer: Buffer.from('mock image') });
    await page.waitForFunction(() => document.getElementById('searchInput').value === 'FALLBACK-WHILE-PENDING');
    await page.evaluate(() => window.scanMock.resolve());
    await page.waitForFunction(n => window.scanMock.stops > n, before);
    await page.locator('#scanToggle').click();
    await page.locator('#scanFile').setInputFiles({ name: 'not-image.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') });
    assert((await page.locator('#scanStatus').textContent()).includes('file ảnh'), 'Invalid file accepted');
    await page.evaluate(() => { window.scanMock.pending = false; window.scanMock.text = 'IMAGE-SERIAL'; });
    await page.locator('#scanMode').selectOption('serialNumber');
    await page.locator('#scanFile').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('mock image') });
    await page.waitForFunction(() => document.getElementById('searchInput').value === 'IMAGE-SERIAL');
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
    assert(errors.length === 0, 'Runtime errors: ' + errors.join(', '));
    await page.unroute('**/api/servicesCheck?*');
    await page.reload({ waitUntil: 'domcontentloaded' });
    return { cameraMapping: true, confirmationOnly: true, externalURLRejected: true, permissionDenied: true, stopDuringStart: true, pendingPermissionImageFallback: true, fileInput: true, mobile: true, runtimeErrors: errors.length };
}
