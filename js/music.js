(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const audio = el('audio');
  const seek = el('progress-container');
  const status = el('player-status');
  const controls = ['play', 'prev', 'next', 'shuffle', 'repeat'];
  let songs = [], index = 0, shuffled = false, repeat = 'off';
  let bag = [], history = [], request = 0, wanted = false, dragging = false;
  let databaseFailed = false;
  const time = value => {
    const seconds = Math.floor(Number.isFinite(value) ? Math.max(0, value) : 0);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  function message(text, retry = false) {
    status.textContent = text;
    el('retry').hidden = !retry;
  }
  function saveSettings() {
    try { localStorage.setItem('ml-music-settings', JSON.stringify({shuffled, repeat})); } catch {}
  }
  function syncControls() {
    const playing = !audio.paused && !audio.ended;
    el('play').setAttribute('aria-label', playing || wanted ? 'Pause' : 'Play');
    el('play-icon').src = `/images/website/icons/${playing || wanted ? 'pause' : 'play'}.png`;
    el('shuffle').classList.toggle('active', shuffled);
    el('shuffle').setAttribute('aria-pressed', String(shuffled));
    el('repeat').classList.toggle('active', repeat !== 'off');
    el('repeat').textContent = repeat === 'one' ? '↺¹' : '↺';
    el('repeat').setAttribute('aria-label', `Repeat: ${repeat}`);
    el('repeat').title = `Repeat: ${repeat}. Click to cycle off, all, one.`;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
  function progress() {
    const duration = audio.duration;
    const valid = Number.isFinite(duration) && duration > 0;
    seek.disabled = !valid;
    if (!dragging) seek.value = valid ? audio.currentTime / duration * 100 : 0;
    el('current-time').textContent = time(dragging && valid ? seek.value / 100 * duration : audio.currentTime);
    el('duration').textContent = time(duration);
    seek.setAttribute('aria-valuetext', `${el('current-time').textContent} of ${time(duration)}`);
    if (!dragging && 'mediaSession' in navigator && navigator.mediaSession.setPositionState) {
      try {
        if (valid) navigator.mediaSession.setPositionState({duration, playbackRate: audio.playbackRate, position: Math.max(0, Math.min(duration, audio.currentTime))});
        else navigator.mediaSession.setPositionState();
      } catch {}
    }
  }
  function seekTo(position, fast = false) {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !Number.isFinite(position)) return;
    dragging = false;
    const target = Math.max(0, Math.min(audio.duration, position));
    if (fast && typeof audio.fastSeek === 'function') audio.fastSeek(target);
    else audio.currentTime = target;
    progress();
  }
  function refillBag() {
    bag = songs.map((_, i) => i).filter(i => i !== index);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  function select(nextIndex, autoplay = false, record = true) {
    if (!songs[nextIndex]) return;
    if (record && nextIndex !== index) history.push(index);
    if (history.length > 100) history.shift();
    request++;
    wanted = false;
    audio.pause();
    index = nextIndex;
    dragging = false;
    bag = bag.filter(i => i !== index);
    const song = songs[index];
    el('song-title').textContent = song.title;
    el('song-artist').textContent = `${song.artist || 'Unknown artist'} · ${song.album || 'Soundtrack'}`;
    el('cover').src = song.cover || '/images/website/main-bg.png';
    el('cover').alt = `${song.title} cover`;
    audio.src = song.file;
    audio.load();
    seek.value = 0;
    progress();
    document.querySelectorAll('.song').forEach(row => {
      const active = Number(row.dataset.index) === index;
      row.classList.toggle('active', active);
      row.querySelector('button').setAttribute('aria-pressed', String(active));
      row.querySelector('.song-details').hidden = !active;
    });
    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      // Use the same track artwork in the player, playlist, and phone controls.
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title, artist: song.artist || 'Unknown artist', album: song.album || 'Soundtrack',
          artwork: [{src: new URL(el('cover').src, document.baseURI).href}]
        });
      } catch {}
    }
    message('Loading track…');
    syncControls();
    if (autoplay) play();
  }
  async function play() {
    if (!songs.length) return;
    const version = ++request;
    wanted = true;
    syncControls();
    message('Starting playback…');
    try {
      // Call directly within the user gesture; metadata need not be loaded first.
      await audio.play();
      if (version !== request) return;
      message('');
      syncControls();
    } catch (error) {
      if (version !== request) return;
      wanted = false;
      syncControls();
      message(error.name === 'NotAllowedError' ? 'Press Play to start this track.' : 'Unable to play this track. Retry or choose another song.', error.name !== 'NotAllowedError');
    }
  }
  function pause() { request++; wanted = false; audio.pause(); syncControls(); message('Paused'); }
  function toggle() { if (wanted || !audio.paused) pause(); else play(); }
  function next(ended = false) {
    if (!songs.length) return;
    let target;
    if (shuffled) {
      if (!bag.length) {
        if (ended && repeat === 'off') { wanted = false; syncControls(); message('Playlist finished'); return; }
        refillBag();
      }
      target = bag.pop() ?? index;
    } else {
      if (ended && index === songs.length - 1 && repeat === 'off') { wanted = false; syncControls(); message('Playlist finished'); return; }
      target = (index + 1) % songs.length;
    }
    select(target, ended || wanted || !audio.paused);
  }
  function previous() {
    if (!songs.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; progress(); return; }
    const target = history.pop() ?? (index - 1 + songs.length) % songs.length;
    if (shuffled && target !== index && !bag.includes(index)) bag.push(index);
    select(target, wanted || !audio.paused, false);
  }
  function buildPlaylist() {
    el('playlist').replaceChildren();
    songs.forEach((song, i) => {
      const row = document.createElement('div');
      row.className = 'song'; row.dataset.index = i;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'song-header';
      button.setAttribute('aria-label', `Play ${song.title}`);
      button.setAttribute('aria-pressed', 'false');
      const number = document.createElement('span'); number.className = 'song-number'; number.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('span'); name.className = 'song-name'; name.textContent = song.title;
      const arrow = document.createElement('span'); arrow.className = 'song-arrow'; arrow.textContent = '♪'; arrow.setAttribute('aria-hidden', 'true');
      button.append(number, name, arrow);
      const details = document.createElement('div'); details.className = 'song-details'; details.hidden = true;
      const text = document.createElement('div'); text.className = 'song-text';
      const credits = document.createElement('div'); credits.textContent = `${song.artist || 'Unknown artist'} · ${song.album || 'Soundtrack'}`;
      const description = document.createElement('small'); description.textContent = song.description || '';
      const meta = document.createElement('div'); meta.className = 'song-meta';
      const artwork = document.createElement('img');
      artwork.src = song.cover || '/images/website/main-bg.png';
      artwork.alt = `${song.title} cover`;
      artwork.loading = 'lazy'; artwork.decoding = 'async';
      artwork.width = 70; artwork.height = 70;
      text.append(credits, description); meta.append(artwork, text); details.append(meta); row.append(button, details);
      button.addEventListener('click', () => { if (i === index) toggle(); else { select(i, true); if (shuffled) refillBag(); } });
      el('playlist').append(row);
    });
    filterPlaylist();
  }
  function filterPlaylist() {
    const query = el('playlist-search').value.trim().toLocaleLowerCase();
    let count = 0;
    document.querySelectorAll('.song').forEach(row => {
      const song = songs[Number(row.dataset.index)];
      row.hidden = ![song.title, song.artist, song.album].some(value => String(value || '').toLocaleLowerCase().includes(query));
      if (!row.hidden) count++;
    });
    el('playlist-count').textContent = count ? `${count} of ${songs.length} tracks` : 'No matching tracks. Try another search.';
  }
  async function loadDatabase() {
    controls.forEach(id => el(id).disabled = true);
    message('Loading soundtrack…');
    try {
      const response = await fetch('/index/songs.json');
      if (!response.ok) throw new Error('Database unavailable');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid database');
      songs = data.filter(song => song && typeof song.title === 'string' && typeof song.file === 'string' && song.file);
      if (!songs.length) throw new Error('No tracks available');
      databaseFailed = false;
      buildPlaylist(); select(0); refillBag();
      controls.forEach(id => el(id).disabled = false);
    } catch { databaseFailed = true; message('The soundtrack could not be loaded. Please try again.', true); }
  }
  el('play').addEventListener('click', toggle);
  el('next').addEventListener('click', () => next());
  el('prev').addEventListener('click', previous);
  el('shuffle').addEventListener('click', () => { shuffled = !shuffled; refillBag(); syncControls(); saveSettings(); message(`Shuffle ${shuffled ? 'on' : 'off'}`); });
  el('repeat').addEventListener('click', () => { repeat = {off: 'all', all: 'one', one: 'off'}[repeat]; syncControls(); saveSettings(); message(`Repeat: ${repeat}`); });
  el('playlist-search').addEventListener('input', filterPlaylist);
  el('retry').addEventListener('click', () => { if (databaseFailed) loadDatabase(); else select(index, true, false); });
  seek.addEventListener('input', () => { dragging = true; progress(); });
  seek.addEventListener('change', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value) / 100 * audio.duration; dragging = false; progress(); });
  seek.addEventListener('keydown', event => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const delta = {ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5}[event.key];
    if (delta !== undefined || event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); dragging = false;
      audio.currentTime = event.key === 'Home' ? 0 : event.key === 'End' ? audio.duration : Math.max(0, Math.min(audio.duration, audio.currentTime + delta)); progress();
    }
  });
  ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked', 'ratechange', 'emptied'].forEach(event => audio.addEventListener(event, progress));
  audio.addEventListener('playing', () => { syncControls(); message(''); });
  audio.addEventListener('pause', syncControls);
  audio.addEventListener('waiting', () => { if (wanted || !audio.paused) message('Buffering…'); });
  audio.addEventListener('canplay', () => { if (!wanted) message(audio.paused ? 'Ready to play' : ''); });
  audio.addEventListener('error', () => { request++; wanted = false; syncControls(); message('This track could not be loaded. Retry or choose another song.', true); });
  audio.addEventListener('ended', () => { if (repeat === 'one') { audio.currentTime = 0; play(); } else next(true); });
  try {
    const saved = JSON.parse(localStorage.getItem('ml-music-settings') || '{}');
    shuffled = saved.shuffled === true;
    repeat = ['off', 'all', 'one'].includes(saved.repeat) ? saved.repeat : 'off';
  } catch {}
  if ('mediaSession' in navigator) {
    const offset = details => Number.isFinite(details.seekOffset) && details.seekOffset > 0 ? details.seekOffset : 10;
    const handlers = {
      play, pause, previoustrack: previous, nexttrack: () => next(),
      seekbackward: (details = {}) => seekTo(audio.currentTime - offset(details)),
      seekforward: (details = {}) => seekTo(audio.currentTime + offset(details)),
      seekto: (details = {}) => seekTo(details.seekTime, details.fastSeek === true),
      stop: () => { pause(); seekTo(0); }
    };
    Object.entries(handlers).forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler); } catch {} });
  }
  syncControls(); loadDatabase();
})();
