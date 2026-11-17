(function () {
  "use strict";

  var STORAGE_KEY = "ptit.todo.v1";
  var THEME_KEY = "ptit.todo.theme";

  var form = document.getElementById("add-form");
  var input = document.getElementById("new-todo");
  var list = document.getElementById("todo-list");
  var template = document.getElementById("todo-template");
  var summary = document.getElementById("summary");
  var itemsLeft = document.getElementById("items-left");
  var clearBtn = document.getElementById("clear-completed");
  var emptyState = document.getElementById("empty-state");
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll(".filters__btn"));
  var themeToggle = document.getElementById("theme-toggle");
  var themeIcon = document.getElementById("theme-icon");

  var todos = load();
  var filter = "all";

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (t) {
          return t && typeof t.title === "string";
        })
        .map(function (t) {
          return {
            id: String(t.id || createId()),
            title: t.title.slice(0, 200),
            completed: Boolean(t.completed)
          };
        });
    } catch (err) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (err) {
      /* storage unavailable (private mode / quota) - app still works in memory */
    }
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function visibleTodos() {
    if (filter === "active") return todos.filter(function (t) { return !t.completed; });
    if (filter === "completed") return todos.filter(function (t) { return t.completed; });
    return todos;
  }

  function remaining() {
    return todos.filter(function (t) { return !t.completed; }).length;
  }

  function render() {
    list.textContent = "";

    var items = visibleTodos();
    items.forEach(function (todo) {
      var node = template.content.firstElementChild.cloneNode(true);
      var check = node.querySelector(".item__check");
      var title = node.querySelector(".item__title");
      var edit = node.querySelector(".item__edit");
      var del = node.querySelector(".item__delete");

      node.dataset.id = todo.id;
      node.classList.toggle("is-completed", todo.completed);
      check.checked = todo.completed;
      title.textContent = todo.title;
      edit.value = todo.title;

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

      var editing = false;
      var settled = false;

      function startEdit() {
        if (editing) return;
        editing = true;
        settled = false;
        edit.hidden = false;
        title.hidden = true;
        edit.focus();
        edit.select();
      }

      function finish(commit) {
        if (settled) return;
        settled = true;
        editing = false;
        if (commit) {
          var next = edit.value.trim();
          if (!next) {
            todos = todos.filter(function (t) { return t.id !== todo.id; });
          } else {
            todo.title = next.slice(0, 200);
          }
          save();
        }
        render();
      }

      title.addEventListener("dblclick", startEdit);
      title.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          startEdit();
        }
      });
      edit.addEventListener("blur", function () {
        finish(true);
      });
      edit.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      });

      list.appendChild(node);
    });

    var left = remaining();
    itemsLeft.textContent = left + (left === 1 ? " item left" : " items left");
    summary.textContent = todos.length
      ? todos.length + (todos.length === 1 ? " task" : " tasks") + " · " + (todos.length - left) + " done"
      : "No tasks yet";
    clearBtn.hidden = todos.length === left;
    emptyState.hidden = items.length > 0;
    emptyState.textContent = todos.length
      ? "No " + filter + " tasks."
      : "Nothing here. Add your first task above.";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = input.value.trim();
    if (!value) return;
    todos.unshift({ id: createId(), title: value.slice(0, 200), completed: false });
    input.value = "";
    save();
    render();
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
    todos = todos.filter(function (t) { return !t.completed; });
    save();
    render();
  });

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      /* ignore */
    }
  }

  themeToggle.addEventListener("click", function () {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  var savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
  } catch (err) {
    savedTheme = null;
  }
  applyTheme(savedTheme === "light" ? "light" : "dark");

  render();
  input.focus();
})();
