
document.addEventListener('DOMContentLoaded', (event) => {
    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Countdown timer
    const weddingDate = new Date("2024-06-15T00:00:00").getTime();
    const daysElement = document.getElementById('days');
    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');
    const secondsElement = document.getElementById('seconds');

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = weddingDate - now;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        daysElement.textContent = days;
        hoursElement.textContent = hours;
        minutesElement.textContent = minutes;
        secondsElement.textContent = seconds;

        if (distance < 0) {
            clearInterval(countdownTimer);
            document.getElementById('countdown').innerHTML = "<div>O grande dia chegou!</div>";
        }
    }

    const countdownTimer = setInterval(updateCountdown, 1000);
    updateCountdown(); // Call once immediately to avoid delay

    // RSVP form submission
    const rsvpForm = document.getElementById('rsvp-form');
    rsvpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Obrigado por confirmar sua presença!');
        rsvpForm.reset();
    });

    // Animate elements on scroll
    function animateOnScroll() {
        const elements = document.querySelectorAll('.event, .gallery-grid img');
        elements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementBottom = element.getBoundingClientRect().bottom;
            if (elementTop < window.innerHeight && elementBottom > 0) {
                element.classList.add('animate');
            }
        });
    }

    window.addEventListener('scroll', animateOnScroll);
    animateOnScroll(); // Call once on load
});
