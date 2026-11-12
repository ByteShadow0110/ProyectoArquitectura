// Se carga en <head> para aplicar el estado del menú antes de pintar (evita parpadeo).
(function () {
  try {
    if (window.matchMedia('(min-width: 992px)').matches && localStorage.getItem('sb-collapsed') === '1') {
      document.documentElement.classList.add('sb-collapsed');
    }
  } catch (e) { /* localStorage no disponible: menú expandido */ }
})();
