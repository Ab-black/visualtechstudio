(() => {
    const menu = document.querySelector('#mobile-menu');
    const sidebar = document.querySelector('#sidebar');
    if (menu && sidebar) {
        menu.addEventListener('click', () => {
            const open = sidebar.classList.toggle('open');
            menu.setAttribute('aria-expanded', String(open));
        });
        sidebar.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('open');
                menu.setAttribute('aria-expanded', 'false');
            });
        });
    }
})();
