document.addEventListener('DOMContentLoaded', (event) => {
    const header = document.querySelector('header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navUl = document.querySelector('nav ul');

    // Mobile menu toggle
    menuToggle.addEventListener('click', () => {
        navUl.classList.toggle('show');
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            navUl.classList.remove('show');
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Parallax effect for hero section
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const heroImages = document.querySelectorAll('.hero-images img');
        heroImages.forEach((img, index) => {
            img.style.transform = `translate3d(0, ${scrolled * (0.1 * (index + 1))}px, 0)`;
        });

        // Add/remove scrolled class to header
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Image gallery lightbox
    const galleryImages = document.querySelectorAll('.gallery-grid img');
    galleryImages.forEach(img => {
        img.addEventListener('click', function() {
            const lightbox = document.createElement('div');
            lightbox.id = 'lightbox';
            document.body.appendChild(lightbox);

            const image = document.createElement('img');
            image.src = this.src;
            lightbox.appendChild(image);

            lightbox.addEventListener('click', e => {
                if (e.target !== e.currentTarget) return;
                lightbox.remove();
            });
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
        let totalPrice = hoursInput.value * 250; // Base price per hour
        if (engagementShoot.checked) totalPrice += 500;
        if (ceremonyVideo.checked) totalPrice += 1000;
        if (filmDigital.checked) totalPrice += 750;
        totalPriceValue.textContent = totalPrice.toLocaleString();
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
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message. We will get back to you soon!');
            form.reset();
        });
    }

    // Animate elements on scroll
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('.animate-on-scroll');
        elements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementBottom = element.getBoundingClientRect().bottom;
            if (elementTop < window.innerHeight && elementBottom > 0) {
                element.classList.add('animated');
            }
        });
    };

    window.addEventListener('scroll', animateOnScroll);
    animateOnScroll(); // Run once on load

    // Scroll to top button
    const scrollTopBtn = document.createElement('button');
    scrollTopBtn.innerHTML = '&uarr;';
    scrollTopBtn.className = 'scroll-top-btn';
    document.body.appendChild(scrollTopBtn);

    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollTopBtn.style.display = 'block';
        } else {
            scrollTopBtn.style.display = 'none';
        }
    });
});
