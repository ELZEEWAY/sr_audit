(function () {
  const page = (location.pathname.split('/').pop() || 'index').toLowerCase();

  async function bootstrap() {
    await SRAuditDB.ready();
    await SRAuditDB.analytics.record(page);

    window.SiteAnalytics = {
      getAll: () => SRAuditDB.analytics.getAll(),
      record: (p) => SRAuditDB.analytics.record(p),
      reset: () => SRAuditDB.analytics.reset(),
      ready: () => SRAuditDB.ready()
    };

    document.dispatchEvent(new CustomEvent('sr-analytics-ready'));
  }

  bootstrap().catch((err) => {
    console.error('Analytics init failed:', err);
    window.SiteAnalytics = {
      getAll: async () => ({}),
      record: async () => {},
      reset: async () => {},
      ready: async () => {}
    };
    document.dispatchEvent(new CustomEvent('sr-analytics-ready'));
  });
})();
