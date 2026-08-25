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

    const contentGroups = document.querySelectorAll('.nav-group');
    const contentGroup = Array.from(contentGroups).find((group) => {
        const label = group.querySelector('.nav-label');
        return label && label.textContent.trim() === 'CONTENT';
    });

    if (contentGroup) {
        const projectsLink = Array.from(contentGroup.querySelectorAll('.nav-item')).find((link) => {
            return link.textContent.trim() === 'Projects';
        });

        if (projectsLink) {
            projectsLink.href = 'projects.html';
        }
    }
})();
