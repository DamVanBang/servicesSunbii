async (page) => {
    await page.goto('http://127.0.0.1:8081/tra-cuu.html', { waitUntil: 'domcontentloaded' });
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    assert(await page.locator('#scanPanel').isHidden(), 'Scanner initially expanded');
    assert(await page.locator('#lookupForm #scanToggle').count() === 1, 'Scan outside form');
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow ' + width);
        const input = await page.locator('#searchInput').boundingBox();
        const button = await page.locator('#scanToggle').boundingBox();
        assert(input.width > 100 && button.x > input.x && button.x + button.width <= input.x + input.width, 'Scan icon not inside input ' + width);
        await page.screenshot({ path: 'output/playwright/scan-form-' + width + '.png', fullPage: true });
    }
    await page.evaluate(() => { const select = document.getElementById('searchType'); select.value = 'serviceCode'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.locator('#scanToggle').click();
    assert(await page.evaluate(() => document.getElementById('scanPanel').matches(':modal')), 'Scanner not modal');
    await page.screenshot({ path: 'output/playwright/scan-dialog-mobile.png', fullPage: true });
    assert(await page.locator('#scanMode').inputValue() === 'warranty', 'Wrong contextual mode');
    await page.locator('#scanMode').press('Escape');
    assert(await page.locator('#scanPanel').isHidden(), 'Escape not closing');
    await page.locator('#scanToggle').click();
    await page.locator('#scanClose').click();
    assert(await page.locator('#scanToggle').getAttribute('aria-expanded') === 'false', 'Wrong expanded state');
    assert(await page.evaluate(() => document.activeElement.id === 'scanToggle'), 'Focus not returned');
    return { formPlacement: true, desktopMobile320: true, contextualMode: true, escapeCloseFocus: true };
}
