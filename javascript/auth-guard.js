/**
 * auth-guard.js
 * Injected at the top of protected HTML pages.
 * Blocks rendering and redirects if module authorization fails.
 */
(function () {
  const sessionUserStr = sessionStorage.getItem('currentUser');
  const currentPage = window.location.pathname;
  const filename = currentPage.substring(currentPage.lastIndexOf('/') + 1);

  if (!sessionUserStr) {
    // If not authenticated and not on login page, redirect immediately
    if (filename !== 'login.html') {
      alert('Seksyon na Protektado. Mangyaring mag-log in muna.');
      window.location.href = 'login.html';
    }
    return;
  }

  const sessionUser = JSON.parse(sessionUserStr);

  // If DILG Admin, bypass guard checks
  if (sessionUser.role === 'admin') {
    return;
  }

  // Module to page mappings
  const moduleAccess = {
    'inventory.html': 'inventory',
    'financial.html': 'financial',
    'documents.html': 'documents'
  };

  if (filename in moduleAccess) {
    const requiredModule = moduleAccess[filename];
    if (sessionUser.authorized_module !== requiredModule) {
      alert('Access Denied: Hindi ka awtorisado na ma-access ang pahinang ito!');
      
      // Redirect to correct module
      if (sessionUser.authorized_module === 'inventory') {
        window.location.href = 'inventory.html';
      } else if (sessionUser.authorized_module === 'financial') {
        window.location.href = 'financial.html';
      } else if (sessionUser.authorized_module === 'documents') {
        window.location.href = 'documents.html';
      } else {
        window.location.href = 'login.html';
      }
    }
  }
})();
