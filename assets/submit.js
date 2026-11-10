/* 부서 상품 업로드 - 5단계 입력 */
(function () {
  "use strict";
  var W = window.WZ, el = W.el;
  var $ = function (id) { return document.getElementById(id); };
  var form = $("form"), steps = form.querySelectorAll(".step"), TOTAL = steps.length;
  var step = 1, photo = null, attachments = [], sending = false;
  var DRAFT_KEY = "wz-submit-draft";

  if (!W.CFG.apiUrl) $("noApi").hidden = false;

  // ---------- 값 읽기 ----------
  function val(id) { return ($(id).value || "").trim(); }
  function category() {
    var c = form.querySelector('input[name="category"]:checked');
    if (!c) return "";
    return c.value === "__etc" ? val("categoryEtc") : c.value;
  }
  function data() {
    return {
      dept: val("dept"), name: val("name"), contact: val("contact"),
      category: category(), title: val("title"), summary: val("summary"), detail: val("detail"),
      price: $("priceAsk").checked ? "" : val("price").replace(/[^0-9]/g, ""),
      deadline: val("deadline"), link: val("link"), wish: val("wish")
    };
  }

  // ---------- 임시 저장 (같은 브라우저에서 이어쓰기) ----------
  var SAVE_IDS = ["dept", "name", "contact", "categoryEtc", "title", "summary", "detail", "price", "deadline", "link", "wish"];
  function saveDraft() {
    try {
      var d = {}; SAVE_IDS.forEach(function (id) { d[id] = $(id).value; });
      var c = form.querySelector('input[name="category"]:checked'); d.category = c ? c.value : "";
      d.priceAsk = $("priceAsk").checked;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) { /* 저장 불가 환경은 무시 */ }
  }
  function loadDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!d) return;
      SAVE_IDS.forEach(function (id) { if (d[id]) $(id).value = d[id]; });
      if (d.category) { var r = form.querySelector('input[name="category"][value="' + d.category + '"]'); if (r) r.checked = true; }
      $("priceAsk").checked = !!d.priceAsk;
    } catch (e) { /* 무시 */ }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 무시 */ } }

  // ---------- 글자 수 ----------
  function updateCounts() {
    form.querySelectorAll("[data-count]").forEach(function (c) {
      var len = $(c.getAttribute("data-count")).value.length, max = +c.getAttribute("data-max");
      c.textContent = len + " / " + max;
      c.classList.toggle("is-over", len > max);
    });
  }

  // ---------- 미리보기 ----------
  function updatePreview() {
    var d = data();
    var chips = $("pvChips"); chips.textContent = "";
    chips.appendChild(el("span", "chip", d.category || "카테고리"));
    var dl = W.deadline(d.deadline);
    if (dl) chips.appendChild(el("span", "chip " + (dl.state === "soon" ? "chip--red" : "chip--gray"), dl.text));
    $("pvTitle").textContent = d.title || "상품명이 여기에 나와요";
    $("pvSummary").textContent = d.summary || "한 줄 설명이 여기에 나와요";
    $("pvPrice").textContent = W.price(d.price);
    var m = $("pvMedia"); m.textContent = "";
    if (photo) { var i = el("img"); i.src = photo.preview; i.alt = ""; m.appendChild(i); } else m.appendChild(el("span", "ph"));
  }

  // ---------- 오류 표시 ----------
  function clearErrors(scope) {
    scope.querySelectorAll(".is-error").forEach(function (n) { n.classList.remove("is-error"); n.removeAttribute("aria-invalid"); });
    scope.querySelectorAll(".field__error").forEach(function (n) { n.remove(); });
    $("formError").hidden = true;
  }
  function fieldError(input, msg) {
    input.classList.add("is-error");
    input.setAttribute("aria-invalid", "true");
    var e = el("span", "field__error", msg);
    e.id = (input.id || "f") + "-err";
    input.setAttribute("aria-describedby", e.id);
    (input.closest(".field") || input.parentNode).appendChild(e);
    return input;
  }

  // ---------- 단계별 확인 ----------
  function validate(n) {
    var s = form.querySelector('[data-step="' + n + '"]');
    clearErrors(s);
    var first = null, d = data();
    function need(id, msg) { if (!val(id)) { first = first || fieldError($(id), msg); return false; } return true; }
    function max(id, m, label) { if (val(id).length > m) { first = first || fieldError($(id), label + "은(는) " + m + "자 이내로 줄여주세요"); } }

    if (n === 1) {
      need("dept", "부서나 파트를 알려주세요");
      need("name", "담당자 이름을 알려주세요");
      if (need("contact", "연락받을 이메일을 알려주세요") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact))
        first = first || fieldError($("contact"), "이메일 형식을 확인해 주세요");
    }
    if (n === 2) {
      var c = form.querySelector('input[name="category"]:checked');
      if (!c) { var e = el("span", "field__error", "카테고리를 골라주세요"); $("categoryChoice").after(e); first = first || form.querySelector('input[name="category"]'); }
      else if (c.value === "__etc" && !val("categoryEtc")) first = first || fieldError($("categoryEtc"), "카테고리를 입력해 주세요");
      need("title", "상품명을 써주세요"); max("title", 24, "상품명");
    }
    if (n === 3) {
      need("summary", "한 줄 설명을 써주세요"); max("summary", 30, "한 줄 설명");
      need("detail", "자세한 설명을 써주세요"); max("detail", 400, "자세한 설명");
      if (!$("priceAsk").checked && val("price") && !/^[0-9,]+$/.test(val("price")))
        first = first || fieldError($("price"), "가격은 숫자만 입력해 주세요");
    }
    if (n === 4 && !photo) {
      var e2 = el("span", "field__error", "대표 사진을 한 장 올려주세요");
      $("photoThumb").after(e2); first = first || $("photo");
    }
    if (n === 5) {
      if (need("link", "문의나 신청을 받을 곳을 알려주세요") && !W.safeUrl(d.link))
        first = first || fieldError($("link"), "이메일 주소나 https://로 시작하는 링크를 넣어주세요");
    }
    if (first) { first.focus(); return false; }
    return true;
  }

  // ---------- 확인 화면 ----------
  function renderReview() {
    var d = data(), r = $("review"); r.textContent = "";
    [["부서 · 담당자", d.dept + " · " + d.name], ["연락처", d.contact], ["카테고리", d.category], ["상품명", d.title],
     ["한 줄 설명", d.summary], ["자세한 설명", d.detail], ["가격", W.price(d.price)],
     ["마감일", d.deadline || "없음"], ["사진", (photo ? "대표 사진 1장" : "") + (attachments.length ? " · 안내 이미지 " + attachments.length + "장" : "")]]
      .forEach(function (row) {
        var div = el("div"); div.appendChild(el("dt", "", row[0])); div.appendChild(el("dd", "", row[1])); r.appendChild(div);
      });
  }

  // ---------- 단계 이동 ----------
  function go(n, initial) {
    step = n;
    steps.forEach(function (s) { s.hidden = +s.getAttribute("data-step") !== n; });
    $("progressBar").style.width = (n / TOTAL * 100) + "%";
    $("progressText").textContent = n + " / " + TOTAL;
    $("prevBtn").hidden = n === 1;
    $("nextBtn").textContent = n === TOTAL ? "접수하기" : "다음";
    if (n === TOTAL) renderReview();
    if (initial) return;
    var t = form.querySelector('[data-step="' + n + '"] .step__title');
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (t) { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); }
  }

  $("prevBtn").addEventListener("click", function () { if (step > 1) go(step - 1); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending || !validate(step)) return;
    if (step < TOTAL) { go(step + 1); return; }
    send();
  });

  function send() {
    var btn = $("nextBtn");
    if (!W.CFG.apiUrl) {
      $("formError").textContent = "아직 접수 서버가 연결되지 않아 보낼 수 없어요. 편집 담당자에게 알려주세요.";
      $("formError").hidden = false; return;
    }
    sending = true; btn.disabled = true; btn.textContent = "보내는 중이에요…";
    var d = data();
    d.photo = { name: photo.name, data: photo.data };
    d.attachments = attachments.map(function (a) { return { name: a.name, data: a.data }; });
    W.api("submit", d).then(function (res) {
      clearDraft();
      form.querySelectorAll(".step").forEach(function (s) { s.hidden = true; });
      $("nav").hidden = true;
      document.querySelector(".progress").hidden = true;
      $("doneId").textContent = res.id ? "접수 번호 " + res.id : "";
      $("done").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function (err) {
      $("formError").textContent = "보내지 못했어요. 잠시 후 다시 눌러주세요. (" + err.message + ")";
      $("formError").hidden = false;
    }).then(function () { sending = false; btn.disabled = false; if (step === TOTAL) btn.textContent = "접수하기"; });
  }

  // ---------- 사진 ----------
  function thumb(box, item, onRemove, wide) {
    var t = el("div", "thumb" + (wide ? " thumb--wide" : ""));
    var i = el("img"); i.src = item.preview; i.alt = ""; t.appendChild(i);
    var b = el("button", "", "×"); b.type = "button"; b.setAttribute("aria-label", "사진 지우기");
    b.addEventListener("click", onRemove); t.appendChild(b);
    box.appendChild(t);
  }
  function renderPhotos() {
    $("photoThumb").textContent = "";
    if (photo) thumb($("photoThumb"), photo, function () { photo = null; renderPhotos(); }, true);
    $("photoDrop").hidden = !!photo;
    $("attachThumbs").textContent = "";
    attachments.forEach(function (a, i) {
      thumb($("attachThumbs"), a, function () { attachments.splice(i, 1); renderPhotos(); });
    });
    $("attachDrop").hidden = attachments.length >= 3;
    updatePreview();
  }
  function showErr(msg) { $("formError").textContent = msg; $("formError").hidden = false; }
  $("photo").addEventListener("change", function () {
    var f = this.files[0]; this.value = "";
    if (!f) return;
    W.resizeImage(f, 1600).then(function (r) { photo = r; renderPhotos(); }).catch(function (e) { showErr(e.message); });
  });
  $("attach").addEventListener("change", function () {
    var fs = Array.prototype.slice.call(this.files, 0, 3 - attachments.length); this.value = "";
    Promise.all(fs.map(function (f) { return W.resizeImage(f, 1400); }))
      .then(function (rs) { attachments = attachments.concat(rs); renderPhotos(); })
      .catch(function (e) { showErr(e.message); });
  });
  ["photoDrop", "attachDrop"].forEach(function (id) {
    var z = $(id);
    z.addEventListener("dragover", function () { z.classList.add("is-drag"); });
    z.addEventListener("dragleave", function () { z.classList.remove("is-drag"); });
    z.addEventListener("drop", function () { z.classList.remove("is-drag"); });
  });

  // ---------- 입력 반응 ----------
  form.addEventListener("input", function (e) {
    if (e.target.classList.contains("is-error")) { e.target.classList.remove("is-error"); var er = e.target.closest(".field") && e.target.closest(".field").querySelector(".field__error"); if (er) er.remove(); }
    updateCounts(); updatePreview(); saveDraft();
  });
  form.addEventListener("change", function (e) {
    if (e.target.name === "category") {
      $("categoryEtc").hidden = e.target.value !== "__etc";
      var er = $("categoryChoice").parentNode.querySelector(".field__error"); if (er) er.remove();
      if (e.target.value === "__etc") $("categoryEtc").focus();
    }
    if (e.target.id === "priceAsk") { $("price").disabled = e.target.checked; }
    updatePreview(); saveDraft();
  });

  loadDraft();
  var etc = form.querySelector('input[name="category"][value="__etc"]');
  $("categoryEtc").hidden = !(etc && etc.checked);
  $("price").disabled = $("priceAsk").checked;
  updateCounts(); updatePreview(); go(1, true);
})();
