(function () {
    'use strict';
    const button = document.querySelector('.mobile-menu-button');
    const nav = document.querySelector('.main-nav');
    if (!button || !nav) return;
    const mobile = window.matchMedia('(max-width: 768px)');
    nav.id = nav.id || 'main-navigation';
    nav.setAttribute('aria-label', 'Điều hướng chính');
    button.type = 'button';
    button.setAttribute('aria-controls', nav.id);
    const icon = button.querySelector('i');
    if (icon) icon.setAttribute('aria-hidden', 'true');
    function setOpen(open) {
        nav.classList.toggle('active', open);
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
        nav.hidden = mobile.matches && !open;
        if (icon) {
            icon.classList.toggle('fa-bars', !open);
            icon.classList.toggle('fa-times', open);
        }
    }
    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && mobile.matches && nav.classList.contains('active')) {
            setOpen(false);
            button.focus();
        }
    });
    document.addEventListener('click', event => {
        if (mobile.matches && !nav.contains(event.target) && !button.contains(event.target)) setOpen(false);
    });
    nav.addEventListener('click', event => {
        if (event.target.closest('a') && mobile.matches) setOpen(false);
    });
    mobile.addEventListener('change', () => {
        const focusInside = nav.contains(document.activeElement);
        setOpen(false);
        if (mobile.matches && focusInside) button.focus();
    });
    setOpen(false);
}());
