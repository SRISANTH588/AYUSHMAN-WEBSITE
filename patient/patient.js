// Auth check
if (!sessionStorage.getItem('loggedUser')) {
  window.location.href = '../login.html';
}

// Set username
const name = sessionStorage.getItem('loggedName') || 'Patient';
const els = document.querySelectorAll('#userName, #welcomeName, #userAvatar');
els.forEach(el => {
  if (el.id === 'userAvatar') {
    el.textContent = name.charAt(0).toUpperCase();
  } else {
    el.textContent = name;
  }
});

function logout() {
  sessionStorage.clear();
  window.location.href = '../login.html';
}
