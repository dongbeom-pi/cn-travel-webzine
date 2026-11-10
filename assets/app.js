/* 씨앤 트래블 매거진 - 구글시트를 읽어 이번 호를 그립니다.
   주소 옵션: ?no=3  → 3호 보기
              ?preview=1 → 공개 N인 호도 보기 (작성 중 미리보기) */
(function () {
  "use strict";
  var CFG = window.WEBZINE_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var PREVIEW = params.get("preview") === "1";

  // ---------- 설정값 표시 ----------
  document.querySelectorAll("[data-cfg]").forEach(function (el) {
    var v = CFG[el.getAttribute("data-cfg")];
    if (v) el.textContent = v;
  });

  // ---------- 시트 읽기 ----------
  function sheetUrl(name) {
    return "https://docs.google.com/spreadsheets/d/" + CFG.sheetId +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(name);
  }

  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function toObjects(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = (r[i] || "").trim(); });
      return o;
    }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k]; }); });
  }

  function load(name) {
    return fetch(sheetUrl(name), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(name); return r.text(); })
      .then(function (t) { return toObjects(parseCSV(t)); });
  }

  // ---------- 도우미 ----------
  var $ = function (id) { return document.getElementById(id); };
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function byOrder(a, b) { return num(a["순서"]) - num(b["순서"]); }
  function sameIssue(no) { return function (r) { return num(r["호수"]) === no; }; }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function imgSrc(v) {
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return (CFG.imageFolder || "images/") + v.replace(/^\/+/, "");
  }
  function price(v) {
    var n = num(v);
    return n > 0 ? n.toLocaleString("ko-KR") + "원~" : "가격 문의";
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function media(box, src, alt, label) {
    box.textContent = "";
    if (src) {
      var img = el("img");
      img.src = src; img.alt = alt || ""; img.loading = "lazy";
      img.onerror = function () { box.textContent = ""; box.appendChild(el("div", "ph", label || "사진 준비 중")); };
      box.appendChild(img);
    } else {
      box.appendChild(el("div", "ph", label || "사진 준비 중"));
    }
  }

  // ---------- 그리기 ----------
  function renderIssue(issue, products, tips, news) {
    var no = num(issue["호수"]);
    $("issueWeek").textContent = "WEEKLY · " + (issue["주차표기"] || issue["발행일"] || "");
    $("issueNo").textContent = "NO. " + String(no).padStart(2, "0") + (issue["공개"] !== "Y" ? " · 미리보기" : "");
    document.title = (issue["커버제목"] || "") + " | " + (CFG.title || "씨앤 트래블 매거진");

    // 커버
    $("coverTitle").textContent = issue["커버제목"];
    $("coverText").textContent = issue["커버소개"];
    media($("coverMedia"), imgSrc(issue["커버사진"]), issue["커버제목"], "커버 사진");
    var cl = safeUrl(issue["커버링크"]);
    if (cl) { $("coverLink").href = cl; $("coverLink").hidden = false; }
    $("cover").hidden = false;

    // 상품
    if (products.length) {
      if (issue["상품섹션제목"]) $("productsTitle").textContent = issue["상품섹션제목"];
      var grid = $("productGrid");
      products.forEach(function (p) {
        var card = el("button", "card");
        card.type = "button";
        card.setAttribute("aria-haspopup", "dialog");
        var m = el("span", "card__media");
        media(m, imgSrc(p["사진"]), p["상품명"], p["카테고리"] || "상품 사진");
        var b = el("span", "card__body");
        b.appendChild(el("span", "label", p["카테고리"]));
        b.appendChild(el("span", "t-subtitle card__name", p["상품명"]));
        if (p["한줄설명"]) b.appendChild(el("span", "t-caption card__summary", p["한줄설명"]));
        b.appendChild(el("span", "card__spacer"));
        var f = el("span", "card__foot");
        f.appendChild(el("span", "t-subtitle card__price", price(p["가격"])));
        f.appendChild(el("span", "card__more", "자세히 →"));
        b.appendChild(f);
        card.appendChild(m); card.appendChild(b);
        card.addEventListener("click", function () { openProduct(p, card); });
        grid.appendChild(card);
      });
      $("products").hidden = false;
    }

    // 팁
    if (tips.length) {
      if (issue["팁섹션제목"]) $("tipsTitle").textContent = issue["팁섹션제목"];
      tips.forEach(function (t, i) {
        var li = el("li");
        li.appendChild(el("span", "tips__no", String(i + 1).padStart(2, "0")));
        var tx = el("div", "tips__text");
        tx.appendChild(el("span", "t-subtitle", t["제목"]));
        if (t["내용"]) tx.appendChild(el("p", "t-body", t["내용"]));
        li.appendChild(tx);
        $("tipList").appendChild(li);
      });
      $("tips").hidden = false;
    }

    // 소식
    if (news.length) {
      news.forEach(function (n) {
        var p = el("p", "t-body", n["내용"] + " ");
        var u = safeUrl(n["링크"]);
        if (u) {
          var a = el("a", "", "바로가기 →");
          a.href = u; a.target = "_blank"; a.rel = "noopener";
          p.appendChild(a);
        }
        $("newsList").appendChild(p);
      });
      $("news").hidden = false;
    }
  }

  function renderArchive(issues, currentNo) {
    if (issues.length < 2) return;
    issues.forEach(function (it) {
      var no = num(it["호수"]);
      var li = el("li");
      var a = el("a");
      a.href = "?no=" + no + (PREVIEW ? "&preview=1" : "");
      if (no === currentNo) a.setAttribute("aria-current", "page");
      a.appendChild(el("span", "label", "NO. " + String(no).padStart(2, "0") + " · " + (it["주차표기"] || it["발행일"] || "")));
      a.appendChild(el("span", "t-subtitle", it["커버제목"]));
      li.appendChild(a);
      $("archiveList").appendChild(li);
    });
    $("archive").hidden = false;
  }

  // ---------- 팝업 ----------
  var modal = $("productModal"), lastFocus = null;
  function openProduct(p, from) {
    lastFocus = from;
    media($("modalMedia"), imgSrc(p["사진"]), p["상품명"], p["카테고리"] || "상품 사진");
    $("modalCategory").textContent = p["카테고리"];
    $("modalTitle").textContent = p["상품명"];
    $("modalSummary").textContent = p["한줄설명"];
    $("modalPrice").textContent = price(p["가격"]);
    $("modalDetail").textContent = p["상세설명"];
    var u = safeUrl(p["링크"]);
    $("modalLink").hidden = !u;
    if (u) $("modalLink").href = u;
    if (modal.showModal) modal.showModal(); else modal.setAttribute("open", "");
  }
  function closeModal() {
    if (modal.close) modal.close(); else modal.removeAttribute("open");
  }
  modal.addEventListener("click", function (e) {
    if (e.target === modal || e.target.closest("[data-close]")) closeModal();
  });
  modal.addEventListener("close", function () { if (lastFocus) lastFocus.focus(); });

  $("openArchive").addEventListener("click", function () {
    var a = $("archive");
    if (a.hidden) { alert("지난 호가 아직 없습니다."); return; }
    a.scrollIntoView({ behavior: "smooth" });
  });

  // ---------- 시작 ----------
  Promise.all([load("호수"), load("상품"), load("팁"), load("소식")])
    .then(function (d) {
      var issues = d[0].filter(function (r) { return num(r["호수"]) > 0 && (PREVIEW || r["공개"] === "Y"); })
        .sort(function (a, b) { return num(b["호수"]) - num(a["호수"]); });
      if (!issues.length) {
        $("state").textContent = "첫 호를 준비하고 있습니다. 곧 찾아뵙겠습니다.";
        return;
      }
      var want = num(params.get("no"));
      var issue = issues.filter(function (r) { return num(r["호수"]) === want; })[0] || issues[0];
      var no = num(issue["호수"]);
      $("state").hidden = true;
      renderIssue(issue,
        d[1].filter(sameIssue(no)).sort(byOrder),
        d[2].filter(sameIssue(no)).sort(byOrder),
        d[3].filter(sameIssue(no)));
      renderArchive(issues, no);
    })
    .catch(function () {
      $("state").textContent = "내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    });
})();
