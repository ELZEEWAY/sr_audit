/**
 * Authentication Module for DILG Audit System
 * Ensures pages are protected and handles login functionality
 */

// Function to check if the user is currently logged in
function checkAuthentication() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  const currentPage = window.location.pathname;

  // If we are NOT logged in and not on login page, redirect to login
  if (isLoggedIn !== 'true' && !currentPage.includes('login.html')) {
    window.location.href = 'login.html';
  }
  // If we ARE logged in and on the login page, redirect to correct module
  else if (isLoggedIn === 'true' && currentPage.includes('login.html')) {
    // Redirect to the user's authorized module page
    const currentUserStr = sessionStorage.getItem('currentUser');
    let targetPage = 'inventory.html';
    if (currentUserStr) {
      try {
        const user = JSON.parse(currentUserStr);
        const moduleRedirects = {
          'inventory': 'inventory.html',
          'financial': 'financial.html',
          'documents': 'documents.html',
          'all': 'inventory.html'
        };
        targetPage = moduleRedirects[user.authorized_module] || 'inventory.html';
      } catch (e) { /* fallback to inventory */ }
    }
    window.location.href = targetPage;
  }
}

// Function to handle login submission
async function handleLogin(username, password) {
  // Hardcoded super admin credentials for offline testing
  if (username === 'dilgadmin' && password === 'dilgadmin_2026') {
    const superAdminUser = {
      id: 0,
      username: 'dilgadmin',
      role: 'admin',
      authorized_module: 'all'
    };
    sessionStorage.setItem('currentUser', JSON.stringify(superAdminUser));
    sessionStorage.setItem('isLoggedIn', 'true');
    return { success: true };
  }

  try {
    const response = await fetch('https://sr-audit-api.onrender.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (response.ok && result.success) {
      // Store current user metadata object in session storage
      sessionStorage.setItem('currentUser', JSON.stringify(result.user));
      sessionStorage.setItem('isLoggedIn', 'true');
      return { success: true };
    } else {
      return { success: false, message: result.message || 'Invalid username or password.' };
    }
  } catch (error) {
    console.error('Login request error:', error);
    return { success: false, message: 'Hindi makakonekta sa PostgreSQL Server.' };
  }
}

// Function to handle logout
function handleLogout() {
  sessionStorage.removeItem('isLoggedIn');
  window.location.href = 'login.html';
}

// Automatically check authentication on page load
// Wait for DOM to be ready or run immediately (running immediately is better to prevent flash of content)
checkAuthentication();
