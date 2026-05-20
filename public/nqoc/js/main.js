// nqoc/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Particles.js for Hero Section
    if (document.getElementById('particles-js')) {
        particlesJS('particles-js', {
            "particles": {
                "number": { "value": 60, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": "#7c4dff" },
                "shape": { "type": "circle" },
                "opacity": { "value": 0.5, "random": false },
                "size": { "value": 3, "random": true },
                "line_linked": {
                    "enable": true,
                    "distance": 150,
                    "color": "#7c4dff",
                    "opacity": 0.2,
                    "width": 1
                },
                "move": {
                    "enable": true,
                    "speed": 2,
                    "direction": "none",
                    "random": false,
                    "straight": false,
                    "out_mode": "out",
                    "bounce": false
                }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": {
                    "onhover": { "enable": true, "mode": "grab" },
                    "onclick": { "enable": true, "mode": "push" },
                    "resize": true
                },
                "modes": {
                    "grab": { "distance": 140, "line_linked": { "opacity": 0.8 } },
                    "push": { "particles_nb": 4 }
                }
            },
            "retina_detect": true
        });
    }

    // 5. Multi-screen Side Navigation Drawer Logic
    const sideNav = document.getElementById('nqocSideNav');
    const closeSideNav = document.getElementById('closeSideNav');
    let navVisibilityTimeout;
    let isMenuVisible = false;

    if (sideNav) {
        const showSideNav = () => {
            if (isMenuVisible) return;
            clearTimeout(navVisibilityTimeout);
            // 延迟100ms触发菜单显示，避免误触
            navVisibilityTimeout = setTimeout(() => {
                sideNav.classList.add('is-visible');
                sideNav.setAttribute('aria-hidden', 'false');
                updateTabIndices(true);
                isMenuVisible = true;
            }, 100);
        };

        const hideSideNav = () => {
            if (!isMenuVisible) return;
            clearTimeout(navVisibilityTimeout);
            sideNav.classList.remove('is-visible');
            sideNav.setAttribute('aria-hidden', 'true');
            updateTabIndices(false);
            isMenuVisible = false;
        };

        // Track "mouse crossing to second screen" (pageY > innerHeight) and Debounce via requestAnimationFrame
        let mouseMoveTicking = false;
        window.addEventListener('mousemove', (e) => {
            if (!mouseMoveTicking) {
                window.requestAnimationFrame(() => {
                    const firstScreenHeight = window.innerHeight;
                    // If mouse absolute Y is beyond the first screen
                    if (e.pageY > firstScreenHeight) {
                        showSideNav();
                    } else {
                        // Mouse returns to the first screen
                        hideSideNav();
                    }
                    mouseMoveTicking = false;
                });
                mouseMoveTicking = true;
            }
        });

        // Fallback for scroll without mouse move (using trackpad/keyboard)
        let scrollTicking = false;
        window.addEventListener('scroll', () => {
            if (!scrollTicking) {
                window.requestAnimationFrame(() => {
                    // Show/hide side nav based on scroll position
                    if (window.scrollY > window.innerHeight / 2) {
                        showSideNav();
                    } else {
                        hideSideNav();
                    }
                    
                    // Scrollspy Logic
                    let currentSectionId = '';
                    const sections = document.querySelectorAll('section[id], header[id]');
                    sections.forEach(section => {
                        const sectionTop = section.offsetTop;
                        // Trigger slightly before reaching the section
                        if (window.scrollY >= (sectionTop - window.innerHeight / 3)) {
                            currentSectionId = section.getAttribute('id');
                        }
                    });

                    // Update active class on left nav links
                    const navItems = sideNav.querySelectorAll('.side-nav-item a');
                    navItems.forEach(item => {
                        item.classList.remove('active');
                        if (item.getAttribute('href') === `#${currentSectionId}`) {
                            item.classList.add('active');
                        }
                    });

                    // Update active class on top nav links
                    const topNavItems = document.querySelectorAll('.top-nav-link');
                    topNavItems.forEach(item => {
                        item.classList.remove('active');
                        if (item.getAttribute('href') === `#${currentSectionId}`) {
                            item.classList.add('active');
                        }
                    });

                    scrollTicking = false;
                });
                scrollTicking = true;
            }
        });

        // Mobile close button
        if (closeSideNav) {
            closeSideNav.addEventListener('click', hideSideNav);
        }

        // Keyboard Navigation (Arrow keys + Enter) & Accessibility
        const menuItems = sideNav.querySelectorAll('[role="menuitem"]');
        
        const updateTabIndices = (isVisible) => {
            menuItems.forEach(item => {
                item.setAttribute('tabindex', isVisible ? '0' : '-1');
            });
        };

        sideNav.addEventListener('keydown', (e) => {
            const focusedElement = document.activeElement;
            const index = Array.from(menuItems).indexOf(focusedElement);
            
            if (index > -1) {
                let nextIndex = index;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    nextIndex = (index + 1) % menuItems.length;
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    nextIndex = (index - 1 + menuItems.length) % menuItems.length;
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    focusedElement.click();
                    if (window.innerWidth <= 768) hideSideNav();
                }
                
                if (nextIndex !== index) {
                    menuItems[nextIndex].focus();
                }
            }
        });

        // Handle clicks on links to close drawer on mobile
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    hideSideNav();
                }
            });
        });
    }

    // 2. Initialize ECharts for 5D Model Radar Chart
    const radarChartDom = document.getElementById('modelRadarChart');
    if (radarChartDom && typeof echarts !== 'undefined') {
        const myChart = echarts.init(radarChartDom);
        const option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item' },
            radar: {
                indicator: [
                    { name: '核心价值观 (Core Values)', max: 100 },
                    { name: '商业模式 (Business Model)', max: 100 },
                    { name: '生产方式 (Production Method)', max: 100 },
                    { name: '管理范式 (Management Paradigm)', max: 100 },
                    { name: '生态协同 (Ecological Synergy)', max: 100 }
                ],
                shape: 'polygon',
                splitNumber: 4,
                axisName: { color: '#e2e8f0', fontSize: 14 },
                splitLine: {
                    lineStyle: {
                        color: [
                            'rgba(124, 77, 255, 0.1)', 'rgba(124, 77, 255, 0.2)',
                            'rgba(124, 77, 255, 0.4)', 'rgba(124, 77, 255, 0.6)'
                        ].reverse()
                    }
                },
                splitArea: { show: false },
                axisLine: { lineStyle: { color: 'rgba(124, 77, 255, 0.2)' } }
            },
            series: [{
                name: '新质组织五维模型',
                type: 'radar',
                data: [
                    {
                        value: [90, 85, 80, 95, 88],
                        name: '基准数据',
                        itemStyle: { color: '#7c4dff' },
                        areaStyle: { color: 'rgba(124, 77, 255, 0.3)' },
                        lineStyle: { width: 2 }
                    }
                ]
            }]
        };
        myChart.setOption(option);
        
        window.addEventListener('resize', () => {
            myChart.resize();
        });
    }

    // 3. Scroll Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('opacity-100', 'translate-y-0');
                entry.target.classList.remove('opacity-0', 'translate-y-10');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        el.classList.add('opacity-0', 'translate-y-10', 'transition-all', 'duration-700', 'ease-out');
        observer.observe(el);
    });

    // 4. Hero Banner 3D Parallax Interaction
    const heroSectionElement = document.getElementById('hero');
    const heroImg = document.querySelector(".hero-banner-img");
    
    if (heroSectionElement && heroImg) {
        heroSectionElement.addEventListener('mousemove', (e) => {
            // Calculate mouse position relative to the center of the screen
            const xAxis = (window.innerWidth / 2 - e.pageX) / 40;
            const yAxis = (window.innerHeight / 2 - e.pageY) / 40;
            
            // Apply 3D rotation based on mouse position
            // The image already has an animation (float), so we wrap it or override its transform carefully.
            // Using a container or combining transforms is safer. We will update transform directly.
            heroImg.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg) scale3d(1.05, 1.05, 1.05)`;
        });
        
        heroSectionElement.addEventListener('mouseleave', () => {
            // Reset position
            heroImg.style.transform = `rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)`;
            // Add a slight transition back
            heroImg.style.transition = 'transform 0.5s ease-out';
        });
        
        heroSectionElement.addEventListener('mouseenter', () => {
            // Remove transition to make it follow mouse instantly
            heroImg.style.transition = 'none';
        });
    }
});


document.addEventListener('DOMContentLoaded', () => {
    // 6. Top Mobile Navigation Menu Toggle
    const mobileMenuBtn = document.getElementById('nqocMobileMenuBtn');
    const mobileMenuCloseBtn = document.getElementById('nqocMobileMenuClose');
    const mobileMenuOverlay = document.getElementById('nqocMobileMenu');

    if (mobileMenuBtn && mobileMenuOverlay && mobileMenuCloseBtn) {
        const toggleMobileMenu = (show) => {
            if (show) {
                mobileMenuOverlay.classList.remove('hidden');
                // Trigger reflow
                void mobileMenuOverlay.offsetWidth;
                mobileMenuOverlay.classList.remove('opacity-0', 'translate-x-full');
                mobileMenuOverlay.classList.add('opacity-100', 'translate-x-0');
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            } else {
                mobileMenuOverlay.classList.remove('opacity-100', 'translate-x-0');
                mobileMenuOverlay.classList.add('opacity-0', 'translate-x-full');
                document.body.style.overflow = '';
                // Wait for transition to finish before hiding
                setTimeout(() => {
                    mobileMenuOverlay.classList.add('hidden');
                }, 300);
            }
        };

        mobileMenuBtn.addEventListener('click', () => toggleMobileMenu(true));
        mobileMenuCloseBtn.addEventListener('click', () => toggleMobileMenu(false));
    }
});
