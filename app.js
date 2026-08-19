/* ============ 个人行为管理工作台 v2 ============ */
const STORE_KEY = "pbm_records_v1";
const EMOTION_CATEGORIES = ["过往情绪", "金钱课题", "环境触发", "身体不适", "他人触发", "评价他人", "自我评价", "工作焦虑", "个人发展焦虑"];
const EMOTION_SOLUTIONS = ["跟智者作者对话", "读书", "爱的呼吸", "紫光冥想", "应急手势"];
const BODY_PRACTICES = ["女丹功法", "爱的呼吸", "枯树盘根", "熊经鸟伸"];
const DIET_ITEMS = ["洋葱配方", "黑米套餐", "白菜西蓝花配方", "过午不食"];
const HEALTH_HABITS = ["坐姿", "效率", "主动性"];
const SOUL_VOW = "从今天开始，我对我的灵魂和行为负 100% 的责任。我拒绝所有无意识操纵，包括家庭关系、亲密关系和祖先对我的操纵，不抱怨。拒绝无意识操纵，拿回主动权。";

const COLORS = { mindset: "#8b5cf6", behavior: "#10b981", emotion: "#f59e0b", body: "#3b82f6", energy: "#3b82f6", sleep: "#0ea5e9", combo: "#4f46e5" };

/* ---------- 存储层 ---------- */
function loadRecords() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function saveRecords(r) { localStorage.setItem(STORE_KEY, JSON.stringify(r)); }

/* ---------- 工具 ---------- */
const $ = (id) => document.getElementById(id);
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const pad2 = (n) => String(n).padStart(2, "0");
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 1800); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------- 状态 ---------- */
let records = loadRecords();
let currentDate = todayStr();
let currentMetric = "emotion";
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
// 多选组的工作态
let emotionCats = [], emotionSols = [], bodyPractices = [], dietState = [], healthHabitsState = [];

/* ---------- 多选 chip 渲染 ---------- */
function renderChipGroup(containerId, items, stateArr) {
  const box = $(containerId);
  box.innerHTML = "";
  items.forEach((item) => {
    const el = document.createElement("span");
    el.className = "habit" + (stateArr.includes(item) ? " checked" : "");
    el.textContent = item;
    el.addEventListener("click", () => {
      const i = stateArr.indexOf(item);
      if (i >= 0) stateArr.splice(i, 1); else stateArr.push(item);
      el.classList.toggle("checked", stateArr.includes(item));
    });
    box.appendChild(el);
  });
}

/* ---------- 加载某天到表单 ---------- */
function loadDateToForm(date) {
  currentDate = date;
  const rec = records[date] || {};
  $("dreamNote").value = rec.dream?.note || rec.mindset?.note || "";
  $("emotionScore").value = rec.emotion?.score ?? 5;
  $("emotionScoreOut").textContent = $("emotionScore").value;
  emotionCats = [...(rec.emotion?.categories || [])];
  emotionSols = [...(rec.emotion?.solutions || [])];
  $("emotionText").value = rec.emotion?.text || "";
  $("sleepHours").value = rec.body?.sleep ?? 7;
  $("energyScore").value = rec.body?.energy ?? 5;
  $("energyScoreOut").textContent = $("energyScore").value;
  bodyPractices = [...(rec.body?.practices || [])];
  $("bodyNote").value = rec.body?.note || "";
  $("periodStart").checked = !!rec.body?.periodStart;
  $("periodEnd").checked = !!rec.body?.periodEnd;
  $("soulVow").checked = !!rec.soulVow;
  dietState = [...(rec.diet || [])];
  healthHabitsState = [...(rec.healthHabits || [])];
  $("diaryText").value = rec.diary || "";
  renderChipGroup("emotionCats", EMOTION_CATEGORIES, emotionCats);
  renderChipGroup("emotionSols", EMOTION_SOLUTIONS, emotionSols);
  renderChipGroup("bodyPractices", BODY_PRACTICES, bodyPractices);
  renderChipGroup("dietItems", DIET_ITEMS, dietState);
  renderChipGroup("healthHabits", HEALTH_HABITS, healthHabitsState);
  renderChart();
  renderDiaryHistory();
  renderCalendar();
}

/* ---------- 保存 ---------- */
function saveCurrent() {
  const rec = records[currentDate] || {};
  rec.dream = { note: $("dreamNote").value.trim() };
  rec.emotion = {
    score: +$("emotionScore").value,
    categories: [...emotionCats],
    text: $("emotionText").value.trim(),
    solutions: [...emotionSols],
  };
  rec.body = {
    sleep: +$("sleepHours").value || 0,
    energy: +$("energyScore").value,
    practices: [...bodyPractices],
    note: $("bodyNote").value.trim(),
    periodStart: $("periodStart").checked,
    periodEnd: $("periodEnd").checked,
  };
  rec.soulVow = $("soulVow").checked;
  rec.diet = [...dietState];
  rec.healthHabits = [...healthHabitsState];
  rec.diary = $("diaryText").value.trim();
  const hasContent =
    rec.dream.note || rec.emotion.text || rec.emotion.categories.length || rec.emotion.solutions.length ||
    rec.emotion.score !== 5 || rec.body.sleep !== 7 || rec.body.energy !== 5 ||
    rec.body.practices.length || rec.body.note || rec.body.periodStart || rec.body.periodEnd ||
    rec.soulVow || rec.diet.length || rec.healthHabits.length || rec.diary;
  if (hasContent) records[currentDate] = rec;
  else delete records[currentDate];
  saveRecords(records);
  toast(hasContent ? `已保存 ${currentDate} 的记录` : `已清空 ${currentDate}（内容为空）`);
  renderChart(); renderDiaryHistory(); renderCalendar();
}

/* ---------- 趋势图（纯 SVG） ---------- */
function metricSeries(metric) {
  const dates = Object.keys(records).sort();
  if (metric === "combo") {
    const defs = [["情绪", (r) => r.emotion?.score, COLORS.emotion], ["精力", (r) => r.body?.energy, COLORS.energy]];
    return defs.map(([name, get, color]) => ({ name, color, pts: dates.map((d) => { const v = get(records[d]); return v == null ? null : +v; }) }));
  }
  const map = { emotion: ["情绪", (r) => r.emotion?.score, COLORS.emotion], energy: ["精力", (r) => r.body?.energy, COLORS.energy], sleep: ["睡眠", (r) => r.body?.sleep, COLORS.sleep] };
  const [name, get, color] = map[metric];
  return [{ name, color, pts: dates.map((d) => { const v = get(records[d]); return v == null ? null : +v; }) }];
}
function renderChart() {
  const wrap = $("chartWrap"), empty = $("chartEmpty");
  const series = metricSeries(currentMetric);
  const dates = Object.keys(records).sort();
  const hasData = series.some((s) => s.pts.some((v) => v != null));
  if (!hasData || dates.length === 0) { wrap.innerHTML = ""; empty.hidden = false; return; }
  empty.hidden = true;
  const W = 520, H = 300, padL = 38, padR = 14, padT = 16, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxV = currentMetric === "sleep" ? Math.max(14, ...series[0].pts.filter((v) => v != null)) : 10;
  const minV = 0, n = dates.length;
  const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  for (let t = 0; t <= 5; t++) {
    const val = minV + ((maxV - minV) * t) / 5, yy = y(val);
    svg += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#eef1f6"/>`;
    svg += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#9aa4b2">${val % 1 === 0 ? val : val.toFixed(1)}</text>`;
  }
  const step = Math.ceil(n / 6);
  dates.forEach((d, i) => { if (i % step === 0 || i === n - 1) svg += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#9aa4b2">${d.slice(5)}</text>`; });
  series.forEach((s) => {
    let dPath = "", started = false;
    s.pts.forEach((v, i) => { if (v == null) { started = false; return; } dPath += `${started ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; started = true; });
    if (dPath) svg += `<path d="${dPath}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>`;
    s.pts.forEach((v, i) => { if (v == null) return; svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2" fill="#fff" stroke="${s.color}" stroke-width="2"/>`; });
  });
  let lx = padL;
  series.forEach((s) => { svg += `<rect x="${lx}" y="${H - 30}" width="10" height="10" rx="2" fill="${s.color}"/><text x="${lx + 14}" y="${H - 21}" font-size="10.5" fill="#6b7686">${s.name}</text>`; lx += 14 + s.name.length * 11 + 16; });
  svg += `</svg>`;
  wrap.innerHTML = svg;
}

/* ---------- 日记历史 ---------- */
function renderDiaryHistory() {
  const box = $("diaryHistory");
  const items = Object.keys(records).filter((d) => records[d].diary && records[d].diary.trim()).sort().reverse().slice(0, 12);
  if (items.length === 0) { box.innerHTML = `<p class="chart-empty" style="padding:14px 0">还没有日记，写一句今天的感受吧。</p>`; return; }
  box.innerHTML = "";
  items.forEach((d) => {
    const r = records[d];
    const meta = [r.emotion?.score ? `情绪 ${r.emotion.score}` : "", r.body?.energy ? `精力 ${r.body.energy}` : ""].filter(Boolean).join("  ·  ");
    const el = document.createElement("div");
    el.className = "diary-item";
    el.innerHTML = `<div class="meta"><b>${d}</b><span>${meta}</span></div><div class="txt">${escapeHtml(r.diary)}</div>`;
    box.appendChild(el);
  });
}

/* ---------- 日历 ---------- */
function renderCalendar() {
  $("calLabel").textContent = `${viewYear}年${viewMonth + 1}月`;
  const grid = $("calGrid");
  grid.innerHTML = "";
  const startDay = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 周一为首
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayStr();
  for (let i = 0; i < startDay; i++) { const c = document.createElement("div"); c.className = "cal-cell empty"; grid.appendChild(c); }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
    const c = document.createElement("div");
    const rec = records[ds];
    const isStart = rec?.body?.periodStart;
    const isEnd = rec?.body?.periodEnd;
    c.className = "cal-cell" + (rec ? " has-rec" : "") + (ds === today ? " today" : "") + (isStart ? " period-start" : "") + (isEnd ? " period-end" : "");
    c.innerHTML = `${d}${isStart ? '<span class="cal-mark start">始</span>' : ''}${isEnd ? '<span class="cal-mark end">终</span>' : ''}`;
    c.addEventListener("click", () => { $("recordDate").value = ds; loadDateToForm(ds); });
    grid.appendChild(c);
  }
}
function shiftMonth(delta) { viewMonth += delta; if (viewMonth < 0) { viewMonth = 11; viewYear--; } else if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderCalendar(); }

/* ---------- 月度总结报告 ---------- */
function freqOf(recs, pick) { const m = {}; recs.forEach(({ r }) => (pick(r) || []).forEach((k) => (m[k] = (m[k] || 0) + 1))); return m; }
function generateReport() {
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const recs = [];
  for (let d = 1; d <= daysInMonth; d++) { const ds = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`; if (records[ds]) recs.push({ ds, r: records[ds] }); }
  const body = $("reportBody");
  if (recs.length === 0) { body.innerHTML = `<p class="chart-empty" style="padding:18px 0">${viewYear}年${viewMonth + 1}月暂无记录。</p>`; return; }
  const avg = (sel) => { const v = recs.map((x) => sel(x.r)).filter((n) => n != null && !isNaN(n)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const aEmo = avg((r) => r.emotion?.score), aEng = avg((r) => r.body?.energy), aSleep = avg((r) => r.body?.sleep);
  const catFreq = freqOf(recs, (r) => r.emotion?.categories);
  const solFreq = freqOf(recs, (r) => r.emotion?.solutions);
  const pracFreq = freqOf(recs, (r) => r.body?.practices);
  const dietFreq = freqOf(recs, (r) => r.diet);
  const habitFreq = freqOf(recs, (r) => r.healthHabits);
  const vowDays = recs.filter(({ r }) => r.soulVow).length;
  const topCat = Object.entries(catFreq).sort((a, b) => b[1] - a[1]).find(([, v]) => v > 0);
  const topPrac = Object.entries(pracFreq).sort((a, b) => b[1] - a[1]).find(([, v]) => v > 0);
  const noFoodAfterNoon = dietFreq["过午不食"] || 0;

  const stat = (v, k) => `<div class="stat"><div class="v">${v != null ? (typeof v === "number" && v % 1 !== 0 ? v.toFixed(1) : v) : "—"}</div><div class="k">${k}</div></div>`;
  const chips = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="report-chip">${k} ${v}</span>`).join("") || `<span class="report-chip">无</span>`;

  let summary = `${viewYear}年${viewMonth + 1}月共记录 <b>${recs.length}</b> 天（占当月 ${Math.round(recs.length / daysInMonth * 100)}%）。`;
  const emoLevel = aEmo == null ? "未知" : aEmo >= 7 ? "整体愉悦平稳" : aEmo >= 5 ? "起伏中等" : "偏低，需更多自我关照";
  summary += `情绪均分 ${aEmo?.toFixed(1) ?? "—"}（${emoLevel}），精力均分 ${aEng?.toFixed(1) ?? "—"}，睡眠均分 ${aSleep?.toFixed(1) ?? "—"} 小时。`;
  if (topCat) summary += `本月最突出的情绪课题是「${topCat[0]}」（${topCat[1]} 次），值得作为觉察重点。`;
  if (topPrac) summary += `最常练习的功法是「${topPrac[0]}」。`;
  summary += `灵魂祈愿打卡 ${vowDays} 天，拿回主动权的练习正在进行；「过午不食」坚持 ${noFoodAfterNoon} 天。`;

  body.innerHTML = `
    <div class="report-stats">
      ${stat(recs.length, "记录天数")}
      ${stat(aEmo, "情绪均分")}
      ${stat(aEng, "精力均分")}
      ${stat(aSleep, "睡眠均分")}
      ${stat(vowDays, "祈愿打卡")}
    </div>
    <div class="report-sec"><h4>情绪分类频次</h4><div class="report-chips">${chips(catFreq)}</div></div>
    <div class="report-sec"><h4>应对方案使用</h4><div class="report-chips">${chips(solFreq)}</div></div>
    <div class="report-sec"><h4>功法练习</h4><div class="report-chips">${chips(pracFreq)}</div></div>
    <div class="report-sec"><h4>健康饮食</h4><div class="report-chips">${chips(dietFreq)}</div></div>
    <div class="report-sec"><h4>健康习惯</h4><div class="report-chips">${chips(habitFreq)}</div></div>
    <div class="report-summary">${summary}</div>`;
}

/* ---------- 绑定 ---------- */
function bindRange(id, outId) { const el = $(id), out = $(outId); el.addEventListener("input", () => (out.textContent = el.value)); }
function init() {
  $("recordDate").value = currentDate;
  $("recordDate").addEventListener("change", (e) => loadDateToForm(e.target.value));
  $("saveBtn").addEventListener("click", saveCurrent);
  bindRange("emotionScore", "emotionScoreOut");
  bindRange("energyScore", "energyScoreOut");
  $("calPrev").addEventListener("click", () => shiftMonth(-1));
  $("calNext").addEventListener("click", () => shiftMonth(1));
  $("reportBtn").addEventListener("click", generateReport);
  $("exportBtn").addEventListener("click", exportData);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
  $("trendTabs").querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      $("trendTabs").querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active"); currentMetric = t.dataset.metric; renderChart();
    });
  });
  loadDateToForm(currentDate);
}

/* ---------- 数据备份：导出 / 导入 ---------- */
function exportData() {
  const payload = { app: "温柔的守望", version: 1, exportedAt: new Date().toISOString(), records };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `温柔的守望-数据-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`已导出 ${Object.keys(records).length} 天记录`);
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const incoming = data && data.records ? data.records : data;
      if (typeof incoming !== "object" || incoming === null) throw new Error("格式不对");
      let count = 0;
      Object.keys(incoming).forEach((d) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        records[d] = incoming[d];
        count++;
      });
      if (count === 0) throw new Error("无有效记录");
      saveRecords(records);
      loadDateToForm(currentDate);
      toast(`已导入 ${count} 天记录`);
    } catch (e) {
      toast("导入失败：文件格式不正确");
    }
  };
  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", init);
