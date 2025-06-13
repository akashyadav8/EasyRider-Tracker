// Auth functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const currentUser = localStorage.getItem('user');
    if (currentUser && window.location.pathname !== '/') {
        window.location.href = '/';
    }
    
    // Handle login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Get users from localStorage
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            
            // Find user with matching email and password
            const user = users.find(u => u.email === email && u.password === password);
            
            if (user) {
                // Store current user info in localStorage
                localStorage.setItem('user', JSON.stringify({
                    id: user.id,
                    name: user.name,
                    email: user.email
                }));
                
                // Redirect to the main page
                window.location.href = '/';
            } else {
                // Show error message
                const authError = document.getElementById('authError');
                authError.textContent = 'Invalid email or password';
                authError.classList.add('visible');
                
                // Hide error after 3 seconds
                setTimeout(() => {
                    authError.classList.remove('visible');
                }, 3000);
            }
        });
    }
    
    // Handle signup form submission
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Get the auth error element
            const authError = document.getElementById('authError');
            
            // Validate passwords match
            if (password !== confirmPassword) {
                authError.textContent = 'Passwords do not match';
                authError.classList.add('visible');
                
                setTimeout(() => {
                    authError.classList.remove('visible');
                }, 3000);
                
                return;
            }
            
            // Get existing users or initialize empty array
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            
            // Check if email already exists
            if (users.some(user => user.email === email)) {
                authError.textContent = 'Email already in use';
                authError.classList.add('visible');
                
                setTimeout(() => {
                    authError.classList.remove('visible');
                }, 3000);
                
                return;
            }
            
            // Create new user
            const newUser = {
                id: Date.now().toString(),
                name,
                email,
                password
            };
            
            // Add user to array and save to localStorage
            users.push(newUser);
            localStorage.setItem('users', JSON.stringify(users));
            
            // Store current user info in localStorage (without password)
            localStorage.setItem('user', JSON.stringify({
                id: newUser.id,
                name: newUser.name,
                email: newUser.email
            }));
            
            // Redirect to the main page
            window.location.href = '/';
        });
    }
}); 