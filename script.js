
    // --- JavaScript để điều khiển Menu Mobile ---
    const menuButton = document.querySelector('.mobile-menu-button');
    const navMenu = document.querySelector('.main-nav');

    menuButton.addEventListener('click', () => {
        // Thêm/xóa class 'active' để hiện/ẩn menu
        navMenu.classList.toggle('active');

        // Thay đổi icon từ hamburger (bars) sang dấu X (times) và ngược lại
        const icon = menuButton.querySelector('i');
        if (navMenu.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
