// ==========================================================================
// Command Bar — Quick actions (Cmd+K style)
// ==========================================================================

let isOpen = false;
let commands = [];
let filteredCommands = [];
let selectedIndex = 0;

export function initCommandBar(commandList) {
  commands = commandList;
  filteredCommands = [...commands];

  // Keyboard shortcut: Cmd+K (Mac) or Ctrl+K
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      toggleCommandBar();
    }
    if (e.key === "Escape" && isOpen) {
      closeCommandBar();
    }
  });
}

function toggleCommandBar() {
  if (isOpen) {
    closeCommandBar();
  } else {
    openCommandBar();
  }
}

function openCommandBar() {
  const bar = document.getElementById("command_bar");
  const overlay = document.getElementById("command_overlay");
  const input = document.getElementById("command_input");
  if (!bar) return;

  isOpen = true;
  filteredCommands = [...commands];
  selectedIndex = 0;

  bar.classList.remove("hidden");
  overlay?.classList.remove("hidden");
  bar.classList.add("command-bar-enter");

  if (input) {
    input.value = "";
    input.focus();
  }

  renderCommandResults();

  // Wire events fresh
  input?.removeEventListener("input", onInput);
  input?.addEventListener("input", onInput);
  input?.removeEventListener("keydown", onKeydown);
  input?.addEventListener("keydown", onKeydown);
  overlay?.removeEventListener("click", closeCommandBar);
  overlay?.addEventListener("click", closeCommandBar);
}

export function closeCommandBar() {
  const bar = document.getElementById("command_bar");
  const overlay = document.getElementById("command_overlay");
  if (!bar) return;

  bar.classList.remove("command-bar-enter");
  bar.classList.add("command-bar-exit");

  setTimeout(() => {
    bar.classList.add("hidden");
    bar.classList.remove("command-bar-exit");
    overlay?.classList.add("hidden");
    isOpen = false;
  }, 150);
}

function onInput(e) {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    filteredCommands = [...commands];
  } else {
    filteredCommands = commands.filter(cmd =>
      fuzzyMatch(cmd.label, query) ||
      fuzzyMatch(cmd.description, query) ||
      fuzzyMatch(cmd.shortcut, query) ||
      fuzzyMatch(cmd.category, query)
    );
  }
  selectedIndex = 0;
  renderCommandResults();
}

function fuzzyMatch(text, query) {
  if (!text) return false;
  const source = text.toLowerCase();
  if (source.includes(query)) return true;

  let qi = 0;
  for (let i = 0; i < source.length && qi < query.length; i++) {
    if (source[i] === query[qi]) qi++;
  }
  return qi === query.length;
}

function onKeydown(e) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
    renderCommandResults();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    renderCommandResults();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (filteredCommands[selectedIndex]) {
      executeCommand(filteredCommands[selectedIndex]);
    }
  }
}

function executeCommand(cmd) {
  closeCommandBar();
  if (cmd.action) {
    // Slight delay so bar closes first
    setTimeout(() => cmd.action(), 50);
  }
}

function renderCommandResults() {
  const list = document.getElementById("command_results");
  if (!list) return;

  if (!filteredCommands.length) {
    list.innerHTML = '<div class="command-empty">Aucun resultat</div>';
    return;
  }

  let currentCategory = null;
  let html = '';

  filteredCommands.forEach((cmd, i) => {
    if (cmd.category && cmd.category !== currentCategory) {
      currentCategory = cmd.category;
      html += `<div class="command-category">${currentCategory}</div>`;
    }

    const selected = i === selectedIndex ? "selected" : "";
    html += `<div class="command-item ${selected}" data-index="${i}">`;
    html += `<div class="command-item-left">`;
    if (cmd.icon) {
      html += `<span class="command-icon">${cmd.icon}</span>`;
    }
    html += `<div class="command-item-text">`;
    html += `<span class="command-label">${cmd.label}</span>`;
    if (cmd.description) {
      html += `<span class="command-desc">${cmd.description}</span>`;
    }
    html += `</div></div>`;
    if (cmd.shortcut) {
      html += `<span class="command-shortcut">${cmd.shortcut}</span>`;
    }
    html += '</div>';
  });

  list.innerHTML = html;

  // Wire click on items
  list.querySelectorAll(".command-item").forEach(item => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.index, 10);
      if (filteredCommands[idx]) {
        executeCommand(filteredCommands[idx]);
      }
    });
    item.addEventListener("mouseenter", () => {
      selectedIndex = parseInt(item.dataset.index, 10);
      list.querySelectorAll(".command-item").forEach(el => el.classList.remove("selected"));
      item.classList.add("selected");
    });
  });

  // Scroll selected into view
  const selectedEl = list.querySelector(".command-item.selected");
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: "nearest" });
  }
}
