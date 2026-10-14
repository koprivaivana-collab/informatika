const STORAGE_KEY = "trideni-zaku-app-v3";

let state = loadState();

if (!state.classes) {
  state = {
    classes: [],
    currentClassId: null,
    areas: [],
    currentAreaId: null,
    lastGroups: [],
    lastAreaId: null
  };
}

migrateOldData();
ensureAreaSelected();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || uid();
}

function getCurrentClass() {
  return state.classes.find(c => c.id === state.currentClassId) || null;
}

function getCurrentArea() {
  return state.areas.find(a => a.id === state.currentAreaId) || null;
}

function getAreaById(areaId) {
  return state.areas.find(a => a.id === areaId) || null;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createEmptyAreaRoles() {
  return {};
}

function ensureStudentArea(student, areaId) {
  if (!student.areas) student.areas = {};
  if (!student.areas[areaId]) {
    student.areas[areaId] = { member: false, leader: false };
  }
  return student.areas[areaId];
}

function normalizeStudent(student) {
  const normalized = {
    id: student.id || uid(),
    name: (student.name || "").trim(),
    areas: {}
  };

  if (student.areas && typeof student.areas === "object") {
    for (const [areaId, role] of Object.entries(student.areas)) {
      normalized.areas[areaId] = {
        member: !!role.member || !!role.leader,
        leader: !!role.leader
      };
    }
  }

  return normalized;
}

function migrateOldData() {
  if (!Array.isArray(state.areas)) state.areas = [];
  if (!Array.isArray(state.classes)) state.classes = [];

  const hasLegacyArea1 = state.classes.some(cls =>
    (cls.students || []).some(s => "area1Member" in s || "area1Leader" in s || "area2Member" in s || "area2Leader" in s)
  );

  if (hasLegacyArea1 && state.areas.length === 0) {
    state.areas = [
      { id: "oblast-1", name: "Oblast 1" },
      { id: "oblast-2", name: "Oblast 2" }
    ];
  }

  state.classes = state.classes.map(cls => {
    const students = (cls.students || []).map(student => {
      if (student.areas) return normalizeStudent(student);

      const normalized = {
        id: student.id || uid(),
        name: (student.name || "").trim(),
        areas: {}
      };

      if (student.area1Member || student.area1Leader) {
        normalized.areas["oblast-1"] = {
          member: !!student.area1Member || !!student.area1Leader,
          leader: !!student.area1Leader
        };
      }

      if (student.area2Member || student.area2Leader) {
        normalized.areas["oblast-2"] = {
          member: !!student.area2Member || !!student.area2Leader,
          leader: !!student.area2Leader
        };
      }

      if (student.leader !== undefined) {
        normalized.areas["vychozi-oblast"] = {
          member: true,
          leader: !!student.leader
        };
        if (!state.areas.find(a => a.id === "vychozi-oblast")) {
          state.areas.push({ id: "vychozi-oblast", name: "Výchozí oblast" });
        }
      }

      return normalized;
    });

    return {
      id: cls.id || uid(),
      name: cls.name || "Bez názvu",
      students
    };
  });

  if (state.areas.length === 0) {
    state.areas.push({ id: "zakladni-oblast", name: "Základní oblast" });
  }

  saveState();
}

function ensureAreaSelected() {
  if (!state.currentAreaId || !state.areas.find(a => a.id === state.currentAreaId)) {
    state.currentAreaId = state.areas[0]?.id || null;
  }
}

function render() {
  ensureAreaSelected();
  renderClassTabs();
  renderAreaList();
  renderAreaSelect();
  renderStudents();
  renderResults();
  renderModeVisibility();
}

function renderClassTabs() {
  const wrap = document.getElementById("classTabs");
  wrap.innerHTML = "";

  state.classes.forEach(cls => {
    const btn = document.createElement("button");
    btn.className = `class-tab ${cls.id === state.currentClassId ? "active" : ""}`;
    btn.textContent = cls.name;
    btn.addEventListener("click", () => {
      state.currentClassId = cls.id;
      state.lastGroups = [];
      saveState();
      render();
    });
    wrap.appendChild(btn);
  });
}

function renderAreaList() {
  const wrap = document.getElementById("areaList");
  wrap.innerHTML = "";

  state.areas.forEach(area => {
    const row = document.createElement("div");
    row.className = "area-item";

    const selectBtn = document.createElement("button");
    selectBtn.className = `area-pill ${area.id === state.currentAreaId ? "active" : ""}`;
    selectBtn.textContent = area.name;
    selectBtn.addEventListener("click", () => {
      state.currentAreaId = area.id;
      saveState();
      render();
    });

    const renameBtn = document.createElement("button");
    renameBtn.className = "mini-btn";
    renameBtn.textContent = "Přejmenovat";
    renameBtn.addEventListener("click", () => renameArea(area.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.textContent = "Smazat";
    deleteBtn.addEventListener("click", () => deleteArea(area.id));

    row.appendChild(selectBtn);
    row.appendChild(renameBtn);
    row.appendChild(deleteBtn);
    wrap.appendChild(row);
  });
}

function renderAreaSelect() {
  const select = document.getElementById("taskArea");
  const activeAreaInfo = document.getElementById("activeAreaInfo");
  select.innerHTML = "";

  state.areas.forEach(area => {
    const option = document.createElement("option");
    option.value = area.id;
    option.textContent = area.name;
    if (area.id === state.currentAreaId) option.selected = true;
    select.appendChild(option);
  });

  const currentArea = getCurrentArea();
  activeAreaInfo.textContent = currentArea
    ? `Aktivní oblast pro role žáků: ${currentArea.name}`
    : "Vyberte aktivní oblast.";

  select.addEventListener("change", () => {
    state.currentAreaId = select.value;
    saveState();
    render();
  }, { once: true });
}

function renderStudents() {
  const current = getCurrentClass();
  const currentArea = getCurrentArea();
  const title = document.getElementById("currentClassTitle");
  const list = document.getElementById("studentList");
  const empty = document.getElementById("studentsEmpty");

  list.innerHTML = "";

  if (!current) {
    title.textContent = "Žáci";
    empty.style.display = "block";
    return;
  }

  title.textContent = `Žáci – ${current.name}`;

  if (!current.students.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  current.students.forEach(student => {
    const areaRole = currentArea ? ensureStudentArea(student, currentArea.id) : { member: false, leader: false };

    const item = document.createElement("div");
    item.className = `student-item ${areaRole.member ? "member" : ""} ${areaRole.leader ? "leader" : ""}`;

    const name = document.createElement("div");
    name.className = "student-name";
    name.textContent = student.name;

    const memberBox = document.createElement("label");
    memberBox.className = "checkbox-row role-box";
    memberBox.innerHTML = `
      <input type="checkbox" ${areaRole.member ? "checked" : ""}>
      <span>V oblasti</span>
    `;

    memberBox.querySelector("input").addEventListener("change", (e) => {
      areaRole.member = e.target.checked;
      if (!areaRole.member) areaRole.leader = false;
      saveState();
      render();
    });

    const leaderBox = document.createElement("label");
    leaderBox.className = "checkbox-row role-box";
    leaderBox.innerHTML = `
      <input type="checkbox" ${areaRole.leader ? "checked" : ""}>
      <span>Leader oblasti</span>
    `;

    leaderBox.querySelector("input").addEventListener("change", (e) => {
      areaRole.leader = e.target.checked;
      if (areaRole.leader) areaRole.member = true;
      saveState();
      render();
    });

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.textContent = "Smazat";
    del.addEventListener("click", () => {
      current.students = current.students.filter(s => s.id !== student.id);
      saveState();
      render();
    });

    item.appendChild(name);
    item.appendChild(memberBox);
    item.appendChild(leaderBox);
    item.appendChild(del);

    list.appendChild(item);
  });
}

function renderResults() {
  const wrap = document.getElementById("results");
  const empty = document.getElementById("resultsEmpty");
  wrap.innerHTML = "";

  if (!state.lastGroups.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  const area = getAreaById(state.lastAreaId);

  state.lastGroups.forEach((group, index) => {
    const card = document.createElement("div");
    card.className = "group-card";

    const title = document.createElement("h3");
    title.textContent = `${area ? area.name : "Oblast"} – Skupina ${index + 1}`;

    const list = document.createElement("ul");

    group.forEach(student => {
      const li = document.createElement("li");
      const role = student.areas?.[state.lastAreaId];
      li.textContent = student.name;
      if (role?.leader) {
        li.classList.add("leader");
        li.textContent += " (leader)";
      }
      list.appendChild(li);
    });

    card.appendChild(title);
    card.appendChild(list);
    wrap.appendChild(card);
  });
}

function renderModeVisibility() {
  const mode = document.getElementById("groupMode").value;
  document.getElementById("groupCountWrap").classList.toggle("hidden", mode !== "count");
  document.getElementById("groupSizeWrap").classList.toggle("hidden", mode !== "size");
}

function addClass() {
  const input = document.getElementById("newClassName");
  const name = input.value.trim();
  if (!name) return alert("Zadejte název třídy.");

  const cls = {
    id: uid(),
    name,
    students: []
  };

  state.classes.push(cls);
  state.currentClassId = cls.id;
  state.lastGroups = [];
  input.value = "";
  saveState();
  render();
}

function deleteCurrentClass() {
  const current = getCurrentClass();
  if (!current) return alert("Nejprve vyberte třídu.");
  if (!confirm(`Opravdu chcete smazat třídu ${current.name}?`)) return;

  state.classes = state.classes.filter(c => c.id !== current.id);
  state.currentClassId = state.classes[0]?.id || null;
  state.lastGroups = [];
  saveState();
  render();
}

function addArea() {
  const input = document.getElementById("newAreaName");
  const name = input.value.trim();
  if (!name) return alert("Zadejte název oblasti.");

  let id = slugify(name);
  while (state.areas.find(a => a.id === id)) {
    id = `${id}-${Math.floor(Math.random() * 1000)}`;
  }

  state.areas.push({ id, name });
  state.currentAreaId = id;
  input.value = "";
  saveState();
  render();
}

function renameArea(areaId) {
  const area = getAreaById(areaId);
  if (!area) return;

  const newName = prompt("Nový název oblasti:", area.name);
  if (!newName || !newName.trim()) return;

  area.name = newName.trim();
  saveState();
  render();
}

function deleteArea(areaId) {
  const area = getAreaById(areaId);
  if (!area) return;
  if (!confirm(`Opravdu chcete smazat oblast "${area.name}"?`)) return;

  state.areas = state.areas.filter(a => a.id !== areaId);

  state.classes.forEach(cls => {
    cls.students.forEach(student => {
      if (student.areas && student.areas[areaId]) {
        delete student.areas[areaId];
      }
    });
  });

  if (state.lastAreaId === areaId) {
    state.lastAreaId = null;
    state.lastGroups = [];
  }

  ensureAreaSelected();
  saveState();
  render();
}

function addStudent() {
  const current = getCurrentClass();
  if (!current) return alert("Nejprve vytvořte nebo vyberte třídu.");

  const input = document.getElementById("studentName");
  const name = input.value.trim();
  if (!name) return alert("Zadejte jméno žáka.");

  current.students.push(normalizeStudent({
    id: uid(),
    name,
    areas: createEmptyAreaRoles()
  }));

  input.value = "";
  saveState();
  render();
}

function createGroups() {
  const current = getCurrentClass();
  if (!current) return alert("Nejprve vyberte třídu.");

  const selectedArea = document.getElementById("taskArea").value;
  const area = getAreaById(selectedArea);
  if (!area) return alert("Vyberte oblast.");

  const mode = document.getElementById("groupMode").value;
  const preferLeaders = document.getElementById("preferLeaders").checked;

  const eligibleStudents = shuffle(
    current.students.filter(student => {
      const role = student.areas?.[selectedArea];
      return !!role?.member;
    })
  );

  if (eligibleStudents.length < 2) {
    return alert(`Pro oblast "${area.name}" musí být alespoň 2 žáci.`);
  }

  const leaders = eligibleStudents.filter(student => student.areas?.[selectedArea]?.leader);
  const others = eligibleStudents.filter(student => !student.areas?.[selectedArea]?.leader);

  let groups = [];

  if (mode === "pairs") {
    if (preferLeaders && leaders.length > 0) {
      groups = leaders.map(leader => [leader]);

      const shuffledOthers = shuffle(others);
      let index = 0;

      for (const student of shuffledOthers) {
        groups[index % groups.length].push(student);
        index++;
      }

      const oversizedGroups = groups.filter(g => g.length > 2);
      if (oversizedGroups.length > 0) {
        alert("V režimu dvojic vyšlo u některých leaderů více členů. Zvažte méně leaderů nebo jiný režim.");
      }
    } else {
      for (let i = 0; i < eligibleStudents.length; i += 2) {
        groups.push(eligibleStudents.slice(i, i + 2));
      }
    }
  } else {
    let desiredGroupCount = 2;

    if (mode === "count") {
      desiredGroupCount = parseInt(document.getElementById("groupCount").value, 10);
    }

    if (mode === "size") {
      const groupSize = parseInt(document.getElementById("groupSize").value, 10);
      desiredGroupCount = Math.ceil(eligibleStudents.length / groupSize);
    }

    if (!desiredGroupCount || desiredGroupCount < 1) {
      return alert("Zadejte platný počet skupin.");
    }

    if (preferLeaders && leaders.length > 0) {
      groups = leaders.map(leader => [leader]);

      if (leaders.length > desiredGroupCount) {
        alert(`Máte ${leaders.length} leaderů, proto bylo vytvořeno ${leaders.length} skupin, aby nebyli dva leadeři v jedné skupině.`);
      } else {
        while (groups.length < desiredGroupCount) {
          groups.push([]);
        }
      }

      const shuffledOthers = shuffle(others);
      let index = 0;

      for (const student of shuffledOthers) {
        groups[index % groups.length].push(student);
        index++;
      }
    } else {
      groups = Array.from({ length: desiredGroupCount }, () => []);
      let index = 0;

      for (const student of eligibleStudents) {
        groups[index % groups.length].push(student);
        index++;
      }
    }
  }

  state.lastGroups = groups;
  state.lastAreaId = selectedArea;
  saveState();
  render();
}

function reshuffle() {
  if (!getCurrentClass()) return alert("Nejprve vyberte třídu.");
  createGroups();
}

function exportCurrentClass() {
  const current = getCurrentClass();
  if (!current) return alert("Nejprve vyberte třídu.");

  const data = {
    name: current.name,
    areas: state.areas,
    students: current.students.map(s => ({
      name: s.name,
      areas: s.areas || {}
    }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${current.name.replace(/\s+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importClassFromFile() {
  const fileInput = document.getElementById("importFile");
  const file = fileInput.files[0];

  if (!file) return alert("Vyberte JSON soubor.");

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.name || !Array.isArray(data.students)) {
        throw new Error("Neplatný formát souboru.");
      }

      if (Array.isArray(data.areas)) {
        data.areas.forEach(importedArea => {
          if (!state.areas.find(a => a.id === importedArea.id)) {
            state.areas.push({
              id: importedArea.id || uid(),
              name: importedArea.name || "Bez názvu oblasti"
            });
          }
        });
      }

      const cls = {
        id: uid(),
        name: data.name,
        students: data.students.map(normalizeStudent).filter(s => s.name)
      };

      state.classes.push(cls);
      state.currentClassId = cls.id;
      ensureAreaSelected();
      state.lastGroups = [];
      saveState();
      render();
      fileInput.value = "";
    } catch (error) {
      alert("Soubor se nepodařilo načíst. Zkontrolujte formát JSON.");
    }
  };

  reader.readAsText(file, "utf-8");
}

document.getElementById("addClassBtn").addEventListener("click", addClass);
document.getElementById("deleteClassBtn").addEventListener("click", deleteCurrentClass);
document.getElementById("addAreaBtn").addEventListener("click", addArea);
document.getElementById("addStudentBtn").addEventListener("click", addStudent);
document.getElementById("generateBtn").addEventListener("click", createGroups);
document.getElementById("reshuffleBtn").addEventListener("click", reshuffle);
document.getElementById("exportBtn").addEventListener("click", exportCurrentClass);
document.getElementById("importBtn").addEventListener("click", importClassFromFile);
document.getElementById("groupMode").addEventListener("change", renderModeVisibility);

render();