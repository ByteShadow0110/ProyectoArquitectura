// Comportamiento de la interfaz (sin scripts en línea por la política CSP).
(function () {
  var root = document.documentElement;
  var toggle = document.getElementById('menu');
  var desktop = window.matchMedia('(min-width: 992px)');

  function setExpanded() {
    if (!toggle) return;
    var open = desktop.matches ? !root.classList.contains('sb-collapsed') : root.classList.contains('sb-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      if (desktop.matches) {
        var collapsed = root.classList.toggle('sb-collapsed');
        try { localStorage.setItem('sb-collapsed', collapsed ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
      } else {
        root.classList.toggle('sb-open');
      }
      setExpanded();
    });
  }

  function closeMobile() { root.classList.remove('sb-open'); setExpanded(); }
  var backdrop = document.getElementById('backdrop');
  if (backdrop) backdrop.addEventListener('click', closeMobile);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMobile(); });
  document.querySelectorAll('.nav a').forEach(function (a) { a.addEventListener('click', closeMobile); });

  // Al cambiar el tamaño de la ventana, se limpia el estado que no aplica
  desktop.addEventListener('change', function (e) {
    root.classList.remove('sb-open');
    if (!e.matches) root.classList.remove('sb-collapsed');
    else {
      try { if (localStorage.getItem('sb-collapsed') === '1') root.classList.add('sb-collapsed'); } catch (err) { /* ignorar */ }
    }
    setExpanded();
  });
  setExpanded();

  // <form data-confirm="¿Seguro?"> pide confirmación antes de enviar
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });
})();
