/* 상세설명 블록 편집기 — 상품 올리기 · 관리자 공용
   W.richEditor(root, { maxImages, allowUrl, onChange, onError })
   → { set(raw), get({preview}), draft(), text(), isEmpty(), imageCount() } */
(function () {
  "use strict";
  var W = window.WZ, el = W.el;

  var ICON = {
    grip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    up: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    del: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'
  };
  var TYPES = [
    ["p", "글"], ["h", "소제목"], ["img", "사진"], ["img2", "사진 2장"],
    ["btn", "버튼"], ["note", "안내 박스"], ["list", "목록"], ["hr", "구분선"]
  ];
  var NAMES = { p: "글", h: "소제목", img: "사진", img2: "사진 2장", btn: "버튼", note: "안내 박스", list: "목록", hr: "구분선" };
  var ALIGN = [["full", "전체 폭"], ["center", "가운데"], ["left", "왼쪽"], ["right", "오른쪽"]];
  var COLORS = [["", "기본", "#191F28"], ["tx-blue", "파랑", "#0072B9"], ["tx-red", "빨강", "#D93A3F"], ["tx-gray", "회색", "#5F6A77"]];
  var SIZES = [["tx-lg", "크게"], ["", "보통"], ["tx-sm", "작게"]];

  function btn(cls, html, label, fn) {
    var b = el("button", cls); b.type = "button"; b.innerHTML = html;
    if (label) { b.setAttribute("aria-label", label); b.title = label; }
    if (fn) b.addEventListener("click", fn);
    return b;
  }

  W.richEditor = function (root, opt) {
    opt = opt || {};
    var maxImages = opt.maxImages || 10;
    root.classList.add("re");
    root.textContent = "";

    // ---------- 상단: 편집 / 미리보기 + 꾸미기 도구 ----------
    var head = el("div", "re-head");
    var tabs = el("div", "re-tabs"); tabs.setAttribute("role", "tablist");
    var tEdit = btn("re-tab is-on", "편집"), tPrev = btn("re-tab", "미리보기");
    tEdit.setAttribute("role", "tab"); tPrev.setAttribute("role", "tab");
    tEdit.setAttribute("aria-selected", "true"); tPrev.setAttribute("aria-selected", "false");
    tabs.appendChild(tEdit); tabs.appendChild(tPrev);
    head.appendChild(tabs);

    var bar = el("div", "re-bar"); bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "글자 꾸미기");
    var hint = el("span", "re-bar__hint", "글이나 안내 박스에서 글자를 고른 뒤 눌러요");
    var bBold = btn("re-tool re-tool--b", "B", "굵게", function () { exec("bold"); });
    bar.appendChild(bBold);
    bar.appendChild(el("span", "re-sep"));
    COLORS.forEach(function (c) {
      var b = btn("re-tool re-tool--color", '<span class="re-dot" style="background:' + c[2] + '"></span>', "글자색 " + c[1], function () { wrapClass(["tx-blue", "tx-red", "tx-gray"], c[0]); });
      bar.appendChild(b);
    });
    bar.appendChild(el("span", "re-sep"));
    SIZES.forEach(function (s) {
      bar.appendChild(btn("re-tool re-tool--size" + (s[0] ? " " + s[0] : ""), s[1], "글자 크기 " + s[1], function () { wrapClass(["tx-lg", "tx-sm"], s[0]); }));
    });
    bar.appendChild(el("span", "re-sep"));
    var bLink = btn("re-tool", ICON.link + "<span>링크</span>", "링크 걸기", openLink);
    bar.appendChild(bLink);
    bar.appendChild(btn("re-tool", "지우기", "꾸밈 지우기", clearFormat));
    head.appendChild(bar);

    var linkRow = el("div", "re-linkrow"); linkRow.hidden = true;
    var linkInput = el("input", "input re-linkrow__input"); linkInput.placeholder = "https:// 주소나 이메일"; linkInput.setAttribute("aria-label", "링크 주소");
    linkRow.appendChild(linkInput);
    linkRow.appendChild(btn("btn btn--primary btn--sm", "적용", "", applyLink));
    linkRow.appendChild(btn("btn btn--gray btn--sm", "취소", "", function () { linkRow.hidden = true; }));
    linkInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); applyLink(); } });
    head.appendChild(linkRow);
    root.appendChild(head);

    // 도구 버튼을 눌러도 고른 글자가 풀리지 않게
    bar.addEventListener("mousedown", function (e) { if (e.target.closest(".re-tool")) e.preventDefault(); });

    var list = el("div", "re-list"); root.appendChild(list);
    var empty = el("p", "re-empty", "아래 버튼으로 글이나 사진을 넣어보세요"); list.appendChild(empty);
    var prev = el("div", "re-preview modal__detail"); prev.hidden = true; root.appendChild(prev);

    var add = el("div", "re-add");
    add.appendChild(el("span", "re-add__label", "넣기"));
    var addRow = el("div", "re-add__row");
    TYPES.forEach(function (t) { addRow.appendChild(btn("re-add__btn", t[1], NAMES[t[0]] + " 넣기", function () { insert({ t: t[0] }, true); })); });
    add.appendChild(addRow);
    root.appendChild(add);
    var count = el("p", "re-count"); root.appendChild(count);

    var lastBlock = null, savedRange = null, lastRich = null;

    function changed() { refresh(); if (opt.onChange) opt.onChange(); }

    // ---------- 블록 공통 틀 ----------
    function frame(b) {
      var node = el("div", "re-block re-block--" + b.t);
      node._b = b;
      var side = el("div", "re-block__side");
      var grip = el("span", "re-icon re-grip"); grip.innerHTML = ICON.grip; grip.title = "끌어서 순서 바꾸기"; grip.setAttribute("aria-hidden", "true");
      grip.draggable = true;
      grip.addEventListener("dragstart", function (e) {
        dragging = node; node.classList.add("is-drag");
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", ""); e.dataTransfer.setDragImage(node, 20, 20); } catch (er) { /* 무시 */ }
      });
      grip.addEventListener("dragend", function () { node.classList.remove("is-drag"); dragging = null; clearMark(); changed(); });
      side.appendChild(grip);
      node.appendChild(side);
      var body = el("div", "re-block__body");
      body.appendChild(el("span", "re-block__name", NAMES[b.t]));
      node.appendChild(body);
      var tools = el("div", "re-block__tools");
      tools.appendChild(btn("re-icon re-up", ICON.up, NAMES[b.t] + " 위로", function () { move(node, -1); }));
      tools.appendChild(btn("re-icon re-down", ICON.down, NAMES[b.t] + " 아래로", function () { move(node, 1); }));
      tools.appendChild(btn("re-icon re-del", ICON.del, NAMES[b.t] + " 지우기", function () {
        var next = node.nextElementSibling || node.previousElementSibling;
        node.remove(); if (lastBlock === node) lastBlock = null;
        if (next && next._b) { var f = next.querySelector("button,input,[contenteditable]"); if (f) f.focus(); }
        changed();
      }));
      node.appendChild(tools);
      node.addEventListener("focusin", function () { lastBlock = node; });
      return { node: node, body: body };
    }

    // ---------- 글 (꾸밀 수 있는 칸) ----------
    function rich(b, ph) {
      var ed = el("div", "re-rich"); ed.contentEditable = "true";
      ed.setAttribute("role", "textbox"); ed.setAttribute("aria-multiline", "true");
      ed.setAttribute("aria-label", ph); ed.dataset.ph = ph;
      ed.appendChild(W.sanitizeInline(b.html || ""));
      ed.addEventListener("input", function () { b.html = ed.innerHTML; if (opt.onChange) opt.onChange(); });
      ed.addEventListener("focus", function () { lastRich = ed; });
      ed.addEventListener("paste", function (e) {
        e.preventDefault();
        var t = (e.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, t);
      });
      ed.addEventListener("drop", function (e) { if (!dragging) e.preventDefault(); });
      return ed;
    }

    // ---------- 사진 칸 ----------
    function picSlot(get, set, label) {
      var slot = el("div", "re-pic");
      function draw() {
        slot.textContent = "";
        var src = get();
        if (src) {
          var img = el("img"); img.src = W.picSrc(src); img.alt = ""; slot.appendChild(img);
          var acts = el("div", "re-pic__acts");
          var change = el("label", "re-pic__btn", "바꾸기");
          var inp = fileInput(); change.appendChild(inp); acts.appendChild(change);
          acts.appendChild(btn("re-pic__btn", "빼기", label + " 빼기", function () { set(null); draw(); changed(); }));
          slot.appendChild(acts);
        } else {
          var up = el("label", "re-pic__empty");
          up.appendChild(fileInput());
          up.appendChild(el("strong", "", "사진 고르기"));
          up.appendChild(el("span", "", "알맞은 크기로 줄여드려요"));
          slot.appendChild(up);
          if (opt.allowUrl !== false) {
            var url = el("input", "input re-pic__url"); url.placeholder = "또는 사진 주소(https://) 붙여넣고 Enter";
            url.setAttribute("aria-label", label + " 주소");
            url.addEventListener("keydown", function (e) {
              if (e.key !== "Enter") return; e.preventDefault();
              var v = url.value.trim();
              if (!/^https?:\/\//i.test(v)) { err("사진 주소는 https://로 시작해야 해요"); return; }
              if (!room()) return;
              set({ url: v }); draw(); changed();
            });
            slot.appendChild(url);
          }
        }
      }
      function fileInput() {
        var inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.setAttribute("aria-label", label + " 고르기");
        inp.addEventListener("change", function () {
          var f = this.files && this.files[0]; this.value = "";
          if (!f) return;
          if (!get() && !room()) return;
          W.resizeImage(f, 1400).then(function (r) { set({ file: r }); draw(); changed(); }, function (e) { err(e.message); });
        });
        return inp;
      }
      draw();
      return slot;
    }
    function room() {
      if (imageCount() >= maxImages) { err("본문 사진은 " + maxImages + "장까지 넣을 수 있어요"); return false; }
      return true;
    }
    function err(m) { if (opt.onError) opt.onError(m); }
    // 사진 값: 저장된 주소(문자열) / {url} / {file:{name,data,preview}}
    function srcOf(v) { return !v ? "" : typeof v === "string" ? v : v.url ? v.url : v.file ? v.file.preview : ""; }

    // ---------- 블록 만들기 ----------
    function build(b) {
      var f = frame(b), body = f.body;
      if (b.t === "p") body.appendChild(rich(b, "내용을 써주세요"));
      if (b.t === "note") body.appendChild(rich(b, "눈에 띄게 알려줄 내용을 써주세요"));
      if (b.t === "h") {
        var h = el("input", "input re-h"); h.value = b.text || ""; h.maxLength = 40; h.placeholder = "소제목 (40자 이내)"; h.setAttribute("aria-label", "소제목");
        h.addEventListener("input", function () { b.text = h.value; if (opt.onChange) opt.onChange(); });
        body.appendChild(h);
      }
      if (b.t === "img") {
        b.align = b.align || "full";
        body.appendChild(picSlot(function () { return srcOf(b.pic); }, function (v) { b.pic = v; }, "사진"));
        var seg = el("div", "re-seg"); seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", "사진 위치");
        ALIGN.forEach(function (a) {
          var x = btn("re-seg__btn" + (b.align === a[0] ? " is-on" : ""), a[1], "", function () {
            b.align = a[0];
            seg.querySelectorAll(".re-seg__btn").forEach(function (y) { y.classList.remove("is-on"); y.setAttribute("aria-checked", "false"); });
            x.classList.add("is-on"); x.setAttribute("aria-checked", "true"); changed();
          });
          x.setAttribute("role", "radio"); x.setAttribute("aria-checked", String(b.align === a[0]));
          seg.appendChild(x);
        });
        body.appendChild(seg);
        body.appendChild(capInput(b));
      }
      if (b.t === "img2") {
        b.pics = b.pics || [null, null];
        var two = el("div", "re-two");
        [0, 1].forEach(function (k) {
          two.appendChild(picSlot(function () { return srcOf(b.pics[k]); }, function (v) { b.pics[k] = v; }, (k + 1) + "번째 사진"));
        });
        body.appendChild(two);
        body.appendChild(capInput(b));
      }
      if (b.t === "btn") {
        var row = el("div", "re-btnrow");
        var lb = el("input", "input"); lb.value = b.label || ""; lb.maxLength = 20; lb.placeholder = "버튼 글자 (예: 신청서 받기)"; lb.setAttribute("aria-label", "버튼 글자");
        var ur = el("input", "input"); ur.value = b.url || ""; ur.placeholder = "연결할 주소나 이메일"; ur.setAttribute("aria-label", "버튼 연결 주소");
        lb.addEventListener("input", function () { b.label = lb.value; if (opt.onChange) opt.onChange(); });
        ur.addEventListener("input", function () { b.url = ur.value; if (opt.onChange) opt.onChange(); });
        row.appendChild(lb); row.appendChild(ur); body.appendChild(row);
      }
      if (b.t === "list") {
        var ta = el("textarea", "textarea re-listta"); ta.value = (b.items || []).join("\n");
        ta.placeholder = "한 줄에 하나씩 써주세요"; ta.setAttribute("aria-label", "목록 (한 줄에 하나씩)");
        ta.addEventListener("input", function () { b.items = ta.value.split("\n"); if (opt.onChange) opt.onChange(); });
        body.appendChild(ta);
      }
      if (b.t === "hr") body.appendChild(el("hr", "rd-hr"));
      return f.node;
    }
    function capInput(b) {
      var c = el("input", "input re-cap"); c.value = b.cap || ""; c.maxLength = 60; c.placeholder = "사진 설명 (선택)"; c.setAttribute("aria-label", "사진 설명");
      c.addEventListener("input", function () { b.cap = c.value; if (opt.onChange) opt.onChange(); });
      return c;
    }

    function blocks() { return Array.prototype.filter.call(list.children, function (n) { return n._b; }); }
    function insert(b, focus) {
      var node = build(b);
      if (lastBlock && lastBlock.parentNode === list) lastBlock.after(node); else list.appendChild(node);
      lastBlock = node;
      changed();
      if (focus) {
        var f = node.querySelector("[contenteditable],input:not([type=file]),textarea") || node.querySelector("button");
        if (f) f.focus();
        node.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      return node;
    }
    function move(node, dir) {
      var sib = dir < 0 ? node.previousElementSibling : node.nextElementSibling;
      if (!sib || !sib._b) return;
      if (dir < 0) sib.before(node); else sib.after(node);
      var f = node.querySelector(dir < 0 ? ".re-up" : ".re-down");
      if (f && !f.disabled) f.focus(); else { var o2 = node.querySelector(dir < 0 ? ".re-down" : ".re-up"); if (o2) o2.focus(); }
      changed();
    }
    function refresh() {
      var bs = blocks();
      empty.hidden = bs.length > 0;
      bs.forEach(function (n, i) {
        n.querySelector(".re-up").disabled = i === 0;
        n.querySelector(".re-down").disabled = i === bs.length - 1;
      });
      var c = imageCount();
      count.textContent = "본문 사진 " + c + " / " + maxImages + "장";
      if (!tPrev.classList.contains("is-on")) return;
      W.renderDetail(prev, get({ preview: true }).doc);
    }

    // ---------- 끌어서 옮기기 ----------
    var dragging = null, mark = el("div", "re-mark");
    function clearMark() { if (mark.parentNode) mark.remove(); }
    list.addEventListener("dragover", function (e) {
      if (!dragging) return;
      e.preventDefault();
      var over = e.target.closest && e.target.closest(".re-block");
      if (!over || over === dragging) return;
      var r = over.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) over.before(mark); else over.after(mark);
    });
    list.addEventListener("drop", function (e) {
      if (!dragging) return;
      e.preventDefault();
      if (mark.parentNode) mark.replaceWith(dragging);
    });

    // ---------- 글자 꾸미기 ----------
    function curRange() {
      var sel = window.getSelection();
      if (!sel.rangeCount) return null;
      var r = sel.getRangeAt(0);
      var host = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
      var ed = host && host.closest && host.closest(".re-rich");
      return ed && root.contains(ed) ? { r: r, ed: ed } : null;
    }
    function needSel() {
      var c = curRange();
      if (!c || c.r.collapsed) { flash(); return null; }
      return c;
    }
    function flash() { hint.classList.remove("is-flash"); void hint.offsetWidth; hint.classList.add("is-flash"); }
    function after(ed) { ed.dispatchEvent(new Event("input", { bubbles: true })); }
    function exec(cmd) {
      var c = needSel(); if (!c) return;
      try { document.execCommand("styleWithCSS", false, false); } catch (e) { /* 무시 */ }
      document.execCommand(cmd, false, null);
      after(c.ed);
    }
    function wrapClass(group, cls) {
      var c = needSel(); if (!c) return;
      var frag = c.r.extractContents();
      frag.querySelectorAll("span").forEach(function (s) {
        group.forEach(function (g) { s.classList.remove(g); });
        if (!s.classList.length) { while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s); s.remove(); }
      });
      var node = frag;
      if (cls) { var sp = document.createElement("span"); sp.className = cls; sp.appendChild(frag); node = sp; }
      var first = node.firstChild, last = node.lastChild, isSpan = node.nodeType === 1;
      c.r.insertNode(node);
      var sel = window.getSelection(), nr = document.createRange();
      if (isSpan) nr.selectNodeContents(node); else if (first && last) { nr.setStartBefore(first); nr.setEndAfter(last); }
      sel.removeAllRanges(); sel.addRange(nr);
      after(c.ed);
    }
    function clearFormat() {
      var c = needSel(); if (!c) return;
      var t = c.r.toString();
      c.r.deleteContents();
      var tn = document.createTextNode(t); c.r.insertNode(tn);
      // 감싸고 있던 꾸밈 밖으로 꺼내기
      var p = tn.parentNode;
      while (p && p !== c.ed && /^(B|STRONG|SPAN|A)$/.test(p.nodeName)) {
        splitOut(tn, p); p = tn.parentNode;
      }
      after(c.ed);
    }
    function splitOut(node, parent) {
      var rightPart = parent.cloneNode(false);
      while (node.nextSibling) rightPart.appendChild(node.nextSibling);
      parent.after(node);
      if (rightPart.childNodes.length) node.after(rightPart);
      if (!parent.childNodes.length) parent.remove();
    }
    function openLink() {
      var c = needSel(); if (!c) return;
      savedRange = c.r.cloneRange(); lastRich = c.ed;
      var a = c.r.commonAncestorContainer.parentNode && c.r.commonAncestorContainer.parentNode.closest && c.r.commonAncestorContainer.parentNode.closest("a");
      linkInput.value = a ? a.getAttribute("href").replace(/^mailto:/, "") : "";
      linkRow.hidden = false; linkInput.focus();
    }
    function applyLink() {
      var v = linkInput.value.trim();
      var h = v ? W.linkHref(v) : "";
      if (v && !h) { err("https://로 시작하는 주소나 이메일을 넣어주세요"); linkInput.focus(); return; }
      linkRow.hidden = true;
      if (!savedRange || !lastRich) return;
      lastRich.focus();
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange);
      if (h) document.execCommand("createLink", false, h); else document.execCommand("unlink", false, null);
      after(lastRich);
    }

    // ---------- 미리보기 ----------
    function setTab(previewOn) {
      tEdit.classList.toggle("is-on", !previewOn); tPrev.classList.toggle("is-on", previewOn);
      tEdit.setAttribute("aria-selected", String(!previewOn)); tPrev.setAttribute("aria-selected", String(previewOn));
      list.hidden = previewOn; add.hidden = previewOn; bar.hidden = previewOn; linkRow.hidden = true; count.hidden = previewOn;
      prev.hidden = !previewOn;
      root.classList.toggle("is-preview", previewOn);
      refresh();
      if (previewOn && !prev.childNodes.length) prev.appendChild(el("p", "re-empty", "아직 넣은 내용이 없어요"));
    }
    tEdit.addEventListener("click", function () { setTab(false); });
    tPrev.addEventListener("click", function () { setTab(true); });

    // ---------- 값 꺼내기 / 넣기 ----------
    function imageCount() {
      var n = 0;
      blocks().forEach(function (node) {
        var b = node._b;
        if (b.t === "img" && b.pic) n++;
        if (b.t === "img2") b.pics.forEach(function (p) { if (p) n++; });
      });
      return n;
    }
    function get(o) {
      o = o || {};
      var files = [], out = [];
      function pic(v) {
        if (!v) return "";
        if (typeof v === "string") return v;
        if (v.url) return v.url;
        if (o.preview) return v.file.preview;
        if (o.draft) return "";
        files.push({ name: v.file.name, data: v.file.data });
        return "upload:" + (files.length - 1);
      }
      blocks().forEach(function (node) {
        var b = node._b, x = { t: b.t };
        if (b.t === "p" || b.t === "note") { x.html = W.inlineHtml(b.html || ""); if (!x.html.replace(/<br>/g, "").trim()) return; }
        if (b.t === "h") { x.text = String(b.text || "").trim(); if (!x.text) return; }
        if (b.t === "img") { x.src = pic(b.pic); if (!x.src) return; x.align = b.align || "full"; if (b.cap) x.cap = b.cap.trim(); }
        if (b.t === "img2") { x.src = b.pics.map(pic).filter(String); if (!x.src.length) return; if (b.cap) x.cap = b.cap.trim(); }
        if (b.t === "btn") { x.label = String(b.label || "").trim(); x.url = String(b.url || "").trim(); if (!x.label && !x.url) return; }
        if (b.t === "list") { x.items = (b.items || []).map(function (s) { return String(s).trim(); }).filter(String); if (!x.items.length) return; }
        out.push(x);
      });
      return { doc: out.length ? JSON.stringify({ v: 1, blocks: out }) : "", images: files };
    }
    function set(raw) {
      blocks().forEach(function (n) { n.remove(); });
      lastBlock = null;
      var d = W.parseDoc(raw);
      if (!d) {
        var t = String(raw == null ? "" : raw).trim();
        d = { blocks: t ? [{ t: "p", html: t.split("\n").map(esc).join("<br>") }] : [] };
      }
      d.blocks.forEach(function (b) {
        var x = { t: b.t };
        if (!NAMES[b.t]) return;
        if (b.t === "p" || b.t === "note") x.html = b.html;
        if (b.t === "h") x.text = b.text;
        if (b.t === "img") { x.pic = b.src || null; x.align = b.align; x.cap = b.cap; }
        if (b.t === "img2") { x.pics = [(b.src || [])[0] || null, (b.src || [])[1] || null]; x.cap = b.cap; }
        if (b.t === "btn") { x.label = b.label; x.url = b.url; }
        if (b.t === "list") x.items = b.items;
        list.appendChild(build(x));
      });
      lastBlock = null;
      refresh();
    }
    function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function validate() {
      var bad = null;
      blocks().forEach(function (node) {
        var b = node._b;
        if (bad || b.t !== "btn") return;
        var l = String(b.label || "").trim(), u = String(b.url || "").trim();
        if ((l || u) && (!l || !W.linkHref(u))) bad = { node: node, msg: !l ? "버튼 글자를 써주세요" : "버튼 주소는 https://로 시작하는 주소나 이메일로 넣어주세요" };
      });
      if (bad) { setTab(false); var f = bad.node.querySelector(!String(bad.node._b.label || "").trim() ? "input" : "input:last-child"); if (f) f.focus(); }
      return bad ? bad.msg : "";
    }

    refresh();
    return {
      set: set,
      get: get,
      draft: function () { return get({ draft: true }).doc; },
      text: function () { return W.docText(get({ preview: true }).doc); },
      isEmpty: function () { return !get({ preview: true }).doc; },
      imageCount: imageCount,
      validate: validate,
      focus: function () { var f = root.querySelector("[contenteditable],.re-add__btn"); if (f) f.focus(); },
      showEdit: function () { setTab(false); }
    };
  };
})();
