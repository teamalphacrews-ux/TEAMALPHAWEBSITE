// Static jump links remain usable without JS. On phones show one product detail at a time.
(() => {
  const section = document.getElementById('features');
  const list = section?.querySelector('.sos-workbench-tabs');
  const links = Array.from(list?.querySelectorAll('.sd-capability-jump') || []);
  const panels = links.map(link => document.getElementById(link.hash.slice(1)));
  if (!links.length || panels.some(panel => !panel)) return;
  const phone = window.matchMedia('(max-width: 600px)');
  let index = 0;

  function show(next, moveFocus = false) {
    index = next;
    links.forEach((link, i) => {
      link.setAttribute('aria-selected', String(i === index));
      link.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
      panels[i].tabIndex = i === index ? 0 : -1;
    });
    if (moveFocus) links[index].focus({ preventScroll: true });
  }
  function applyMode() {
    section.toggleAttribute('data-phone-tabs', phone.matches);
    if (phone.matches) {
      list.setAttribute('role', 'tablist');
      links.forEach((link, i) => {
        link.setAttribute('role', 'tab');
        link.setAttribute('aria-controls', panels[i].id);
        panels[i].setAttribute('role', 'tabpanel');
        panels[i].setAttribute('aria-labelledby', link.id);
      });
      const target = links.findIndex(link => link.hash === location.hash);
      show(target < 0 ? index : target);
    } else {
      list.removeAttribute('role');
      links.forEach((link, i) => {
        ['role', 'aria-controls', 'aria-selected', 'tabindex'].forEach(name => link.removeAttribute(name));
        panels[i].hidden = false;
        panels[i].tabIndex = -1;
        panels[i].setAttribute('role', 'region');
        panels[i].removeAttribute('aria-labelledby');
      });
    }
  }

  list.addEventListener('click', event => {
    if (!phone.matches || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const next = links.indexOf(event.target.closest('a'));
    if (next < 0) return;
    event.preventDefault();
    show(next);
  });
  list.addEventListener('keydown', event => {
    if (!phone.matches || !links.includes(event.target)) return;
    const next = { ArrowRight: (index + 1) % links.length, ArrowLeft: (index + links.length - 1) % links.length, Home: 0, End: links.length - 1, ' ': index }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    show(next, true);
  });
  window.addEventListener('hashchange', () => {
    const next = links.findIndex(link => link.hash === location.hash);
    if (phone.matches && next >= 0) show(next);
  });
  phone.addEventListener('change', applyMode);
  applyMode();
})();
