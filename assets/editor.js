/* 상세설명 편집기 (워드처럼 한 장에 쭉 쓰기) — 상품 올리기 · 관리자 공용
   W.richEditor(root, { maxImages, onChange, onError })
   → { set(raw), get({preview|draft}), draft(), text(), isEmpty(), imageCount(), validate(), focus(), showEdit() }
   저장 형식은 블록 문서(JSON) 그대로라 웹진·서버는 바뀌지 않아요. */
(function () {
  "use strict";
  var W = window.WZ, el = W.el;

  var ICON = {
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    pic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-7 7"/></svg>',
    list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></svg>',
    up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
  };
  var COLORS = [["", "기본", "#191F28"], ["tx-blue", "파랑", "#0072B9"], ["tx-red", "빨강", "#BE2A30"], ["tx-gray", "회색", "#5F6A77"]];
  var SIZES = [["tx-lg", "크게"], ["", "보통"], ["tx-sm", "작게"]];
  var ALIGN = [["full", "크게"], ["center", "작게"]];
  var INLINE = { "#text": 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, SPAN: 1, FONT: 1, A: 1, BR: 1, SMALL: 1, SUB: 1, SUP: 1, MARK: 1, CODE: 1 };

  function btn(cls, html, label, fn) {
    var b = el("button", cls); b.type = "button"; b.innerHTML = html;
    if (label) { b.setAttribute("aria-label", label); b.title = label; }
    if (fn) b.addEventListener("click", fn);
    return b;
  }
  function blank(h) { var d = document.createElement("div"); d.innerHTML = h; return !d.textContent.replace(/\u00a0/g, " ").trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  W.richEditor = function (root, opt) {
    opt = opt || {};
    var maxImages = opt.maxImages || 10;
    var pics = {}, seq = 0;          // 사진 번호 → 주소 문자열 또는 {file}
    root.classList.add("re");
    root.textContent = "";

    // ---------- 위쪽: 편집 / 미리보기 + 도구 ----------
    var head = el("div", "re-head");
    var tabs = el("div", "re-tabs"); tabs.setAttribute("role", "tablist");
    var tEdit = btn("re-tab is-on", "편집"), tPrev = btn("re-tab", "미리보기");
    [tEdit, tPrev].forEach(function (t, i) { t.setAttribute("role", "tab"); t.setAttribute("aria-selected", String(i === 0)); tabs.appendChild(t); });
    head.appendChild(tabs);

    var bar = el("div", "re-bar"); bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "글 꾸미기");
    var fmt = el("select", "re-select"); fmt.setAttribute("aria-label", "글 모양");
    [["p", "본문"], ["h4", "소제목"]].forEach(function (o) { var x = el("option", "", o[1]); x.value = o[0]; fmt.appendChild(x); });
    fmt.addEventListener("change", function () { restore(); document.execCommand("formatBlock", false, fmt.value); changed(); });
    bar.appendChild(fmt);
    bar.appendChild(el("span", "re-sep"));
    bar.appendChild(btn("re-tool re-tool--b", "B", "굵게", function () { if (needSel()) { document.execCommand("bold"); changed(); } }));
    COLORS.forEach(function (c) {
      bar.appendChild(btn("re-tool re-tool--color", '<span class="re-dot" style="background:' + c[2] + '"></span>', "글자색 " + c[1], function () { wrapClass(["tx-blue", "tx-red", "tx-gray"], c[0]); }));
    });
    SIZES.forEach(function (z) {
      bar.appendChild(btn("re-tool re-tool--size" + (z[0] ? " " + z[0] : ""), z[1], "글자 크기 " + z[1], function () { wrapClass(["tx-lg", "tx-sm"], z[0]); }));
    });
    bar.appendChild(el("span", "re-sep"));
    bar.appendChild(btn("re-tool", ICON.list, "목록", toggleList));
    bar.appendChild(btn("re-tool", "안내 박스", "안내 박스 (파란 상자)", toggleNote));
    bar.appendChild(btn("re-tool", ICON.link + "<span>링크</span>", "링크 걸기", openLink));
    bar.appendChild(btn("re-tool", "구분선", "구분선 넣기", function () { insertBlock(el("hr")); }));
    var picBtn = el("label", "re-tool re-tool--pic"); picBtn.innerHTML = ICON.pic + "<span>사진</span>"; picBtn.title = "사진 넣기";
    var picInput = el("input"); picInput.type = "file"; picInput.accept = "image/*"; picInput.multiple = true; picInput.setAttribute("aria-label", "사진 넣기");
    picBtn.appendChild(picInput); bar.appendChild(picBtn);
    bar.appendChild(btn("re-tool", "지우기", "꾸밈 지우기", clearFormat));
    var hint = el("span", "re-bar__hint", "글자를 고른 뒤 꾸미기를 눌러요 · 사진은 상세 화면에서 글 위에 모아서 보여요");
    bar.appendChild(hint);
    head.appendChild(bar);

    var linkRow = el("div", "re-linkrow"); linkRow.hidden = true;
    var linkInput = el("input", "input re-linkrow__input"); linkInput.placeholder = "https:// 주소나 이메일"; linkInput.setAttribute("aria-label", "링크 주소");
    linkRow.appendChild(linkInput);
    linkRow.appendChild(btn("btn btn--primary btn--sm", "적용", "", applyLink));
    linkRow.appendChild(btn("btn btn--gray btn--sm", "취소", "", function () { linkRow.hidden = true; }));
    linkInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); applyLink(); } });
    head.appendChild(linkRow);
    root.appendChild(head);
    bar.addEventListener("mousedown", function (e) { if (e.target.closest(".re-tool")) e.preventDefault(); });

    // ---------- 본문 (한 장) ----------
    var stage = el("div", "re-stage");
    var doc = el("div", "re-doc");
    doc.contentEditable = "true"; doc.setAttribute("role", "textbox"); doc.setAttribute("aria-multiline", "true");
    doc.setAttribute("aria-label", "자세한 설명"); doc.dataset.ph = "여기에 바로 써주세요. 사진은 위의 '사진' 버튼으로 넣어요.";
    stage.appendChild(doc);
    // 사진 메뉴 (사진을 누르면 나와요)
    var pop = el("div", "re-pop"); pop.hidden = true; pop.setAttribute("role", "toolbar"); pop.setAttribute("aria-label", "사진 설정");
    var popAlign = el("div", "re-pop__row");
    ALIGN.forEach(function (a) { popAlign.appendChild(btn("re-pop__btn", a[1], "사진 크기 " + a[1], function () { if (selFig) { selFig.dataset.align = a[0]; syncPop(); changed(); } })); });
    pop.appendChild(popAlign);
    var popRow2 = el("div", "re-pop__row");
    var capIn = el("input", "input re-pop__cap"); capIn.placeholder = "사진 설명 (선택)"; capIn.maxLength = 60; capIn.setAttribute("aria-label", "사진 설명");
    capIn.addEventListener("input", function () { if (!selFig) return; setCap(selFig, capIn.value); changed(); });
    popRow2.appendChild(capIn);
    popRow2.appendChild(btn("re-pop__btn re-pop__icon", ICON.up, "사진 위로", function () { moveFig(-1); }));
    popRow2.appendChild(btn("re-pop__btn re-pop__icon", ICON.down, "사진 아래로", function () { moveFig(1); }));
    popRow2.appendChild(btn("re-pop__btn re-pop__del", "삭제", "사진 삭제", function () { if (selFig) { var f = selFig; unselect(); f.remove(); ensureEnd(); changed(); } }));
    pop.appendChild(popRow2);
    stage.appendChild(pop);
    root.appendChild(stage);

    var prev = el("div", "re-preview modal__detail"); prev.hidden = true; root.appendChild(prev);
    var count = el("p", "re-count"); root.appendChild(count);

    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* 무시 */ }

    var savedRange = null, selFig = null;
    function changed() { refresh(); if (opt.onChange) opt.onChange(); }
    function err(m) { if (opt.onError) opt.onError(m); }

    // ---------- 커서 · 선택 ----------
    function inDoc(n) { return n && (n === doc || doc.contains(n)); }
    function curRange() {
      var sel = window.getSelection();
      if (!sel.rangeCount) return null;
      var r = sel.getRangeAt(0);
      return inDoc(r.commonAncestorContainer) ? r : null;
    }
    document.addEventListener("selectionchange", function () {
      var r = curRange(); if (!r) return;
      savedRange = r.cloneRange();
      var b = topBlock(r.startContainer);
      fmt.value = b && /^H\d$/.test(b.nodeName) ? "h4" : "p";
    });
    function restore() {
      var r = curRange() || (savedRange && inDoc(savedRange.commonAncestorContainer) ? savedRange : null);
      if (r && r.startContainer.nodeType === 1 && r.startContainer.closest && r.startContainer.closest("figure")) r = null;
      if (document.activeElement !== doc) doc.focus({ preventScroll: true });
      var s = window.getSelection();
      if (r) { s.removeAllRanges(); s.addRange(r); } else placeEnd();
    }
    function placeEnd() {
      var r = document.createRange(); r.selectNodeContents(doc); r.collapse(false);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    function needSel() {
      restore();
      var r = curRange();
      if (!r || r.collapsed) { hint.classList.remove("is-flash"); void hint.offsetWidth; hint.classList.add("is-flash"); return null; }
      return r;
    }
    function topBlock(n) {
      while (n && n.parentNode !== doc) { if (n === doc || !n.parentNode) return null; n = n.parentNode; }
      return n;
    }

    // ---------- 꾸미기 ----------
    function wrapClass(group, cls) {
      var r = needSel(); if (!r) return;
      var frag = r.extractContents();
      frag.querySelectorAll("span").forEach(function (s) {
        group.forEach(function (g) { s.classList.remove(g); });
        if (!s.classList.length) { while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s); s.remove(); }
      });
      var node = frag, first = frag.firstChild, last = frag.lastChild;
      if (cls) { var sp = document.createElement("span"); sp.className = cls; sp.appendChild(frag); node = sp; }
      r.insertNode(node);
      var nr = document.createRange();
      if (cls) nr.selectNodeContents(node); else if (first && last) { nr.setStartBefore(first); nr.setEndAfter(last); }
      var s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(nr);
      changed();
    }
    function clearFormat() {
      var r = needSel(); if (!r) return;
      document.execCommand("removeFormat"); document.execCommand("unlink");
      r = curRange();
      if (r && !r.collapsed) {
        var t = r.toString(); r.deleteContents();
        var tn = document.createTextNode(t); r.insertNode(tn);
        var p = tn.parentNode;
        while (p && p !== doc && /^(B|STRONG|SPAN|A|FONT|I|EM|U)$/.test(p.nodeName)) { splitOut(tn, p); p = tn.parentNode; }
      }
      changed();
    }
    function splitOut(node, parent) {
      var right = parent.cloneNode(false);
      while (node.nextSibling) right.appendChild(node.nextSibling);
      parent.after(node);
      if (right.childNodes.length) node.after(right);
      if (!parent.childNodes.length) parent.remove();
    }
    function toggleNote() {
      var list = selBlocks(); if (!list.length) return;
      var a = list[0], last = null;
      var on = !(a.classList && a.classList.contains("re-note"));
      list.forEach(function (b) {
        if (b.nodeType !== 1 || b.nodeName === "FIGURE" || b.nodeName === "HR" || /^(UL|OL)$/.test(b.nodeName)) return;
        var x = document.createElement(on ? "div" : "p");
        if (on) x.className = "re-note";
        while (b.firstChild) x.appendChild(b.firstChild);
        if (!x.childNodes.length) x.appendChild(document.createElement("br"));
        b.replaceWith(x); last = x;
      });
      if (last) caretIn(last, true);
      ensureEnd(); changed();
    }
    function selBlocks() {
      restore();
      var r = curRange(); if (!r) return [];
      var a = topBlock(r.startContainer), z = topBlock(r.endContainer);
      if (!a) return [];
      var list = [], n = a;
      while (n) { if (n.nodeType === 1) list.push(n); if (n === z || !z) break; n = n.nextSibling; }
      return list;
    }
    function caretIn(node, atEnd) {
      var r = document.createRange(); r.selectNodeContents(node); r.collapse(!atEnd);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    function toggleList() {
      var bs = selBlocks(); if (!bs.length) return;
      var last = null;
      if (bs[0].nodeName === "UL" || bs[0].nodeName === "OL") {
        // 목록 풀기: 고른 목록의 항목을 문단으로
        bs.forEach(function (ul) {
          if (ul.nodeName !== "UL" && ul.nodeName !== "OL") return;
          Array.prototype.slice.call(ul.children).forEach(function (li) {
            var p = document.createElement("p");
            while (li.firstChild) p.appendChild(li.firstChild);
            if (!p.childNodes.length) p.appendChild(document.createElement("br"));
            ul.before(p); last = p;
          });
          ul.remove();
        });
      } else {
        var ul = document.createElement("ul");
        bs[0].before(ul);
        bs.forEach(function (b) {
          if (b.nodeName === "FIGURE" || b.nodeName === "HR") return;
          if (b.nodeName === "UL" || b.nodeName === "OL") { while (b.firstChild) ul.appendChild(b.firstChild); b.remove(); return; }
          var li = document.createElement("li");
          while (b.firstChild) li.appendChild(b.firstChild);
          if (!li.childNodes.length) li.appendChild(document.createElement("br"));
          ul.appendChild(li); b.remove(); last = li;
        });
        // 바로 붙은 목록끼리는 합치기
        [ul.previousElementSibling, ul.nextElementSibling].forEach(function (sib) {
          if (sib && sib.nodeName === "UL") { if (sib === ul.previousElementSibling) { while (ul.firstChild) sib.appendChild(ul.firstChild); ul.remove(); ul = sib; } else { while (sib.firstChild) ul.appendChild(sib.firstChild); sib.remove(); } }
        });
        if (!ul.children.length) ul.remove();
      }
      if (last && doc.contains(last)) caretIn(last, true);
      ensureEnd(); changed();
    }
    function openLink() {
      var r = needSel(); if (!r) return;
      savedRange = r.cloneRange();
      var a = r.startContainer.parentNode && r.startContainer.parentNode.closest && r.startContainer.parentNode.closest("a");
      linkInput.value = a ? a.getAttribute("href").replace(/^mailto:/, "") : "";
      linkRow.hidden = false; linkInput.focus();
    }
    function applyLink() {
      var v = linkInput.value.trim(), h = v ? W.linkHref(v) : "";
      if (v && !h) { err("https://로 시작하는 주소나 이메일을 넣어주세요"); linkInput.focus(); return; }
      linkRow.hidden = true;
      doc.focus();
      if (savedRange) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
      document.execCommand(h ? "createLink" : "unlink", false, h || null);
      changed();
    }

    // ---------- 사진 ----------
    function imageCount() { return doc.querySelectorAll("figure.re-fig").length; }
    function makeFig(pic, align, cap) {
      var key = "k" + (++seq); pics[key] = pic;
      var f = document.createElement("figure");
      f.className = "re-fig"; f.contentEditable = "false"; f.dataset.key = key; f.dataset.align = align || "full";
      f.tabIndex = 0; f.setAttribute("role", "button"); f.setAttribute("aria-label", "사진 (눌러서 위치·설명 바꾸기)");
      f.draggable = true;
      var img = document.createElement("img"); img.alt = ""; img.draggable = false;
      img.src = typeof pic === "string" ? W.picSrc(pic) : pic.file.preview;
      f.appendChild(img);
      if (cap) setCap(f, cap);
      return f;
    }
    function setCap(f, v) {
      var c = f.querySelector("figcaption");
      if (!v) { if (c) c.remove(); return; }
      if (!c) { c = document.createElement("figcaption"); f.appendChild(c); }
      c.textContent = v;
    }
    function insertBlock(node, after) {
      var b = null;
      if (after && doc.contains(after)) b = after;
      else { restore(); var r = curRange(); b = r ? topBlock(r.startContainer) : null; }
      if (b && b.nodeType === 1 && !b.textContent.trim() && !b.querySelector("img") && b.nodeName !== "HR" && b.nodeName !== "FIGURE") b.replaceWith(node);
      else if (b) b.after(node);
      else doc.appendChild(node);
      var next = node.nextSibling;
      if (!next || next.nodeName === "FIGURE" || next.nodeName === "HR") { var p = document.createElement("p"); p.appendChild(document.createElement("br")); node.after(p); next = p; }
      var nr = document.createRange(); nr.selectNodeContents(next); nr.collapse(true);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(nr);
      changed();
      return node;
    }
    function addFiles(files) {
      var room = maxImages - imageCount();
      var fs = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
      if (fs.length > room) err("본문 사진은 " + maxImages + "장까지 넣을 수 있어요");
      fs = fs.slice(0, Math.max(0, room));
      var chain = Promise.resolve(), prevFig = null;
      fs.forEach(function (f) {
        chain = chain.then(function () { return W.resizeImage(f, 1400); })
          .then(function (r) { prevFig = insertBlock(makeFig({ file: r }, "full"), prevFig); }, function (e) { err(e.message); });
      });
      return chain;
    }
    picInput.addEventListener("change", function () { var fs = this.files; addFiles(fs).then(function () { picInput.value = ""; }); });

    function select(f) {
      if (selFig === f) return;
      unselect(); selFig = f; f.classList.add("is-sel");
      var c = f.querySelector("figcaption"); capIn.value = c ? c.textContent : "";
      pop.hidden = false; syncPop(); placePop();
    }
    function unselect() { if (selFig) selFig.classList.remove("is-sel"); selFig = null; pop.hidden = true; }
    function syncPop() {
      if (!selFig) return;
      popAlign.querySelectorAll(".re-pop__btn").forEach(function (b, i) { b.classList.toggle("is-on", ALIGN[i][0] === selFig.dataset.align); });
      placePop();
    }
    function placePop() {
      if (!selFig) return;
      var sr = stage.getBoundingClientRect(), fr = selFig.getBoundingClientRect();
      pop.style.top = Math.max(0, fr.bottom - sr.top + 8) + "px";
    }
    function moveFig(d) {
      if (!selFig) return;
      var sib = d < 0 ? selFig.previousSibling : selFig.nextSibling;
      while (sib && sib.nodeType === 3 && !sib.nodeValue.trim()) sib = d < 0 ? sib.previousSibling : sib.nextSibling;
      if (!sib) return;
      if (d < 0) sib.before(selFig); else sib.after(selFig);
      ensureEnd(); placePop(); selFig.scrollIntoView({ block: "nearest", behavior: "smooth" });
      changed();
    }
    doc.addEventListener("click", function (e) {
      var f = e.target.closest && e.target.closest("figure.re-fig");
      if (f && inDoc(f)) select(f); else unselect();
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        var r = curRange(), blk = r && topBlock(r.startContainer);
        if (blk && blk.classList && blk.classList.contains("re-note") && !blk.textContent.trim()) {
          e.preventDefault();
          var p = document.createElement("p"); p.appendChild(document.createElement("br"));
          blk.replaceWith(p); caretIn(p, false); changed(); return;
        }
      }
      if (selFig && document.activeElement === selFig && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault(); var f = selFig; unselect(); f.remove(); ensureEnd(); changed();
      }
      if (selFig && document.activeElement === selFig && e.key === "Escape") unselect();
    });
    doc.addEventListener("focusin", function (e) {
      var f = e.target.closest && e.target.closest("figure.re-fig");
      if (f) select(f);
    });
    document.addEventListener("pointerdown", function (e) { if (!root.contains(e.target)) unselect(); });
    window.addEventListener("resize", placePop);

    // 붙여넣기: 사진 파일은 사진으로, 글은 허용한 모양만 남겨서
    doc.addEventListener("paste", function (e) {
      var cd = e.clipboardData || window.clipboardData; if (!cd) return;
      var files = Array.prototype.filter.call(cd.files || [], function (f) { return /^image\//.test(f.type); });
      e.preventDefault();
      if (files.length) { addFiles(files); return; }
      var html = cd.getData("text/html"), html2;
      if (html) {
        var body = new DOMParser().parseFromString(html, "text/html").body;
        html2 = blocksToHtml(collect(body), true);
      } else {
        var t = cd.getData("text/plain");
        html2 = t.split(/\r?\n/).map(function (l) { return "<p>" + (esc(l) || "<br>") + "</p>"; }).join("");
        if (t.indexOf("\n") < 0) html2 = esc(t);
      }
      document.execCommand("insertHTML", false, html2);
      tidy(); changed();
    });
    // 사진 끌어서 옮기기 (PC)
    var dragFig = null;
    doc.addEventListener("dragstart", function (e) {
      var f = e.target.closest && e.target.closest("figure.re-fig");
      unselect();
      if (!f) return;
      dragFig = f; f.classList.add("is-drag");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", ""); } catch (er) { /* 무시 */ }
    });
    doc.addEventListener("dragover", function (e) { if (dragFig) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } });
    doc.addEventListener("dragend", function () { if (dragFig) dragFig.classList.remove("is-drag"); dragFig = null; });
    doc.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); return; }
      if (!dragFig) return;
      e.preventDefault();
      var t = e.target.nodeType === 1 ? e.target : e.target.parentNode;
      var b = topBlock(t);
      if (!b) {   // 문서 빈 곳: 가장 가까운 줄 찾기
        var kids = Array.prototype.filter.call(doc.children, function (k) { return k !== dragFig; });
        b = kids.filter(function (k) { return k.getBoundingClientRect().top < e.clientY; }).pop() || kids[0];
      }
      if (b && b !== dragFig) {
        var r = b.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) b.before(dragFig); else b.after(dragFig);
      }
      dragFig.classList.remove("is-drag"); dragFig = null;
      ensureEnd(); changed();
    });
    doc.addEventListener("input", function () { tidy(); changed(); });

    // 끝에 항상 쓸 자리 + 맨 위 줄은 문단으로
    function ensureEnd() {
      var last = doc.lastChild;
      while (last && last.nodeType === 3 && !last.nodeValue.trim()) last = last.previousSibling;
      if (!last || last.nodeName === "FIGURE" || last.nodeName === "HR") { var p = document.createElement("p"); p.appendChild(document.createElement("br")); doc.appendChild(p); }
    }
    function tidy() {
      // 드래그·붙여넣기로 생긴 '번호 없는 사진'이나 중복 번호 정리
      var seen = {};
      doc.querySelectorAll("figure").forEach(function (f) {
        var k = f.dataset.key;
        if (!k || !pics[k] || seen[k]) {
          if (k && pics[k] && seen[k]) { var nk = "k" + (++seq); pics[nk] = pics[k]; f.dataset.key = nk; k = nk; }
          else { f.remove(); return; }
        }
        seen[k] = 1;
        f.contentEditable = "false"; f.classList.add("re-fig"); f.tabIndex = 0;
      });
      // 문서 바로 아래 맨 글자는 문단으로 감싸기
      Array.prototype.slice.call(doc.childNodes).forEach(function (n) {
        if (n.nodeType === 3 && n.nodeValue.trim()) { var p = document.createElement("p"); n.replaceWith(p); p.appendChild(n); }
      });
      ensureEnd();
      if (selFig && !doc.contains(selFig)) unselect(); else placePop();
    }

    // ---------- 문서 ↔ 블록 ----------
    function cleanInline(html) { return W.inlineHtml(html); }
    function collect(container) {
      var out = [], buf = [];
      function flush() {
        if (!buf.length) return;
        var h = cleanInline(buf.join("")); buf = [];
        if (!blank(h)) out.push({ t: "p", html: h });
      }
      Array.prototype.forEach.call(container.childNodes, function (c) {
        var tag = c.nodeName;
        if (c.nodeType === 3) { buf.push(esc(c.nodeValue)); return; }
        if (c.nodeType !== 1) return;
        if (INLINE[tag]) { buf.push(c.outerHTML); return; }
        flush();
        if (tag === "FIGURE" && c.dataset && c.dataset.key) {
          var cap = c.querySelector("figcaption");
          out.push({ t: "img", key: c.dataset.key, align: c.dataset.align || "full", cap: cap ? cap.textContent.trim() : "" });
        } else if (/^H[1-6]$/.test(tag)) {
          var tx = c.textContent.replace(/\s+/g, " ").trim(); if (tx) out.push({ t: "h", text: tx.slice(0, 60) });
        } else if (tag === "UL" || tag === "OL") {
          var items = Array.prototype.map.call(c.querySelectorAll("li"), function (li) { return cleanInline(li.innerHTML); })
            .filter(function (x) { return !blank(x); });
          if (items.length) out.push({ t: "list", items: items });
        } else if ((tag === "DIV" && c.classList.contains("re-note")) || tag === "BLOCKQUOTE") {
          var nh = cleanInline(c.innerHTML);
          if (!blank(nh)) {
            var lastB = out[out.length - 1];
            if (lastB && lastB.t === "note") lastB.html += "<br>" + nh; else out.push({ t: "note", html: nh });
          }
        } else if (tag === "HR") {
          out.push({ t: "hr" });
        } else if (tag === "P") {
          if (c.querySelector("figure,ul,ol,h1,h2,h3,h4,h5,h6,hr,div")) { var sub = collect(c); out.push.apply(out, sub); return; }
          buf.push(c.innerHTML); flush();
        } else if (tag === "IMG" || tag === "SCRIPT" || tag === "STYLE") {
          return;
        } else {
          out.push.apply(out, collect(c));
        }
      });
      flush();
      return out;
    }
    function blocksToHtml(bs, forPaste) {
      return bs.map(function (b) {
        if (b.t === "p") return "<p>" + cleanInline(b.html) + "</p>";
        if (b.t === "h") return "<h4>" + esc(b.text) + "</h4>";
        if (b.t === "note") return '<div class="re-note">' + cleanInline(b.html) + "</div>";
        if (b.t === "list") return "<ul>" + b.items.map(function (x) { return "<li>" + cleanInline(x) + "</li>"; }).join("") + "</ul>";
        if (b.t === "hr") return "<hr>";
        if (b.t === "img" && !forPaste && b.key) {
          var d = document.createElement("div"); d.appendChild(makeFigFromKey(b.key, b.align, b.cap)); return d.innerHTML;
        }
        return "";
      }).join("");
    }
    function makeFigFromKey(key, align, cap) {
      var f = makeFig(pics[key], align, cap); delete pics[f.dataset.key]; f.dataset.key = key; return f;
    }
    function get(o) {
      o = o || {};
      var files = [], out = [];
      collect(doc).forEach(function (b) {
        if (b.t === "img") {
          var v = pics[b.key], src = "";
          if (typeof v === "string") src = v;
          else if (v && v.file) {
            if (o.preview) src = v.file.preview;
            else if (!o.draft) { files.push({ name: v.file.name, data: v.file.data }); src = "upload:" + (files.length - 1); }
          }
          if (!src) return;
          var x = { t: "img", src: src, align: b.align };
          if (b.cap) x.cap = b.cap;
          out.push(x);
        } else out.push(b);
      });
      return { doc: out.length ? JSON.stringify({ v: 1, blocks: out }) : "", images: files };
    }
    function set(raw) {
      unselect(); pics = {}; doc.textContent = "";
      var d = W.parseDoc(raw);
      if (!d) {
        var t = String(raw == null ? "" : raw).trim();
        d = { blocks: t ? t.split(/\n/).map(function (l) { return { t: "p", html: esc(l) }; }) : [] };
      }
      d.blocks.forEach(function (b) {
        if (b.t === "img") { if (b.src) doc.appendChild(makeFig(b.src, b.align, b.cap)); return; }
        if (b.t === "img2") { (b.src || []).forEach(function (u) { if (u) doc.appendChild(makeFig(u, "full", b.cap)); }); return; }
        if (b.t === "btn") { var h = W.linkHref(b.url); if (b.label) doc.insertAdjacentHTML("beforeend", "<p>" + (h ? '<a href="' + esc(h) + '">' + esc(b.label) + "</a>" : esc(b.label)) + "</p>"); return; }
        if (b.t === "list") { doc.insertAdjacentHTML("beforeend", blocksToHtml([{ t: "list", items: (b.items || []).map(function (x) { return String(x); }) }])); return; }
        doc.insertAdjacentHTML("beforeend", blocksToHtml([b]));
      });
      ensureEnd();
      refresh();
    }

    // ---------- 미리보기 ----------
    function setTab(previewOn) {
      tEdit.classList.toggle("is-on", !previewOn); tPrev.classList.toggle("is-on", previewOn);
      tEdit.setAttribute("aria-selected", String(!previewOn)); tPrev.setAttribute("aria-selected", String(previewOn));
      stage.hidden = previewOn; bar.hidden = previewOn; linkRow.hidden = true; count.hidden = previewOn; prev.hidden = !previewOn;
      unselect(); refresh();
      if (previewOn && !prev.childNodes.length) prev.appendChild(el("p", "re-empty", "아직 쓴 내용이 없어요"));
    }
    tEdit.addEventListener("click", function () { setTab(false); });
    tPrev.addEventListener("click", function () { setTab(true); });

    function isEmpty() { return !doc.textContent.trim() && !imageCount() && !doc.querySelector("hr"); }
    function refresh() {
      doc.classList.toggle("is-empty", isEmpty() && doc.childNodes.length <= 1);
      count.textContent = "본문 사진 " + imageCount() + " / " + maxImages + "장";
      if (!prev.hidden) W.renderDetail(prev, get({ preview: true }).doc, { imagesFirst: true });
    }

    set("");
    return {
      set: set,
      get: get,
      draft: function () { return get({ draft: true }).doc; },
      text: function () { return W.docText(get({ preview: true }).doc); },
      isEmpty: function () { return !get({ preview: true }).doc; },
      imageCount: imageCount,
      validate: function () { return ""; },
      focus: function () { doc.focus(); },
      showEdit: function () { setTab(false); }
    };
  };
})();
