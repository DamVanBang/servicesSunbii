(function () {
    'use strict';
    const panel = document.getElementById('scanPanel');
    if (!panel) return;
    const camera = document.getElementById('scanCamera');
    const choose = document.getElementById('scanChoose');
    const fileInput = document.getElementById('scanFile');
    const stopButton = document.getElementById('scanStop');
    const mode = document.getElementById('scanMode');
    const status = document.getElementById('scanStatus');
    const reader = document.getElementById('scanReader');
    const input = document.getElementById('searchInput');
    const type = document.getElementById('searchType');
    const toggle = document.getElementById('scanToggle');
    const close = document.getElementById('scanClose');
    const summary = document.getElementById('scanSummary');
    function collapse(focusTarget) {
        stop(false);
        if (panel.open) panel.close();
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        if (focusTarget) focusTarget.focus();
    }
    toggle.addEventListener('click', () => {
        if (!panel.hidden) { collapse(toggle); return; }
        mode.value = type.value === 'serviceCode' || type.value === 'QRCoder' ? 'warranty' : 'serialNumber';
        panel.hidden = false;
        panel.showModal();
        toggle.setAttribute('aria-expanded', 'true');
        mode.focus();
        camera.click();
    });
    close.addEventListener('click', () => collapse(toggle));
    panel.addEventListener('cancel', event => { event.preventDefault(); collapse(toggle); });
    panel.addEventListener('click', event => {
        const bounds = panel.getBoundingClientRect();
        if (event.target === panel && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) collapse(toggle);
    });
    panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); collapse(toggle); }
    });
    input.addEventListener('input', () => { summary.hidden = true; });
    type.addEventListener('change', () => { summary.hidden = true; });
    let library, active, generation = 0;
    function feedback(text, error = false) {
        status.textContent = text;
        panel.dataset.state = error ? 'error' : 'idle';
    }
    function busy(value) {
        stopButton.disabled = !value;
        panel.setAttribute('aria-busy', String(value));
    }
    function loadLibrary() {
        if (window.Html5Qrcode) return Promise.resolve();
        if (library) return library;
        library = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timeout = window.setTimeout(() => finish(false), 20000);
            function finish(ok) {
                window.clearTimeout(timeout);
                script.onload = script.onerror = null;
                if (ok && window.Html5Qrcode) resolve();
                else { script.remove(); reject(new Error('library')); }
            }
            script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
            script.referrerPolicy = 'no-referrer';
            script.onload = () => finish(true);
            script.onerror = () => finish(false);
            document.head.append(script);
        }).catch(error => { library = null; throw error; });
        return library;
    }
    function stopTracks(operation) {
        operation.element.querySelectorAll('video').forEach(video => {
            if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
        });
    }
    async function cleanup(operation) {
        stopTracks(operation);
        operation.element.remove();
        if (!reader.children.length) reader.hidden = true;
        if (operation.pending || operation.cleaning) return;
        operation.cleaning = true;
        if (operation.scanner) {
            if (operation.running) {
                try { await operation.scanner.stop(); } catch (_) { stopTracks(operation); }
            }
            operation.running = false;
            try { operation.scanner.clear(); } catch (_) { /* Tracks are stopped even if library cleanup fails. */ }
        }
    }
    function stop(announce = true) {
        generation++;
        const operation = active;
        active = null;
        busy(false);
        if (announce) feedback('Đã dừng quét. Có thể mở camera hoặc chọn ảnh để thử lại.');
        if (operation) return cleanup(operation);
    }
    function decoded(value, selectedMode, current) {
        if (current !== generation) return;
        let parsed;
        try { parsed = window.ScanModel.parseScan(value, selectedMode); }
        catch (error) {
            stop(false);
            feedback(error.message + ' Chọn đúng loại tem rồi thử lại.', true);
            camera.focus();
            return;
        }
        stop(false);
        input.value = parsed.keyword;
        type.value = parsed.type;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        type.dispatchEvent(new Event('change', { bubbles: true }));
        feedback('Đã đọc mã. Kiểm tra thông tin và nhấn Tra cứu để xác nhận.');
        summary.textContent = 'Đã đọc mã. Kiểm tra thông tin phía trên rồi nhấn Tra cứu.';
        summary.hidden = false;
        collapse(document.getElementById('searchButton'));
    }
    async function begin(file) {
        stop(false);
        const current = generation;
        const selectedMode = mode.value;
        const element = document.createElement('div');
        element.id = 'scan-reader-' + current;
        const operation = { element, scanner: null, pending: false, running: false, cleaning: false };
        active = operation;
        busy(true);
        feedback(file ? 'Đang đọc ảnh trên thiết bị…' : 'Đang chuẩn bị camera…');
            try {
                await loadLibrary();
                if (current !== generation) return;
                reader.hidden = false;
                reader.append(element);
                operation.scanner = new window.Html5Qrcode(element.id, {
                    formatsToSupport: [window.Html5QrcodeSupportedFormats.QR_CODE, window.Html5QrcodeSupportedFormats.CODE_128],
                    experimentalFeatures: { useBarCodeDetectorIfSupported: false },
                    verbose: false
                });
                if (file) {
                    operation.pending = true;
                    const value = await operation.scanner.scanFile(file, false);
                    operation.pending = false;
                    decoded(value, selectedMode, current);
                    await cleanup(operation);
                } else {
                    operation.pending = true;
                    await operation.scanner.start({ facingMode: 'environment' }, { fps: 10 }, value => decoded(value, selectedMode, current), () => {});
                    operation.pending = false;
                    operation.running = true;
                    if (current !== generation) await cleanup(operation);
                    else feedback('Đưa tem QR hoặc mã vạch CODE128 vào khung camera.');
                }
            } catch (error) {
                operation.pending = false;
                await cleanup(operation);
                if (current !== generation) return;
                active = null;
                busy(false);
                const name = error && error.name || String(error);
                if (/NotAllowed|PermissionDenied|Permission denied/i.test(name)) feedback('Chưa được cấp quyền camera. Cho phép camera trong trình duyệt rồi nhấn Mở camera; hoặc chọn ảnh.', true);
                else if (error && error.message === 'library') feedback('Không tải được thư viện quét. Kiểm tra mạng rồi nhấn Mở camera hoặc Chọn ảnh để thử lại; vẫn có thể nhập mã bằng tay.', true);
                else feedback(file ? 'Không đọc được QR/CODE128 trong ảnh. Chọn ảnh rõ hơn (JPEG, PNG…) hoặc nhập mã bằng tay.' : 'Không mở được camera. Kiểm tra camera có đang được ứng dụng khác dùng, rồi thử lại hoặc chọn ảnh.', true);
                (file ? choose : camera).focus();
            }
    }
    camera.addEventListener('click', () => {
        if (!window.isSecureContext) { stop(false); feedback('Camera cần HTTPS hoặc localhost. Hãy chọn ảnh hoặc nhập mã bằng tay.', true); return; }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { stop(false); feedback('Trình duyệt không hỗ trợ camera. Hãy chọn ảnh hoặc nhập mã bằng tay.', true); return; }
        begin();
    });
    choose.addEventListener('click', () => { stop(false); feedback('Chọn ảnh tem QR hoặc CODE128, tối đa 15 MB.'); fileInput.click(); });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        if (!/^image\//i.test(file.type) || file.size > 15 * 1024 * 1024 || file.size === 0) {
            stop(false); feedback('Vui lòng chọn file ảnh không rỗng, tối đa 15 MB.', true); choose.focus(); return;
        }
        begin(file);
    });
    stopButton.addEventListener('click', () => { stop(); camera.focus(); });
    mode.addEventListener('change', () => { if (panel.open) camera.click(); else stop(false); });
    document.getElementById('lookupForm').addEventListener('submit', () => stop(false), true);
    document.getElementById('retryButton').addEventListener('click', () => stop(false), true);
    window.addEventListener('pagehide', () => stop(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(false); });
}());
