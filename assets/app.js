/* 씨앤 트래블 매거진 - 공개 시트를 읽어 이번 호를 그립니다.
   주소 옵션: ?no=3 → 3호 · ?preview=1 → 공개 N 인 호도 미리보기 */
(function () {
  "use strict";
  var W = window.WZ, CFG = W.CFG, el = W.el, num = W.num;
  var params = new URLSearchParams(location.search);
  var PREVIEW = params.get("preview") === "1";
  var $ = function (id) { return document.getElementById(id); };

  document.querySelectorAll("[data-cfg]").forEach(function (n) {
    var v = CFG[n.getAttribute("data-cfg")]; if (v) n.textContent = v;
  });

  function byOrder(a, b) { return num(a["순서"]) - num(b["순서"]); }
  function sameIssue(no) { return function (r) { return num(r["호수"]) === no; }; }
  function issueLabel(it) {
    var no = num(it["호수"]);
    return (it["주차표기"] || it["발행일"] || "") + " · " + no + "호" + (it["공개"] !== "Y" ? " · 미리보기" : "");
  }
  function show(id) { $(id).hidden = false; }

  // ---------- 커버 ----------
  function renderCover(issue) {
    $("issueLabel").textContent = issueLabel(issue);
    $("coverTitle").textContent = issue["커버제목"];
    $("coverText").textContent = issue["커버소개"];
    W.media($("coverMedia"), W.imgSrc(issue["커버사진"]), issue["커버제목"]);
    var u = W.safeUrl(issue["커버링크"]);
    if (u) { $("coverLink").href = u; $("coverLink").hidden = false; }
    document.title = issue["커버제목"] + " | " + (CFG.title || "씨앤 트래블 매거진");
    show("cover");
  }

  // ---------- 상품 ----------
  function chips(box, p, withDeadline) {
    box.textContent = "";
    if (p["카테고리"]) box.appendChild(el("span", "chip", p["카테고리"]));
    var d = withDeadline && W.deadline(p["마감일"]);
    if (d) box.appendChild(el("span", "chip " + (d.state === "soon" ? "chip--red" : "chip--gray"), d.text));
  }

  function renderProducts(issue, products) {
    if (!products.length) return;
    if (issue["상품섹션제목"]) $("productsTitle").textContent = issue["상품섹션제목"];
    products.forEach(function (p) {
      var d = W.deadline(p["마감일"]);
      var card = el("button", "card" + (d && d.state === "closed" ? " is-closed" : ""));
      card.type = "button";
      card.setAttribute("aria-haspopup", "dialog");
      var m = el("span", "card__media");
      W.media(m, W.imgSrc(p["사진"]), p["상품명"]);
      card.appendChild(m);
      var c = el("span", "card__chips"); chips(c, p, true); card.appendChild(c);
      card.appendChild(el("span", "card__name t-card", p["상품명"]));
      if (p["한줄설명"]) card.appendChild(el("span", "card__summary t-small c-sub", p["한줄설명"]));
      card.appendChild(el("span", "card__price", W.price(p["가격"])));
      card.addEventListener("click", function () { openProduct(p, card); });
      $("productGrid").appendChild(card);
    });
    show("products"); show("d1");
  }

  // ---------- 팁 · 소식 · 지난 호 ----------
  function renderTips(issue, tips) {
    if (!tips.length) return;
    if (issue["팁섹션제목"]) $("tipsTitle").textContent = issue["팁섹션제목"];
    tips.forEach(function (t, i) {
      var li = el("li");
      li.appendChild(el("span", "tips__no", String(i + 1)));
      var box = el("div");
      box.appendChild(el("span", "tips__title", t["제목"]));
      if (t["내용"]) box.appendChild(el("p", "tips__text", t["내용"]));
      li.appendChild(box);
      $("tipList").appendChild(li);
    });
    show("tips"); show("d2");
  }

  function renderNews(news) {
    if (!news.length) return;
    news.forEach(function (n) {
      var u = W.safeUrl(n["링크"]);
      var box = el(u ? "a" : "div", "news");
      if (u) { box.href = u; box.target = "_blank"; box.rel = "noopener"; }
      var t = el("span", "news__text");
      t.appendChild(el("span", "t-small c-blue", "씨앤 소식이에요"));
      t.appendChild(el("span", "t-card", n["내용"]));
      box.appendChild(t);
      if (u) box.appendChild(el("span", "btn btn--primary btn--sm", "자세히 보기"));
      $("newsList").appendChild(box);
    });
    show("news"); show("d2");
  }

  function renderArchive(issues, currentNo) {
    var others = issues.filter(function (it) { return num(it["호수"]) !== currentNo; });
    if (!others.length) { $("toArchive").hidden = true; return; }
    others.forEach(function (it) {
      var a = el("a");
      a.href = "?no=" + num(it["호수"]) + (PREVIEW ? "&preview=1" : "");
      var th = el("span", "archive__thumb"); W.media(th, W.imgSrc(it["커버사진"]), "");
      var tx = el("span");
      tx.appendChild(el("span", "archive__meta t-cap c-sub", issueLabel(it)));
      tx.appendChild(el("span", "archive__title", it["커버제목"]));
      tx.style.display = "flex"; tx.style.flexDirection = "column";
      a.appendChild(th); a.appendChild(tx);
      $("archiveList").appendChild(a);
    });
    show("archive"); show("d3");
  }

  // ---------- 상세 팝업 ----------
  var modal = $("productModal"), lastFocus = null;
  function openProduct(p, from) {
    lastFocus = from;
    W.media($("modalMedia"), W.imgSrc(p["사진"]), p["상품명"]);
    chips($("modalChips"), p, true);
    $("modalTitle").textContent = p["상품명"];
    $("modalSummary").textContent = p["한줄설명"];
    $("modalPrice").textContent = W.price(p["가격"]);
    $("modalDetail").textContent = p["상세설명"];

    var info = $("modalInfo"); info.textContent = "";
    var d = W.deadline(p["마감일"]);
    if (d) {
      var row = el("div"); row.appendChild(el("dt", "", "신청 마감"));
      row.appendChild(el("dd", "", d.date + (d.state === "closed" ? " (마감)" : d.state === "soon" ? " (" + d.text + ")" : "")));
      info.appendChild(row);
    }
    info.hidden = !info.children.length;

    var files = W.list(p["첨부이미지"]);
    var box = $("attachList"); box.textContent = ""; box.hidden = true;
    $("attachToggle").setAttribute("aria-expanded", "false");
    $("attachToggle").textContent = "안내 이미지 보기";
    files.forEach(function (f) { var i = el("img"); i.src = W.imgSrc(f); i.alt = p["상품명"] + " 안내 이미지"; i.loading = "lazy"; box.appendChild(i); });
    $("modalAttach").hidden = !files.length;

    var u = W.safeUrl(p["링크"]);
    $("modalLink").hidden = !u;
    if (u) {
      $("modalLink").href = u;
      $("modalLink").textContent = /^mailto:/i.test(u) ? "메일로 문의하기" : "예약 · 문의하기";
    }
    modal.querySelector(".modal__scroll").scrollTop = 0;
    if (modal.showModal) modal.showModal(); else modal.setAttribute("open", "");
  }
  $("attachToggle").addEventListener("click", function () {
    var open = $("attachList").hidden;
    $("attachList").hidden = !open;
    this.setAttribute("aria-expanded", String(open));
    this.textContent = open ? "안내 이미지 접기" : "안내 이미지 보기";
  });
  function closeModal() { if (modal.close) modal.close(); else modal.removeAttribute("open"); }
  modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });
  modal.addEventListener("close", function () { if (lastFocus) lastFocus.focus(); });

  // ---------- 시작 ----------
  function stateMsg(title, sub) {
    var s = $("state"); s.textContent = "";
    s.appendChild(el("strong", "", title)); s.appendChild(el("span", "", sub));
  }

  Promise.all([W.loadSheet("호수"), W.loadSheet("상품"), W.loadSheet("팁"), W.loadSheet("소식")])
    .then(function (d) {
      var issues = d[0].filter(function (r) { return num(r["호수"]) > 0 && (PREVIEW || r["공개"] === "Y"); })
        .sort(function (a, b) { return num(b["호수"]) - num(a["호수"]); });
      if (!issues.length) {
        stateMsg("첫 호를 준비하고 있어요", "곧 새로운 여행 소식으로 찾아올게요");
        $("toArchive").hidden = true;
        return;
      }
      var want = num(params.get("no"));
      var issue = issues.filter(function (r) { return num(r["호수"]) === want; })[0] || issues[0];
      var no = num(issue["호수"]);
      $("state").hidden = true;
      renderCover(issue);
      var products = d[1].filter(sameIssue(no)).sort(byOrder);
      renderProducts(issue, products);
      if (products.length) $("toProducts").hidden = false;
      renderTips(issue, d[2].filter(sameIssue(no)).sort(byOrder));
      renderNews(d[3].filter(sameIssue(no)));
      renderArchive(issues, no);
    })
    .catch(function () {
      stateMsg("내용을 불러오지 못했어요", "잠시 후 다시 들어와 주세요");
    });
})();
