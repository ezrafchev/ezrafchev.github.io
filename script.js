document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('.site-header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navUl = document.querySelector('.main-navigation ul');
    const scrollTopBtn = document.createElement('button');
    scrollTopBtn.classList.add('scroll-top');
    scrollTopBtn.innerHTML = '&uarr;';
    scrollTopBtn.setAttribute('aria-label', 'Scroll to top');
    document.body.appendChild(scrollTopBtn);

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = header.offsetHeight;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition - headerOffset;

                window.scrollBy({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Header background change on scroll
    function handleScroll() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Show/hide scroll to top button
        if (window.scrollY > 300) {
            scrollTopBtn.classList.add('show');
        } else {
            scrollTopBtn.classList.remove('show');
        }
    }

    window.addEventListener('scroll', handleScroll);

    // Mobile menu toggle
    menuToggle.addEventListener('click', function() {
        navUl.classList.toggle('show');
        this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });

    // Close mobile menu when a link is clicked
    navUl.addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
            navUl.classList.remove('show');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Message slider
    const messages = document.querySelectorAll('.message');
    let currentMessageIndex = 0;

    function showNextMessage() {
        messages[currentMessageIndex].classList.remove('active');
        currentMessageIndex = (currentMessageIndex + 1) % messages.length;
        messages[currentMessageIndex].classList.add('active');
    }

    setInterval(showNextMessage, 5000);

    // Form submission
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        }).then(response => {
            if (response.ok) {
                form.reset();
                alert('Obrigado pela sua mensagem! Entraremos em contato em breve.');
            } else {
                alert('Oops! Houve um problema ao enviar sua mensagem. Por favor, tente novamente.');
            }
        }).catch(error => {
            alert('Oops! Houve um problema ao enviar sua mensagem. Por favor, tente novamente.');
        });
    });

    // Image gallery lightbox
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const lightbox = document.createElement('div');
            lightbox.id = 'lightbox';
            lightbox.setAttribute('aria-label', 'Image lightbox');
            document.body.appendChild(lightbox);

            const img = document.createElement('img');
            img.src = this.querySelector('img').src;
            img.alt = this.querySelector('img').alt;
            
            const caption = document.createElement('p');
            caption.textContent = this.querySelector('figcaption').textContent;

            lightbox.appendChild(img);
            lightbox.appendChild(caption);

            lightbox.addEventListener('click', e => {
                if (e.target !== e.currentTarget) return;
                lightbox.remove();
            });

            // Close lightbox with Esc key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    lightbox.remove();
                }
            });
        });
    });

    // Scroll to top functionality
    scrollTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Lazy loading images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    image.src = image.dataset.src;
                    image.classList.remove('lazy');
                    observer.unobserve(image);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

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

    // Timeline animation
    const timelineItems = document.querySelectorAll('.timeline-item');
    const timelineObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, { threshold: 0.5 });

    timelineItems.forEach(item => {
        timelineObserver.observe(item);
    });
});
