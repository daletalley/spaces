(() => {
  "use strict";

  const LS_KEY = "spaces_v1";
  const LEGACY_KEYS = ["workspace_switcher_v1"];
  const now = () => Date.now();

  const defaultSettings = {
    openMode: "tabs",
    confirmOpenAll: true,
    maxOpenAll: 24,
    openDelayMs: 80
  };

  const el = {
    folderList: document.getElementById("folderList"),
    folderCount: document.getElementById("folderCount"),
    activeFolderName: document.getElementById("activeFolderName"),
    activeFolderLinks: document.getElementById("activeFolderLinks"),
    itemsGrid: document.getElementById("itemsGrid"),
    emptyState: document.getElementById("emptyState"),
    searchInput: document.getElementById("searchInput"),
    btnNewFolder: document.getElementById("btnNewFolder"),
    btnNewLink: document.getElementById("btnNewLink"),
    btnIO: document.getElementById("btnIO"),
    btnSettings: document.getElementById("btnSettings"),
    btnOpenAll: document.getElementById("btnOpenAll"),
    btnFolderEdit: document.getElementById("btnFolderEdit"),
    btnFolderDelete: document.getElementById("btnFolderDelete"),
    toast: document.getElementById("toast"),

    modalBg: document.getElementById("modalBg"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalFoot: document.getElementById("modalFoot"),
    modalClose: document.getElementById("modalClose")
  };

  let state = loadState();
  saveState({ silent: true });

  function createId() {
    return crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(16).slice(2) + "-" + now());
  }

  function seedData() {
    const id = createId;
    const work = id();
    const life = id();
    const learn = id();

    return {
      version: 1,
      settings: { ...defaultSettings },
      activeFolderId: work,
      folders: [
        {
          id: work,
          name: "Work",
          emoji: "🧠",
          createdAt: now(),
          order: 0,
          links: [
            { id: id(), title: "Email", url: "https://mail.google.com/", createdAt: now(), order: 0 },
            { id: id(), title: "Calendar", url: "https://calendar.google.com/", createdAt: now(), order: 1 },
            { id: id(), title: "GitHub", url: "https://github.com/", createdAt: now(), order: 2 }
          ]
        },
        {
          id: life,
          name: "Life",
          emoji: "✨",
          createdAt: now(),
          order: 1,
          links: [
            { id: id(), title: "YouTube", url: "https://www.youtube.com/", createdAt: now(), order: 0 },
            { id: id(), title: "Spotify", url: "https://open.spotify.com/", createdAt: now(), order: 1 }
          ]
        },
        {
          id: learn,
          name: "Learn",
          emoji: "📚",
          createdAt: now(),
          order: 2,
          links: [
            { id: id(), title: "MDN", url: "https://developer.mozilla.org/", createdAt: now(), order: 0 },
            { id: id(), title: "Stack Overflow", url: "https://stackoverflow.com/", createdAt: now(), order: 1 }
          ]
        }
      ]
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return normalizeState(data);
      }

      for (const key of LEGACY_KEYS) {
        const legacyRaw = localStorage.getItem(key);
        if (!legacyRaw) continue;
        const legacyData = JSON.parse(legacyRaw);
        return normalizeState(legacyData);
      }

      return seedData();
    } catch (err) {
      return seedData();
    }
  }

  function saveState({ silent = false } = {}) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (err) {
      if (!silent) {
        notify("Unable to save changes. Check localStorage permissions.");
      }
    }
  }

  function normalizeState(data) {
    if (!data || typeof data !== "object") {
      return seedData();
    }

    const settings = normalizeSettings(data.settings || {});
    const rawFolders = Array.isArray(data.folders) ? data.folders : [];
    const folders = rawFolders.map((folder, index) => normalizeFolder(folder, index)).filter(Boolean);

    ensureUniqueFolderIds(folders);
    folders.forEach((folder) => ensureUniqueLinkIds(folder));

    const activeFolderId = folders.find((f) => f.id === data.activeFolderId)?.id || (folders[0]?.id ?? null);

    const normalized = {
      version: 1,
      settings,
      activeFolderId,
      folders
    };

    normalizeOrders(normalized);
    return normalized;
  }

  function normalizeSettings(raw) {
    const openMode = raw.openMode === "window" ? "window" : "tabs";
    const confirmOpenAll = Boolean(raw.confirmOpenAll);
    const maxOpenAll = clampInt(raw.maxOpenAll, 1, 100, defaultSettings.maxOpenAll);
    const openDelayMs = clampInt(raw.openDelayMs, 0, 2000, defaultSettings.openDelayMs);
    return { openMode, confirmOpenAll, maxOpenAll, openDelayMs };
  }

  function normalizeFolder(raw, fallbackOrder) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const id = typeof raw.id === "string" && raw.id ? raw.id : createId();
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Untitled";
    const emoji = clipGraphemes(typeof raw.emoji === "string" ? raw.emoji.trim() : "📁", 4) || "📁";
    const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : now();
    const order = typeof raw.order === "number" ? raw.order : fallbackOrder;
    const linksRaw = Array.isArray(raw.links) ? raw.links : [];
    const links = linksRaw.map((link, index) => normalizeLink(link, index)).filter(Boolean);

    return { id, name, emoji, createdAt, order, links };
  }

  function normalizeLink(raw, fallbackOrder) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const id = typeof raw.id === "string" && raw.id ? raw.id : createId();
    const url = typeof raw.url === "string" ? safeUrl(raw.url.trim()) : null;
    if (!url) {
      return null;
    }
    const titleRaw = typeof raw.title === "string" ? raw.title.trim() : "";
    const title = titleRaw || domainOf(url) || "Untitled";
    const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : now();
    const order = typeof raw.order === "number" ? raw.order : fallbackOrder;

    return { id, title, url, createdAt, order };
  }

  function ensureUniqueFolderIds(folders) {
    const seen = new Set();
    folders.forEach((folder) => {
      if (seen.has(folder.id)) {
        folder.id = createId();
      }
      seen.add(folder.id);
    });
  }

  function ensureUniqueLinkIds(folder) {
    const seen = new Set();
    folder.links.forEach((link) => {
      if (seen.has(link.id)) {
        link.id = createId();
      }
      seen.add(link.id);
    });
  }

  function byOrder(a, b) {
    return (a.order ?? 0) - (b.order ?? 0);
  }

  function normalizeOrders(target = state) {
    const folders = [...target.folders].sort(byOrder);
    folders.forEach((folder, index) => {
      folder.order = index;
      const links = [...(folder.links || [])].sort(byOrder);
      links.forEach((link, linkIndex) => {
        link.order = linkIndex;
      });
      folder.links = links;
    });
    target.folders = folders;
  }

  function activeFolder() {
    const match = state.folders.find((f) => f.id === state.activeFolderId);
    if (match) return match;
    return state.folders[0] || null;
  }

  function setActiveFolder(folderId) {
    state.activeFolderId = folderId;
    saveState();
    render();
  }

  function safeUrl(input) {
    if (!input) return null;
    const trimmed = input.trim();
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
    const candidate = hasScheme ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(candidate);
      const allowed = ["http:", "https:", "mailto:"];
      if (!allowed.includes(url.protocol)) return null;
      return url.toString();
    } catch (err) {
      return null;
    }
  }

  function domainOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (err) {
      return "";
    }
  }

  function clipGraphemes(value, limit) {
    return Array.from(value).slice(0, limit).join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function notify(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.dataset.show = "true";
    window.clearTimeout(notify._timer);
    notify._timer = window.setTimeout(() => {
      el.toast.dataset.show = "false";
    }, 2200);
  }

  function isTextInput(target) {
    if (!target) return false;
    const tag = target.tagName ? target.tagName.toLowerCase() : "";
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }

  function openModal({ title, body, footer }) {
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = "";
    el.modalFoot.innerHTML = "";
    el.modalBody.appendChild(body);
    footer.forEach((btn) => el.modalFoot.appendChild(btn));
    el.modalBg.dataset.open = "true";
  }

  function closeModal() {
    el.modalBg.dataset.open = "false";
    el.modalBody.innerHTML = "";
    el.modalFoot.innerHTML = "";
  }

  function mkButton(label, { cls = "", onClick }) {
    const button = document.createElement("button");
    button.textContent = label;
    button.className = cls;
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  el.modalClose.addEventListener("click", closeModal);
  el.modalBg.addEventListener("click", (event) => {
    if (event.target === el.modalBg) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.modalBg.dataset.open === "true") {
      closeModal();
    }
    if (event.key === "/" && !isTextInput(document.activeElement)) {
      event.preventDefault();
      el.searchInput.focus();
    }
  });

  function showFolderModal(folder) {
    const isEdit = Boolean(folder);
    const draft = folder ? { ...folder } : { id: createId(), name: "", emoji: "📁" };

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="form">
        <div>
          <label>Space name</label>
          <input id="f_name" placeholder="e.g., Work, School, Morning" value="${escapeHtml(draft.name || "")}">
        </div>
        <div>
          <label>Emoji</label>
          <input id="f_emoji" placeholder="e.g., 🧠" value="${escapeHtml(draft.emoji || "📁")}">
        </div>
        <div class="full tiny">
          Tip: keep spaces simple so “Open all” stays quick and predictable.
        </div>
      </div>
    `;

    const btnCancel = mkButton("Cancel", { cls: "ghost", onClick: closeModal });
    const btnSave = mkButton(isEdit ? "Save changes" : "Create space", {
      cls: "primary",
      onClick: () => {
        const nameInput = wrap.querySelector("#f_name");
        const emojiInput = wrap.querySelector("#f_emoji");
        const name = nameInput.value.trim();
        const emoji = clipGraphemes(emojiInput.value.trim() || "📁", 4) || "📁";

        if (!name) {
          alert("Space name is required.");
          nameInput.focus();
          return;
        }

        if (isEdit) {
          const target = state.folders.find((item) => item.id === folder.id);
          if (!target) return;
          target.name = name;
          target.emoji = emoji;
        } else {
          const maxOrder = Math.max(-1, ...state.folders.map((item) => item.order ?? 0));
          state.folders.push({
            id: draft.id,
            name,
            emoji,
            createdAt: now(),
            order: maxOrder + 1,
            links: []
          });
          state.activeFolderId = draft.id;
        }

        normalizeOrders();
        saveState();
        render();
        closeModal();
      }
    });

    openModal({ title: isEdit ? "Edit space" : "New space", body: wrap, footer: [btnCancel, btnSave] });
    setTimeout(() => wrap.querySelector("#f_name").focus(), 30);
  }

  function deleteFolder(folderId) {
    const folder = state.folders.find((item) => item.id === folderId);
    if (!folder) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="tiny">
        Delete <b>${escapeHtml(folder.name)}</b> and its <b>${(folder.links || []).length}</b> link(s)?
        <div class="hr"></div>
        This cannot be undone (unless you export first).
      </div>
    `;

    const btnCancel = mkButton("Cancel", { cls: "ghost", onClick: closeModal });
    const btnDelete = mkButton("Delete", {
      cls: "danger",
      onClick: () => {
        state.folders = state.folders.filter((item) => item.id !== folderId);
        normalizeOrders();
        state.activeFolderId = state.folders[0]?.id ?? null;
        saveState();
        render();
        closeModal();
      }
    });

    openModal({ title: "Delete space", body: wrap, footer: [btnCancel, btnDelete] });
  }

  function showLinkModal(link) {
    const folder = activeFolder();
    if (!folder) {
      alert("Create a space first.");
      return;
    }

    const isEdit = Boolean(link);
    const draft = link ? { ...link } : { id: createId(), title: "", url: "" };

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="form">
        <div class="full">
          <label>Title</label>
          <input id="l_title" placeholder="e.g., Gmail, Jira, Canvas" value="${escapeHtml(draft.title || "")}">
        </div>
        <div class="full">
          <label>URL</label>
          <input id="l_url" placeholder="https://…" value="${escapeHtml(draft.url || "")}">
        </div>
        <div class="full tiny">
          Tip: you can paste “google.com” and spaces will fix it to https://google.com
        </div>
      </div>
    `;

    const btnCancel = mkButton("Cancel", { cls: "ghost", onClick: closeModal });
    const btnSave = mkButton(isEdit ? "Save changes" : "Add link", {
      cls: "primary",
      onClick: () => {
        const titleInput = wrap.querySelector("#l_title");
        const urlInput = wrap.querySelector("#l_url");

        const title = titleInput.value.trim();
        const urlRaw = urlInput.value.trim();
        const url = safeUrl(urlRaw);

        if (!title) {
          alert("Title is required.");
          titleInput.focus();
          return;
        }
        if (!url) {
          alert("Enter a valid URL (http, https, or mailto).");
          urlInput.focus();
          return;
        }

        if (isEdit) {
          const target = folder.links.find((item) => item.id === link.id);
          if (!target) return;
          target.title = title;
          target.url = url;
        } else {
          const maxOrder = Math.max(-1, ...(folder.links || []).map((item) => item.order ?? 0));
          folder.links.push({
            id: draft.id,
            title,
            url,
            createdAt: now(),
            order: maxOrder + 1
          });
        }

        normalizeOrders();
        saveState();
        render();
        closeModal();
      }
    });

    openModal({ title: isEdit ? "Edit link" : `New link → ${folder.name}`, body: wrap, footer: [btnCancel, btnSave] });
    setTimeout(() => wrap.querySelector("#l_title").focus(), 30);
  }

  function deleteLink(linkId) {
    const folder = activeFolder();
    if (!folder) return;
    folder.links = (folder.links || []).filter((item) => item.id !== linkId);
    normalizeOrders();
    saveState();
    render();
  }

  async function openAllInFolder() {
    const folder = activeFolder();
    if (!folder) return;

    const links = (folder.links || []).sort(byOrder).filter((link) => safeUrl(link.url));
    if (!links.length) {
      alert("No valid links in this space.");
      return;
    }

    const settings = normalizeSettings(state.settings || {});
    const cap = Math.max(1, settings.maxOpenAll || 24);
    const toOpen = links.slice(0, cap);

    if (settings.confirmOpenAll) {
      const ok = confirm(`Open ${toOpen.length}${links.length > cap ? " (capped)" : ""} tabs from \"${folder.name}\"?`);
      if (!ok) return;
    }

    if (settings.openMode === "window") {
      const first = toOpen[0];
      const win = window.open(first.url, "_blank");
      if (!win) {
        alert("Popup blocked. Allow popups or switch to tabs mode in Settings.");
        return;
      }
      for (let i = 1; i < toOpen.length; i++) {
        await sleep(settings.openDelayMs || 80);
        try {
          win.open(toOpen[i].url, "_blank");
        } catch (err) {
          window.open(toOpen[i].url, "_blank");
        }
      }
      return;
    }

    let opened = 0;
    for (const item of toOpen) {
      const win = window.open(item.url, "_blank");
      if (!win && opened === 0) {
        alert("Popup blocked. Allow popups or reduce open settings.");
        return;
      }
      opened += 1;
      await sleep(settings.openDelayMs || 80);
    }
  }

  function openOne(url) {
    const safe = safeUrl(url);
    if (!safe) {
      notify("That link is not valid anymore.");
      return;
    }
    window.open(safe, "_blank");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showImportExport() {
    const wrap = document.createElement("div");
    const data = JSON.stringify(state, null, 2);

    wrap.innerHTML = `
      <div class="tiny">
        Export your setup for backups or new devices. Import replaces your current data.
      </div>
      <div class="hr"></div>
      <label>Export (copy this)</label>
      <textarea id="io_area">${escapeHtml(data)}</textarea>
      <div class="hr"></div>
      <div class="tiny">
        Import: paste JSON above, then click “Import”.
      </div>
    `;

    const btnClose = mkButton("Close", { cls: "ghost", onClick: closeModal });
    const btnCopy = mkButton("Copy export", {
      cls: "",
      onClick: async () => {
        const area = wrap.querySelector("#io_area");
        area.select();
        try {
          await navigator.clipboard.writeText(area.value);
          notify("Export copied to clipboard.");
        } catch (err) {
          document.execCommand("copy");
          notify("Export copied.");
        }
      }
    });
    const btnImport = mkButton("Import (replace)", {
      cls: "primary",
      onClick: () => {
        const txt = wrap.querySelector("#io_area").value.trim();
        try {
          const obj = JSON.parse(txt);
          state = normalizeState(obj);
          saveState();
          render();
          closeModal();
          notify("Import complete.");
        } catch (err) {
          alert("Import failed. Paste valid JSON from an export.");
        }
      }
    });

    openModal({ title: "Import / Export", body: wrap, footer: [btnClose, btnCopy, btnImport] });
    setTimeout(() => wrap.querySelector("#io_area").focus(), 30);
  }

  function showSettings() {
    const settings = normalizeSettings(state.settings || {});

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="form">
        <div>
          <label>Open mode</label>
          <select id="s_mode">
            <option value="tabs">New tabs</option>
            <option value="window">New window</option>
          </select>
        </div>
        <div>
          <label>Confirm “Open all”</label>
          <select id="s_confirm">
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
        </div>
        <div>
          <label>Safety cap (max tabs)</label>
          <input id="s_cap" type="number" min="1" max="100" value="${settings.maxOpenAll}">
        </div>
        <div>
          <label>Open delay (ms)</label>
          <input id="s_delay" type="number" min="0" max="2000" value="${settings.openDelayMs}">
        </div>
        <div class="full tiny">
          Note: browsers may block popups if you open many links too fast or without a click.
        </div>
      </div>
    `;

    wrap.querySelector("#s_mode").value = settings.openMode;
    wrap.querySelector("#s_confirm").value = String(Boolean(settings.confirmOpenAll));

    const btnClose = mkButton("Close", { cls: "ghost", onClick: closeModal });
    const btnSave = mkButton("Save settings", {
      cls: "primary",
      onClick: () => {
        const openMode = wrap.querySelector("#s_mode").value;
        const confirmOpenAll = wrap.querySelector("#s_confirm").value === "true";
        const maxOpenAll = clampInt(wrap.querySelector("#s_cap").value, 1, 100, defaultSettings.maxOpenAll);
        const openDelayMs = clampInt(wrap.querySelector("#s_delay").value, 0, 2000, defaultSettings.openDelayMs);

        state.settings = { openMode, confirmOpenAll, maxOpenAll, openDelayMs };
        saveState();
        closeModal();
        notify("Settings saved.");
      }
    });

    openModal({ title: "Settings", body: wrap, footer: [btnClose, btnSave] });
  }

  function clampInt(value, min, max, fallback) {
    const number = parseInt(value, 10);
    if (Number.isNaN(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  let drag = { type: null, folderId: null, linkId: null };

  function onFolderDragStart(event, folderId) {
    drag = { type: "folder", folderId, linkId: null };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", folderId);
  }

  function onFolderDrop(event, targetFolderId) {
    event.preventDefault();
    if (drag.type !== "folder" || drag.folderId === targetFolderId) return;

    const list = [...state.folders].sort(byOrder);
    const from = list.findIndex((folder) => folder.id === drag.folderId);
    const to = list.findIndex((folder) => folder.id === targetFolderId);
    if (from < 0 || to < 0) return;

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    list.forEach((folder, index) => {
      folder.order = index;
    });

    state.folders = list;
    saveState();
    render();
  }

  function onLinkDragStart(event, linkId) {
    const folder = activeFolder();
    if (!folder) return;
    drag = { type: "link", folderId: folder.id, linkId };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", linkId);
  }

  function onLinkDrop(event, targetLinkId) {
    event.preventDefault();
    if (drag.type !== "link" || drag.linkId === targetLinkId) return;

    const folder = activeFolder();
    if (!folder || folder.id !== drag.folderId) return;

    const list = [...(folder.links || [])].sort(byOrder);
    const from = list.findIndex((link) => link.id === drag.linkId);
    const to = list.findIndex((link) => link.id === targetLinkId);
    if (from < 0 || to < 0) return;

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    list.forEach((link, index) => {
      link.order = index;
    });
    folder.links = list;

    saveState();
    render();
  }

  function render() {
    normalizeOrders();

    const folders = [...state.folders].sort(byOrder);
    el.folderCount.textContent = String(folders.length);
    el.folderList.innerHTML = "";

    folders.forEach((folder) => {
      const node = document.createElement("div");
      node.className = "folder";
      node.draggable = true;
      node.dataset.active = String(folder.id === state.activeFolderId);
      node.setAttribute("role", "listitem");
      node.addEventListener("click", () => setActiveFolder(folder.id));
      node.addEventListener("dragstart", (event) => onFolderDragStart(event, folder.id));
      node.addEventListener("dragover", (event) => event.preventDefault());
      node.addEventListener("drop", (event) => onFolderDrop(event, folder.id));

      const left = document.createElement("div");
      left.className = "folderLeft";
      left.innerHTML = `
        <div class="emoji">${escapeHtml(folder.emoji || "📁")}</div>
        <div class="folderText">
          <p class="folderName">${escapeHtml(folder.name || "Untitled")}</p>
          <div class="folderMeta">${(folder.links || []).length} link(s)</div>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "folderActions";

      const openBtn = document.createElement("button");
      openBtn.className = "iconBtn primary";
      openBtn.textContent = "Open";
      openBtn.title = "Open all links";
      openBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        setActiveFolder(folder.id);
        openAllInFolder();
      });

      const editBtn = document.createElement("button");
      editBtn.className = "iconBtn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        showFolderModal(folder);
      });

      actions.appendChild(openBtn);
      actions.appendChild(editBtn);

      node.appendChild(left);
      node.appendChild(actions);
      el.folderList.appendChild(node);
    });

    const active = activeFolder();
    el.activeFolderName.textContent = active ? active.name : "—";
    el.activeFolderLinks.textContent = String(active ? (active.links || []).length : 0);

    el.btnOpenAll.disabled = !active || !(active.links || []).length;
    el.btnFolderEdit.disabled = !active;
    el.btnFolderDelete.disabled = !active;

    el.itemsGrid.innerHTML = "";
    const query = (el.searchInput.value || "").trim().toLowerCase();

    if (!active) {
      el.emptyState.style.display = "block";
      el.emptyState.innerHTML = "No spaces yet. Click <b>New space</b> to start.";
      return;
    }

    const links = (active.links || []).sort(byOrder);
    const filtered = links.filter((link) => {
      if (!query) return true;
      const hay = `${link.title} ${link.url} ${domainOf(link.url)}`.toLowerCase();
      return hay.includes(query);
    });

    if (!filtered.length) {
      el.emptyState.style.display = "block";
      el.emptyState.innerHTML = query
        ? `No results for <span class="kbd">${escapeHtml(query)}</span> in <b>${escapeHtml(active.name)}</b>.`
        : `No links in <b>${escapeHtml(active.name)}</b> yet.<br><br>
           Click <b>New link</b> or press <span class="kbd">/</span> to search.`;
    } else {
      el.emptyState.style.display = "none";
    }

    filtered.forEach((link) => {
      const card = document.createElement("div");
      card.className = "card";
      card.draggable = true;

      card.addEventListener("dragstart", (event) => onLinkDragStart(event, link.id));
      card.addEventListener("dragover", (event) => event.preventDefault());
      card.addEventListener("drop", (event) => onLinkDrop(event, link.id));

      const tag = domainOf(link.url) || "link";

      card.innerHTML = `
        <div class="cardTop">
          <div style="min-width:0">
            <p class="title">${escapeHtml(link.title)}</p>
            <p class="url">${escapeHtml(link.url)}</p>
          </div>
        </div>
        <div class="tag">${escapeHtml(tag)}</div>
        <div class="cardActions">
          <button class="primary" data-act="open" type="button">Open</button>
          <button data-act="edit" type="button">Edit</button>
          <button class="danger" data-act="del" type="button">Delete</button>
        </div>
      `;

      card.querySelector('[data-act="open"]').addEventListener("click", () => openOne(link.url));
      card.querySelector('[data-act="edit"]').addEventListener("click", () => showLinkModal(link));
      card.querySelector('[data-act="del"]').addEventListener("click", () => deleteLink(link.id));

      el.itemsGrid.appendChild(card);
    });
  }

  el.btnNewFolder.addEventListener("click", () => showFolderModal(null));
  el.btnNewLink.addEventListener("click", () => showLinkModal(null));
  el.btnIO.addEventListener("click", showImportExport);
  el.btnSettings.addEventListener("click", showSettings);

  el.btnOpenAll.addEventListener("click", openAllInFolder);
  el.btnFolderEdit.addEventListener("click", () => {
    const folder = activeFolder();
    if (!folder) return;
    showFolderModal(folder);
  });
  el.btnFolderDelete.addEventListener("click", () => {
    const folder = activeFolder();
    if (!folder) return;
    deleteFolder(folder.id);
  });

  el.searchInput.addEventListener("input", render);

  render();
})();
