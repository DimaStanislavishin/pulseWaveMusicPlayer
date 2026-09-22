const playerAppName = 'Pulse Wave';
const defaultApiHost = 'https://discoveryprovider.audius.co';
const defaultCover = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80';
let audio = null;
let progressBar = null;
let volumeBar = null;
let currentTimeText = null;
let totalTimeText = null;
let currentTitle = null;
let currentArtist = null;
let currentCover = null;
let playButton = null;
let trackList = [];
let trackIndex = 0;
let shuffleEnabled = false;
let repeatEnabled = false;
let currentTrack = null;

function getPlayerApiHost() { return window.apiHost || defaultApiHost; }
function formatPlayerTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const restSeconds = Math.floor(seconds % 60);
    return minutes + ':' + (restSeconds < 10 ? '0' : '') + restSeconds;
}
function getPlayerCover(track) {
    if (track.artwork && track.artwork['150x150']) return track.artwork['150x150'];
    return track.cover || defaultCover;
}
function getPlayerArtist(track) {
    if (track.user && track.user.name) return track.user.name;
    return track.artist || 'Невідомий';
}
function getTrackStreamUrl(track) {
    if (!track) return '';
    if (typeof track.stream === 'string') return track.stream;
    if (track.stream && track.stream.url) return track.stream.url;
    if (track.stream_url) return track.stream_url;
    if (track.id) return getPlayerApiHost() + '/v1/tracks/' + track.id + '/stream?app_name=' + encodeURIComponent(playerAppName);
    return '';
}
function findTrackByTitle(title) {
    const lowerTitle = title.toLowerCase();
    const lists = [trackList, window.localTracks || []];
    for (let listIndex = 0; listIndex < lists.length; listIndex++) {
        const list = lists[listIndex];
        for (let i = 0; i < list.length; i++) {
            if (list[i].title && list[i].title.toLowerCase() === lowerTitle) {
                trackList = list;
                trackIndex = i;
                return list[i];
            }
        }
    }
    return null;
}
function findTrack(track) {
    if (typeof track === 'string') return findTrackByTitle(track);
    if (!track) return null;
    for (let i = 0; i < trackList.length; i++) {
        const item = trackList[i];
        if ((item.id && track.id && String(item.id) === String(track.id)) ||
            (item.title && track.title && item.title.toLowerCase() === track.title.toLowerCase())) {
            trackIndex = i;
            return item;
        }
    }
    return track;
}
function updatePlayer(track) {
    if (!track) return;
    currentTitle.textContent = track.title || '';
    currentArtist.textContent = getPlayerArtist(track);
    currentCover.src = getPlayerCover(track);
}
function updatePlayIcon() {
    if (!playButton) return;
    const icon = playButton.querySelector('span');
    if (icon) icon.textContent = audio && !audio.paused ? 'pause' : 'play_arrow';
}
function playCurrentAudio() { audio.play().then(updatePlayIcon).catch(updatePlayIcon); }
function playSong(track) {
    if (!audio) initializePlayer();
    const foundTrack = findTrack(track);
    if (!foundTrack) return;
    const streamUrl = getTrackStreamUrl(foundTrack);
    if (!streamUrl) return;
    currentTrack = foundTrack;
    updatePlayer(foundTrack);
    audio.src = streamUrl;
    updateProgress();
    playCurrentAudio();
    window.dispatchEvent(new CustomEvent('trackchange', { detail: foundTrack }));
}
function getCurrentTrack() { return currentTrack; }
function togglePlay() {
    if (!audio) initializePlayer();
    if (!audio.src && trackList.length > 0) playSong(trackList[trackIndex] || trackList[0]);
    else if (audio.paused) playCurrentAudio();
    else { audio.pause(); updatePlayIcon(); }
}
function playNext() {
    if (Array.isArray(window.queueTracks) && window.queueTracks.length > 0) {
        const nextQueuedTrack = window.queueTracks.shift();
        window.dispatchEvent(new CustomEvent('queuechange'));
        playSong(nextQueuedTrack);
        return;
    }
    if (trackList.length === 0) return;
    if (shuffleEnabled && trackList.length > 1) {
        let nextIndex = trackIndex;
        while (nextIndex === trackIndex) nextIndex = Math.floor(Math.random() * trackList.length);
        trackIndex = nextIndex;
    } else trackIndex = (trackIndex + 1) % trackList.length;
    playSong(trackList[trackIndex]);
}
function playPrevious() {
    if (trackList.length === 0) return;
    if (shuffleEnabled && trackList.length > 1) {
        let previousIndex = trackIndex;
        while (previousIndex === trackIndex) previousIndex = Math.floor(Math.random() * trackList.length);
        trackIndex = previousIndex;
    } else trackIndex = (trackIndex - 1 + trackList.length) % trackList.length;
    playSong(trackList[trackIndex]);
}
function updateRangeVisual(range, value, color) {
    if (!range) return;
    const percentage = Math.max(0, Math.min(100, Number(value) || 0));
    range.value = percentage;
    range.style.background = 'linear-gradient(to right, ' + color + ' 0%, ' + color + ' ' + percentage + '%, rgba(255,255,255,0.1) ' + percentage + '%, rgba(255,255,255,0.1) 100%)';
}
function updateProgressVisual(value) { updateRangeVisual(progressBar, value, 'var(--primary-light)'); }
function updateVolumeVisual(value) { updateRangeVisual(volumeBar, value, 'var(--primary-light)'); }
function seekTrack(value) {
    if (audio && isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = audio.duration * (Number(value) / 100);
        updateProgress();
    }
}
function changeVolume(value) {
    const percentage = Math.max(0, Math.min(100, Number(value) || 0));
    if (audio) audio.volume = percentage / 100;
    updateVolumeVisual(percentage);
}
function setButtonActive(buttonId, isActive) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.style.color = isActive ? '#ff6b9d' : '';
    button.style.fontWeight = isActive ? 'bold' : '';
}
function toggleShuffle() { shuffleEnabled = !shuffleEnabled; setButtonActive('shuffle-icon', shuffleEnabled); }
function toggleRepeat() { repeatEnabled = !repeatEnabled; setButtonActive('repeat-icon', repeatEnabled); }
function updateProgress() {
    if (!audio) return;
    const duration = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (currentTrack && Number(currentTrack.duration)) || 0;
    const currentTime = isFinite(audio.currentTime) ? audio.currentTime : 0;
    updateProgressVisual(duration > 0 ? currentTime / duration * 100 : 0);
    currentTimeText.textContent = formatPlayerTime(currentTime);
    totalTimeText.textContent = formatPlayerTime(duration);
}
function onSongEnded() {
    updateProgressVisual(100);
    updatePlayIcon();
    if (repeatEnabled) { audio.currentTime = 0; playCurrentAudio(); } else playNext();
}
function setTrackList(tracks, startIndex) {
    if (!Array.isArray(tracks)) return;
    trackList = tracks;
    trackIndex = startIndex || 0;
}
function navigateTo(pageName, event) {
    if (event) event.preventDefault();
    document.querySelectorAll('.view').forEach(function(view) { view.classList.remove('active'); });
    const currentView = document.getElementById('view-' + pageName);
    if (currentView) currentView.classList.add('active');
    const buttons = document.querySelectorAll('aside nav .nav-btn');
    buttons.forEach(function(button) { button.classList.remove('active'); });
    const indexes = { home: 0, search: 1, library: 2 };
    if (buttons[indexes[pageName]]) buttons[indexes[pageName]].classList.add('active');
}
function initializePlayer() {
    audio = document.getElementById('audio');
    progressBar = document.getElementById('progress-bar');
    volumeBar = document.querySelector('.volume-controls input[type="range"]');
    currentTimeText = document.getElementById('current-time');
    totalTimeText = document.getElementById('total-time');
    currentTitle = document.getElementById('current-title');
    currentArtist = document.getElementById('current-artist');
    currentCover = document.getElementById('current-cover');
    playButton = document.getElementById('play-btn');
    if (!audio) { audio = document.createElement('audio'); audio.id = 'audio'; audio.preload = 'metadata'; document.body.appendChild(audio); }
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('seeked', updateProgress);
    audio.addEventListener('play', updatePlayIcon);
    audio.addEventListener('pause', updatePlayIcon);
    audio.addEventListener('ended', onSongEnded);
    changeVolume(volumeBar ? volumeBar.value : 75);
    updateProgress();
    updatePlayIcon();
}

/* Track actions: three-dot menu, playlists, queue and preference exclusion. */
(function() {
    const menuStyle = document.createElement('style');
    menuStyle.textContent = `
        .song-row{position:relative}.song-more-wrap{position:relative;display:flex;align-items:center;margin-left:8px}
        .song-more-btn{display:none;background:none;border:0;color:var(--text-muted);cursor:pointer;padding:6px;border-radius:50%}
        .song-row:hover .song-more-btn,.song-more-btn:focus{display:flex}.song-more-btn:hover{color:#fff;background:rgba(255,255,255,.08)}
        .song-more-menu{display:none;position:absolute;right:0;top:100%;min-width:205px;background:#29272b;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:5px;z-index:1500;box-shadow:0 10px 25px rgba(0,0,0,.45)}
        .song-more-menu.open{display:block}.song-more-menu button{display:flex;align-items:center;gap:8px;width:100%;padding:9px 10px;border:0;border-radius:5px;background:none;color:var(--text-main);cursor:pointer;text-align:left;white-space:nowrap}.song-more-menu button:hover{background:rgba(107,33,255,.25)}
        .queue-toast{position:fixed;left:50%;bottom:calc(var(--player-height) + 18px);transform:translate(-50%,20px);opacity:0;pointer-events:none;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:12px 16px;background:#29272f;border:1px solid rgba(206,189,255,.2);border-radius:10px;box-shadow:0 8px 25px rgba(0,0,0,.4);z-index:2100;transition:opacity .2s,transform .2s}.queue-toast.visible{opacity:1;transform:translate(-50%,0);pointer-events:auto}.queue-toast-link{color:var(--primary-light);font-weight:600;text-decoration:underline;cursor:pointer;border:0;background:none;padding:0;font:inherit}.queue-toast-close{border:0;background:none;color:var(--text-muted);cursor:pointer;font-size:18px}
        .queue-panel-backdrop{position:fixed;inset:0;z-index:2050;background:rgba(0,0,0,.58);display:flex;align-items:flex-end;justify-content:center;padding:0 16px 112px}.queue-panel{width:min(620px,100%);max-height:min(70vh,620px);overflow:auto;background:var(--surface-color);border:1px solid rgba(255,255,255,.1);border-radius:16px 16px 10px 10px;box-shadow:0 15px 45px rgba(0,0,0,.55);padding:20px}.queue-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.queue-panel-header h2{font-size:20px}.queue-panel-close,.queue-clear{border:0;background:none;color:var(--text-muted);cursor:pointer}.queue-clear:hover,.queue-panel-close:hover{color:#fff}.queue-empty{padding:30px 10px;text-align:center;color:var(--text-muted)}.queue-item{display:flex;align-items:center;gap:12px;padding:9px;border-radius:9px}.queue-item:hover{background:rgba(255,255,255,.05)}.queue-item img{width:44px;height:44px;object-fit:cover;border-radius:6px}.queue-item-info{flex:1;min-width:0}.queue-item-title,.queue-item-artist{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.queue-item-title{font-weight:600}.queue-item-artist{font-size:13px;color:var(--text-muted)}.queue-item-play,.queue-item-remove{border:0;background:none;color:var(--text-muted);cursor:pointer;padding:6px}.queue-item-play:hover{color:var(--primary-light)}.queue-item-remove:hover{color:#ff6b9d}
    `;
    document.head.appendChild(menuStyle);
    let queue = [];
    let toastTimer = null;

    function read(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value !== null && typeof value === 'object' ? value : fallback; } catch (error) { return fallback; } }
    function sameTrack(first, second) { return first && second && ((first.id && second.id && String(first.id) === String(second.id)) || first.title === second.title); }
    function savePlaylists(playlists) { localStorage.setItem('pulseWavePlaylists', JSON.stringify(playlists)); }
    function addToPlaylist(track) {
        if (window.openPlaylistPicker) { window.openPlaylistPicker(track); return; }
        const playlists = read('pulseWavePlaylists', {}); const names = Object.keys(playlists);
        const requested = window.prompt(names.length ? 'Введите название плейлиста (существующий или новый):' : 'Введите название нового плейлиста:');
        if (!requested || !requested.trim()) return;
        const name = requested.trim(); if (!Array.isArray(playlists[name])) playlists[name] = [];
        if (!playlists[name].some(function(item) { return sameTrack(item, track); })) playlists[name].push(track);
        savePlaylists(playlists); window.alert('Трек добавлен в плейлист «' + name + '»');
    }
    function renderQueuePanel() {
        const list = document.querySelector('.queue-panel-list'); if (!list) return;
        list.innerHTML = '';
        if (!queue.length) { list.innerHTML = '<div class="queue-empty">Очередь пуста</div>'; return; }
        queue.forEach(function(track, index) {
            const item = document.createElement('div'); item.className = 'queue-item';
            item.innerHTML = '<img><div class="queue-item-info"><span class="queue-item-title"></span><span class="queue-item-artist"></span></div><button class="queue-item-play" title="Слушать сейчас"></span></button><button class="queue-item-remove" title="Удалить"><span class="material-symbols-outlined">close</span></button>';
            item.querySelector('img').src = getPlayerCover(track); item.querySelector('.queue-item-title').textContent = track.title || 'Без названия'; item.querySelector('.queue-item-artist').textContent = getPlayerArtist(track);
            item.querySelector('.queue-item-play').addEventListener('click', function() { queue.splice(index, 1); window.queueTracks = queue; renderQueuePanel(); playSong(track); });
            item.querySelector('.queue-item-remove').addEventListener('click', function() { queue.splice(index, 1); window.queueTracks = queue; renderQueuePanel(); });
            list.appendChild(item);
        });
    }
    function openQueuePanel() {
        closeQueuePanel();
        const backdrop = document.createElement('div'); backdrop.className = 'queue-panel-backdrop';
        backdrop.innerHTML = '<section class="queue-panel" role="dialog" aria-modal="true" aria-labelledby="queue-title"><div class="queue-panel-header"><h2 id="queue-title">Следующие треки</h2><div><button class="queue-clear" type="button">Очистить</button><button class="queue-panel-close" type="button" aria-label="Закрыть"><span class="material-symbols-outlined">close</span></button></div></div><div class="queue-panel-list"></div></section>';
        document.body.appendChild(backdrop); renderQueuePanel();
        backdrop.querySelector('.queue-panel-close').addEventListener('click', closeQueuePanel);
        backdrop.querySelector('.queue-clear').addEventListener('click', function() { queue.length = 0; window.queueTracks = queue; renderQueuePanel(); });
        backdrop.addEventListener('click', function(event) { if (event.target === backdrop) closeQueuePanel(); });
    }
    function closeQueuePanel() { const old = document.querySelector('.queue-panel-backdrop'); if (old) old.remove(); }
    function showQueueToast(track) {
        let toast = document.querySelector('.queue-toast');
        if (!toast) { toast = document.createElement('div'); toast.className = 'queue-toast'; document.body.appendChild(toast); }
        toast.innerHTML = '<span>«' + (track.title || 'Трек') + '» добавлен в очередь</span><button class="queue-toast-link" type="button">Открыть список очередей</button><button class="queue-toast-close" type="button" aria-label="Закрыть">×</button>';
        toast.classList.add('visible');
        toast.querySelector('.queue-toast-link').addEventListener('click', openQueuePanel);
        toast.querySelector('.queue-toast-close').addEventListener('click', function() { toast.classList.remove('visible'); });
        clearTimeout(toastTimer); toastTimer = setTimeout(function() { toast.classList.remove('visible'); }, 5000);
    }
    function addToQueue(track) {
        if (!queue.some(function(item) { return sameTrack(item, track); })) { queue.push(track); window.queueTracks = queue; }
        showQueueToast(track);
    }
    function excludeFromPreferences(track, row) { const excluded = read('pulseWaveExcludedTracks', []); if (!excluded.some(function(item) { return sameTrack(item, track); })) excluded.push(track); localStorage.setItem('pulseWaveExcludedTracks', JSON.stringify(excluded)); row.remove(); }
    function closeMenus() { document.querySelectorAll('.song-more-menu.open').forEach(function(menu) { menu.classList.remove('open'); }); }
    function getTrackFromRow(row) {
        const title = row.querySelector('.song-title'); const artist = row.querySelector('.song-artist'); if (!title) return null;
        const lists = [window.localTracks || [], window.activeTracks || []];
        for (let i = 0; i < lists.length; i++) { const found = lists[i].find(function(item) { return item.title === title.textContent && (!artist || getPlayerArtist(item) === artist.textContent); }); if (found) return found; }
        return { title: title.textContent, artist: artist ? artist.textContent : '' };
    }
    function enhanceRow(row) {
        if (row.querySelector('.song-more-wrap')) return;
        const track = getTrackFromRow(row); if (!track) return;
        const wrap = document.createElement('div'); wrap.className = 'song-more-wrap';
        const button = document.createElement('button'); button.className = 'song-more-btn'; button.type = 'button'; button.title = 'Действия с треком'; button.setAttribute('aria-label', 'Действия с треком'); button.innerHTML = '<span class="material-symbols-outlined">more_vert</span>';
        const menu = document.createElement('div'); menu.className = 'song-more-menu';
        [['playlist_add', 'Добавить в плейлист', function() { addToPlaylist(track); }], ['queue_music', 'Добавить в очередь', function() { addToQueue(track); }], ['block', 'Не рекомендовать', function() { excludeFromPreferences(track, row); }]].forEach(function(item) {
            const action = document.createElement('button'); action.type = 'button'; action.innerHTML = '<span class="material-symbols-outlined">' + item[0] + '</span> ' + item[1];
            action.addEventListener('click', function(event) { event.stopPropagation(); item[2](); closeMenus(); }); menu.appendChild(action);
        });
        button.addEventListener('click', function(event) { event.stopPropagation(); const wasOpen = menu.classList.contains('open'); closeMenus(); if (!wasOpen) menu.classList.add('open'); });
        wrap.appendChild(button); wrap.appendChild(menu); row.appendChild(wrap);
    }
    function enhanceRows() { document.querySelectorAll('.song-row').forEach(enhanceRow); }
    document.addEventListener('click', function(event) { if (!event.target.closest('.song-more-wrap')) closeMenus(); });
    window.addEventListener('queuechange', function() { const panel = document.querySelector('.queue-panel'); if (panel) renderQueuePanel(); });
    document.addEventListener('DOMContentLoaded', function() {
        enhanceRows();
        const observer = new MutationObserver(enhanceRows);
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    });
})();

document.addEventListener('DOMContentLoaded', initializePlayer);
window.playSong = playSong;
window.togglePlay = togglePlay;
window.playNext = playNext;
window.playPrevious = playPrevious;
window.seekTrack = seekTrack;
window.changeVolume = changeVolume;
window.setTrackList = setTrackList;
window.navigateTo = navigateTo;
window.toggleShuffle = toggleShuffle;
window.toggleRepeat = toggleRepeat;
window.getCurrentTrack = getCurrentTrack;
