async (page) => {
    await page.goto('http://127.0.0.1:8081/tra-cuu.html');
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js' });
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js' });
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js' });
    const result = await page.evaluate(async () => {
        async function scanThroughUI(blob, filename, mode, expectedType, expectedValue) {
            if (document.getElementById('scanPanel').hidden) document.getElementById('scanToggle').click();
            const select = document.getElementById('scanMode'); select.value = mode; select.dispatchEvent(new Event('change'));
            const transfer = new DataTransfer(); transfer.items.add(new File([blob], filename, { type: blob.type }));
            const input = document.getElementById('scanFile'); input.files = transfer.files; input.dispatchEvent(new Event('change'));
            const deadline = Date.now() + 4000;
            while (document.getElementById('searchInput').value !== expectedValue && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
            if (document.getElementById('searchInput').value !== expectedValue || document.getElementById('searchType').value !== expectedType) throw new Error('Real image UI decode failed: ' + document.getElementById('scanStatus').textContent);
        }
        const holder = document.createElement('div'); holder.id = 'decoder-test'; holder.style.width = '800px'; document.body.append(holder);
        const decoder = new Html5Qrcode(holder.id, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128], verbose: false });
        const decoded = [];
        try {
            for (const text of ['BAT-SN-DEMO-001', 'https://services.sunbii.vn/tra-cuu.html?keyword=DEMO-QR&Method=QRCoder']) {
                const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
                const blob = await (await fetch(qr.createDataURL(8, 32))).blob();
                const value = await decoder.scanFile(new File([blob], 'qr.gif', { type: blob.type }), false);
                if (value !== text) throw new Error('QR decode mismatch');
                decoded.push('QR decoded');
                await scanThroughUI(blob, 'qr.gif', text.startsWith('https:') ? 'warranty' : 'serialNumber', text.startsWith('https:') ? 'QRCoder' : 'serialNumber', text.startsWith('https:') ? 'DEMO-QR' : text);
            }
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, 'DEMO-BARCODE-001', { format: 'CODE128', width: 3, height: 140, margin: 35 });
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            const value = await decoder.scanFile(new File([blob], 'barcode.png', { type: 'image/png' }), false);
            if (value !== 'DEMO-BARCODE-001') throw new Error('CODE128 decode mismatch');
            decoded.push('CODE128 decoded');
            await scanThroughUI(blob, 'barcode.png', 'warranty', 'serviceCode', 'DEMO-BARCODE-001');
            decoded.push('3 real image input flows passed');
            return decoded;
        } finally { decoder.clear(); holder.remove(); }
    });
    await page.reload();
    return result;
}
