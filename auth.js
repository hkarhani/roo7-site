(() => {
  let isRegisterMode = false;

  const usernameEl = document.getElementById('username');
  const emailEl = document.getElementById('email');
  const fullNameEl = document.getElementById('full_name');
  const passwordEl = document.getElementById('password');
  const toggleBtn = document.getElementById('toggle-mode');
  const submitBtn = document.getElementById('submit-btn');
  const formTitle = document.getElementById('form-title');
  const errorMsg = document.getElementById('error-msg');

  toggleBtn.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    formTitle.innerText = isRegisterMode ? 'Register' : 'Login';
    submitBtn.innerText = isRegisterMode ? 'Register' : 'Login';
    emailEl.style.display = isRegisterMode ? 'block' : 'none';
    fullNameEl.style.display = isRegisterMode ? 'block' : 'none';
    toggleBtn.innerText = isRegisterMode ? 'Already have an account? Login' : 'Don\'t have an account? Register';
    errorMsg.innerText = '';
  });

  submitBtn.addEventListener('click', async () => {
    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();
    const email = emailEl.value.trim();
    const full_name = fullNameEl.value.trim();

    errorMsg.innerText = '';

    if (!username || !password) {
      errorMsg.innerText = 'Username and password are required.';
      return;
    }

    try {
      if (isRegisterMode) {
        const res = await fetch('https://api.roo7.site/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, full_name, password })
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Registration failed');
        }

        alert('Registration successful. You can now log in.');
        toggleBtn.click();  // switch to login
      } else {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch('https://api.roo7.site/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Login failed');
        }

        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        window.location.href = 'dashboard.html';
      }
    } catch (err) {
      errorMsg.innerText = err.message;
    }
  });
})();
