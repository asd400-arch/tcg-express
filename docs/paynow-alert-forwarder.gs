/**
 * TCG Express — DBS 입금 알림 → 앱 자동 크레딧 전달 스크립트
 * =========================================================
 * 설치 위치: script.google.com (admin@techchainglobal.com 계정으로)
 * 트리거: 시간 기반, 1분마다 checkBankAlerts 실행
 *
 * 동작: admin@ Gmail에 도착한 DBS 입금 알림 이메일에서 금액을 뽑아
 *      앱의 /api/wallet/paynow-incoming 으로 전달한다.
 *      앱이 금액이 정확히 일치하는 대기 충전 건을 자동 크레딧한다.
 *
 * AMOUNT_REGEX 는 2026-08-24 실제 DBS 알림 메일로 검증 완료.
 * 설치 시 ALERT_SECRET 값에 Vercel의 PAYNOW_ALERT_SECRET 을 직접 붙여넣을 것.
 */

// ===== 설정 =====
var APP_ENDPOINT = 'https://app.techchainglobal.com/api/wallet/paynow-incoming'; // 앱 도메인 확인
var ALERT_SECRET = 'PASTE_PAYNOW_ALERT_SECRET_HERE'; // Vercel의 PAYNOW_ALERT_SECRET 과 동일 값
var SEARCH_QUERY = 'from:(DBSeAdvice@dbs.com) subject:("Incoming Funds Alert") newer_than:1d -label:tcg-processed';
var PROCESSED_LABEL = 'tcg-processed';

// 금액 추출 — 확정된 DBS 형식 (2026-08-24 실제 알림 기준):
// "You have received SGD1.50 from PARK JOO EON to your account XXXXX05344 on 24-Aug-2026 via FAST PAYMENT"
var AMOUNT_REGEX = /You have received SGD\s*([0-9,]+\.[0-9]{2})/i;
// 송금인 이름 추출 (참조 정보로 함께 전달)
var REF_REGEX = /received SGD\s*[0-9,.]+ from (.+?) to your account/i;

function checkBankAlerts() {
  var label = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  var threads = GmailApp.search(SEARCH_QUERY, 0, 20);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var handledAny = false;

    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      var body = msg.getPlainBody() || '';
      var subject = msg.getSubject() || '';
      var text = subject + '\n' + body;

      var m = text.match(AMOUNT_REGEX);
      if (!m) continue;
      var amount = parseFloat(m[1].replace(/,/g, ''));
      if (!amount || amount <= 0) continue;

      var refMatch = text.match(REF_REGEX);
      var reference = refMatch ? refMatch[1] : ('dbs_' + msg.getId());

      try {
        var res = UrlFetchApp.fetch(APP_ENDPOINT, {
          method: 'post',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + ALERT_SECRET },
          payload: JSON.stringify({ amount: amount, reference: reference }),
          muteHttpExceptions: true,
        });
        Logger.log('amount=' + amount + ' status=' + res.getResponseCode() + ' body=' + res.getContentText());
        handledAny = true;
      } catch (e) {
        Logger.log('POST failed: ' + e);
        // 전달 실패 시 라벨을 붙이지 않는다 → 다음 실행에서 재시도
        return;
      }
    }

    if (handledAny) threads[i].addLabel(label);
  }
}

/** 최초 1회 실행: 1분 간격 트리거 등록 */
function installTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) ScriptApp.deleteTrigger(triggers[i]);
  ScriptApp.newTrigger('checkBankAlerts').timeBased().everyMinutes(1).create();
}
