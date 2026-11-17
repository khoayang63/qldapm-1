(function () {
  "use strict";

  var STORAGE_KEY = "ptit.todo.v1";
  var TAGS_KEY = "ptit.todo.tags.v1";
  var THEME_KEY = "ptit.todo.theme";
  var EXPORT_VERSION = 2;
  var MAX_TITLE = 200;
  var MAX_TAG_NAME = 24;
  var MAX_TASKS = 2000;
  var MAX_IMPORT_BYTES = 2 * 1024 * 1024;

  var PRESET_TAGS = [
    { id: "work", name: "Work", color: "#2563eb" },
    { id: "personal", name: "Personal", color: "#15803d" },
    { id: "urgent", name: "Urgent", color: "#dc2626" }
  ];

  // High-contrast backgrounds that stay legible with white text in both themes.
  var TAG_PALETTE = [
    "#7c3aed",
    "#b45309",
    "#0f766e",
    "#be185d",
    "#4338ca",
    "#0369a1",
    "#a16207",
    "#4d7c0f"
  ];

  var form = document.getElementById("add-form");
  var input = document.getElementById("new-todo");
  var dueInput = document.getElementById("new-due");
  var newTagsEl = document.getElementById("new-tags");
  var newTagBtn = document.getElementById("new-tag-btn");
  var newTagForm = document.getElementById("new-tag-form");
  var newTagName = document.getElementById("new-tag-name");
  var newTagSave = document.getElementById("new-tag-save");
  var newTagCancel = document.getElementById("new-tag-cancel");
  var newTagMessage = document.getElementById("new-tag-message");
  var list = document.getElementById("todo-list");
  var template = document.getElementById("todo-template");
  var summary = document.getElementById("summary");
  var itemsLeft = document.getElementById("items-left");
  var clearBtn = document.getElementById("clear-completed");
  var emptyState = document.getElementById("empty-state");
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll(".filters__btn"));
  var tagFiltersEl = document.getElementById("tag-filters");
  var overdueBanner = document.getElementById("overdue-banner");
  var themeToggle = document.getElementById("theme-toggle");
  var themeIcon = document.getElementById("theme-icon");
  var exportBtn = document.getElementById("export-btn");
  var importBtn = document.getElementById("import-btn");
  var importFile = document.getElementById("import-file");
  var importMode = document.getElementById("import-mode");
  var dataStatus = document.getElementById("data-status");

  var customTags = loadTags();
  var todos = loadTodos();
  var filter = "all";
  var tagFilter = null;
  var addTags = [];
  var rolloverTimer = null;
  var lastDayKey = dayKey(new Date());
  var statusTimer = null;

  function readStore(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function save() {
    return writeStore(STORAGE_KEY, JSON.stringify(todos));
  }

  function saveTags() {
    return writeStore(TAGS_KEY, JSON.stringify(customTags));
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function parseDue(value) {
    if (typeof value !== "string") return null;
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return { year: year, month: month, day: day };
  }

  function normalizeDue(value) {
    return parseDue(value) ? value : null;
  }

  function normalizeColor(value) {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
  }

  function isPresetName(name) {
    var key = String(name || "").toLowerCase();
    return PRESET_TAGS.some(function (tag) { return tag.name.toLowerCase() === key; });
  }

  function allTags() {
    return PRESET_TAGS.concat(customTags || []);
  }

  function tagsById() {
    var map = Object.create(null);
    allTags().forEach(function (tag) { map[tag.id] = tag; });
    return map;
  }

  function tagsByName() {
    var map = Object.create(null);
    allTags().forEach(function (tag) { map[tag.name.toLowerCase()] = tag; });
    return map;
  }

  function uniqueTagId(name, used) {
    var taken = used || Object.create(null);
    if (!used) {
      allTags().forEach(function (tag) { taken[tag.id] = true; });
    }
    var base = "tag-" + (String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "custom");
    var id = base;
    var suffix = 2;
    while (taken[id]) {
      id = base + "-" + suffix;
      suffix += 1;
    }
    taken[id] = true;
    return id;
  }

  function nextTagColor() {
    var used = allTags().map(function (tag) { return tag.color.toLowerCase(); });
    for (var i = 0; i < TAG_PALETTE.length; i += 1) {
      if (used.indexOf(TAG_PALETTE[i]) === -1) return TAG_PALETTE[i];
    }
    return TAG_PALETTE[customTags.length % TAG_PALETTE.length];
  }

  function loadTags() {
    var raw = readStore(TAGS_KEY);
    if (!raw) return [];
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    var used = Object.create(null);
    PRESET_TAGS.forEach(function (tag) { used[tag.id] = true; });
    var seenNames = Object.create(null);
    var out = [];

    parsed.forEach(function (tag) {
      if (!tag || typeof tag !== "object" || Array.isArray(tag)) return;
      var name = typeof tag.name === "string" ? tag.name.trim().slice(0, MAX_TAG_NAME) : "";
      if (!name) return;
      var nameKey = name.toLowerCase();
      if (seenNames[nameKey] || isPresetName(name)) return;
      seenNames[nameKey] = true;

      var id = typeof tag.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(tag.id) && !used[tag.id]
        ? tag.id
        : uniqueTagId(name, used);
      used[id] = true;
      out.push({
        id: id,
        name: name,
        color: normalizeColor(tag.color) || TAG_PALETTE[out.length % TAG_PALETTE.length]
      });
    });

    return out;
  }

  function filterKnownTagIds(value) {
    if (!Array.isArray(value)) return [];
    var lookup = tagsById();
    var out = [];
    value.forEach(function (id) {
      if (typeof id === "string" && Object.prototype.hasOwnProperty.call(lookup, id) && out.indexOf(id) === -1) {
        out.push(id);
      }
    });
    return out;
  }

  function sanitizeStoredTask(raw, seen) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var title = typeof raw.title === "string" ? raw.title.trim().slice(0, MAX_TITLE) : "";
    if (!title) return null;

    var id = typeof raw.id === "string" || typeof raw.id === "number" ? String(raw.id) : "";
    if (!id || seen[id]) id = createId();
    seen[id] = true;

    return {
      id: id,
      title: title,
      completed: Boolean(raw.completed),
      due: normalizeDue(raw.due),
      tags: filterKnownTagIds(raw.tags)
    };
  }

  function loadTodos() {
    var raw = readStore(STORAGE_KEY);
    if (!raw) return [];
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    var seen = Object.create(null);
    return parsed
      .map(function (item) { return sanitizeStoredTask(item, seen); })
      .filter(Boolean);
  }

  function dayKey(date) {
    return date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
  }

  function dayNumber(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function endOfDay(parts) {
    return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).getTime();
  }

  function isOverdue(todo) {
    if (!todo || todo.completed || !todo.due) return false;
    var parts = parseDue(todo.due);
    return Boolean(parts) && Date.now() > endOfDay(parts);
  }

  function formatDue(due) {
    var parts = parseDue(due);
    if (!parts) return "";
    var target = new Date(parts.year, parts.month - 1, parts.day);
    var now = new Date();
    var diff = dayNumber(target) - dayNumber(now);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    var options = { month: "short", day: "numeric" };
    if (parts.year !== now.getFullYear()) options.year = "numeric";
    try {
      return target.toLocaleDateString(undefined, options);
    } catch (err) {
      return target.toDateString();
    }
  }

  function readableInk(hex) {
    var color = normalizeColor(hex) || "#000000";
    function channel(value) {
      var c = parseInt(value, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var luminance = 0.2126 * channel(color.slice(1, 3)) +
      0.7152 * channel(color.slice(3, 5)) +
      0.0722 * channel(color.slice(5, 7));
    var contrastWithWhite = 1.05 / (luminance + 0.05);
    return contrastWithWhite >= 4.5 ? "#ffffff" : "#111318";
  }

  function tagChip(tag) {
    var chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = tag.name;
    chip.style.setProperty("--tag-bg", tag.color);
    chip.style.setProperty("--tag-fg", readableInk(tag.color));
    return chip;
  }

  function renderTagPicker(container, selectedIds) {
    container.textContent = "";
    allTags().forEach(function (tag) {
      var btn = document.createElement("button");
      var selected = selectedIds.indexOf(tag.id) !== -1;
      btn.type = "button";
      btn.className = "tag-chip tag-chip--toggle";
      btn.textContent = tag.name;
      btn.style.setProperty("--tag-bg", tag.color);
      btn.style.setProperty("--tag-fg", readableInk(tag.color));
      btn.setAttribute("aria-pressed", String(selected));
      btn.classList.toggle("is-selected", selected);
      btn.addEventListener("click", function () {
        var index = selectedIds.indexOf(tag.id);
        var next = index === -1;
        if (next) selectedIds.push(tag.id);
        else selectedIds.splice(index, 1);
        btn.classList.toggle("is-selected", next);
        btn.setAttribute("aria-pressed", String(next));
      });
      container.appendChild(btn);
    });
  }

  function renderAddTagPicker() {
    renderTagPicker(newTagsEl, addTags);
  }

  function visibleTodos() {
    return todos.filter(function (todo) {
      if (filter === "active" && todo.completed) return false;
      if (filter === "completed" && !todo.completed) return false;
      if (tagFilter && todo.tags.indexOf(tagFilter) === -1) return false;
      return true;
    });
  }

  function remaining() {
    return todos.filter(function (todo) { return !todo.completed; }).length;
  }

  function renderTagFilters(tags) {
    tagFiltersEl.textContent = "";

    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "tag-chip tag-chip--all";
    allBtn.textContent = "All tags";
    allBtn.setAttribute("aria-pressed", String(!tagFilter));
    allBtn.classList.toggle("is-selected", !tagFilter);
    allBtn.addEventListener("click", function () {
      tagFilter = null;
      render();
    });
    tagFiltersEl.appendChild(allBtn);

    tags.forEach(function (tag) {
      var btn = document.createElement("button");
      var selected = tagFilter === tag.id;
      btn.type = "button";
      btn.className = "tag-chip tag-chip--toggle";
      btn.textContent = tag.name;
      btn.style.setProperty("--tag-bg", tag.color);
      btn.style.setProperty("--tag-fg", readableInk(tag.color));
      btn.setAttribute("aria-pressed", String(selected));
      btn.classList.toggle("is-selected", selected);
      btn.addEventListener("click", function () {
        tagFilter = tagFilter === tag.id ? null : tag.id;
        render();
      });
      tagFiltersEl.appendChild(btn);
    });
  }

  function emptyMessage() {
    if (!todos.length) return "Nothing here. Add your first task above.";
    var tagName = "";
    if (tagFilter) {
      var tag = tagsById()[tagFilter];
      tagName = tag ? " tagged " + tag.name : "";
    }
    if (filter === "all") {
      return tagFilter ? "No tasks" + tagName + "." : "Nothing here. Add your first task above.";
    }
    return "No " + filter + " tasks" + tagName + ".";
  }

  function renderItem(todo, tagMap) {
    var node = template.content.firstElementChild.cloneNode(true);
    var row = node.querySelector(".item__row");
    var check = node.querySelector(".item__check");
    var title = node.querySelector(".item__title");
    var meta = node.querySelector(".item__meta");
    var dueEl = node.querySelector(".item__due");
    var tagsEl = node.querySelector(".item__tags");
    var editBtn = node.querySelector(".item__edit-btn");
    var del = node.querySelector(".item__delete");
    var editor = node.querySelector(".item__editor");
    var editTitle = node.querySelector(".item__edit-title");
    var editDue = node.querySelector(".item__edit-due");
    var editTags = node.querySelector(".item__edit-tags");
    var saveBtn = node.querySelector(".item__save");
    var cancelBtn = node.querySelector(".item__cancel");

    var overdue = isOverdue(todo);
    node.dataset.id = todo.id;
    node.classList.toggle("is-completed", todo.completed);
    node.classList.toggle("is-overdue", overdue);
    check.checked = todo.completed;
    check.setAttribute("aria-label", (todo.completed ? "Mark task not complete: " : "Mark task complete: ") + todo.title);
    title.textContent = todo.title;
    title.title = "Double-click or press Enter to edit";

    if (todo.due) {
      dueEl.textContent = (overdue ? "Overdue · " : "Due ") + formatDue(todo.due);
      dueEl.hidden = false;
    } else {
      dueEl.hidden = true;
    }

    todo.tags.forEach(function (id) {
      var tag = tagMap[id];
      if (tag) tagsEl.appendChild(tagChip(tag));
    });
    meta.hidden = !todo.due && todo.tags.length === 0;

    check.addEventListener("change", function () {
      todo.completed = check.checked;
      save();
      render();
    });

    del.addEventListener("click", function () {
      todos = todos.filter(function (t) { return t.id !== todo.id; });
      save();
      render();
    });

    var draftTags = [];

    function stopEditing() {
      editor.hidden = true;
      row.hidden = false;
      node.classList.remove("is-editing");
    }

    function startEdit() {
      if (!editor.hidden) return;
      row.hidden = true;
      editor.hidden = false;
      node.classList.add("is-editing");
      editTitle.value = todo.title;
      editDue.value = todo.due || "";
      draftTags = todo.tags.slice();
      renderTagPicker(editTags, draftTags);
      editTitle.focus();
      editTitle.select();
    }

    function commit() {
      if (editor.hidden) return;
      var next = editTitle.value.trim();
      if (!next) {
        todos = todos.filter(function (t) { return t.id !== todo.id; });
      } else {
        todo.title = next.slice(0, MAX_TITLE);
        todo.due = normalizeDue(editDue.value);
        todo.tags = filterKnownTagIds(draftTags);
      }
      save();
      render();
    }

    function cancel() {
      if (editor.hidden) return;
      stopEditing();
      editBtn.focus();
    }

    saveBtn.addEventListener("click", commit);
    cancelBtn.addEventListener("click", cancel);
    editTitle.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });
    editDue.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });

    title.addEventListener("dblclick", startEdit);
    title.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        startEdit();
      }
    });
    editBtn.addEventListener("click", startEdit);

    return node;
  }

  function render() {
    lastDayKey = dayKey(new Date());
    var tags = allTags();
    if (tagFilter && !tagsById()[tagFilter]) tagFilter = null;
    renderTagFilters(tags);

    var tagMap = Object.create(null);
    tags.forEach(function (tag) { tagMap[tag.id] = tag; });

    list.textContent = "";
    var items = visibleTodos();
    items.forEach(function (todo) {
      list.appendChild(renderItem(todo, tagMap));
    });

    var left = remaining();
    itemsLeft.textContent = left + (left === 1 ? " item left" : " items left");
    summary.textContent = todos.length
      ? todos.length + (todos.length === 1 ? " task" : " tasks") + " · " + (todos.length - left) + " done"
      : "No tasks yet";
    clearBtn.hidden = todos.length === left;
    emptyState.hidden = items.length > 0;
    emptyState.textContent = emptyMessage();

    var overdue = todos.filter(isOverdue).length;
    overdueBanner.hidden = overdue === 0;
    overdueBanner.textContent = overdue === 0
      ? ""
      : overdue === 1
        ? "1 task is overdue — check its due date."
        : overdue + " tasks are overdue — check their due dates.";
  }

  function scheduleRollover() {
    if (rolloverTimer) clearTimeout(rolloverTimer);
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
    var delay = Math.min(Math.max(next.getTime() - now.getTime(), 1000), 2147483647);
    rolloverTimer = setTimeout(function () {
      lastDayKey = "";
      refreshTimeSensitive();
    }, delay);
  }

  function refreshTimeSensitive() {
    var key = dayKey(new Date());
    if (key !== lastDayKey) {
      lastDayKey = key;
      render();
    }
    scheduleRollover();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = input.value.trim();
    if (!value) return;
    todos.unshift({
      id: createId(),
      title: value.slice(0, MAX_TITLE),
      completed: false,
      due: normalizeDue(dueInput.value),
      tags: filterKnownTagIds(addTags)
    });
    input.value = "";
    dueInput.value = "";
    addTags = [];
    save();
    renderAddTagPicker();
    render();
    scheduleRollover();
    input.focus();
  });

  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filter = btn.dataset.filter;
      filterBtns.forEach(function (other) {
        var active = other === btn;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-selected", String(active));
      });
      render();
    });
  });

  clearBtn.addEventListener("click", function () {
    todos = todos.filter(function (todo) { return !todo.completed; });
    save();
    render();
  });

  function showTagMessage(text) {
    newTagMessage.textContent = text;
    newTagMessage.hidden = false;
  }

  function toggleNewTagForm(show) {
    newTagForm.hidden = !show;
    newTagBtn.setAttribute("aria-expanded", String(show));
    newTagMessage.hidden = true;
    if (show) {
      newTagName.value = "";
      newTagName.focus();
    }
  }

  function createNewTag() {
    var name = newTagName.value.trim().replace(/\s+/g, " ");
    if (!name) {
      showTagMessage("Enter a tag name.");
      newTagName.focus();
      return;
    }
    if (name.length > MAX_TAG_NAME) {
      showTagMessage("Keep tag names to " + MAX_TAG_NAME + " characters or fewer.");
      newTagName.focus();
      return;
    }
    if (isPresetName(name) || allTags().some(function (tag) { return tag.name.toLowerCase() === name.toLowerCase(); })) {
      showTagMessage("A tag named “" + name + "” already exists.");
      newTagName.focus();
      return;
    }
    var tag = { id: uniqueTagId(name), name: name, color: nextTagColor() };
    customTags.push(tag);
    saveTags();
    addTags.push(tag.id);
    toggleNewTagForm(false);
    renderAddTagPicker();
    render();
    newTagBtn.focus();
  }

  newTagBtn.addEventListener("click", function () {
    toggleNewTagForm(newTagForm.hidden);
  });
  newTagSave.addEventListener("click", createNewTag);
  newTagCancel.addEventListener("click", function () {
    toggleNewTagForm(false);
    newTagBtn.focus();
  });
  newTagName.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      createNewTag();
    } else if (event.key === "Escape") {
      event.preventDefault();
      toggleNewTagForm(false);
      newTagBtn.focus();
    }
  });

  function setStatus(text, isError) {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    dataStatus.textContent = text;
    dataStatus.classList.toggle("is-error", Boolean(isError));
    dataStatus.hidden = false;
    if (!isError) {
      statusTimer = setTimeout(function () {
        dataStatus.hidden = true;
        statusTimer = null;
      }, 7000);
    }
  }

  function todayStamp() {
    var now = new Date();
    function pad(value) { return value < 10 ? "0" + value : String(value); }
    return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  }

  function exportTasks() {
    var lookup = tagsById();
    var payload = {
      version: EXPORT_VERSION,
      app: "ptit.todo",
      exportedAt: new Date().toISOString(),
      tasks: todos.map(function (todo) {
        return {
          id: todo.id,
          title: todo.title,
          completed: todo.completed,
          due: todo.due,
          tags: todo.tags.map(function (id) {
            var tag = lookup[id];
            return tag ? tag.name : null;
          }).filter(Boolean)
        };
      }),
      tags: customTags.map(function (tag) {
        return { name: tag.name, color: tag.color };
      })
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "todo-export-" + todayStamp() + ".json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setStatus("Exported " + todos.length + (todos.length === 1 ? " task." : " tasks."), false);
  }

  function parseImport(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("the file is not valid JSON");
    }

    var tasksRaw;
    var tagsRaw = [];
    if (Array.isArray(data)) {
      tasksRaw = data;
    } else if (data && typeof data === "object") {
      if (!Array.isArray(data.tasks)) {
        throw new Error("the JSON object is missing a \"tasks\" array");
      }
      if (data.version != null && Number(data.version) > EXPORT_VERSION) {
        throw new Error("the file version (" + data.version + ") is newer than this app supports");
      }
      tasksRaw = data.tasks;
      if (data.tags != null) {
        if (!Array.isArray(data.tags)) throw new Error("\"tags\" must be an array");
        tagsRaw = data.tags;
      }
    } else {
      throw new Error("expected a JSON object or an array of tasks");
    }

    if (tasksRaw.length > MAX_TASKS) {
      throw new Error("too many tasks (maximum " + MAX_TASKS + ")");
    }

    var tagDefs = tagsRaw.map(function (raw, index) {
      var where = "tag " + (index + 1);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(where + " is invalid");
      var name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!name) throw new Error(where + " is missing a name");
      if (name.length > MAX_TAG_NAME) throw new Error(where + " has a name longer than " + MAX_TAG_NAME + " characters");
      return { name: name, color: normalizeColor(raw.color) };
    });

    var seen = Object.create(null);
    var tasks = tasksRaw.map(function (raw, index) {
      var where = "task " + (index + 1);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(where + " is invalid");
      var title = typeof raw.title === "string" ? raw.title.trim() : "";
      if (!title) throw new Error(where + " is missing a title");

      var due = null;
      if (raw.due != null && raw.due !== "") {
        due = normalizeDue(raw.due);
        if (!due) throw new Error(where + " has an invalid due date (expected YYYY-MM-DD)");
      }

      var tagNames = [];
      if (raw.tags != null) {
        if (!Array.isArray(raw.tags)) throw new Error(where + " has an invalid \"tags\" value");
        raw.tags.forEach(function (value) {
          if (typeof value !== "string") throw new Error(where + " has an invalid tag name");
          var clean = value.trim().slice(0, MAX_TAG_NAME);
          if (clean && tagNames.indexOf(clean) === -1) tagNames.push(clean);
        });
      }

      var id = typeof raw.id === "string" || typeof raw.id === "number" ? String(raw.id).slice(0, 64) : "";
      if (id) {
        if (seen[id]) throw new Error(where + " has a duplicate id");
        seen[id] = true;
      }

      return {
        id: id || null,
        title: title.slice(0, MAX_TITLE),
        completed: Boolean(raw.completed),
        due: due,
        tagNames: tagNames
      };
    });

    return { tasks: tasks, tagDefs: tagDefs };
  }

  function ensureTags(defs, tasks) {
    var byName = tagsByName();

    function addTag(name, color) {
      var key = name.toLowerCase();
      if (byName[key]) return;
      var tag = {
        id: uniqueTagId(name),
        name: name,
        color: color || nextTagColor()
      };
      customTags.push(tag);
      byName[key] = tag;
    }

    defs.forEach(function (def) { addTag(def.name, def.color); });
    tasks.forEach(function (task) {
      task.tagNames.forEach(function (name) { addTag(name, null); });
    });
    saveTags();
    return byName;
  }

  function applyImport(parsed, replace) {
    var byName = ensureTags(parsed.tagDefs, parsed.tasks);

    var next = replace ? [] : todos.slice();
    var indexById = Object.create(null);
    if (!replace) {
      next.forEach(function (todo, index) { indexById[todo.id] = index; });
    }

    var seenImport = Object.create(null);
    var added = 0;
    var updated = 0;

    parsed.tasks.forEach(function (draft) {
      var id = draft.id;
      if (!id || seenImport[id]) {
        do {
          id = createId();
        } while (indexById[id] != null);
      }
      seenImport[id] = true;

      var todo = {
        id: id,
        title: draft.title,
        completed: draft.completed,
        due: draft.due,
        tags: draft.tagNames.map(function (name) {
          var tag = byName[name.toLowerCase()];
          return tag ? tag.id : null;
        }).filter(Boolean)
      };

      if (indexById[id] != null) {
        next[indexById[id]] = todo;
        updated += 1;
      } else {
        indexById[id] = next.length;
        next.push(todo);
        added += 1;
      }
    });

    todos = next;
    var stored = save();
    render();

    var message;
    if (replace) {
      message = "Replaced the task list with " + parsed.tasks.length + (parsed.tasks.length === 1 ? " task." : " tasks.");
    } else {
      message = "Imported " + parsed.tasks.length + (parsed.tasks.length === 1 ? " task" : " tasks") +
        ": " + added + " added, " + updated + " updated.";
    }
    if (!stored) {
      setStatus(message + " Warning: localStorage could not be written; changes are in memory only.", true);
    } else {
      setStatus(message, false);
    }
  }

  function handleImport(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setStatus("Import failed: the file is larger than 2 MB. Existing tasks were not changed.", true);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var text = typeof reader.result === "string" ? reader.result : "";
      var parsed;
      try {
        parsed = parseImport(text);
      } catch (err) {
        setStatus("Import failed: " + err.message + ". Existing tasks were not changed.", true);
        return;
      }
      applyImport(parsed, importMode.value === "replace");
    };
    reader.onerror = function () {
      setStatus("Import failed: the file could not be read. Existing tasks were not changed.", true);
    };
    reader.readAsText(file);
  }

  exportBtn.addEventListener("click", exportTasks);

  importBtn.addEventListener("click", function () {
    importFile.click();
  });

  importFile.addEventListener("change", function () {
    var file = importFile.files && importFile.files[0];
    importFile.value = "";
    handleImport(file);
  });

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    writeStore(THEME_KEY, theme);
  }

  themeToggle.addEventListener("click", function () {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refreshTimeSensitive();
  });
  window.addEventListener("focus", refreshTimeSensitive);
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY || event.key === TAGS_KEY) {
      customTags = loadTags();
      todos = loadTodos();
      render();
    }
  });

  var savedTheme = readStore(THEME_KEY);
  applyTheme(savedTheme === "light" ? "light" : "dark");

  renderAddTagPicker();
  render();
  scheduleRollover();
  input.focus();
})();
