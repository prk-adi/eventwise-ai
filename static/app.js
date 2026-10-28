const $ = (id) => document.getElementById(id);
let currentPlan = null;
let currentEvent = null;
let activePlanId = null;
let savedPlans = readSavedPlans();

function money(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {style: "currency", currency, maximumFractionDigits: 2}).format(amount);
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function getEvent() {
  const fd = new FormData($("event-form"));
  return {
    event_type: fd.get("event_type"),
    event_date: fd.get("event_date"),
    guests: Number(fd.get("guests")),
    currency: fd.get("currency"),
    style: fd.get("style"),
    location: fd.get("location"),
    notes: fd.get("notes")
  };
}
function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function showError(message) {
  $("form-error").textContent = message;
  $("form-error").hidden = false;
}
function clearError() {
  $("form-error").hidden = true;
  $("form-error").textContent = "";
}
function readSavedPlans() {
  try {
    const plans = JSON.parse(localStorage.getItem("eventwise-plans") || "[]");
    if (Array.isArray(plans)) return plans.filter(item => item && item.id && item.event && item.plan);
    return [];
  } catch {
    return [];
  }
}
function announceStorageError() {
  const status = $("storage-status");
  status.textContent = "Your browser could not save these changes. Check available local storage.";
  status.hidden = false;
}
function persistPlans() {
  try {
    localStorage.setItem("eventwise-plans", JSON.stringify(savedPlans));
    localStorage.setItem("eventwise-active-plan", activePlanId || "");
    $("storage-status").hidden = true;
  } catch {
    announceStorageError();
  }
}
function newId() {
  return globalThis.crypto?.randomUUID?.() || `plan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function activeRecord() {
  return savedPlans.find(item => item.id === activePlanId);
}
function updatePlanSelector() {
  const selector = $("saved-plans");
  selector.innerHTML = savedPlans.map(record => {
    const title = `${record.event.event_type || "Event"}${record.event.event_date ? ` · ${record.event.event_date}` : ""}`;
    return `<option value="${esc(record.id)}">${esc(title)}</option>`;
  }).join("");
  selector.value = activePlanId || "";
  $("delete-plan-btn").disabled = !activePlanId;
}
function renderBudget() {
  const items = currentPlan.budget || [];
  const largest = Math.max(1, ...items.map(item => Number(item.amount) || 0));
  $("budget-list").innerHTML = items.map((item, i) => `
    <div class="budget-row">
      <label class="budget-name" for="actual-${i}">${esc(item.category)}</label>
      <span class="budget-amount">${money(Number(item.amount) || 0, currentEvent.currency)}</span>
      <label class="actual-label" for="actual-${i}">Actual cost</label>
      <input class="edit-field actual-cost" id="actual-${i}" type="number" min="0" step="0.01"
        inputmode="decimal" data-budget-index="${i}" aria-label="Actual cost for ${esc(item.category)}"
        value="${item.actual_amount ?? ""}" placeholder="Not entered">
      <div class="budget-track" role="img" aria-label="${esc(item.category)} estimated allocation">
        <span style="width:${Math.max(0, Math.min(100, (Number(item.amount) || 0) / largest * 100))}%"></span>
      </div>
    </div>`).join("");
  updateBudgetTotals();
}
function updateBudgetTotals() {
  const actual = (currentPlan.budget || []).reduce((sum, item) => {
    const value = Number(item.actual_amount);
    return sum + (item.actual_amount !== "" && Number.isFinite(value) ? value : 0);
  }, 0);
  const total = Number(currentEvent.budget) || 0;
  const remaining = total - actual;
  $("budget-total").textContent = money(total, currentEvent.currency);
  const estimate = currentEvent.budget_estimate;
  $("budget-label").textContent = estimate?.estimated ? "Estimated planning budget" : "Your planned budget";
  $("budget-estimate-note").textContent = estimate?.estimated
    ? `Indicative estimate as of ${estimate.as_of}. Not a live vendor quote.`
    : "";
  $("budget-actual-total").textContent = `Actual costs: ${money(actual, currentEvent.currency)}`;
  $("budget-remaining").textContent = `${remaining < 0 ? "Over budget" : "Remaining"}: ${money(Math.abs(remaining), currentEvent.currency)}`;
  $("budget-remaining").classList.toggle("over-budget", remaining < 0);
  $("budget-meter").style.width = `${Math.min(100, total ? actual / total * 100 : 0)}%`;
  $("budget-meter").classList.toggle("over-budget-meter", remaining < 0);
}
function renderTimeline() {
  const tasks = currentPlan.timeline || [];
  $("timeline-count").textContent = `${tasks.length} tasks`;
  $("timeline-list").innerHTML = tasks.map((task, i) => `
    <div class="task-row${task.done ? " done" : ""}" data-index="${i}">
      <input type="checkbox" class="task-check" id="task-${i}" ${task.done ? "checked" : ""}
        aria-label="Mark task ${i + 1} complete">
      <div class="task-edit">
        <label class="sr-only" for="task-name-${i}">Task ${i + 1} description</label>
        <input class="edit-field task-name" id="task-name-${i}" maxlength="180" value="${esc(task.task)}">
        <label class="sr-only" for="task-date-${i}">Task ${i + 1} due date</label>
        <input class="edit-field task-date" id="task-date-${i}" type="date" min="${todayISO()}" value="${esc(task.date || "")}">
      </div>
      <div class="item-actions">
        <button class="icon-btn" type="button" data-action="up" aria-label="Move task ${i + 1} up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" type="button" data-action="down" aria-label="Move task ${i + 1} down" ${i === tasks.length - 1 ? "disabled" : ""}>↓</button>
        <button class="icon-btn remove-btn" type="button" data-action="remove" aria-label="Delete task ${i + 1}">×</button>
      </div>
    </div>`).join("");
}
function renderVendors() {
  const vendors = currentPlan.vendors || [];
  $("vendor-count").textContent = `${vendors.length} items`;
  $("vendor-list").innerHTML = vendors.map((vendor, i) => `
    <div class="vendor-row${vendor.contacted ? " contacted" : ""}" data-index="${i}">
      <input type="checkbox" class="vendor-check" id="vendor-${i}" ${vendor.contacted ? "checked" : ""}
        aria-label="Mark checklist item ${i + 1} complete">
      <div class="vendor-copy">
        <label class="sr-only" for="vendor-name-${i}">Checklist item ${i + 1}</label>
        <input class="edit-field vendor-name" id="vendor-name-${i}" maxlength="180" value="${esc(vendor.name)}">
        <label class="sr-only" for="vendor-notes-${i}">Notes for checklist item ${i + 1}</label>
        <input class="edit-field vendor-notes" id="vendor-notes-${i}" type="text" maxlength="500"
          placeholder="Quote, contact, or follow-up notes" value="${esc(vendor.notes || "")}">
      </div>
      <span class="vendor-status">${vendor.contacted ? "Done" : "To do"}</span>
      <div class="item-actions">
        <button class="icon-btn" type="button" data-action="up" aria-label="Move checklist item ${i + 1} up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" type="button" data-action="down" aria-label="Move checklist item ${i + 1} down" ${i === vendors.length - 1 ? "disabled" : ""}>↓</button>
        <button class="icon-btn remove-btn" type="button" data-action="remove" aria-label="Delete checklist item ${i + 1}">×</button>
      </div>
    </div>`).join("");
}
function updatePlanningProgress() {
  const checks = [
    ...$("timeline-list").querySelectorAll(".task-check"),
    ...$("vendor-list").querySelectorAll(".vendor-check")
  ];
  const done = checks.filter(input => input.checked).length;
  const percentage = checks.length ? Math.round(done / checks.length * 100) : 0;
  $("progress-bar").value = percentage;
  $("progress-percent").textContent = `${percentage}%`;
  $("progress-count").textContent = `${done} of ${checks.length} checklist items complete`;
}
function renderPlan(plan) {
  currentPlan = plan;
  currentPlan.timeline = (plan.timeline || []).map(task =>
    typeof task === "string" ? {task, date: "", status: "pending", done: false} : {...task});
  currentPlan.vendors = (plan.vendors || []).map(vendor =>
    typeof vendor === "string" ? {name: vendor, notes: "", contacted: false} : {...vendor});
  currentPlan.budget = (plan.budget || []).map(item => ({...item, actual_amount: item.actual_amount ?? ""}));
  $("empty-state").hidden = true;
  $("results").hidden = false;
  $("plan-title").textContent = plan.title || "Your event plan";
  $("plan-summary").textContent = plan.summary || "";
  $("theme-text").textContent = plan.theme || "";
  $("mode-tag").textContent = plan.mode === "gemini" ? "✦ Gemini AI" : "Local planning mode";
  $("ideas-list").innerHTML = (plan.ideas || []).map(item => `<li>${esc(item)}</li>`).join("");
  $("assumptions-list").innerHTML = (plan.assumptions || []).map(item => `<li>${esc(item)}</li>`).join("");
  renderBudget();
  renderTimeline();
  renderVendors();
  const record = activeRecord();
  if (record?.progress) applyProgress(record.progress);
  updatePlanningProgress();
  updatePlanSelector();
}
function captureProgress() {
  return {
    tasks: [...$("timeline-list").querySelectorAll(".task-check")].map(input => input.checked),
    vendors: [...$("vendor-list").querySelectorAll(".vendor-row")].map(row => ({
      checked: row.querySelector(".vendor-check").checked,
      notes: row.querySelector(".vendor-notes").value
    }))
  };
}
function applyProgress(progress) {
  $("timeline-list").querySelectorAll(".task-check").forEach((input, i) => {
    input.checked = Boolean(progress.tasks?.[i] ?? currentPlan.timeline[i]?.done);
    input.closest(".task-row").classList.toggle("done", input.checked);
    currentPlan.timeline[i].done = input.checked;
  });
  $("vendor-list").querySelectorAll(".vendor-row").forEach((row, i) => {
    const vendor = currentPlan.vendors[i];
    const saved = progress.vendors?.[i];
    const checked = Boolean(saved?.checked ?? vendor.contacted);
    row.querySelector(".vendor-check").checked = checked;
    row.querySelector(".vendor-notes").value = saved?.notes ?? vendor.notes ?? "";
    row.querySelector(".vendor-status").textContent = checked ? "Done" : "To do";
    row.classList.toggle("contacted", checked);
    vendor.contacted = checked;
    vendor.notes = row.querySelector(".vendor-notes").value;
  });
}
function saveProgress() {
  if (!currentPlan || !activePlanId) return;
  const record = activeRecord();
  if (!record) return;
  currentPlan.timeline.forEach((task, i) => {
    task.done = Boolean($("timeline-list").querySelectorAll(".task-check")[i]?.checked);
  });
  currentPlan.vendors.forEach((vendor, i) => {
    const row = $("vendor-list").querySelectorAll(".vendor-row")[i];
    if (!row) return;
    vendor.contacted = row.querySelector(".vendor-check").checked;
    vendor.notes = row.querySelector(".vendor-notes").value;
  });
  record.plan = currentPlan;
  record.event = currentEvent;
  record.progress = captureProgress();
  record.updatedAt = Date.now();
  persistPlans();
  updatePlanSelector();
}
function syncForm(eventData) {
  const form = $("event-form");
  const selected = [...form.querySelectorAll('input[name="event_type"]')]
    .find(input => input.value === eventData.event_type);
  if (selected) selected.checked = true;
  ["event_date", "guests", "currency", "style", "location", "notes"].forEach(name => {
    const field = form.elements.namedItem(name);
    if (eventData[name] !== undefined && field) field.value = eventData[name];
  });
}
function createSavedPlan(eventData, plan) {
  const record = {
    id: newId(),
    event: eventData,
    plan,
    progress: {tasks: [], vendors: []},
    updatedAt: Date.now()
  };
  savedPlans.unshift(record);
  activePlanId = record.id;
  persistPlans();
  return record;
}
function selectPlan(id) {
  const record = savedPlans.find(item => item.id === id);
  if (!record) return;
  activePlanId = record.id;
  currentEvent = record.event;
  syncForm(currentEvent);
  renderPlan(record.plan);
  persistPlans();
}
function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], {type});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
function renderSavedPlan() {
  try {
    const plans = JSON.parse(localStorage.getItem("eventwise-plans") || "null");
    if (Array.isArray(plans)) {
      savedPlans = plans.filter(item => item && item.id && item.event && item.plan);
    } else {
      const old = JSON.parse(localStorage.getItem("eventwise-plan") || "null");
      if (old?.event && old?.plan) {
        const oldProgress = JSON.parse(localStorage.getItem("eventwise-progress") || "null");
        const record = {id: newId(), event: old.event, plan: old.plan, progress: oldProgress || {}, updatedAt: Date.now()};
        savedPlans = [record];
        activePlanId = record.id;
        persistPlans();
      }
    }
    const storedActiveId = localStorage.getItem("eventwise-active-plan");
    const record = savedPlans.find(item => item.id === storedActiveId) || savedPlans[0];
    if (record) selectPlan(record.id);
    else updatePlanSelector();
  } catch {
    updatePlanSelector();
  }
}

$("event_date").min = todayISO();
$("event_date").addEventListener("change", () => {
  const dateValue = $("event_date").value;
  $("date-hint").textContent = dateValue && dateValue < todayISO()
    ? "Choose today or a future date."
    : "Choose a future date for suggested task deadlines.";
});
$("event-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const data = getEvent();
  if (!Number.isInteger(data.guests) || data.guests < 1) return showError("Please enter at least one guest.");
  if (data.event_date && data.event_date < todayISO()) return showError("Choose today or a future event date.");
  const button = $("generate-btn");
  button.disabled = true;
  button.textContent = "Creating your plan…";
  try {
    const response = await fetch("/api/plan", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not create the plan.");
    currentEvent = {...data, budget: result.budget_estimate.amount, budget_estimate: result.budget_estimate};
    createSavedPlan(currentEvent, result);
    renderPlan(result);
    $("results").scrollIntoView({behavior: "smooth", block: "start"});
  } catch (error) {
    showError(error.message || "Something went wrong. Please try again.");
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>✦</span> Create my event plan <span class=\"btn-arrow\">→</span>";
  }
});
$("new-plan-btn").addEventListener("click", () => {
  activePlanId = null;
  currentPlan = null;
  currentEvent = null;
  $("event-form").reset();
  $("event_date").min = todayISO();
  $("results").hidden = true;
  $("empty-state").hidden = false;
  clearError();
  updatePlanSelector();
  persistPlans();
  $("event-form").scrollIntoView({behavior: "smooth", block: "start"});
});
$("saved-plans").addEventListener("change", event => selectPlan(event.target.value));
$("delete-plan-btn").addEventListener("click", () => {
  if (!activePlanId || !window.confirm("Delete this saved event plan? This cannot be undone.")) return;
  savedPlans = savedPlans.filter(record => record.id !== activePlanId);
  activePlanId = null;
  currentPlan = null;
  currentEvent = null;
  persistPlans();
  const next = savedPlans[0];
  if (next) selectPlan(next.id);
  else {
    $("results").hidden = true;
    $("empty-state").hidden = false;
    updatePlanSelector();
  }
});
$("timeline-list").addEventListener("change", event => {
  const row = event.target.closest(".task-row");
  if (!row) return;
  const index = Number(row.dataset.index);
  if (event.target.matches(".task-check")) {
    currentPlan.timeline[index].done = event.target.checked;
    row.classList.toggle("done", event.target.checked);
  } else if (event.target.matches(".task-date")) {
    currentPlan.timeline[index].date = event.target.value;
  }
  updatePlanningProgress();
  saveProgress();
});
$("timeline-list").addEventListener("input", event => {
  if (!event.target.matches(".task-name")) return;
  const row = event.target.closest(".task-row");
  currentPlan.timeline[Number(row.dataset.index)].task = event.target.value;
  saveProgress();
});
$("timeline-list").addEventListener("click", event => handleItemAction(event, "timeline"));
$("vendor-list").addEventListener("change", event => {
  const row = event.target.closest(".vendor-row");
  if (!row || !event.target.matches(".vendor-check")) return;
  const vendor = currentPlan.vendors[Number(row.dataset.index)];
  vendor.contacted = event.target.checked;
  row.classList.toggle("contacted", vendor.contacted);
  row.querySelector(".vendor-status").textContent = vendor.contacted ? "Done" : "To do";
  updatePlanningProgress();
  saveProgress();
});
$("vendor-list").addEventListener("input", event => {
  const row = event.target.closest(".vendor-row");
  if (!row) return;
  const vendor = currentPlan.vendors[Number(row.dataset.index)];
  if (event.target.matches(".vendor-name")) vendor.name = event.target.value;
  if (event.target.matches(".vendor-notes")) vendor.notes = event.target.value;
  saveProgress();
});
$("vendor-list").addEventListener("click", event => handleItemAction(event, "vendors"));
$("budget-list").addEventListener("input", event => {
  if (!event.target.matches(".actual-cost")) return;
  currentPlan.budget[Number(event.target.dataset.budgetIndex)].actual_amount = event.target.value;
  updateBudgetTotals();
  saveProgress();
});
function handleItemAction(event, collectionName) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const collection = currentPlan[collectionName];
  const index = Number(button.closest("[data-index]").dataset.index);
  const action = button.dataset.action;
  saveProgress();
  if (action === "remove") collection.splice(index, 1);
  if (action === "up" && index > 0) [collection[index - 1], collection[index]] = [collection[index], collection[index - 1]];
  if (action === "down" && index < collection.length - 1) [collection[index + 1], collection[index]] = [collection[index], collection[index + 1]];
  const record = activeRecord();
  record.progress = {
    tasks: currentPlan.timeline.map(task => Boolean(task.done)),
    vendors: currentPlan.vendors.map(vendor => ({checked: Boolean(vendor.contacted), notes: vendor.notes || ""}))
  };
  record.plan = currentPlan;
  record.updatedAt = Date.now();
  persistPlans();
  renderPlan(currentPlan);
  saveProgress();
}
$("add-task-btn").addEventListener("click", () => {
  currentPlan.timeline.push({task: "New planning task", date: "", status: "pending", done: false});
  renderPlan(currentPlan);
  saveProgress();
  $("timeline-list").lastElementChild?.querySelector(".task-name")?.focus();
});
$("add-vendor-btn").addEventListener("click", () => {
  currentPlan.vendors.push({name: "New checklist item", notes: "", contacted: false});
  renderPlan(currentPlan);
  saveProgress();
  $("vendor-list").lastElementChild?.querySelector(".vendor-name")?.focus();
});
$("chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("chat-message").value.trim();
  if (!message) return;
  const button = $("chat-btn");
  button.disabled = true;
  button.textContent = "Thinking…";
  $("chat-answer").hidden = true;
  try {
    const response = await fetch("/api/chat", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({message, event: currentEvent || getEvent()})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not get an answer.");
    $("chat-answer").textContent = result.answer;
    $("chat-answer").hidden = false;
  } catch (error) {
    $("chat-answer").textContent = error.message || "Something went wrong. Please try again.";
    $("chat-answer").hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Ask <span>→</span>';
  }
});
$("download-btn").addEventListener("click", () => {
  if (!currentPlan) return;
  const record = activeRecord();
  downloadFile("eventwise-plan.json", JSON.stringify({...currentPlan, event: currentEvent, progress: record?.progress}, null, 2), "application/json");
});
$("csv-btn").addEventListener("click", () => {
  if (!currentPlan) return;
  const rows = [["Category", "Estimated", "Actual", "Currency"]];
  currentPlan.budget.forEach(item => rows.push([item.category, item.amount, item.actual_amount ?? "", currentEvent.currency]));
  const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  downloadFile("eventwise-budget.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
});
$("print-btn").addEventListener("click", () => window.print());
renderSavedPlan();
