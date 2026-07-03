async function renderAnalyticsDashboard() {
  await SRAuditDB.ready();
  const data = (window.SiteAnalytics && (await SiteAnalytics.getAll())) || {};

  const table = document.getElementById('analyticsTable');
  if (table) {
    const pages = Object.keys(data).sort();
    let html = '<tr><th>Page</th><th>Views</th><th>Last Visit</th></tr>';
    pages.forEach((p) => {
      const d = data[p] || { views: 0, lastVisit: null };
      const last = d.lastVisit ? new Date(d.lastVisit).toLocaleString() : '-';
      html += `<tr><td>${p}</td><td>${d.views}</td><td>${last}</td></tr>`;
    });
    table.innerHTML = html;
  }

  const ctx = document.getElementById('analyticsChart');
  if (ctx && typeof Chart !== 'undefined') {
    const pages = Object.keys(data).sort();
    const labels = pages.map((p) => p);
    const values = pages.map((p) => (data[p] && data[p].views) || 0);
    new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Page Views',
          data: values,
          backgroundColor: labels.map(() => 'rgba(196, 30, 58, 0.85)'),
          borderColor: labels.map(() => 'rgba(139, 21, 56, 1)'),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }
}

function startDashboard() {
  if (window.SiteAnalytics) {
    renderAnalyticsDashboard().catch(console.error);
    return;
  }
  document.addEventListener('sr-analytics-ready', () => {
    renderAnalyticsDashboard().catch(console.error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startDashboard);
} else {
  startDashboard();
}
