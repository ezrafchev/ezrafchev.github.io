document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navUl = document.querySelector('nav ul');

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Header background change on scroll
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        } else {
            header.style.backgroundColor = 'transparent';
        }
    });

    // Mobile menu toggle
    menuToggle.addEventListener('click', function() {
        navUl.classList.toggle('show');
    });

    // Close mobile menu when a link is clicked
    navUl.addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
            navUl.classList.remove('show');
        }
    });

    // Message slider
    const messages = document.querySelectorAll('.message');
    let currentMessageIndex = 0;

    function showNextMessage() {
        messages[currentMessageIndex].style.display = 'none';
        currentMessageIndex = (currentMessageIndex + 1) % messages.length;
        messages[currentMessageIndex].style.display = 'block';
    }

    setInterval(showNextMessage, 5000);

    // Form submission
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Obrigado pela sua mensagem! Entraremos em contato em breve.');
        form.reset();
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

    // Animate elements on scroll
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('.animate-on-scroll');
        elements.forEach(el => {
            const elementTop = el.getBoundingClientRect().top;
            const elementBottom = el.getBoundingClientRect().bottom;
            if (elementTop < window.innerHeight && elementBottom > 0) {
                el.classList.add('is-visible');
            }
        });
    };

    window.addEventListener('scroll', animateOnScroll);
    animateOnScroll(); // Run once on load
});
