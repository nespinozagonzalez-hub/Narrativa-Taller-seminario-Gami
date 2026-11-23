(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const dialog = $('treasureDialog');
  const frame = $('cinemaFrame');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SCENES = [
    {
      kicker: 'Tierra a la vista',
      title: 'El último horizonte',
      line: 'La niebla se abre. Tras cada desafío, cada decisión y cada milla compartida, la isla del tesoro aparece ante ustedes.',
      backdrop: 0,
      duration: 8000
    },
    {
      kicker: 'El secreto de la isla',
      title: 'El mapa termina aquí',
      line: 'Bajo la piedra antigua espera un cofre sellado. Su cerradura reconoce a quienes se atrevieron a explorar juntos.',
      backdrop: 1,
      duration: 8000
    },
    {
      kicker: 'La recompensa de la travesía',
      title: '¡El tesoro es suyo!',
      line: 'El sello cede. Una luz dorada llena el santuario. Lo que parecía una leyenda acaba de hacerse realidad.',
      backdrop: 2,
      duration: 8500
    },
    {
      kicker: 'Capitán Brújula',
      title: '¡Leyendas de los siete mares!',
      line: '',
      backdrop: 2,
      duration: 0
    }
  ];

  let sceneIndex = 0;
  let playing = false;
  let remaining = 0;
  let startedAt = 0;
  let sceneTimer;
  let names = '';
  let wholeFleet = false;
  let captionAnimation;

  const particles = document.createDocumentFragment();
  for (let index = 0; index < 34; index++) {
    const particle = document.createElement('span');
    particle.style.setProperty('--x', (index * 37 % 101) + '%');
    particle.style.setProperty('--drift', (index % 2 ? 1 : -1) * (25 + index * 13 % 75) + 'px');
    particle.style.setProperty('--duration', (4 + index % 6) + 's');
    particle.style.setProperty('--delay', -(index * 0.73) + 's');
    particle.style.setProperty('--size', (2 + index % 4) + 'px');
    particles.appendChild(particle);
  }
  $('cinemaParticles').appendChild(particles);

  function stopClock() {
    clearTimeout(sceneTimer);
    sceneTimer = undefined;
    if (startedAt) remaining = Math.max(0, remaining - (performance.now() - startedAt));
    startedAt = 0;
  }

  function runClock() {
    if (!playing || !dialog.open || document.hidden || sceneIndex === SCENES.length - 1) return;
    startedAt = performance.now();
    sceneTimer = setTimeout(() => showScene(sceneIndex + 1), remaining);
  }

  function renderPlayback() {
    const last = sceneIndex === SCENES.length - 1;
    $('cinemaPauseBtn').hidden = last;
    $('cinemaPauseBtn').textContent = playing ? 'Pausar' : 'Reproducir';
    $('cinemaPauseBtn').setAttribute('aria-label', playing ? 'Pausar cinemática' : 'Reproducir cinemática');
    frame.classList.toggle('is-paused', (!playing || document.hidden) && !last);
  }

  function showScene(index) {
    stopClock();
    sceneIndex = Math.max(0, Math.min(SCENES.length - 1, index));
    const scene = SCENES[sceneIndex];
    const last = sceneIndex === SCENES.length - 1;
    const pauseWasFocused = document.activeElement === $('cinemaPauseBtn');
    remaining = scene.duration;
    if (last) playing = false;

    frame.dataset.scene = sceneIndex;
    document.querySelectorAll('[data-cinema-bg]').forEach(image => {
      image.classList.toggle('is-active', Number(image.dataset.cinemaBg) === scene.backdrop);
    });
    $('cinemaKicker').textContent = scene.kicker;
    $('treasureTitle').textContent = last && wholeFleet ? '¡Una flota de leyenda!' : scene.title;
    $('treasureTeams').textContent = names;
    $('treasureTeams').hidden = sceneIndex === 1 || sceneIndex === 2;
    $('treasureLine').textContent = last
      ? '«¡Por las siete mareas! Han encontrado un tesoro increíble. ' +
        (wholeFleet ? '¡Que todo el puerto celebre lo que logró esta flota!»'
          : '¡Que ruede la voz y que las demás tripulaciones sigan el rumbo!»')
      : scene.line;
    $('treasureChallenge').hidden = !last || !wholeFleet;
    $('cinemaCaptain').hidden = !last;
    $('cinemaEndActions').hidden = !last;
    $('cinemaPrevBtn').disabled = sceneIndex === 0;
    $('cinemaNextBtn').textContent = last ? 'Volver al mapa' : 'Siguiente →';
    $('cinemaCounter').textContent = (sceneIndex + 1) + ' / ' + SCENES.length;
    document.querySelectorAll('[data-cinema-scene]').forEach(button => {
      if (Number(button.dataset.cinemaScene) === sceneIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    captionAnimation?.cancel();
    if (!reducedMotion.matches) {
      captionAnimation = $('cinemaCaption').animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 700, easing: 'ease-out', fill: 'both' }
      );
    }
    renderPlayback();
    runClock();
    if (last && pauseWasFocused) $('cinemaNextBtn').focus();
  }

  function play(options) {
    names = options.names;
    wholeFleet = options.wholeFleet;
    playing = !reducedMotion.matches;
    document.querySelectorAll('dialog[open]').forEach(current => current.close());
    stopClock();
    if (!dialog.open) dialog.showModal();
    showScene(0);
    $('cinemaNextBtn').focus({ preventScroll: true });
  }

  function togglePlayback() {
    stopClock();
    playing = !playing;
    renderPlayback();
    runClock();
  }

  function close() {
    stopClock();
    playing = false;
    captionAnimation?.cancel();
    frame.classList.add('is-paused');
    if (dialog.open) dialog.close();
  }

  $('cinemaNextBtn').addEventListener('click', () => {
    if (sceneIndex === SCENES.length - 1) close();
    else showScene(sceneIndex + 1);
  });
  $('cinemaPrevBtn').addEventListener('click', () => showScene(sceneIndex - 1));
  $('cinemaPauseBtn').addEventListener('click', togglePlayback);
  $('cinemaReplayBtn').addEventListener('click', () => {
    playing = !reducedMotion.matches;
    showScene(0);
    $('cinemaNextBtn').focus();
  });
  document.querySelectorAll('[data-cinema-scene]').forEach(button => {
    button.addEventListener('click', () => showScene(Number(button.dataset.cinemaScene)));
  });
  dialog.addEventListener('close', () => {
    if (!dialog.open) close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      $('cinemaNextBtn').click();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showScene(sceneIndex - 1);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!dialog.open) return;
    stopClock();
    renderPlayback();
    runClock();
  });
  reducedMotion.addEventListener('change', () => {
    if (dialog.open && reducedMotion.matches) {
      stopClock();
      playing = false;
      renderPlayback();
    }
  });

  window.TreasureCinema = { play, close };
})();
