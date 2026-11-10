/* 관리자 화면 - 로그인 확인은 Apps Script 서버에서 합니다 (이 파일에 비밀번호 없음) */
(function () {
  "use strict";
  var W = window.WZ, el = W.el, num = W.num;
  var $ = function (id) { return document.getElementById(id); };
  var TOKEN_KEY = "wz-admin-token";
  var state = { submissions: [], issues: [], counts: {}, sheetUrl: "" };
  var current = null, issuePhoto = null, editingNo = null;

  function token() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* 무시 */ } }

  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function call(action, data) {
    return W.api(action, Object.assign({ token: token() }, data || {})).catch(function (err) {
      if (err.code === "AUTH") { setToken(""); showLogin("로그인이 만료됐어요. 다시 로그인해 주세요."); }
      throw err;
    });
  }
  function openModal(id) { var m = $(id); if (m.showModal) m.showModal(); else m.setAttribute("open", ""); }
  function closeModal(m) { if (m.close) m.close(); else m.removeAttribute("open"); }
  document.querySelectorAll("dialog.modal").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m || e.target.closest("[data-close]")) closeModal(m); });
  });

  // ---------- 로그인 ----------
  function showLogin(msg) {
    $("adminView").hidden = true; $("logoutBtn").hidden = true; $("loginForm").hidden = false;
    if (msg) { $("loginError").textContent = msg; $("loginError").hidden = false; }
  }
  if (!W.CFG.apiUrl) $("noApi").hidden = false;

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var id = $("loginId").value.trim(), pw = $("loginPw").value;
    $("loginError").hidden = true;
    if (!id || !pw) { $("loginError").textContent = "아이디와 비밀번호를 모두 입력해 주세요."; $("loginError").hidden = false; return; }
    if (!W.CFG.apiUrl) { $("loginError").textContent = "서버가 아직 연결되지 않았어요."; $("loginError").hidden = false; return; }
    var b = $("loginBtn"); b.disabled = true; b.textContent = "확인하고 있어요…";
    W.api("login", { id: id, pw: pw }).then(function (res) {
      setToken(res.token); $("loginPw").value = ""; load();
    }).catch(function (err) {
      $("loginError").textContent = err.code === "LOGIN" ? "아이디나 비밀번호가 맞지 않아요." : "로그인하지 못했어요. (" + err.message + ")";
      $("loginError").hidden = false;
    }).then(function () { b.disabled = false; b.textContent = "로그인"; });
  });
  $("logoutBtn").addEventListener("click", function () { setToken(""); showLogin(); });

  // ---------- 데이터 ----------
  function load() {
    return call("adminData").then(function (res) {
      state.submissions = res.submissions || [];
      state.issues = (res.issues || []).sort(function (a, b) { return num(b["호수"]) - num(a["호수"]); });
      state.counts = res.counts || {};
      state.sheetUrl = res.sheetUrl || "";
      $("loginForm").hidden = true; $("adminView").hidden = false; $("logoutBtn").hidden = false;
      render();
    });
  }

  // ---------- 탭 ----------
  var tabs = ["wait", "done", "issue"];
  tabs.forEach(function (t) {
    $("tab-" + t).addEventListener("click", function () {
      tabs.forEach(function (x) {
        $("tab-" + x).setAttribute("aria-selected", String(x === t));
        $("pane-" + x).hidden = x !== t;
      });
    });
  });

  // ---------- 그리기 ----------
  function render() {
    var wait = state.submissions.filter(function (s) { return s.status === "대기"; });
    var done = state.submissions.filter(function (s) { return s.status !== "대기"; }).reverse();
    $("cntWait").textContent = wait.length;
    var latest = state.issues[0];
    $("summaryText").textContent = "새로 들어온 상품 " + wait.length + "개" +
      (latest ? " · 가장 최근 호는 " + num(latest["호수"]) + "호(" + (latest["공개"] === "Y" ? "공개 중" : "비공개") + ")예요" : " · 아직 만든 호가 없어요");
    if (state.sheetUrl) $("sheetLink").href = state.sheetUrl; else $("sheetLink").hidden = true;
    renderList($("listWait"), wait, "아직 새로 들어온 상품이 없어요");
    renderList($("listDone"), done, "처리한 상품이 없어요");
    renderIssues();
  }

  function renderList(box, items, empty) {
    box.textContent = "";
    if (!items.length) { box.appendChild(el("div", "adm-empty", empty)); return; }
    items.forEach(function (s) {
      var row = el("article", "adm-item");
      var th = el("div", "adm-item__thumb"); W.media(th, s.photo, ""); row.appendChild(th);
      var meta = el("div", "adm-item__meta");
      var chips = el("div", "chips");
      if (s.category) chips.appendChild(el("span", "chip", s.category));
      var d = W.deadline(s.deadline);
      if (d) chips.appendChild(el("span", "chip " + (d.state === "soon" ? "chip--red" : "chip--gray"), d.text));
      if (s.status === "승인") chips.appendChild(el("span", "chip chip--green", num(s.issue) + "호에 실었어요"));
      if (s.status === "반려") chips.appendChild(el("span", "chip chip--gray", "반려"));
      meta.appendChild(chips);
      meta.appendChild(el("span", "t-card", s.title));
      meta.appendChild(el("span", "t-small c-sub", s.summary));
      meta.appendChild(el("span", "t-cap c-sub", [s.dept, s.name, s.createdAt, s.wish ? "희망: " + s.wish : ""].filter(Boolean).join(" · ")));
      if (s.memo) meta.appendChild(el("span", "t-cap c-mid", "메모: " + s.memo));
      row.appendChild(meta);
      var act = el("div", "adm-item__actions");
      act.appendChild(btn("자세히", "btn--gray", function () { view(s); }));
      if (s.status === "대기") {
        act.appendChild(btn("반려", "btn--danger", function () { reject(s); }));
        act.appendChild(btn("웹진에 싣기", "btn--primary", function () { approve(s); }));
      }
      row.appendChild(act);
      box.appendChild(row);
    });
  }
  function btn(text, cls, fn) { var b = el("button", "btn btn--sm " + cls, text); b.type = "button"; b.addEventListener("click", fn); return b; }

  function renderIssues() {
    var box = $("listIssue"); box.textContent = "";
    if (!state.issues.length) { box.appendChild(el("div", "adm-empty", "아직 만든 호가 없어요. 새 호를 만들어 주세요.")); return; }
    state.issues.forEach(function (it) {
      var no = num(it["호수"]), pub = it["공개"] === "Y";
      var row = el("article", "adm-item");
      var th = el("div", "adm-item__thumb"); W.media(th, W.imgSrc(it["커버사진"]), ""); row.appendChild(th);
      var meta = el("div", "adm-item__meta");
      var chips = el("div", "chips");
      chips.appendChild(el("span", "chip " + (pub ? "chip--green" : "chip--gray"), pub ? "공개 중" : "비공개"));
      chips.appendChild(el("span", "chip chip--gray", "상품 " + (state.counts[no] || 0) + "개"));
      meta.appendChild(chips);
      meta.appendChild(el("span", "t-card", no + "호 · " + (it["커버제목"] || "제목 없음")));
      meta.appendChild(el("span", "t-cap c-sub", [it["주차표기"], it["발행일"]].filter(Boolean).join(" · ")));
      row.appendChild(meta);
      var act = el("div", "adm-item__actions");
      var pv = el("a", "btn btn--sm btn--gray", "미리보기"); pv.href = "./?no=" + no + "&preview=1"; pv.target = "_blank"; pv.rel = "noopener";
      act.appendChild(pv);
      act.appendChild(btn("고치기", "btn--gray", function () { editIssue(it); }));
      act.appendChild(btn(pub ? "비공개로" : "공개하기", pub ? "btn--danger" : "btn--primary", function () { togglePublish(no, !pub, this); }));
      row.appendChild(act);
      box.appendChild(row);
    });
  }

  // ---------- 자세히 ----------
  function view(s) {
    W.media($("vMedia"), s.photo, s.title);
    var c = $("vChips"); c.textContent = "";
    if (s.category) c.appendChild(el("span", "chip", s.category));
    $("vTitle").textContent = s.title; $("vSummary").textContent = s.summary;
    $("vPrice").textContent = W.price(s.price); $("vDetail").textContent = s.detail;
    var a = $("vAttach"); a.textContent = ""; a.style.marginTop = "16px";
    W.list(s.attachments).forEach(function (u) { var i = el("img"); i.src = u; i.alt = "안내 이미지"; a.appendChild(i); });
    var m = $("vMeta"); m.textContent = "";
    [["접수 번호", s.id], ["부서 · 담당자", s.dept + " · " + s.name], ["연락처", s.contact], ["마감일", s.deadline || "없음"],
     ["신청 받을 곳", s.link], ["희망 시기", s.wish || "없음"], ["접수일", s.createdAt]].forEach(function (r) {
      var d = el("div"); d.appendChild(el("dt", "", r[0])); d.appendChild(el("dd", "", r[1])); m.appendChild(d);
    });
    openModal("viewModal");
  }

  // ---------- 승인 ----------
  function approve(s) {
    current = s;
    $("aProduct").textContent = s.title;
    $("aError").hidden = true;
    var sel = $("aIssue"); sel.textContent = "";
    if (!state.issues.length) {
      var o = el("option", "", "먼저 호를 만들어 주세요"); o.value = ""; sel.appendChild(o);
    }
    state.issues.forEach(function (it) {
      var no = num(it["호수"]);
      var o = el("option", "", no + "호 · " + (it["주차표기"] || "") + (it["공개"] === "Y" ? " (공개 중)" : ""));
      o.value = no; sel.appendChild(o);
    });
    var unpublished = state.issues.filter(function (i) { return i["공개"] !== "Y"; })[0];
    if (unpublished) sel.value = num(unpublished["호수"]);
    setOrder();
    openModal("approveModal");
  }
  function setOrder() { $("aOrder").value = (state.counts[num($("aIssue").value)] || 0) + 1; }
  $("aIssue").addEventListener("change", setOrder);
  $("aSubmit").addEventListener("click", function () {
    var no = num($("aIssue").value), order = num($("aOrder").value);
    if (!no) { $("aError").textContent = "실을 호를 골라주세요."; $("aError").hidden = false; return; }
    var b = this; b.disabled = true;
    call("approve", { id: current.id, issue: no, order: order || 1 }).then(function () {
      closeModal($("approveModal")); toast(no + "호에 실었어요"); return load();
    }).catch(function (e) { $("aError").textContent = e.message; $("aError").hidden = false; })
      .then(function () { b.disabled = false; });
  });

  // ---------- 반려 ----------
  function reject(s) { current = s; $("rProduct").textContent = s.title; $("rMemo").value = ""; openModal("rejectModal"); }
  $("rSubmit").addEventListener("click", function () {
    var b = this; b.disabled = true;
    call("reject", { id: current.id, memo: $("rMemo").value.trim() }).then(function () {
      closeModal($("rejectModal")); toast("반려했어요"); return load();
    }).catch(function (e) { toast(e.message); }).then(function () { b.disabled = false; });
  });

  // ---------- 공개 전환 ----------
  function togglePublish(no, on, b) {
    if (on && !confirm(no + "호를 공개할까요? 웹진 첫 화면이 이 호로 바뀌어요.")) return;
    b.disabled = true;
    call("setPublish", { no: no, value: on ? "Y" : "N" }).then(function () {
      toast(on ? no + "호를 공개했어요" : no + "호를 비공개로 바꿨어요"); return load();
    }).catch(function (e) { toast(e.message); b.disabled = false; });
  }

  // ---------- 호수 만들기 · 고치기 ----------
  var IFIELDS = { iNo: "호수", iDate: "발행일", iWeek: "주차표기", iTitleIn: "커버제목", iText: "커버소개", iLink: "커버링크", iProdTitle: "상품섹션제목", iTipTitle: "팁섹션제목" };
  function fillIssue(it) {
    Object.keys(IFIELDS).forEach(function (k) { $(k).value = it ? (it[IFIELDS[k]] || "") : ""; });
    $("iPhotoUrl").value = it ? (it["커버사진"] || "") : "";
    issuePhoto = null; renderIssuePhoto();
    $("iError").hidden = true;
  }
  function renderIssuePhoto() {
    var box = $("iThumb"); box.textContent = "";
    if (!issuePhoto) { $("iDrop").hidden = false; return; }
    var t = el("div", "thumb thumb--wide"); var i = el("img"); i.src = issuePhoto.preview; i.alt = ""; t.appendChild(i);
    var x = el("button", "", "×"); x.type = "button"; x.setAttribute("aria-label", "사진 지우기");
    x.addEventListener("click", function () { issuePhoto = null; renderIssuePhoto(); }); t.appendChild(x);
    box.appendChild(t); $("iDrop").hidden = true;
  }
  $("iPhoto").addEventListener("change", function () {
    var f = this.files[0]; this.value = ""; if (!f) return;
    W.resizeImage(f, 1600).then(function (r) { issuePhoto = r; renderIssuePhoto(); })
      .catch(function (e) { $("iError").textContent = e.message; $("iError").hidden = false; });
  });
  $("newIssueBtn").addEventListener("click", function () {
    editingNo = null; fillIssue(null);
    var next = state.issues.length ? num(state.issues[0]["호수"]) + 1 : 1;
    $("iNo").value = next; $("iNo").disabled = false;
    $("iTitle").textContent = "새 호 만들기";
    openModal("issueModal");
  });
  function editIssue(it) {
    editingNo = num(it["호수"]); fillIssue(it);
    $("iNo").disabled = true;
    $("iTitle").textContent = editingNo + "호 고치기";
    openModal("issueModal");
  }
  $("iSubmit").addEventListener("click", function () {
    var data = {};
    Object.keys(IFIELDS).forEach(function (k) { data[IFIELDS[k]] = $(k).value.trim(); });
    data["커버사진"] = $("iPhotoUrl").value.trim();
    var no = num(data["호수"]);
    if (!no) { $("iError").textContent = "호수를 숫자로 넣어주세요."; $("iError").hidden = false; return; }
    if (!data["커버제목"]) { $("iError").textContent = "커버 제목을 써주세요."; $("iError").hidden = false; return; }
    if (editingNo === null && state.issues.some(function (i) { return num(i["호수"]) === no; })) {
      $("iError").textContent = no + "호는 이미 있어요. 목록에서 고치기를 눌러주세요."; $("iError").hidden = false; return;
    }
    var b = this; b.disabled = true; b.textContent = "저장하고 있어요…";
    call("saveIssue", { issue: data, isNew: editingNo === null, photo: issuePhoto ? { name: issuePhoto.name, data: issuePhoto.data } : null })
      .then(function () { closeModal($("issueModal")); toast(no + "호를 저장했어요"); return load(); })
      .catch(function (e) { $("iError").textContent = e.message; $("iError").hidden = false; })
      .then(function () { b.disabled = false; b.textContent = "저장하기"; });
  });

  // ---------- 시작 ----------
  if (token() && W.CFG.apiUrl) load().catch(function () { showLogin(); });
  else showLogin();
})();
