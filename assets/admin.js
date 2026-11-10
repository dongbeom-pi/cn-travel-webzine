/* 관리자 - 웹진의 모든 내용을 여기서 고칩니다. 로그인 확인은 Apps Script 서버에서 합니다. */
(function () {
  "use strict";
  var W = window.WZ, el = W.el, num = W.num;
  var $ = function (id) { return document.getElementById(id); };
  var TOKEN_KEY = "wz-admin-token";
  var S = { submissions: [], issues: [], products: [], tips: [], news: [], sheetUrl: "", cur: null };

  // ---------- 공통 ----------
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
  function openModal(id) { var m = $(id); if (m.showModal) m.showModal(); else m.setAttribute("open", ""); var s = m.querySelector(".modal__scroll"); if (s) s.scrollTop = 0; }
  function closeModal(id) { var m = typeof id === "string" ? $(id) : id; if (m.close) m.close(); else m.removeAttribute("open"); }
  document.querySelectorAll("dialog.modal").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m || e.target.closest("[data-close]")) closeModal(m); });
  });
  function btn(text, cls, fn) { var b = el("button", "btn btn--sm " + cls, text); b.type = "button"; b.addEventListener("click", fn); return b; }
  var ICON = { up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6" };
  function iconBtn(dir, label, fn, disabled) {
    var b = el("button", "icon-btn"); b.type = "button"; b.setAttribute("aria-label", label); b.disabled = !!disabled;
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICON[dir] + '"/></svg>';
    b.addEventListener("click", fn); return b;
  }
  function busy(b, text) { var old = b.textContent; b.disabled = true; b.textContent = text || "저장하고 있어요…"; return function () { b.disabled = false; b.textContent = old; }; }
  function showErr(id, msg) { $(id).textContent = msg; $(id).hidden = false; }
  function byOrder(a, b) { return num(a["순서"]) - num(b["순서"]); }
  function ofIssue(list, no) { return list.filter(function (r) { return num(r["호수"]) === no; }).sort(byOrder); }
  function issueOf(no) { return S.issues.filter(function (i) { return num(i["호수"]) === no; })[0]; }

  // ---------- 로그인 ----------
  function showLogin(msg) {
    $("adminView").hidden = true; $("logoutBtn").hidden = true; $("loginForm").hidden = false;
    if (msg) showErr("loginError", msg);
  }
  if (!W.CFG.apiUrl) $("noApi").hidden = false;
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var id = $("loginId").value.trim(), pw = $("loginPw").value;
    $("loginError").hidden = true;
    if (!id || !pw) { showErr("loginError", "아이디와 비밀번호를 모두 입력해 주세요."); return; }
    var done = busy($("loginBtn"), "확인하고 있어요…");
    W.api("login", { id: id, pw: pw }).then(function (res) {
      setToken(res.token); $("loginPw").value = ""; return load();
    }).catch(function (err) {
      showErr("loginError", err.code === "LOGIN" ? "아이디나 비밀번호가 맞지 않아요." : "로그인하지 못했어요. (" + err.message + ")");
    }).then(done);
  });
  function logout() { setToken(""); showLogin(); }
  $("logoutBtn").addEventListener("click", logout);
  $("logoutBtn2").addEventListener("click", logout);

  // ---------- 데이터 ----------
  function load() {
    return call("adminData").then(function (res) {
      S.submissions = res.submissions || [];
      S.issues = (res.issues || []).sort(function (a, b) { return num(b["호수"]) - num(a["호수"]); });
      S.products = res.products || []; S.tips = res.tips || []; S.news = res.news || [];
      S.sheetUrl = res.sheetUrl || "";
      if (S.cur === null || !issueOf(S.cur)) {
        var draft = S.issues.filter(function (i) { return i["공개"] !== "Y"; })[0];
        S.cur = S.issues.length ? num((draft || S.issues[0])["호수"]) : null;
      }
      $("loginForm").hidden = true; $("adminView").hidden = false; $("logoutBtn").hidden = false;
      render();
    });
  }

  // ---------- 탭 ----------
  var TABS = ["edit", "wait", "done"];
  function selectTab(t) {
    TABS.forEach(function (x) { $("tab-" + x).setAttribute("aria-selected", String(x === t)); $("pane-" + x).hidden = x !== t; });
  }
  TABS.forEach(function (t) { $("tab-" + t).addEventListener("click", function () { selectTab(t); }); });

  // ---------- 그리기 ----------
  function render() {
    var wait = S.submissions.filter(function (s) { return s.status === "대기"; });
    $("cntWait").textContent = wait.length;
    var pub = S.issues.filter(function (i) { return i["공개"] === "Y"; })[0];
    $("summaryText").textContent = (pub ? "지금 공개 중인 호는 " + num(pub["호수"]) + "호예요" : "아직 공개한 호가 없어요") +
      (wait.length ? " · 새로 들어온 상품 " + wait.length + "개" : "");
    if (S.sheetUrl) $("sheetLink").href = S.sheetUrl;
    renderPicker(); renderEditor();
    renderSubs($("listWait"), wait, "아직 새로 들어온 상품이 없어요");
    renderSubs($("listDone"), S.submissions.filter(function (s) { return s.status !== "대기"; }).reverse(), "처리한 상품이 없어요");
  }

  function renderPicker() {
    var box = $("issuePick"); box.textContent = "";
    S.issues.forEach(function (it) {
      var no = num(it["호수"]);
      var c = el("button", "issue-chip"); c.type = "button";
      c.setAttribute("aria-pressed", String(no === S.cur));
      var dot = el("i", it["공개"] === "Y" ? "on" : ""); dot.setAttribute("aria-hidden", "true");
      c.appendChild(dot); c.appendChild(document.createTextNode(no + "호" + (it["주차표기"] ? " · " + it["주차표기"] : "")));
      c.setAttribute("aria-label", no + "호 " + (it["공개"] === "Y" ? "공개 중" : "비공개"));
      c.addEventListener("click", function () { S.cur = no; renderPicker(); renderEditor(); });
      box.appendChild(c);
    });
    var n = el("button", "issue-chip issue-chip--new", "+ 새 호"); n.type = "button";
    n.addEventListener("click", newIssue);
    box.appendChild(n);
  }

  function renderEditor() {
    var it = S.cur !== null ? issueOf(S.cur) : null;
    $("editor").hidden = !it; $("editorEmpty").hidden = !!it;
    if (!it) return;
    var no = S.cur, pub = it["공개"] === "Y";
    W.media($("edCoverThumb"), W.imgSrc(it["커버사진"]), "");
    var ch = $("edCoverChips"); ch.textContent = "";
    ch.appendChild(el("span", "chip " + (pub ? "chip--green" : "chip--gray"), pub ? "공개 중" : "비공개"));
    ch.appendChild(el("span", "chip chip--gray", no + "호" + (it["주차표기"] ? " · " + it["주차표기"] : "")));
    $("edCoverTitle").textContent = it["커버제목"] || "커버 제목이 없어요";
    $("edCoverText").textContent = it["커버소개"] || "";
    $("edPreview").href = "./?no=" + no + "&preview=1";
    $("edPublish").textContent = pub ? "비공개로" : "공개하기";
    $("edPublish").className = "btn btn--sm " + (pub ? "btn--danger" : "btn--primary");

    var ps = ofIssue(S.products, no), ts = ofIssue(S.tips, no), ns = ofIssue(S.news, no);
    $("cntProducts").textContent = ps.length; $("cntTips").textContent = ts.length; $("cntNews").textContent = ns.length;

    rows($("edProducts"), ps, "상품", "아직 실린 상품이 없어요. 접수함에서 싣거나 직접 추가해 주세요.", function (p) {
      var r = el("article", "adm-item");
      var th = el("div", "adm-item__thumb"); W.media(th, W.imgSrc(p["사진"]), ""); r.appendChild(th);
      var m = el("div", "adm-item__meta");
      var c = el("div", "chips");
      if (p["카테고리"]) c.appendChild(el("span", "chip", p["카테고리"]));
      var d = W.deadline(p["마감일"]);
      if (d) c.appendChild(el("span", "chip " + (d.state === "soon" ? "chip--red" : "chip--gray"), d.text));
      m.appendChild(c);
      m.appendChild(el("span", "t-card", p["상품명"]));
      m.appendChild(el("span", "t-small c-sub", W.price(p["가격"]) + (p["한줄설명"] ? " · " + p["한줄설명"] : "")));
      r.appendChild(m);
      return r;
    }, editProduct);

    rows($("edTips"), ts, "팁", "여행 팁이 없으면 웹진에서 이 영역이 빠져요.", function (t, i) {
      var r = el("article", "adm-item adm-item--text");
      r.appendChild(el("span", "adm-item__no", String(i + 1)));
      var m = el("div", "adm-item__meta");
      m.appendChild(el("span", "t-card", t["제목"])); m.appendChild(el("span", "t-small c-sub", t["내용"]));
      r.appendChild(m); return r;
    }, editTip);

    rows($("edNews"), ns, "소식", "씨앤 소식이 없으면 웹진에서 이 영역이 빠져요.", function (n) {
      var r = el("article", "adm-item adm-item--text");
      r.appendChild(el("span", "adm-item__no", "i"));
      var m = el("div", "adm-item__meta");
      m.appendChild(el("span", "t-card", n["내용"])); if (n["링크"]) m.appendChild(el("span", "t-cap c-sub", n["링크"]));
      r.appendChild(m); return r;
    }, editNews);
  }

  // 목록 + 순서 · 고치기 · 삭제
  function rows(box, list, table, empty, make, onEdit) {
    box.textContent = "";
    if (!list.length) { box.appendChild(el("div", "adm-empty", empty)); return; }
    list.forEach(function (item, i) {
      var r = make(item, i);
      var act = el("div", "adm-item__actions");
      var ord = el("span", "order");
      ord.appendChild(iconBtn("up", "위로", function () { move(table, list, i, -1); }, i === 0));
      ord.appendChild(iconBtn("down", "아래로", function () { move(table, list, i, 1); }, i === list.length - 1));
      act.appendChild(ord);
      act.appendChild(btn("고치기", "btn--gray", function () { onEdit(item); }));
      act.appendChild(btn("삭제", "btn--danger", function () { remove(table, item); }));
      r.appendChild(act);
      box.appendChild(r);
    });
  }

  function move(table, list, i, dir) {
    var ids = list.map(function (x) { return x.id; });
    var j = i + dir; if (j < 0 || j >= ids.length) return;
    var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    var src = table === "상품" ? S.products : table === "팁" ? S.tips : S.news;
    ids.forEach(function (id, k) { src.forEach(function (r) { if (r.id === id) r["순서"] = String(k + 1); }); });
    renderEditor();
    call("reorder", { table: table, ids: ids }).catch(function (e) { toast("순서를 바꾸지 못했어요. " + e.message); load(); });
  }

  function remove(table, item) {
    var name = item["상품명"] || item["제목"] || item["내용"] || "";
    if (!confirm("'" + name + "'을(를) 지울까요? 되돌릴 수 없어요.")) return;
    call("deleteRow", { table: table, id: item.id }).then(function () { toast("지웠어요"); return load(); })
      .catch(function (e) { toast(e.message); });
  }

  // ---------- 호 ----------
  $("edPublish").addEventListener("click", function () {
    var it = issueOf(S.cur), on = it["공개"] !== "Y";
    if (on && !confirm(S.cur + "호를 공개할까요? 웹진 첫 화면이 이 호로 바뀌어요.")) return;
    var done = busy(this, "바꾸고 있어요…");
    call("setPublish", { no: S.cur, value: on ? "Y" : "N" }).then(function () {
      toast(on ? S.cur + "호를 공개했어요" : S.cur + "호를 비공개로 바꿨어요"); return load();
    }).catch(function (e) { toast(e.message); }).then(done);
  });
  $("edDelete").addEventListener("click", function () {
    if (!confirm(S.cur + "호를 지울까요? 이 호의 상품·팁·소식도 함께 지워지고 되돌릴 수 없어요.")) return;
    var no = S.cur, done = busy(this, "지우고 있어요…");
    call("deleteIssue", { no: no }).then(function () { S.cur = null; toast(no + "호를 지웠어요"); return load(); })
      .catch(function (e) { toast(e.message); }).then(done);
  });

  var IF = { iNo: "호수", iDate: "발행일", iWeek: "주차표기", iTitleIn: "커버제목", iText: "커버소개", iLink: "커버링크", iProdTitle: "상품섹션제목", iTipTitle: "팁섹션제목" };
  var issueMode = "new", issuePhoto = null;
  function fillIssue(it) {
    Object.keys(IF).forEach(function (k) { $(k).value = it ? (it[IF[k]] || "") : ""; });
    $("iPhotoUrl").value = it ? (it["커버사진"] || "") : "";
    issuePhoto = null; photoThumb($("iThumb"), $("iDrop"), null, $("iPhotoUrl").value, function () { issuePhoto = null; $("iPhotoUrl").value = ""; fillIssuePhoto(); });
    $("iError").hidden = true;
  }
  function fillIssuePhoto() { photoThumb($("iThumb"), $("iDrop"), issuePhoto, $("iPhotoUrl").value, function () { issuePhoto = null; $("iPhotoUrl").value = ""; fillIssuePhoto(); }); }
  function newIssue() {
    issueMode = "new"; fillIssue(null);
    $("iNo").value = S.issues.length ? num(S.issues[0]["호수"]) + 1 : 1; $("iNo").disabled = false;
    $("iTitle").textContent = "새 호 만들기";
    openModal("issueModal");
  }
  $("edCoverBtn").addEventListener("click", function () {
    issueMode = "edit"; fillIssue(issueOf(S.cur)); $("iNo").disabled = true;
    $("iTitle").textContent = S.cur + "호 커버 고치기";
    openModal("issueModal");
  });
  $("iPhoto").addEventListener("change", function () {
    var f = this.files[0]; this.value = ""; if (!f) return;
    W.resizeImage(f, 1600).then(function (r) { issuePhoto = r; fillIssuePhoto(); }).catch(function (e) { showErr("iError", e.message); });
  });
  $("iPhotoUrl").addEventListener("change", fillIssuePhoto);
  $("iSubmit").addEventListener("click", function () {
    var data = {}; Object.keys(IF).forEach(function (k) { data[IF[k]] = $(k).value.trim(); });
    data["커버사진"] = $("iPhotoUrl").value.trim();
    var no = num(data["호수"]);
    if (!no) return showErr("iError", "호수를 숫자로 넣어주세요.");
    if (!data["커버제목"]) return showErr("iError", "커버 제목을 써주세요.");
    if (issueMode === "new" && issueOf(no)) return showErr("iError", no + "호는 이미 있어요.");
    var done = busy(this);
    call("saveIssue", { issue: data, isNew: issueMode === "new", photo: issuePhoto ? { name: issuePhoto.name, data: issuePhoto.data } : null })
      .then(function () { closeModal("issueModal"); S.cur = no; selectTab("edit"); toast(no + "호를 저장했어요"); return load(); })
      .catch(function (e) { showErr("iError", e.message); }).then(done);
  });

  // ---------- 상품 ----------
  var prod = { id: "", photo: null, attach: [], newAttach: [] };
  function issueOptions(sel, cur) {
    sel.textContent = "";
    S.issues.forEach(function (it) {
      var no = num(it["호수"]);
      var o = el("option", "", no + "호" + (it["주차표기"] ? " · " + it["주차표기"] : "") + (it["공개"] === "Y" ? " (공개 중)" : ""));
      o.value = no; sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }
  function editProduct(p) {
    prod = { id: p ? p.id : "", photo: null, attach: p ? W.list(p["첨부이미지"]) : [], newAttach: [] };
    issueOptions($("pIssue"), p ? num(p["호수"]) : S.cur);
    $("pCat").value = p ? p["카테고리"] || "" : "";
    $("pName").value = p ? p["상품명"] || "" : "";
    $("pSummary").value = p ? p["한줄설명"] || "" : "";
    $("pPrice").value = p ? String(p["가격"] || "").replace(/[^0-9]/g, "") : "";
    var d = p && String(p["마감일"] || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    $("pDeadline").value = d ? d[1] + "-" + ("0" + d[2]).slice(-2) + "-" + ("0" + d[3]).slice(-2) : "";
    $("pDetail").value = p ? p["상세설명"] || "" : "";
    $("pPhotoUrl").value = p ? p["사진"] || "" : "";
    $("pLink").value = p ? p["링크"] || "" : "";
    $("pTitle").textContent = p ? "상품 고치기" : "상품 추가";
    $("pError").hidden = true;
    fillProdPhotos(); counts();
    openModal("productModal");
  }
  function fillProdPhotos() {
    photoThumb($("pPhotoThumb"), $("pPhotoDrop"), prod.photo, $("pPhotoUrl").value, function () { prod.photo = null; $("pPhotoUrl").value = ""; fillProdPhotos(); });
    var box = $("pAttachThumbs"); box.textContent = "";
    prod.attach.forEach(function (u, i) { thumbItem(box, W.imgSrc(u), function () { prod.attach.splice(i, 1); fillProdPhotos(); }); });
    prod.newAttach.forEach(function (a, i) { thumbItem(box, a.preview, function () { prod.newAttach.splice(i, 1); fillProdPhotos(); }); });
  }
  $("addProduct").addEventListener("click", function () { editProduct(null); });
  $("pPhoto").addEventListener("change", function () {
    var f = this.files[0]; this.value = ""; if (!f) return;
    W.resizeImage(f, 1600).then(function (r) { prod.photo = r; fillProdPhotos(); }).catch(function (e) { showErr("pError", e.message); });
  });
  $("pPhotoUrl").addEventListener("change", fillProdPhotos);
  $("pAttach").addEventListener("change", function () {
    var fs = Array.prototype.slice.call(this.files, 0, 5); this.value = "";
    Promise.all(fs.map(function (f) { return W.resizeImage(f, 1400); }))
      .then(function (rs) { prod.newAttach = prod.newAttach.concat(rs); fillProdPhotos(); })
      .catch(function (e) { showErr("pError", e.message); });
  });
  $("pSubmit").addEventListener("click", function () {
    var row = {
      id: prod.id, "호수": $("pIssue").value, "카테고리": $("pCat").value.trim(), "상품명": $("pName").value.trim(),
      "한줄설명": $("pSummary").value.trim(), "가격": $("pPrice").value.replace(/[^0-9]/g, ""), "마감일": $("pDeadline").value,
      "상세설명": $("pDetail").value.trim(), "사진": $("pPhotoUrl").value.trim(), "링크": $("pLink").value.trim(),
      "첨부이미지": prod.attach.join(", ")
    };
    if (!num(row["호수"])) return showErr("pError", "실을 호를 골라주세요. 호가 없으면 먼저 만들어 주세요.");
    if (!row["상품명"]) return showErr("pError", "상품명을 써주세요.");
    if (row["링크"] && !W.safeUrl(row["링크"])) return showErr("pError", "예약·문의 받을 곳은 이메일이나 https:// 링크로 써주세요.");
    if (!prod.id) row["순서"] = "";
    var done = busy(this);
    call("saveRow", {
      table: "상품", row: row,
      photo: prod.photo ? { name: prod.photo.name, data: prod.photo.data } : null,
      attachments: prod.newAttach.map(function (a) { return { name: a.name, data: a.data }; })
    }).then(function () { closeModal("productModal"); S.cur = num(row["호수"]); toast("상품을 저장했어요"); return load(); })
      .catch(function (e) { showErr("pError", e.message); }).then(done);
  });

  // ---------- 팁 · 소식 ----------
  var textMode = { table: "팁", id: "" };
  function editText(table, item) {
    textMode = { table: table, id: item ? item.id : "" };
    var tip = table === "팁";
    $("tTitle").textContent = (tip ? "팁 " : "소식 ") + (item ? "고치기" : "추가");
    $("tTitleField").hidden = !tip; $("tLinkField").hidden = tip;
    $("tBodyLabel").textContent = tip ? "내용" : "소식 한 줄";
    $("tHead").value = item && tip ? item["제목"] || "" : "";
    $("tBody").value = item ? item["내용"] || "" : "";
    $("tLink").value = item && !tip ? item["링크"] || "" : "";
    $("tError").hidden = true;
    openModal("textModal");
  }
  function editTip(t) { editText("팁", t); }
  function editNews(n) { editText("소식", n); }
  $("addTip").addEventListener("click", function () { editText("팁", null); });
  $("addNews").addEventListener("click", function () { editText("소식", null); });
  $("tSubmit").addEventListener("click", function () {
    var tip = textMode.table === "팁";
    var row = { id: textMode.id, "호수": S.cur, "내용": $("tBody").value.trim() };
    if (tip) { row["제목"] = $("tHead").value.trim(); if (!row["제목"]) return showErr("tError", "팁 제목을 써주세요."); }
    else {
      row["링크"] = $("tLink").value.trim();
      if (!row["내용"]) return showErr("tError", "소식 내용을 써주세요.");
      if (row["링크"] && !W.safeUrl(row["링크"])) return showErr("tError", "링크는 https://로 시작하게 써주세요.");
    }
    var done = busy(this);
    call("saveRow", { table: textMode.table, row: row }).then(function () {
      closeModal("textModal"); toast("저장했어요"); return load();
    }).catch(function (e) { showErr("tError", e.message); }).then(done);
  });

  // ---------- 사진 썸네일 ----------
  function thumbItem(box, src, onRemove, wide) {
    var t = el("div", "thumb" + (wide ? " thumb--wide" : ""));
    var i = el("img"); i.src = src; i.alt = ""; t.appendChild(i);
    var x = el("button", "", "×"); x.type = "button"; x.setAttribute("aria-label", "사진 지우기");
    x.addEventListener("click", onRemove); t.appendChild(x);
    box.appendChild(t);
  }
  function photoThumb(box, drop, file, url, onRemove) {
    box.textContent = "";
    var src = file ? file.preview : W.imgSrc(url);
    if (src) thumbItem(box, src, onRemove, true);
    drop.hidden = !!src;
  }
  function counts() {
    document.querySelectorAll("#productForm [data-count]").forEach(function (c) {
      var len = $(c.getAttribute("data-count")).value.length, max = +c.getAttribute("data-max");
      c.textContent = len + " / " + max; c.classList.toggle("is-over", len > max);
    });
  }
  $("productForm").addEventListener("input", counts);

  // ---------- 접수함 ----------
  function renderSubs(box, items, empty) {
    box.textContent = "";
    if (!items.length) { box.appendChild(el("div", "adm-empty", empty)); return; }
    items.forEach(function (s) {
      var r = el("article", "adm-item");
      var th = el("div", "adm-item__thumb"); W.media(th, s.photo, ""); r.appendChild(th);
      var m = el("div", "adm-item__meta");
      var c = el("div", "chips");
      if (s.category) c.appendChild(el("span", "chip", s.category));
      if (s.status === "승인") c.appendChild(el("span", "chip chip--green", num(s.issue) + "호에 실었어요"));
      if (s.status === "반려") c.appendChild(el("span", "chip chip--gray", "반려"));
      m.appendChild(c);
      m.appendChild(el("span", "t-card", s.title));
      m.appendChild(el("span", "t-cap c-sub", [s.dept, s.name, s.createdAt].filter(Boolean).join(" · ")));
      if (s.memo) m.appendChild(el("span", "t-cap c-mid", "메모: " + s.memo));
      r.appendChild(m);
      var a = el("div", "adm-item__actions");
      a.appendChild(btn("자세히", "btn--gray", function () { view(s); }));
      if (s.status === "대기") {
        a.appendChild(btn("반려", "btn--danger", function () { reject(s); }));
        a.appendChild(btn("싣기", "btn--primary", function () { approve(s); }));
      }
      r.appendChild(a);
      box.appendChild(r);
    });
  }
  var curSub = null;
  function view(s) {
    W.media($("vMedia"), s.photo, s.title);
    var c = $("vChips"); c.textContent = ""; if (s.category) c.appendChild(el("span", "chip", s.category));
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
  function approve(s) {
    curSub = s; $("aProduct").textContent = s.title; $("aError").hidden = true;
    if (!S.issues.length) { toast("먼저 호 편집에서 새 호를 만들어 주세요"); selectTab("edit"); return; }
    issueOptions($("aIssue"), S.cur);
    openModal("approveModal");
  }
  $("aSubmit").addEventListener("click", function () {
    var no = num($("aIssue").value);
    if (!no) return showErr("aError", "실을 호를 골라주세요.");
    var done = busy(this, "싣고 있어요…");
    call("approve", { id: curSub.id, issue: no }).then(function () {
      closeModal("approveModal"); S.cur = no; toast(no + "호에 실었어요. 호 편집에서 순서를 바꿀 수 있어요"); return load();
    }).catch(function (e) { showErr("aError", e.message); }).then(done);
  });
  function reject(s) { curSub = s; $("rProduct").textContent = s.title; $("rMemo").value = ""; openModal("rejectModal"); }
  $("rSubmit").addEventListener("click", function () {
    var done = busy(this, "처리하고 있어요…");
    call("reject", { id: curSub.id, memo: $("rMemo").value.trim() }).then(function () {
      closeModal("rejectModal"); toast("반려했어요"); return load();
    }).catch(function (e) { toast(e.message); }).then(done);
  });

  // ---------- 자동화 ----------
  $("runQueue").addEventListener("click", function () {
    var done = busy(this, "실행하고 있어요…");
    call("runQueue").then(function (res) {
      var r = res.result || {};
      toast(r.error ? "자동화: " + r.error : "자동화 지시 " + (r.ran || 0) + "건 실행" + (r.failed ? ", " + r.failed + "건 실패" : ""));
      return load();
    }).catch(function (e) { toast(e.message); }).then(done);
  });

  // ---------- 시작 ----------
  if (token() && W.CFG.apiUrl) load().catch(function () { showLogin(); });
  else showLogin();
})();
