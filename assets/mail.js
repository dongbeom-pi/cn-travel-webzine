/* 이번 호 안내 메일 만들기 (관리자)
   W.buildMail({ issue, products, base }) → { subject, html, body, text }
   메일 프로그램이 대부분 <style>을 지우기 때문에 모든 꾸밈은 태그 안에 직접 넣어요. */
(function () {
  "use strict";
  var W = window.WZ;
  var FONT = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Arial,sans-serif";
  var C = { text: "#191F28", sub: "#4E5968", mute: "#5F6A77", blue: "#0072B9", line: "#E5E8EB", bg: "#F2F4F6", soft: "#E8F3FB" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function abs(u, base) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return base + u.replace(/^\.?\/+/, "");   // firstImg가 이미 images/ 를 붙여줘요
  }
  // 메일용 사진 크기 맞추기 (구글 드라이브·Pexels는 주소로 크기·자르기 가능)
  function fit(u, w, h) {
    if (/googleusercontent\.com\/d\//.test(u)) return u.replace(/=[^/]*$/, "") + "=w" + w + (h ? "-h" + h + "-c" : "");
    if (/images\.pexels\.com/.test(u)) {
      u = u.replace(/([?&])(w|h|fit|dpr|auto)=[^&]*/g, "$1").replace(/[?&]+$/, "").replace(/\?&+/, "?");
      return u + (u.indexOf("?") < 0 ? "?" : "&") + "auto=compress&w=" + w + (h ? "&h=" + h + "&fit=crop" : "");
    }
    return u;
  }
  function T(style, inner, tag) { return "<" + (tag || "div") + ' style="' + style + '">' + inner + "</" + (tag || "div") + ">"; }

  W.buildMail = function (o) {
    var it = o.issue, base = o.base.replace(/\/?$/, "/");
    var no = W.num(it["호수"]);
    var week = it["주차표기"] || "";
    var title = it["커버제목"] || "이번 호가 나왔어요";
    var intro = it["커버소개"] || "";
    var issueUrl = base + "issues/" + no + "/?ref=mail";
    var cover = fit(abs(W.firstImg(it["커버사진"]), base), 1104);
    var ps = o.products || [];
    var subject = "(광고) 씨앤 트래블 매거진 " + (week ? week + " · " : "") + title;
    var pre = intro ? intro.slice(0, 60) : title;

    var rows = ps.map(function (p) {
      var url = p.id ? base + "products/" + encodeURIComponent(p.id) + "/?ref=mail" : issueUrl;
      var img = fit(abs(W.firstImg(p["사진"]), base), 240, 180);
      var dl = W.deadline(p["마감일"]);
      var chips = esc(p["카테고리"] || "") + (dl && dl.state !== "closed" ? '&nbsp;&nbsp;<span style="color:' + (dl.state === "soon" ? "#BE2A30" : C.mute) + ';">' + esc(dl.text) + "</span>" : "");
      return '<tr><td style="padding:0 0 12px;">' +
        '<a href="' + esc(url) + '" target="_blank" style="text-decoration:none;color:' + C.text + ';display:block;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + C.line + ';border-radius:16px;border-collapse:separate;"><tr>' +
        (img ? '<td width="132" valign="top" style="width:132px;padding:14px 0 14px 14px;"><img src="' + esc(img) + '" width="120" height="90" alt="" style="display:block;width:120px;height:90px;border-radius:10px;border:0;background:' + C.bg + ';"></td>' : "") +
        '<td valign="top" style="padding:14px 16px;font-family:' + FONT + ';">' +
        T("font-size:12px;line-height:18px;font-weight:bold;color:" + C.blue + ";", chips) +
        T("margin-top:2px;font-size:17px;line-height:25px;font-weight:bold;color:" + C.text + ";", esc(p["상품명"] || "")) +
        (p["한줄설명"] ? T("margin-top:2px;font-size:14px;line-height:21px;color:" + C.sub + ";", esc(p["한줄설명"])) : "") +
        T("margin-top:6px;font-size:15px;line-height:22px;font-weight:bold;color:" + C.text + ";", esc(W.price(p["가격"]))) +
        "</td></tr></table></a></td></tr>";
    }).join("");

    var body =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.bg + ';">' +
      '<tr><td align="center" style="padding:32px 12px;">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:24px;border-collapse:separate;">' +
      // 머리
      '<tr><td style="padding:28px 28px 0;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td valign="middle" style="width:48px;"><img src="' + esc(base) + 'images/cn-symbol.png" width="48" height="27" alt="CN" style="display:block;width:48px;height:27px;border:0;"></td>' +
      '<td valign="middle" style="padding-left:10px;font-family:' + FONT + ';">' +
      T("font-size:16px;line-height:22px;font-weight:bold;color:" + C.text + ";", "씨앤 트래블 매거진") +
      T("font-size:11px;line-height:14px;font-weight:bold;letter-spacing:2px;color:" + C.blue + ";", "CTM") +
      "</td></tr></table></td></tr>" +
      // 호수
      '<tr><td style="padding:28px 28px 0;font-family:' + FONT + ';">' +
      T("font-size:14px;line-height:20px;font-weight:bold;color:" + C.blue + ";", esc((week ? week + " · " : "") + no + "호")) +
      T("margin-top:6px;font-size:26px;line-height:36px;font-weight:bold;letter-spacing:-0.5px;color:" + C.text + ";", esc(title)) +
      (intro ? T("margin-top:10px;font-size:16px;line-height:26px;color:" + C.sub + ";", esc(intro)) : "") +
      "</td></tr>" +
      // 커버
      (cover ? '<tr><td style="padding:20px 28px 0;"><a href="' + esc(issueUrl) + '" target="_blank"><img src="' + esc(cover) + '" width="544" alt="' + esc(title) + '" style="display:block;width:100%;max-width:544px;height:auto;border-radius:16px;border:0;background:' + C.bg + ';"></a></td></tr>' : "") +
      // 상품
      (rows ? '<tr><td style="padding:32px 28px 0;font-family:' + FONT + ';">' +
        T("font-size:19px;line-height:28px;font-weight:bold;color:" + C.text + ";", esc(it["상품섹션제목"] || "이번 호 상품이에요")) +
        T("margin:4px 0 14px;font-size:14px;line-height:20px;color:" + C.mute + ";", "누르면 웹진에서 자세히 볼 수 있어요") +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + rows + "</table></td></tr>" : "") +
      // 버튼
      '<tr><td align="center" style="padding:20px 28px 36px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td align="center" bgcolor="' + C.blue + '" style="background:' + C.blue + ';border-radius:14px;">' +
      '<a href="' + esc(issueUrl) + '" target="_blank" style="display:block;padding:16px 24px;font-family:' + FONT + ';font-size:17px;line-height:24px;font-weight:bold;color:#FFFFFF;text-decoration:none;">이번 호 보러 가기</a>' +
      "</td></tr></table></td></tr>" +
      "</table>" +
      // 하단
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">' +
      '<tr><td style="padding:24px 28px 8px;font-family:' + FONT + ';font-size:12px;line-height:19px;color:' + C.mute + ';">' +
      T("font-weight:bold;color:" + C.sub + ";", "주식회사 씨앤") +
      T("", "대표이사 박상용 · 사업자등록번호 602-81-42620") +
      T("", "부산광역시 남구 남동천로 128, 809~812호 (문현동, BIFC2)") +
      T("", '문의 1600-3630 · <a href="mailto:biz@cncorp.kr" style="color:' + C.mute + ';">biz@cncorp.kr</a>') +
      T("margin-top:10px;", "이 메일은 씨앤과 거래 중인 고객님께 보내는 여행 소식이에요. 더 받지 않으시려면 이 메일에 ‘수신거부’라고 답장해 주세요.") +
      "</td></tr></table>" +
      "</td></tr></table>";

    var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>" + esc(subject) + "</title></head>" +
      '<body style="margin:0;padding:0;background:' + C.bg + ';">' +
      '<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:' + C.bg + ';">' + esc(pre) + "</div>" +
      body + "</body></html>";

    var text = [subject, "", title, intro, ""].concat(ps.map(function (p) {
      return "· " + (p["상품명"] || "") + " — " + W.price(p["가격"]);
    })).concat(["", "이번 호 보러 가기: " + issueUrl]).join("\n");

    return { subject: subject, html: html, body: body, text: text };
  };
})();
