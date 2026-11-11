/* 웹진·업로드·관리자 페이지가 함께 쓰는 도구 */
(function () {
  "use strict";
  var CFG = window.WEBZINE_CONFIG || {};

  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
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

  function loadSheet(name) {
    var url = "https://docs.google.com/spreadsheets/d/" + CFG.sheetId +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(name) + "&_=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(name); return r.text(); })
      .then(function (t) { return toObjects(parseCSV(t)); });
  }

  // Apps Script 호출 (text/plain 으로 보내 사전 요청 없이 동작)
  function api(action, data) {
    if (!CFG.apiUrl) return Promise.reject(new Error("NO_API"));
    var body = Object.assign({ action: action }, data || {});
    return fetch(CFG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) {
          var err = new Error((res && res.error) || "요청을 처리하지 못했어요");
          err.code = res && res.code;
          throw err;
        }
        return res;
      });
  }

  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function safeUrl(u) {
    u = (u || "").trim();
    if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u)) return u;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return "mailto:" + u;
    return "";
  }
  function imgSrc(v) {
    v = (v || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return (CFG.imageFolder || "images/") + v.replace(/^\/+/, "");
  }
  function price(v) {
    var n = num(v);
    return n > 0 ? n.toLocaleString("ko-KR") + "원부터" : "가격은 문의해 주세요";
  }
  function parseDate(v) {
    var m = String(v || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  // 마감 표시: { text, state } state = soon | open | closed
  function deadline(v) {
    var d = parseDate(v);
    if (!d) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var left = Math.round((d - today) / 86400000);
    var md = (d.getMonth() + 1) + "월 " + d.getDate() + "일";
    if (left < 0) return { text: "마감됐어요", state: "closed", date: md };
    if (left === 0) return { text: "오늘 마감", state: "soon", date: md };
    if (left <= 7) return { text: "D-" + left, state: "soon", date: md };
    return { text: md + " 마감", state: "open", date: md };
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function media(box, src, alt) {
    box.textContent = "";
    var ph = el("div", "ph");
    if (!src) { box.appendChild(ph); return; }
    var img = el("img");
    img.src = src; img.alt = alt || ""; img.loading = "lazy";
    img.onerror = function () { box.textContent = ""; box.appendChild(ph); };
    box.appendChild(img);
  }
  function list(v) {
    return String(v || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // 사진을 가로 최대 maxW 로 줄여 JPEG base64 로 변환 (업로드 용량 절약)
  function resizeImage(file, maxW) {
    maxW = maxW || 1600;
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) { reject(new Error("사진 파일만 올릴 수 있어요")); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("사진을 읽지 못했어요")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("사진을 열지 못했어요")); };
        img.onload = function () {
          var s = Math.min(1, maxW / img.width);
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          var ctx = c.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          var data = c.toDataURL("image/jpeg", 0.85);
          resolve({ name: file.name.replace(/\.[^.]+$/, "") + ".jpg", data: data.split(",")[1], preview: data });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 사진 칸(쉼표로 여러 장)에서 주소 목록 / 첫 장
  function photos(v) { return list(v).map(imgSrc).filter(Boolean); }
  function firstImg(v) { return photos(v)[0] || ""; }

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVG = {
    prev: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
  };

  // 사진 슬라이드: 손가락으로 밀기 · 점 · 좌우 버튼 · 자동 넘김(opt.auto ms)
  function slider(box, srcs, opt) {
    opt = opt || {};
    if (box._slider) box._slider.stop();
    box.textContent = ""; box._slider = null;
    var n = srcs.length;
    if (n < 2) {
      media(box, srcs[0] || "", opt.alt);
      if (n && opt.onTap) { var only = box.firstChild; only.style.cursor = "zoom-in"; only.addEventListener("click", function () { opt.onTap(0); }); }
      return null;
    }
    var root = el("div", "slider");
    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "슬라이드");
    root.setAttribute("aria-label", (opt.alt || "사진") + " " + n + "장");
    var track = el("div", "slider__track");
    track.tabIndex = 0;
    srcs.forEach(function (src, i) {
      var slide = el("div", "slider__slide");
      slide.setAttribute("aria-label", n + "장 중 " + (i + 1) + "번째");
      var img = el("img");
      img.src = src; img.alt = opt.alt ? opt.alt + " " + (i + 1) : ""; img.loading = i ? "lazy" : "eager"; img.draggable = false;
      img.onerror = function () { slide.textContent = ""; slide.appendChild(el("div", "ph")); };
      slide.appendChild(img);
      if (opt.onTap) { slide.style.cursor = "zoom-in"; slide.addEventListener("click", function () { opt.onTap(i); }); }
      track.appendChild(slide);
    });
    var dots = el("div", "slider__dots");
    var dotBtns = srcs.map(function (_, i) {
      var d = el("button", "slider__dot"); d.type = "button"; d.setAttribute("aria-label", (i + 1) + "번째 사진 보기");
      d.addEventListener("click", function (e) { e.stopPropagation(); go(i); hold(); });
      dots.appendChild(d); return d;
    });
    var count = el("span", "slider__count");
    var prev = el("button", "slider__nav slider__nav--prev"); prev.type = "button"; prev.setAttribute("aria-label", "이전 사진"); prev.innerHTML = SVG.prev;
    var next = el("button", "slider__nav slider__nav--next"); next.type = "button"; next.setAttribute("aria-label", "다음 사진"); next.innerHTML = SVG.next;
    prev.addEventListener("click", function (e) { e.stopPropagation(); go(idx - 1); hold(); });
    next.addEventListener("click", function (e) { e.stopPropagation(); go(idx + 1); hold(); });
    root.appendChild(track); root.appendChild(prev); root.appendChild(next); root.appendChild(count); root.appendChild(dots);
    box.appendChild(root);

    var idx = 0, timer = null, paused = false, resumeT = null;
    function mark() {
      dotBtns.forEach(function (d, i) { d.setAttribute("aria-current", String(i === idx)); });
      count.textContent = (idx + 1) + " / " + n;
    }
    function go(i) {
      idx = (i + n) % n;
      track.scrollTo({ left: idx * track.clientWidth, behavior: REDUCED ? "auto" : "smooth" });
      mark();
    }
    var st = null;
    track.addEventListener("scroll", function () {
      clearTimeout(st);
      st = setTimeout(function () { var w = track.clientWidth || 1; var k = Math.round(track.scrollLeft / w); if (k !== idx) { idx = k; mark(); } }, 60);
    }, { passive: true });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); hold(); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1); hold(); }
    });
    function hold() { paused = true; clearTimeout(resumeT); resumeT = setTimeout(function () { paused = false; }, 8000); }
    ["pointerdown", "touchstart", "focusin"].forEach(function (ev) { root.addEventListener(ev, hold, { passive: true }); });
    root.addEventListener("mouseenter", function () { paused = true; clearTimeout(resumeT); });
    root.addEventListener("mouseleave", function () { paused = false; });
    if (opt.auto && !REDUCED) {
      timer = setInterval(function () { if (!paused && !document.hidden && root.isConnected) go(idx + 1); }, opt.auto);
    }
    window.addEventListener("resize", function () { track.scrollLeft = idx * track.clientWidth; });
    mark();
    var api = { stop: function () { clearInterval(timer); }, go: go };
    box._slider = api;
    return api;
  }

  // 여러 장 사진 고르기 (관리자·업로드 공용)
  // o: { thumbs, drop, input, urlInput, max, maxW, onChange, onError }
  function photoSet(o) {
    var items = [], max = o.max || 5, dragFrom = -1;
    function render() {
      o.thumbs.textContent = "";
      items.forEach(function (it, i) {
        var card = el("div", "pthumb");
        var fig = el("div", "pthumb__img");
        var img = el("img"); img.src = it.src; img.alt = ""; fig.appendChild(img);
        if (i === 0) fig.appendChild(el("span", "pthumb__badge", "대표"));
        card.appendChild(fig);
        var bar = el("div", "pthumb__bar");
        function mk(label, html, fn, dis) {
          var b = el("button", "pthumb__btn"); b.type = "button"; b.setAttribute("aria-label", label); b.innerHTML = html; b.disabled = !!dis;
          b.addEventListener("click", fn); bar.appendChild(b);
        }
        mk((i + 1) + "번째 사진 앞으로", SVG.prev, function () { swap(i, i - 1); }, i === 0);
        mk((i + 1) + "번째 사진 뒤로", SVG.next, function () { swap(i, i + 1); }, i === items.length - 1);
        mk((i + 1) + "번째 사진 지우기", "×", function () { items.splice(i, 1); render(); });
        card.appendChild(bar);
        card.draggable = true; card.title = "끌어서 순서를 바꿀 수 있어요";
        card.addEventListener("dragstart", function (e) { dragFrom = i; card.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", ""); } catch (er) { /* 무시 */ } });
        card.addEventListener("dragend", function () { card.classList.remove("is-drag"); dragFrom = -1; });
        card.addEventListener("dragover", function (e) { if (dragFrom < 0) return; e.preventDefault(); card.classList.add("is-over"); });
        card.addEventListener("dragleave", function () { card.classList.remove("is-over"); });
        card.addEventListener("drop", function (e) {
          e.preventDefault(); card.classList.remove("is-over");
          if (dragFrom < 0 || dragFrom === i) return;
          var it = items.splice(dragFrom, 1)[0]; items.splice(i, 0, it); dragFrom = -1; render();
        });
        o.thumbs.appendChild(card);
      });
      o.drop.hidden = items.length >= max;
      if (o.urlInput) o.urlInput.hidden = items.length >= max;
      if (o.onChange) o.onChange();
    }
    function swap(a, b) { if (b < 0 || b >= items.length) return; var t = items[a]; items[a] = items[b]; items[b] = t; render(); }
    o.input.addEventListener("change", function () {
      var fs = Array.prototype.slice.call(this.files, 0, Math.max(0, max - items.length)); this.value = "";
      Promise.all(fs.map(function (f) { return resizeImage(f, o.maxW || 1600); }))
        .then(function (rs) { rs.forEach(function (r) { items.push({ file: r, src: r.preview }); }); render(); })
        .catch(function (e) { if (o.onError) o.onError(e.message); });
    });
    if (o.urlInput) {
      var addUrl = function () {
        var v = o.urlInput.value.trim();
        if (!v) return;
        if (!/^https?:\/\//i.test(v)) { if (o.onError) o.onError("사진 주소는 https://로 시작해야 해요"); return; }
        if (items.length < max) items.push({ url: v, src: v });
        o.urlInput.value = ""; render();
      };
      o.urlInput.addEventListener("change", addUrl);
      o.urlInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addUrl(); } });
    }
    o.drop.addEventListener("dragover", function () { o.drop.classList.add("is-drag"); });
    o.drop.addEventListener("dragleave", function () { o.drop.classList.remove("is-drag"); });
    o.drop.addEventListener("drop", function () { o.drop.classList.remove("is-drag"); });
    return {
      set: function (v) { items = list(v).slice(0, max).map(function (u) { return { url: u, src: imgSrc(u) }; }); render(); },
      payload: function () { return items.map(function (it) { return it.url ? it.url : { name: it.file.name, data: it.file.data }; }); },
      count: function () { return items.length; },
      first: function () { return items[0] ? items[0].src : ""; },
      clear: function () { items = []; render(); }
    };
  }


  // ---------- 상세설명 (블록 문서) ----------
  // 저장 형식: {"v":1,"blocks":[{t:"p",html},{t:"h",text},{t:"img",src,cap,align},{t:"img2",src:[a,b],cap},
  //            {t:"btn",label,url},{t:"note",html},{t:"list",items:[..]},{t:"hr"}]}  · 예전 글(그냥 글자)도 그대로 보여요
  var INLINE_CLS = { "tx-blue": 1, "tx-red": 1, "tx-gray": 1, "tx-lg": 1, "tx-sm": 1 };
  function parseDoc(raw) {
    if (raw && typeof raw === "object" && Array.isArray(raw.blocks)) return raw;
    var s = String(raw == null ? "" : raw).trim();
    if (s.charAt(0) !== "{") return null;
    try { var d = JSON.parse(s); return d && Array.isArray(d.blocks) ? d : null; } catch (e) { return null; }
  }
  function linkHref(u) {
    u = String(u || "").trim();
    if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u)) return u;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return "mailto:" + u;
    if (/^www\./i.test(u)) return "https://" + u;
    return "";
  }
  // 허용한 꾸밈(굵게·색·크기·링크·줄바꿈)만 남기고 나머지는 글자로만 살려요
  function sanitizeInline(html) {
    var frag = document.createDocumentFragment();
    var src = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html").body;
    function lastIsBr(out) { var l = out.lastChild; return !l || (l.nodeName === "BR"); }
    function walk(node, out) {
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        var tag = n.nodeName, x;
        if (tag === "BR") { out.appendChild(document.createElement("br")); return; }
        if (tag === "B" || tag === "STRONG") { x = document.createElement("b"); walk(n, x); out.appendChild(x); return; }
        if (tag === "A") {
          var h = linkHref(n.getAttribute("href"));
          if (h) { x = document.createElement("a"); x.href = h; x.target = "_blank"; x.rel = "noopener"; walk(n, x); out.appendChild(x); }
          else walk(n, out);
          return;
        }
        if (tag === "SPAN" || tag === "FONT") {
          var cls = (n.getAttribute("class") || "").split(/\s+/).filter(function (c) { return INLINE_CLS[c]; });
          var bold = /font-weight:\s*(bold|[6-9]00)/i.test(n.getAttribute("style") || "");
          if (cls.length || bold) {
            x = document.createElement(cls.length ? "span" : "b");
            if (cls.length) x.className = cls.join(" ");
            walk(n, x); out.appendChild(x);
          } else walk(n, out);
          return;
        }
        if (tag === "DIV" || tag === "P" || tag === "LI") {
          if (out.childNodes.length && !lastIsBr(out)) out.appendChild(document.createElement("br"));
          walk(n, out); return;
        }
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT") return;
        walk(n, out);
      });
    }
    walk(src, frag);
    while (frag.lastChild && frag.lastChild.nodeName === "BR") frag.removeChild(frag.lastChild);
    return frag;
  }
  function inlineHtml(html) { var d = document.createElement("div"); d.appendChild(sanitizeInline(html)); return d.innerHTML; }
  function inlineText(html) { var d = document.createElement("div"); d.appendChild(sanitizeInline(html)); return d.textContent; }
  function docText(raw) {
    var d = parseDoc(raw);
    if (!d) return String(raw == null ? "" : raw);
    return d.blocks.map(function (b) {
      if (b.t === "p" || b.t === "note") return inlineText(b.html);
      if (b.t === "h") return b.text || "";
      if (b.t === "list") return (b.items || []).join("\n");
      if (b.t === "btn") return b.label || "";
      if (b.t === "img" || b.t === "img2") return b.cap || "";
      return "";
    }).join("\n").trim();
  }
  function docImages(raw) {
    var d = parseDoc(raw), out = [];
    if (d) d.blocks.forEach(function (b) {
      if (b.t === "img" && b.src) out.push(b.src);
      if (b.t === "img2") (b.src || []).forEach(function (u) { if (u) out.push(u); });
    });
    return out;
  }
  function picSrc(u) {
    u = String(u || "");
    if (/^data:image\/(jpeg|png|webp|gif);base64,/i.test(u)) return u;
    if (/^(javascript|data|vbscript):/i.test(u)) return "";
    return imgSrc(u);
  }
  function renderDetail(box, raw, o) {
    o = o || {};
    box.textContent = "";
    box.classList.add("rd");
    var d = parseDoc(raw);
    if (!d) {
      var t = String(raw == null ? "" : raw).trim();
      if (t) box.appendChild(el("p", "rd-p rd-pre", t));
      return;
    }
    var all = [];
    function pic(u, alt) {
      var s = picSrc(u); if (!s) return null;
      var k = all.length; all.push(s);
      var img = el("img"); img.src = s; img.alt = alt || ""; img.loading = "lazy"; img.decoding = "async";
      if (o.onImg) {
        var b = el("button", "rd-zoom"); b.type = "button"; b.setAttribute("aria-label", "사진 크게 보기");
        b.appendChild(img); b.addEventListener("click", function () { o.onImg(all, k, b); });
        return b;
      }
      return img;
    }
    d.blocks.forEach(function (b) {
      var n;
      if (b.t === "p" || b.t === "note") {
        n = el(b.t === "p" ? "p" : "div", b.t === "p" ? "rd-p" : "rd-note");
        n.appendChild(sanitizeInline(b.html));
        if (!n.textContent.trim()) return;
      } else if (b.t === "h") {
        if (!b.text) return; n = el("h4", "rd-h", b.text);
      } else if (b.t === "img") {
        var p1 = pic(b.src, b.cap); if (!p1) return;
        var al = { full: 1, center: 1, left: 1, right: 1 }[b.align] ? b.align : "full";
        n = el("figure", "rd-fig rd-fig--" + al); n.appendChild(p1);
        if (b.cap) n.appendChild(el("figcaption", "", b.cap));
      } else if (b.t === "img2") {
        var ps = (b.src || []).slice(0, 2).map(function (u) { return pic(u, b.cap); }).filter(Boolean);
        if (!ps.length) return;
        n = el("figure", "rd-fig2"); var row = el("div", "rd-fig2__row");
        ps.forEach(function (p) { row.appendChild(p); }); n.appendChild(row);
        if (b.cap) n.appendChild(el("figcaption", "", b.cap));
      } else if (b.t === "btn") {
        var h = linkHref(b.url); if (!h || !b.label) return;
        n = el("p", "rd-btnrow"); var a = el("a", "btn btn--soft rd-btn", b.label);
        a.href = h; a.target = "_blank"; a.rel = "noopener"; n.appendChild(a);
      } else if (b.t === "list") {
        var items = (b.items || []).filter(function (x) { return String(x).trim(); }); if (!items.length) return;
        n = el("ul", "rd-list"); items.forEach(function (x) { n.appendChild(el("li", "", x)); });
      } else if (b.t === "hr") {
        n = el("hr", "rd-hr");
      }
      if (n) box.appendChild(n);
    });
  }

  window.WZ = {
    CFG: CFG, loadSheet: loadSheet, api: api, num: num, safeUrl: safeUrl, imgSrc: imgSrc,
    price: price, deadline: deadline, el: el, media: media, list: list, resizeImage: resizeImage,
    photos: photos, firstImg: firstImg, slider: slider, photoSet: photoSet,
    parseDoc: parseDoc, renderDetail: renderDetail, docText: docText, docImages: docImages,
    sanitizeInline: sanitizeInline, inlineHtml: inlineHtml, linkHref: linkHref, picSrc: picSrc
  };
})();
