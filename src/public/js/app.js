// Comportamiento mínimo de la interfaz (sin scripts en línea por la política CSP).
(function () {
  var menu = document.getElementById('menu');
  var sidebar = document.getElementById('sidebar');
  if (menu && sidebar) menu.addEventListener('click', function () { sidebar.classList.toggle('open'); });

  // <form data-confirm="¿Seguro?"> pide confirmación antes de enviar
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });
})();
