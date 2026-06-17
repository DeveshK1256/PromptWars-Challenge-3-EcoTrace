/**
 * @module team-challenges
 * Team-based eco challenges — create/join teams, track collective CO₂ savings.
 * Uses localStorage for demo mode, Firestore when configured.
 */

/* ── Default Teams ─────────────────────────────────────────────────── */

/** @type {Array<{id: string, name: string, icon: string, members: number, co2Saved: number}>} */
const DEFAULT_TEAMS = [
  { id: "office-green",    name: "Office Green Team",    icon: "🏢", members: 12, co2Saved: 1840 },
  { id: "campus-eco",      name: "Campus Eco Warriors",  icon: "🎓", members: 28, co2Saved: 3200 },
  { id: "family-climate",  name: "Family Climate Club",  icon: "🏠", members: 5,  co2Saved: 680 },
  { id: "neighborhood",    name: "Neighborhood Heroes",  icon: "🏘️", members: 18, co2Saved: 2100 },
];

/**
 * Gets all teams including user-created ones.
 * @returns {typeof DEFAULT_TEAMS}
 */
export function getTeams() {
  try {
    const stored = JSON.parse(localStorage.getItem("ecotrace.teams") || "null");
    if (stored?.length) return stored;
  } catch { /* use defaults */ }
  localStorage.setItem("ecotrace.teams", JSON.stringify(DEFAULT_TEAMS));
  return DEFAULT_TEAMS;
}

/**
 * Gets the user's current team ID.
 * @returns {string|null}
 */
export function getUserTeam() {
  return localStorage.getItem("ecotrace.userTeam") || null;
}

/**
 * Joins a team.
 * @param {string} teamId
 * @returns {boolean} Success.
 */
export function joinTeam(teamId) {
  const teams = getTeams();
  const team = teams.find((t) => t.id === teamId);
  if (!team) return false;

  const currentTeam = getUserTeam();
  if (currentTeam === teamId) return true;

  // Leave old team
  if (currentTeam) {
    const old = teams.find((t) => t.id === currentTeam);
    if (old) old.members = Math.max(0, old.members - 1);
  }

  team.members += 1;
  localStorage.setItem("ecotrace.userTeam", teamId);
  localStorage.setItem("ecotrace.teams", JSON.stringify(teams));
  return true;
}

/**
 * Creates a new team.
 * @param {string} name
 * @param {string} icon
 * @returns {Object} The new team.
 */
export function createTeam(name, icon) {
  const teams = getTeams();
  const id = `team-${Date.now()}`;
  const team = { id, name: name.slice(0, 40), icon: icon || "🌍", members: 1, co2Saved: 0 };
  teams.push(team);
  localStorage.setItem("ecotrace.teams", JSON.stringify(teams));
  localStorage.setItem("ecotrace.userTeam", id);
  return team;
}

/**
 * Contributes CO₂ savings to the user's team.
 * @param {number} kgSaved
 */
export function contributeToTeam(kgSaved) {
  const teamId = getUserTeam();
  if (!teamId || kgSaved <= 0) return;
  const teams = getTeams();
  const team = teams.find((t) => t.id === teamId);
  if (team) {
    team.co2Saved += Math.round(kgSaved);
    localStorage.setItem("ecotrace.teams", JSON.stringify(teams));
  }
}

/* ── DOM Rendering ─────────────────────────────────────────────────── */

/**
 * Renders the team leaderboard.
 * @param {HTMLElement} container
 */
export function renderTeamLeaderboard(container) {
  if (!container) return;
  container.textContent = "";

  const teams = getTeams().sort((a, b) => b.co2Saved - a.co2Saved);
  const userTeam = getUserTeam();

  const table = document.createElement("table");
  table.className = "team-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Rank", "Team", "Members", "CO₂ Saved"].forEach((text) => {
    const th = document.createElement("th");
    th.setAttribute("scope", "col");
    th.textContent = text;
    headRow.append(th);
  });
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  teams.forEach((team, i) => {
    const tr = document.createElement("tr");
    if (team.id === userTeam) tr.className = "team-row-active";

    const rankTd = document.createElement("td");
    rankTd.textContent = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);

    const nameTd = document.createElement("td");
    nameTd.textContent = `${team.icon} ${team.name}`;
    if (team.id === userTeam) {
      const badge = document.createElement("span");
      badge.className = "team-badge";
      badge.textContent = " (Your team)";
      nameTd.append(badge);
    }

    const membersTd = document.createElement("td");
    membersTd.textContent = String(team.members);

    const co2Td = document.createElement("td");
    co2Td.className = "team-co2";
    co2Td.textContent = `${team.co2Saved.toLocaleString()} kg`;

    tr.append(rankTd, nameTd, membersTd, co2Td);
    tbody.append(tr);
  });

  table.append(thead, tbody);
  container.append(table);

  // Join buttons
  if (!userTeam) {
    const joinSection = document.createElement("div");
    joinSection.className = "team-join-section";
    const joinTitle = document.createElement("p");
    joinTitle.className = "muted";
    joinTitle.textContent = "Join a team to start competing:";
    joinSection.append(joinTitle);

    teams.forEach((team) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-small btn-secondary";
      btn.textContent = `Join ${team.name}`;
      btn.addEventListener("click", () => {
        joinTeam(team.id);
        renderTeamLeaderboard(container);
      });
      joinSection.append(btn);
    });

    container.append(joinSection);
  }
}

/**
 * Renders the create-team form.
 * @param {HTMLElement} container
 * @param {HTMLElement} leaderboardContainer - to refresh after creation.
 */
export function renderCreateTeamForm(container, leaderboardContainer) {
  if (!container) return;
  container.textContent = "";

  const form = document.createElement("form");
  form.className = "create-team-form";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Team name...";
  input.maxLength = 40;
  input.required = true;

  const btn = document.createElement("button");
  btn.className = "btn btn-primary btn-small";
  btn.type = "submit";
  btn.textContent = "Create Team";

  form.append(input, btn);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (name) {
      createTeam(name, "🌍");
      if (leaderboardContainer) renderTeamLeaderboard(leaderboardContainer);
      input.value = "";
    }
  });

  container.append(form);
}
