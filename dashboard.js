(async () => {
  const token = localStorage.getItem('access_token');
  const logoutBtn = document.getElementById('logout-btn');

  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const res = await fetch('https://api.roo7.site/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error('Invalid or expired token');
    }

    const data = await res.json();
    document.getElementById('username').innerText = data.username;
    document.getElementById('email').innerText = data.email;
    document.getElementById('full_name').innerText = data.full_name || 'N/A';
  } catch (err) {
    localStorage.removeItem('access_token');
    window.location.href = 'index.html';
  }

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('access_token');
    window.location.href = 'index.html';
  });
})();
