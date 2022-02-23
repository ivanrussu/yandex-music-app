const { app, Menu, Tray, MenuItem, ipcMain } = require("electron");
const { truncate } = require("../utils");

let tray = null;
const trackInfo = new MenuItem({ label: "  –", enabled: false });
const like = new MenuItem({
  label: "Love",
  type: "checkbox",
  enabled: false,
  click: () => playerCmd("toggleLike"),
});
const dislike = new MenuItem({
  label: "Dislike",
  type: "checkbox",
  enabled: false,
  click: () => playerCmd("toggleDislike"),
});
const play = new MenuItem({
  label: "Play",
  enabled: false,
  click: () => playerCmd("togglePause"),
});
const next = new MenuItem({
  label: "Next",
  enabled: false,
  click: () => playerCmd("next"),
});
const previous = new MenuItem({
  label: "Previous",
  enabled: false,
  click: () => playerCmd("prev"),
});
let playlistMenu = createPlayListMenuItem([]);

refreshMenu();

function buildMenu() {
  const menu = new Menu();
  menu.append(new MenuItem({ label: "Now Playing", enabled: false }));
  menu.append(trackInfo);
  menu.append(like);
  menu.append(dislike);
  menu.append(new MenuItem({ type: "separator" }));
  menu.append(play);
  menu.append(next);
  menu.append(previous);
  menu.append(new MenuItem({ type: "separator" }));
  menu.append(playlistMenu);
  return menu;
}

exports.refreshTrayMenu = () => {
  refreshMenu()
}

function refreshMenu() {
  const menu = buildMenu();

  // Update Dock
  app.dock.setMenu(menu);

  if (tray) {
    tray.showTitle = global.store.get("tray-song", false);
    tray.setTitle((tray.showTitle && play.playing && trackInfo.label) || "");
  }
}

ipcMain.on("initControls", (_event, { currentTrack, controls }) => {
  handleControlsChange(controls);
  handleTrackChange(currentTrack);

  global.store.onDidChange("tray", initTray);
  initTray(global.store.get("tray"), true);

  refreshMenu();
});

ipcMain.on("changeControls", (_event, { currentTrack, controls }) => {
  handleControlsChange(controls);
  handleTrackChange(currentTrack);

  refreshMenu();
});

ipcMain.on("changeState", (_event, { isPlaying, currentTrack }) => {
  play.label = isPlaying ? "Pause" : "Play";
  play.playing = isPlaying;
  handleTrackChange(currentTrack);

  refreshMenu();
});

ipcMain.on("changePlaylist", (_event, { currentTrack, playlist }) => {
  handleTrackChange(currentTrack);

  if (currentTrack && playlist.length > 0) {
    playlist.forEach((track, index) => {
      track.index = index;
    });
    const currentTrackIndex = playlist.findIndex((track) => {
      return track.link === currentTrack.link;
    });

    if (currentTrackIndex < 0) {
      playlist = playlist.slice(0, 10);
    } else {
      const startIndex = Math.max(currentTrackIndex - 1, 0);
      const endIndex = currentTrackIndex + 10;
      playlist = playlist.slice(startIndex, currentTrackIndex).concat(playlist.slice(currentTrackIndex, endIndex));
    }
  } else {
    playlist = [];
  }
  playlistMenu = createPlayListMenuItem(playlist, currentTrack);
  refreshMenu();
});

function playerCmd(cmd) {
  global.mainWindow.webContents.send("playerCmd", cmd);
}

function handleControlsChange(controls) {
  next.enabled = controls.next;
  previous.enabled = controls.prev;
}

function handleTrackChange(currentTrack) {
  const hasCurrentTrack = !!currentTrack;
  if (hasCurrentTrack) {
    trackInfo.label = "  " + getLabelForTrack(currentTrack);
    like.checked = currentTrack.liked;
    like.label = currentTrack.liked ? "Loved" : "Love";
    dislike.checked = currentTrack.disliked;
    dislike.label = currentTrack.disliked ? "Disliked" : "Dislike";
  }

  like.enabled = hasCurrentTrack;
  dislike.enabled = hasCurrentTrack;
  play.enabled = hasCurrentTrack;
  next.enabled = hasCurrentTrack;
  previous.enabled = hasCurrentTrack;
  if (!hasCurrentTrack) {
    trackInfo.label = "  –";
  }
}

function getLabelForTrack(track) {
  const label = track.title + " – " + track.artists.map((a) => a.title).join(", ");
  return truncate(label, global.store.get("tray-song-label-length", 35));
}

function createPlayListMenuItem(tracks, currentTrack) {
  const menu = new Menu();
  tracks.forEach((track) => {
    menu.append(
      new MenuItem({
        label: getLabelForTrack(track),
        enabled: track.link !== currentTrack.link,
        click: () => {
          global.mainWindow.webContents.send("playTrack", track.index);
        },
      })
    );
  });
  return new MenuItem({
    label: "Playlist",
    type: "submenu",
    enabled: tracks.length > 0,
    submenu: menu,
  });
}

function togglePopUp() {
  global.trayPopUpWindow.isVisible()
    ? global.trayPopUpWindow.hide()
    : showPopUp();
}

function getPopUpPosition() {
  const windowBounds = global.trayPopUpWindow.getBounds();
  const trayBounds = tray.getBounds();
  const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
  const y = Math.round(trayBounds.y + trayBounds.height);
  return {x, y};
}

function showPopUp() {
  const position = getPopUpPosition();
  global.trayPopUpWindow.setPosition(position.x, position.y, false);
  global.trayPopUpWindow.show();
  global.trayPopUpWindow.setVisibleOnAllWorkspaces(true);
  global.trayPopUpWindow.focus();
  global.trayPopUpWindow.setVisibleOnAllWorkspaces(false);
}

function initTray(trayEnabled, skipRefresh) {
  if (trayEnabled) {
    if (!tray) {
      let logo = "static/trayTemplate.png";
      if (app.isPackaged) logo = `${process.resourcesPath}/${logo}`;
      tray = new Tray(logo);
      tray.setIgnoreDoubleClickEvents(true);
      tray.on('click', togglePopUp);
    }

    tray.showTitle = global.store.get("tray-song", false);

    if (!skipRefresh) refreshMenu();
  } else if (tray) {
    tray.destroy();
    tray = null;
  }
}