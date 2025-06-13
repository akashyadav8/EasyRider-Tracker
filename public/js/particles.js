class FloatingParticles {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'floating-particles';
        this.particles = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.init();
    }

    init() {
        // Add container to the body
        document.body.appendChild(this.container);
        
        // Generate initial particles
        this.generateParticles();

        // Add mouse move event listener
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            this.updateParticles();
        });

        // Continuously update particles
        setInterval(() => this.updateParticles(), 16); // ~60fps
    }

    generateParticles() {
        // Clear existing particles
        this.container.innerHTML = '';
        this.particles = [];

        // Generate new particles
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Random position
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            
            // Random animation delay and duration
            const delay = Math.random() * 12;
            const duration = 8 + Math.random() * 8;
            
            // Set initial styles
            particle.style.left = `${x}%`;
            particle.style.top = `${y}%`;
            particle.style.animationDelay = `${delay}s`;
            particle.style.animationDuration = `${duration}s`;
            
            // Store original position
            particle.dataset.originalX = x;
            particle.dataset.originalY = y;
            
            // Add to container
            this.container.appendChild(particle);
            this.particles.push(particle);
        }
    }

    updateParticles() {
        const mouseRadius = 200; // Increased from 150 to 200 for larger interaction area

        this.particles.forEach(particle => {
            const rect = particle.getBoundingClientRect();
            const particleX = rect.left + rect.width / 2;
            const particleY = rect.top + rect.height / 2;

            // Calculate distance from mouse to particle
            const dx = particleX - this.mouseX;
            const dy = particleY - this.mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouseRadius) {
                // Calculate repulsion force
                const force = (mouseRadius - distance) / mouseRadius;
                const angle = Math.atan2(dy, dx);
                
                // Move particle away from mouse with increased force
                const moveX = Math.cos(angle) * force * 30; // Increased from 20 to 30
                const moveY = Math.sin(angle) * force * 30; // Increased from 20 to 30

                // Apply movement with transition
                particle.style.transition = 'transform 0.3s ease-out'; // Added smooth transition
                particle.style.transform = `translate(${moveX}px, ${moveY}px)`;
            } else {
                // Return to original position with transition
                particle.style.transition = 'transform 0.3s ease-out'; // Added smooth transition
                particle.style.transform = 'translate(0, 0)';
            }
        });
    }
}

// Initialize particles when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FloatingParticles();
}); 