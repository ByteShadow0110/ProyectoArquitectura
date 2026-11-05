// Maqueta: inyecta sidebar/topbar y simula roles. Sin backend.
(function () {
  const ROLES = { admin: 'Administrador', supervisor: 'Supervisor', operativo: 'Operativo' };
  const NAV = [
    { id: 'dashboard', href: 'dashboard.html', icon: '📊', label: 'Dashboard', roles: ['admin', 'supervisor', 'operativo'] },
    { id: 'personas', href: 'personas.html', icon: '👥', label: 'Personas', roles: ['admin', 'supervisor', 'operativo'] },
    { id: 'activos', href: 'activos.html', icon: '📱', label: 'Activos', roles: ['admin', 'supervisor', 'operativo'] },
    { id: 'solicitudes', href: 'solicitudes.html', icon: '📝', label: 'Solicitudes', roles: ['admin', 'supervisor', 'operativo'] },
    { id: 'reportes', href: 'reportes.html', icon: '📈', label: 'Reportes', roles: ['admin', 'supervisor'] },
    { id: 'usuarios', href: 'usuarios.html', icon: '🔐', label: 'Usuarios y roles', roles: ['admin'] },
  ];
  const body = document.body;
  if (!body.dataset.page) return; // login
  const role = localStorage.getItem('rol') || 'admin';
  const page = body.dataset.page;
  const content = document.createElement('main');
  content.className = 'content';
  while (body.firstChild) content.appendChild(body.firstChild);

  const nav = NAV.filter(n => n.roles.includes(role))
    .map(n => `<a href="${n.href}" class="${n.id === page ? 'active' : ''}"><span>${n.icon}</span>${n.label}</a>`).join('');
  const opts = Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === role ? 'selected' : ''}>${v}</option>`).join('');
  const shell = document.createElement('div');
  shell.className = 'layout';
  shell.innerHTML = `
    <aside class="sidebar" id="sidebar"><div class="brand">Refacciones<span>MX</span></div><nav class="nav" aria-label="Principal">${nav}</nav></aside>
    <div class="main"><header class="topbar">
      <div style="display:flex;gap:10px;align-items:center"><button class="menu-btn" id="menu" aria-label="Menú">☰</button><h1>${body.dataset.title || ''}</h1></div>
      <div class="who"><label for="rol" style="margin:0;font-weight:400">Ver como:</label><select id="rol">${opts}</select><a href="login.html">Salir</a></div>
    </header></div>`;
  shell.querySelector('.main').appendChild(content);
  body.appendChild(shell);

  // Acceso por rol: si la página no está permitida, avisa
  const allowed = NAV.find(n => n.id === (body.dataset.section || page));
  if (allowed && !allowed.roles.includes(role)) {
    content.innerHTML = '<div class="card"><h2>Acceso restringido</h2><p>Tu rol no tiene permiso para esta sección.</p><a class="btn" href="dashboard.html">Volver al dashboard</a></div>';
  }
  // Elementos visibles solo para ciertos roles: data-roles="admin,supervisor"
  content.querySelectorAll('[data-roles]').forEach(el => {
    if (!el.dataset.roles.split(',').includes(role)) el.hidden = true;
  });
  document.getElementById('rol').addEventListener('change', e => { localStorage.setItem('rol', e.target.value); location.reload(); });
  document.getElementById('menu').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

  // Filtro de tablas en vivo: <input data-filter="#tabla">
  document.querySelectorAll('[data-filter]').forEach(inp => inp.addEventListener('input', () => {
    const q = inp.value.toLowerCase();
    document.querySelectorAll(inp.dataset.filter + ' tbody tr').forEach(tr => { tr.hidden = !tr.textContent.toLowerCase().includes(q); });
  }));
  // Formularios de maqueta: no envían, muestran confirmación
  document.querySelectorAll('form[data-demo]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    alert('Maqueta: aquí se guardaría el registro y se regresaría a la lista.');
    if (f.dataset.demo) location.href = f.dataset.demo;
  }));
})();
