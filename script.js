document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('.site-header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Mobile menu toggle
    menuToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
    });

    // Parallax effect for hero section
    window.addEventListener('scroll', function() {
        const scrollPosition = window.pageYOffset;
        document.querySelectorAll('.hero-images img').forEach((img, index) => {
            const speed = 0.1 * (index + 1);
            img.style.transform = `translateY(${scrollPosition * speed}px)`;
        });
    });

    // Pricing calculator
    const hoursInput = document.getElementById('hours');
    const hoursValue = document.getElementById('hours-value');
    const engagementShoot = document.getElementById('engagement-shoot');
    const ceremonyVideo = document.getElementById('ceremony-video');
    const filmDigital = document.getElementById('film-digital');
    const totalPriceValue = document.getElementById('total-price-value');

    function calculatePrice() {
        let totalPrice = parseInt(hoursInput.value) * 250; // Base price per hour
        if (engagementShoot.checked) totalPrice += 500;
        if (ceremonyVideo.checked) totalPrice += 1000;
        if (filmDigital.checked) totalPrice += 750;
        totalPriceValue.textContent = totalPrice;
    }

    hoursInput.addEventListener('input', () => {
        hoursValue.textContent = hoursInput.value;
        calculatePrice();
    });

    engagementShoot.addEventListener('change', calculatePrice);
    ceremonyVideo.addEventListener('change', calculatePrice);
    filmDigital.addEventListener('change', calculatePrice);

    calculatePrice(); // Initial calculation

    // Form submission
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        // Here you would typically send the form data to a server
        alert('Obrigado pelo seu interesse! Entraremos em contato em breve.');
        form.reset();
    });

    // Lazy loading images
    const images = document.querySelectorAll('img[data-src]');
    const config = {
        rootMargin: '50px 0px',
        threshold: 0.01
    };

    let observer = new IntersectionObserver((entries, self) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                preloadImage(entry.target);
                self.unobserve(entry.target);
            }
        });
    }, config);

    images.forEach(image => {
        observer.observe(image);
    });

    function preloadImage(img) {
        const src = img.getAttribute('data-src');
        if (!src) { return; }
        img.src = src;
    }

    // Animate on scroll
    const animatedElements = document.querySelectorAll('.animate-on-scroll');

    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, { threshold: 0.1 });

    animatedElements.forEach(el => animationObserver.observe(el));
});
