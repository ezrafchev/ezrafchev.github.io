
document.addEventListener('DOMContentLoaded', function() {
    // Blog posts
    const blogPosts = [
        { title: 'Nosso Primeiro Post', content: 'Bem-vindos ao nosso blog!' },
        { title: 'Momentos Especiais', content: 'Compartilhando alguns momentos especiais...' }
    ];

    const blogPostsContainer = document.getElementById('blog-posts');
    blogPosts.forEach(post => {
        const article = document.createElement('article');
        article.innerHTML = `
            <h3>${post.title}</h3>
            <p>${post.content}</p>
        `;
        blogPostsContainer.appendChild(article);
    });

    // Contact form
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
                alert('Mensagem enviada com sucesso!');
                form.reset();
            } else {
                alert('Ocorreu um erro. Por favor, tente novamente.');
            }
        }).catch(error => {
            alert('Ocorreu um erro. Por favor, tente novamente.');
        });
    });
});
