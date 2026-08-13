(function () {
  'use strict';

  var keys = [
    'contestName', 'contestStart', 'contestEnd', 'venue', 'category', 'contestDesc',
    'lectureStart', 'lectureEnd', 'sessions', 'fee', 'audience', 'lectureDays',
    'lectureTime', 'deadline', 'contact', 'how'
  ];
  var state = {};
  var excludedDates = new Set();
  var extraSchedules = [];
  var savedDrafts = [];
  var editingScheduleId = null;
  var exclusionViewMonth = null;
  var exclusionExpanded = false;
  var saveTimer = null;
  var storageAvailable = true;
  var AUTO_KEY = 'playwell-special-lecture-autosave-v3';
  var SAVES_KEY = 'playwell-special-lecture-saves-v3';
  var weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  var monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  var scheduleColors = {
    '추석': '#56bca7',
    '설날': '#43a696',
    '봄방학': '#2569c0',
    '여름방학': '#58ae41',
    '기타': '#038b78'
  };
  var modeLabels = {
    exclude: '특강 제외',
    proceed: '특강 진행',
    display: '표시만'
  };
  var layoutFlags = { titleOverflow: false, introOverflow: false, cardsOverflow: false };
  var $ = function (selector) { return document.querySelector(selector); };

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    var parts = value.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function fmt(value) {
    var date = parseDate(value);
    return date ? (date.getMonth() + 1) + '/' + date.getDate() + '(' + weekdays[date.getDay()] + ')' : '';
  }

  function listDates(start, end) {
    return start && end ? fmt(start) + ' ~ ' + fmt(end) : start ? fmt(start) : end ? fmt(end) : '';
  }

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function renderInfo(id, items) {
    $(id).innerHTML = items.filter(function (item) { return item[1]; }).map(function (item) {
      return '<div class="info-line"><span class="info-label">' + esc(item[0]) + '</span><span class="info-value">' + esc(item[1]).replace(/\n/g, '<br>') + '</span></div>';
    }).join('');
  }

  function getLectureDayIndexes(value) {
    var text = String(value || '').trim();
    if (!text) return new Set();
    if (text.includes('매일')) return new Set([0, 1, 2, 3, 4, 5, 6]);
    var fullNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    var found = new Set();
    fullNames.forEach(function (name, index) {
      var shortPattern = new RegExp('(^|[\\s,·/])' + weekdays[index] + '($|[\\s,·/])');
      if (text.includes(name) || shortPattern.test(text)) found.add(index);
    });
    return found;
  }

  function getLectureCandidates() {
    var start = parseDate(state.lectureStart);
    var end = parseDate(state.lectureEnd);
    var dayIndexes = getLectureDayIndexes(state.lectureDays);
    if (!start || !end || start > end || !dayIndexes.size) return [];
    var results = [];
    var cursor = new Date(start);
    var guard = 0;
    while (cursor <= end && guard < 740) {
      if (dayIndexes.has(cursor.getDay())) results.push(dateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    return results;
  }

  function scheduleName(schedule) {
    return schedule.type === '기타' ? schedule.name : schedule.type;
  }

  function schedulesOnDate(key) {
    return extraSchedules.filter(function (schedule) { return key >= schedule.start && key <= schedule.end; });
  }

  function isAutoExcluded(key) {
    return schedulesOnDate(key).some(function (schedule) { return schedule.mode === 'exclude'; });
  }

  function getEffectiveLectureDates() {
    return getLectureCandidates().filter(function (key) {
      return !excludedDates.has(key) && !isAutoExcluded(key);
    });
  }

  function compactDateList(values, limit) {
    var dates = values.map(fmt).filter(Boolean);
    if (dates.length <= limit) return dates.join(', ');
    return dates.slice(0, limit).join(', ') + ' 외 ' + (dates.length - limit) + '일';
  }

  function compactScheduleList() {
    var values = extraSchedules.map(function (schedule) {
      var range = listDates(schedule.start, schedule.end);
      return scheduleName(schedule) + ' ' + range + ' · ' + modeLabels[schedule.mode];
    });
    if (values.length <= 3) return values.join('\n');
    return values.slice(0, 3).join('\n') + '\n외 ' + (values.length - 3) + '건';
  }

  function collectFields() {
    keys.forEach(function (key) {
      var element = $('[data-key="' + key + '"]');
      state[key] = element ? element.value.trim() : '';
    });
  }

  function snapshot() {
    collectFields();
    return {
      version: 3,
      fields: clone(state),
      exclusions: Array.from(excludedDates).sort(),
      schedules: clone(extraSchedules),
      updatedAt: new Date().toISOString()
    };
  }

  function validSnapshot(data) {
    return data && typeof data === 'object' && data.fields && typeof data.fields === 'object' && Array.isArray(data.exclusions) && Array.isArray(data.schedules);
  }

  function restoreSnapshot(data, shouldPersist) {
    if (!validSnapshot(data)) return false;
    keys.forEach(function (key) {
      var element = $('[data-key="' + key + '"]');
      if (element && key !== 'sessions') element.value = data.fields[key] == null ? '' : String(data.fields[key]);
    });
    excludedDates = new Set(data.exclusions.filter(function (key) { return parseDate(key); }));
    extraSchedules = data.schedules.filter(function (schedule) {
      return schedule && schedule.id && schedule.type && parseDate(schedule.start) && parseDate(schedule.end) && schedule.start <= schedule.end && modeLabels[schedule.mode];
    }).map(function (schedule) {
      return {
        id: String(schedule.id),
        type: String(schedule.type),
        name: String(schedule.name || ''),
        start: schedule.start,
        end: schedule.end,
        mode: schedule.mode
      };
    });
    update(shouldPersist !== false);
    return true;
  }

  function setSaveStatus(text) {
    $('#saveStatus').textContent = text;
  }

  function saveAutosaveNow() {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(AUTO_KEY, JSON.stringify(snapshot()));
      var now = new Date();
      setSaveStatus('자동 저장됨 ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
    } catch (error) {
      storageAvailable = false;
      setSaveStatus('이 브라우저에서는 자동 저장 불가');
    }
  }

  function queueAutosave() {
    if (!storageAvailable) return;
    setSaveStatus('저장 중…');
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveAutosaveNow, 280);
  }

  function loadStorage() {
    try {
      var savedRaw = localStorage.getItem(SAVES_KEY);
      var parsedSaves = savedRaw ? JSON.parse(savedRaw) : [];
      savedDrafts = Array.isArray(parsedSaves) ? parsedSaves.filter(function (item) {
        return item && item.id && item.name && validSnapshot(item.data);
      }) : [];
      var autoRaw = localStorage.getItem(AUTO_KEY);
      if (autoRaw) {
        var autoData = JSON.parse(autoRaw);
        if (restoreSnapshot(autoData, false)) {
          setSaveStatus('최근 작업 복원됨');
          return;
        }
      }
    } catch (error) {
      storageAvailable = false;
      savedDrafts = [];
      setSaveStatus('이 브라우저에서는 자동 저장 불가');
    }
    update(false);
    if (storageAvailable) setSaveStatus('자동 저장 사용 중');
  }

  function saveDraftList() {
    try {
      localStorage.setItem(SAVES_KEY, JSON.stringify(savedDrafts));
    } catch (error) {
      storageAvailable = false;
      setSaveStatus('이 브라우저에서는 저장 불가');
    }
  }

  function makeId() {
    return 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  function monthWeekCount(year, month) {
    return Math.ceil((new Date(year, month, 1).getDay() + new Date(year, month + 1, 0).getDate()) / 7);
  }

  function makeCalendar(year, month) {
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var lectureDays = getLectureDayIndexes(state.lectureDays);
    var html = '<h4>' + (month + 1) + '월 <small>' + monthNames[month] + '</small></h4><table><thead><tr><th class="sun">일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th class="sat">토</th></tr></thead><tbody><tr>';
    var blank;
    for (blank = 0; blank < firstDay; blank += 1) html += '<td></td>';

    for (var day = 1; day <= daysInMonth; day += 1) {
      var date = new Date(year, month, day);
      var key = dateKey(date);
      var classes = [];
      var lectureRange = state.lectureStart && state.lectureEnd && key >= state.lectureStart && key <= state.lectureEnd;
      var contestRange = state.contestStart && state.contestEnd && key >= state.contestStart && key <= state.contestEnd;
      var isCandidate = lectureRange && lectureDays.has(date.getDay());
      var isExcluded = isCandidate && (excludedDates.has(key) || isAutoExcluded(key));
      var isLecture = isCandidate && !isExcluded;
      var events = schedulesOnDate(key);
      var uniqueEvents = [];
      events.forEach(function (schedule) {
        var name = scheduleName(schedule);
        if (!uniqueEvents.some(function (item) { return scheduleName(item) === name; })) uniqueEvents.push(schedule);
      });

      if (date.getDay() === 0) classes.push('sun');
      if (date.getDay() === 6) classes.push('sat');
      if (isExcluded) classes.push('excluded');
      if (isLecture) classes.push('lecture');
      if (contestRange) classes.push(isLecture ? 'both' : 'contest');

      var titleParts = uniqueEvents.map(function (schedule) {
        return scheduleName(schedule) + ' (' + modeLabels[schedule.mode] + ')';
      });
      var bars = uniqueEvents.slice(0, 4).map(function (schedule) {
        var color = scheduleColors[schedule.type] || scheduleColors['기타'];
        return '<i class="event-bar" style="background:' + color + '"></i>';
      }).join('');
      var title = titleParts.length ? ' title="' + esc(titleParts.join(', ')) + '"' : '';
      html += '<td class="' + classes.join(' ') + '"' + title + '><span class="day-number">' + day + '</span>' + (bars ? '<span class="event-bars">' + bars + '</span>' : '') + '</td>';
      if ((firstDay + day) % 7 === 0 && day < daysInMonth) html += '</tr><tr>';
    }
    var trailing = (firstDay + daysInMonth) % 7;
    if (trailing) html += '<td></td>'.repeat(7 - trailing);
    return html + '</tr></tbody></table>';
  }

  function renderCalendar(element, date) {
    element.classList.toggle('six-weeks', monthWeekCount(date.getFullYear(), date.getMonth()) === 6);
    element.innerHTML = makeCalendar(date.getFullYear(), date.getMonth());
  }

  function getDisplayMonths() {
    var values = [state.lectureStart, state.lectureEnd, state.contestStart, state.contestEnd];
    extraSchedules.forEach(function (schedule) {
      values.push(schedule.start, schedule.end);
    });
    var dates = values.map(parseDate).filter(Boolean).sort(function (a, b) { return a - b; });
    if (!dates.length) return [];
    var first = dates[0];
    var last = dates[dates.length - 1];
    var firstMonth = new Date(first.getFullYear(), first.getMonth(), 1);
    var secondMonth = first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()
      ? new Date(first.getFullYear(), first.getMonth() + 1, 1)
      : new Date(last.getFullYear(), last.getMonth(), 1);
    return [firstMonth, secondMonth];
  }

  function renderLegend() {
    var html = '<span class="key"><i class="swatch" style="background:var(--orange)"></i>특강</span>' +
      '<span class="key"><i class="swatch" style="background:var(--pink)"></i>대회</span>';
    var used = [];
    extraSchedules.forEach(function (schedule) {
      var name = scheduleName(schedule);
      if (!used.some(function (item) { return item.name === name; })) {
        used.push({ name: name, color: scheduleColors[schedule.type] || scheduleColors['기타'] });
      }
    });
    html += used.map(function (item) {
      return '<span class="key"><i class="swatch bar" style="background:' + item.color + '"></i>' + esc(item.name) + '</span>';
    }).join('');
    $('#legend').innerHTML = html;
  }

  function renderPlannerSummary() {
    var candidates = getLectureCandidates();
    var effective = getEffectiveLectureDates();
    var autoExcluded = candidates.filter(isAutoExcluded).length;
    var parts = [];
    if (!candidates.length) {
      $('#plannerSummary').textContent = '특강 기간과 요일을 입력하면 선택 가능한 날짜가 표시됩니다.';
    } else {
      parts.push('예정 ' + candidates.length + '회');
      if (excludedDates.size) parts.push('직접 제외 ' + excludedDates.size + '일');
      if (autoExcluded) parts.push('추가 일정 제외 ' + autoExcluded + '일');
      parts.push('실제 특강 ' + effective.length + '회');
      $('#plannerSummary').textContent = parts.join(' · ');
    }

    var sorted = Array.from(excludedDates).sort();
    var visible = exclusionExpanded ? sorted : sorted.slice(0, 3);
    var html = visible.map(function (key) {
      return '<button class="chip" type="button" data-remove-exclusion="' + key + '" title="제외 취소">' + esc(fmt(key)) + ' ×</button>';
    }).join('');
    if (!exclusionExpanded && sorted.length > 3) {
      html += '<button class="chip more" type="button" id="moreExclusions">+' + (sorted.length - 3) + '일 더보기</button>';
    } else if (exclusionExpanded && sorted.length > 3) {
      html += '<button class="chip more" type="button" id="moreExclusions">접기</button>';
    }
    $('#exclusionChips').innerHTML = html;
  }

  function updateContentWarning() {
    $('#contentWarning').hidden = !(layoutFlags.titleOverflow || layoutFlags.introOverflow || layoutFlags.cardsOverflow);
  }

  function applyTitleScale() {
    var title = $('.title');
    var length = (state.contestName || '').length;
    var modes = length <= 16 ? ['', 'title-normal', 'title-dense', 'title-min'] : length <= 28 ? ['title-normal', 'title-dense', 'title-min'] : ['title-dense', 'title-min'];
    title.classList.remove('title-normal', 'title-dense', 'title-min');
    var modeIndex = 0;
    if (modes[modeIndex]) title.classList.add(modes[modeIndex]);
    while (title.scrollWidth > title.clientWidth + 1 && modeIndex < modes.length - 1) {
      if (modes[modeIndex]) title.classList.remove(modes[modeIndex]);
      modeIndex += 1;
      if (modes[modeIndex]) title.classList.add(modes[modeIndex]);
    }
    layoutFlags.titleOverflow = title.scrollWidth > title.clientWidth + 1;
    updateContentWarning();
  }

  function applyIntroScale() {
    var intro = $('#intro');
    var modes = ['', 'intro-dense', 'intro-min'];
    intro.classList.remove('intro-dense', 'intro-min');
    var modeIndex = 0;
    while (intro.scrollWidth > intro.clientWidth + 1 && modeIndex < modes.length - 1) {
      if (modes[modeIndex]) intro.classList.remove(modes[modeIndex]);
      modeIndex += 1;
      intro.classList.add(modes[modeIndex]);
    }
    layoutFlags.introOverflow = intro.scrollWidth > intro.clientWidth + 1;
    updateContentWarning();
  }

  function applyInfoDensity() {
    var hasOverflow = false;
    $('#cards').querySelectorAll('.card').forEach(function (card) {
      var length = card.textContent.trim().length;
      var modes = length <= 170 ? ['density-roomy', 'density-normal', 'density-dense', 'density-min'] : length <= 300 ? ['density-normal', 'density-dense', 'density-min'] : ['density-dense', 'density-min'];
      card.classList.remove('density-roomy', 'density-normal', 'density-dense', 'density-min');
      var modeIndex = 0;
      card.classList.add(modes[modeIndex]);
      while (card.scrollHeight > card.clientHeight + 1 && modeIndex < modes.length - 1) {
        card.classList.remove(modes[modeIndex]);
        modeIndex += 1;
        card.classList.add(modes[modeIndex]);
      }
      hasOverflow = hasOverflow || card.scrollHeight > card.clientHeight + 1;
    });
    layoutFlags.cardsOverflow = hasOverflow;
    updateContentWarning();
  }

  function update(shouldPersist) {
    collectFields();
    var candidates = getLectureCandidates();
    var candidateSet = new Set(candidates);
    excludedDates = new Set(Array.from(excludedDates).filter(function (key) { return candidateSet.has(key); }));
    var sessionCount = getEffectiveLectureDates().length;
    $('[data-key="sessions"]').value = candidates.length ? String(sessionCount) : '';
    state.sessions = candidates.length ? String(sessionCount) : '';

    $('#v-contestName').textContent = state.contestName || '대회명';
    var contestDates = listDates(state.contestStart, state.contestEnd);
    var lectureDates = listDates(state.lectureStart, state.lectureEnd);
    $('#intro').textContent = (contestDates ? contestDates + '에 열리는 ' : '') + (state.contestName || '대회') + ' 참가 여부와 특강 안내를 아래와 같이 드립니다.';
    renderInfo('#contestInfo', [
      ['대회명', state.contestName],
      ['일자', contestDates],
      ['장소', state.venue],
      ['종목', state.category],
      ['종목 설명', state.contestDesc]
    ]);
    renderInfo('#lectureInfo', [
      ['특강 기간', lectureDates],
      ['특강 요일', state.lectureDays],
      ['특강 시간', state.lectureTime],
      ['특강 횟수', state.sessions ? state.sessions + '회' : ''],
      ['대상', state.audience],
      ['특강비', state.fee ? state.fee + '원' : ''],
      ['제외 날짜', compactDateList(Array.from(excludedDates).sort(), 5)],
      ['추가 일정', compactScheduleList()],
      ['신청 마감', state.deadline ? fmt(state.deadline) : ''],
      ['신청 방법', state.how],
      ['문의', state.contact]
    ]);

    var months = getDisplayMonths();
    if (!months.length) {
      $('#year').textContent = '—';
      ['#cal1', '#cal2'].forEach(function (selector, index) {
        $(selector).classList.remove('six-weeks');
        $(selector).innerHTML = '<p class="empty">' + (index ? '대회 날짜' : '특강 날짜') + '를 입력해 주세요.</p>';
      });
    } else {
      var firstMonth = months[0];
      var secondMonth = months[1];
      $('#year').textContent = firstMonth.getFullYear() === secondMonth.getFullYear() ? String(firstMonth.getFullYear()) : firstMonth.getFullYear() + ' ~ ' + secondMonth.getFullYear();
      renderCalendar($('#cal1'), firstMonth);
      renderCalendar($('#cal2'), secondMonth);
    }
    renderPlannerSummary();
    renderLegend();
    if ($('#scheduleDialog').open) renderScheduleList();
    if ($('#exclusionDialog').open) renderExclusionPicker();
    window.requestAnimationFrame(function () {
      applyTitleScale();
      applyIntroScale();
      applyInfoDensity();
    });
    if (shouldPersist !== false) queueAutosave();
  }

  function fitPreview() {
    var stage = $('#stage');
    var fit = $('#fit');
    var scale = Math.min((stage.clientWidth - 44) / 1123, (stage.clientHeight - 44) / 794, 1);
    fit.style.transform = 'scale(' + Math.max(.1, scale) + ')';
  }

  function waitForSheetImages(sheet) {
    return Promise.all(Array.from(sheet.querySelectorAll('img')).map(function (image) {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      if (image.complete) return Promise.reject(new Error('image-load-failed'));
      return new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () { reject(new Error('image-load-timeout')); }, 10000);
        image.addEventListener('load', function () { clearTimeout(timeout); resolve(); }, { once: true });
        image.addEventListener('error', function () { clearTimeout(timeout); reject(new Error('image-load-failed')); }, { once: true });
      });
    }));
  }

  function downloadCanvas(canvas, filename) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) { reject(new Error('png-encode-failed')); return; }
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        resolve();
      }, 'image/png');
    });
  }

  async function downloadPng() {
    var button = $('#pngDownload');
    var sheet = $('#sheet');
    var fit = $('#fit');
    var previousTransform = fit.style.transform;
    var previousLabel = button.textContent;
    applyTitleScale();
    applyIntroScale();
    applyInfoDensity();
    if (layoutFlags.titleOverflow || layoutFlags.introOverflow || layoutFlags.cardsOverflow) {
      alert('입력 내용이 안내문 영역을 초과했습니다. 내용을 조금 줄인 뒤 다시 저장해 주세요.');
      return;
    }
    try {
      button.disabled = true;
      button.textContent = 'PNG 생성 중';
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await waitForSheetImages(sheet);
      if (typeof html2canvas !== 'function') throw new Error('capture-library-unavailable');
      fit.style.transform = 'none';
      var canvas = await html2canvas(sheet, {
        backgroundColor: '#fdf7ee',
        scale: 2,
        useCORS: true,
        logging: false,
        width: 1123,
        height: 794,
        windowWidth: 1123,
        windowHeight: 794,
        scrollX: 0,
        scrollY: 0
      });
      var baseName = (state.contestName || '').replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
      await downloadCanvas(canvas, baseName ? baseName + '_특강안내문.png' : '특강_안내문.png');
    } catch (error) {
      console.error(error);
      alert('PNG 이미지를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      fit.style.transform = previousTransform;
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }

  function monthIndex(date) {
    return date.getFullYear() * 12 + date.getMonth();
  }

  function openExclusionDialog() {
    collectFields();
    var candidates = getLectureCandidates();
    if (!candidates.length) {
      alert('특강 시작일·종료일과 특강 요일을 먼저 입력해 주세요.');
      return;
    }
    exclusionViewMonth = new Date(parseDate(candidates[0]).getFullYear(), parseDate(candidates[0]).getMonth(), 1);
    renderExclusionPicker();
    $('#exclusionDialog').showModal();
  }

  function renderExclusionPicker() {
    if (!exclusionViewMonth) return;
    var candidates = getLectureCandidates();
    var candidateSet = new Set(candidates);
    var firstCandidate = parseDate(candidates[0]);
    var lastCandidate = parseDate(candidates[candidates.length - 1]);
    var firstMonth = new Date(firstCandidate.getFullYear(), firstCandidate.getMonth(), 1);
    var lastMonth = new Date(lastCandidate.getFullYear(), lastCandidate.getMonth(), 1);
    if (monthIndex(exclusionViewMonth) < monthIndex(firstMonth)) exclusionViewMonth = firstMonth;
    if (monthIndex(exclusionViewMonth) > monthIndex(lastMonth)) exclusionViewMonth = lastMonth;
    var year = exclusionViewMonth.getFullYear();
    var month = exclusionViewMonth.getMonth();
    $('#exclusionMonth').textContent = year + '년 ' + (month + 1) + '월';
    $('#exclusionPrev').disabled = monthIndex(exclusionViewMonth) <= monthIndex(firstMonth);
    $('#exclusionNext').disabled = monthIndex(exclusionViewMonth) >= monthIndex(lastMonth);
    var html = weekdays.map(function (day, index) {
      return '<span class="picker-weekday ' + (index === 0 ? 'sun' : index === 6 ? 'sat' : '') + '">' + day + '</span>';
    }).join('');
    var firstDay = new Date(year, month, 1).getDay();
    html += '<button class="picker-day blank" disabled></button>'.repeat(firstDay);
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for (var day = 1; day <= daysInMonth; day += 1) {
      var key = dateKey(new Date(year, month, day));
      var candidate = candidateSet.has(key);
      html += '<button class="picker-day' + (excludedDates.has(key) ? ' selected' : '') + '" type="button" data-picker-date="' + key + '"' + (candidate ? '' : ' disabled') + '>' + day + '</button>';
    }
    $('#exclusionCalendar').innerHTML = html;
    $('#exclusionHelp').textContent = '회색 취소선 날짜 ' + excludedDates.size + '일 · 실제 특강 ' + getEffectiveLectureDates().length + '회';
  }

  function shiftExclusionMonth(amount) {
    exclusionViewMonth = new Date(exclusionViewMonth.getFullYear(), exclusionViewMonth.getMonth() + amount, 1);
    renderExclusionPicker();
  }

  function renderScheduleType() {
    $('#scheduleCustomWrap').hidden = $('#scheduleType').value !== '기타';
  }

  function resetScheduleEditor() {
    editingScheduleId = null;
    $('#scheduleType').value = '추석';
    $('#scheduleCustom').value = '';
    $('#scheduleStart').value = state.lectureStart || '';
    $('#scheduleEnd').value = state.lectureStart || '';
    $('#scheduleMode').value = 'exclude';
    $('#scheduleSave').textContent = '일정 추가';
    renderScheduleType();
  }

  function renderScheduleList() {
    if (!extraSchedules.length) {
      $('#scheduleList').innerHTML = '<div class="empty-list">등록된 추가 일정이 없습니다.</div>';
      return;
    }
    $('#scheduleList').innerHTML = extraSchedules.map(function (schedule) {
      return '<div class="schedule-row"><div><strong><span style="color:' + (scheduleColors[schedule.type] || scheduleColors['기타']) + '">●</span> ' + esc(scheduleName(schedule)) + '</strong><small>' + esc(listDates(schedule.start, schedule.end)) + ' · ' + esc(modeLabels[schedule.mode]) + '</small></div><div class="row-actions"><button class="mini-button" type="button" data-edit-schedule="' + esc(schedule.id) + '">수정</button><button class="mini-button" type="button" data-delete-schedule="' + esc(schedule.id) + '">삭제</button></div></div>';
    }).join('');
  }

  function openScheduleDialog() {
    resetScheduleEditor();
    renderScheduleList();
    $('#scheduleDialog').showModal();
  }

  function saveSchedule() {
    var type = $('#scheduleType').value;
    var name = $('#scheduleCustom').value.trim();
    var start = $('#scheduleStart').value;
    var end = $('#scheduleEnd').value;
    var mode = $('#scheduleMode').value;
    if (type === '기타' && !name) { alert('기타 일정의 이름을 입력해 주세요.'); return; }
    if (!parseDate(start) || !parseDate(end)) { alert('추가 일정의 시작일과 종료일을 입력해 주세요.'); return; }
    if (start > end) { alert('종료일은 시작일보다 빠를 수 없습니다.'); return; }
    var data = { id: editingScheduleId || makeId(), type: type, name: name, start: start, end: end, mode: mode };
    if (editingScheduleId) {
      extraSchedules = extraSchedules.map(function (schedule) { return schedule.id === editingScheduleId ? data : schedule; });
    } else {
      extraSchedules.push(data);
    }
    resetScheduleEditor();
    renderScheduleList();
    update();
  }

  function editSchedule(id) {
    var schedule = extraSchedules.find(function (item) { return item.id === id; });
    if (!schedule) return;
    editingScheduleId = id;
    $('#scheduleType').value = schedule.type;
    $('#scheduleCustom').value = schedule.name || '';
    $('#scheduleStart').value = schedule.start;
    $('#scheduleEnd').value = schedule.end;
    $('#scheduleMode').value = schedule.mode;
    $('#scheduleSave').textContent = '일정 수정';
    renderScheduleType();
    $('#scheduleDialog .dialog-body').scrollTop = 0;
  }

  function renderSavedDrafts() {
    if (!savedDrafts.length) {
      $('#savedList').innerHTML = '<div class="empty-list">이름을 붙여 저장한 내용이 없습니다.</div>';
      return;
    }
    var sorted = savedDrafts.slice().sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    $('#savedList').innerHTML = sorted.map(function (item) {
      var updated = new Date(item.updatedAt);
      var stamp = isNaN(updated.getTime()) ? '' : updated.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return '<div class="saved-row"><div><strong>' + esc(item.name) + '</strong><small>' + esc(stamp) + '</small></div><div class="row-actions"><button class="mini-button" type="button" data-load-draft="' + item.id + '">불러오기</button><button class="mini-button" type="button" data-overwrite-draft="' + item.id + '">덮어쓰기</button><button class="mini-button" type="button" data-duplicate-draft="' + item.id + '">복제</button><button class="mini-button" type="button" data-rename-draft="' + item.id + '">이름 변경</button><button class="mini-button" type="button" data-delete-draft="' + item.id + '">삭제</button></div></div>';
    }).join('');
  }

  function saveCurrentDraft() {
    var name = $('#saveName').value.trim();
    if (!name) { alert('저장본 이름을 입력해 주세요.'); return; }
    var existing = savedDrafts.find(function (item) { return item.name === name; });
    if (existing) {
      if (!confirm('같은 이름의 저장본을 현재 내용으로 덮어쓸까요?')) return;
      existing.data = snapshot();
      existing.updatedAt = new Date().toISOString();
    } else {
      savedDrafts.push({ id: makeId(), name: name, data: snapshot(), updatedAt: new Date().toISOString() });
    }
    saveDraftList();
    $('#saveName').value = '';
    renderSavedDrafts();
    setSaveStatus('저장본에 보관됨');
  }

  function draftAction(action, id) {
    var item = savedDrafts.find(function (draft) { return draft.id === id; });
    if (!item) return;
    if (action === 'load') {
      if (restoreSnapshot(item.data, true)) {
        $('#savesDialog').close();
        setSaveStatus('“' + item.name + '” 불러옴');
      }
    } else if (action === 'overwrite') {
      if (!confirm('“' + item.name + '” 저장본을 현재 내용으로 덮어쓸까요?')) return;
      item.data = snapshot();
      item.updatedAt = new Date().toISOString();
    } else if (action === 'duplicate') {
      savedDrafts.push({ id: makeId(), name: item.name + ' 복사본', data: clone(item.data), updatedAt: new Date().toISOString() });
    } else if (action === 'rename') {
      var nextName = prompt('새 저장본 이름을 입력해 주세요.', item.name);
      if (!nextName || !nextName.trim()) return;
      item.name = nextName.trim();
      item.updatedAt = new Date().toISOString();
    } else if (action === 'delete') {
      if (!confirm('“' + item.name + '” 저장본을 삭제할까요?')) return;
      savedDrafts = savedDrafts.filter(function (draft) { return draft.id !== id; });
    }
    saveDraftList();
    renderSavedDrafts();
  }

  function exportSaves() {
    var payload = { version: 3, exportedAt: new Date().toISOString(), autosave: snapshot(), savedDrafts: savedDrafts };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = '플레이웰_특강안내문_저장본.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  async function importSaves(file) {
    try {
      var data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.savedDrafts)) throw new Error('invalid');
      var incoming = data.savedDrafts.filter(function (item) { return item && item.id && item.name && validSnapshot(item.data); });
      incoming.forEach(function (item) {
        var copy = clone(item);
        if (savedDrafts.some(function (existing) { return existing.id === copy.id; })) copy.id = makeId();
        savedDrafts.push(copy);
      });
      saveDraftList();
      renderSavedDrafts();
      alert(incoming.length + '개의 저장본을 가져왔습니다.');
    } catch (error) {
      alert('올바른 플레이웰 저장본 파일이 아닙니다.');
    }
  }

  document.querySelectorAll('[data-key]').forEach(function (element) {
    if (element.dataset.key !== 'sessions') element.addEventListener('input', function () { update(); });
  });

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (item) { item.classList.toggle('active', item === tab); });
      document.querySelectorAll('[data-page]').forEach(function (page) { page.classList.toggle('active', page.dataset.page === tab.dataset.tab); });
      $('.form-scroll').scrollTop = 0;
    });
  });

  document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
    button.addEventListener('click', function () { $('#' + button.dataset.closeDialog).close(); });
  });

  $('#exclusionsOpen').addEventListener('click', openExclusionDialog);
  $('#exclusionPrev').addEventListener('click', function () { shiftExclusionMonth(-1); });
  $('#exclusionNext').addEventListener('click', function () { shiftExclusionMonth(1); });
  $('#exclusionCalendar').addEventListener('click', function (event) {
    var button = event.target.closest('[data-picker-date]');
    if (!button || button.disabled) return;
    var key = button.dataset.pickerDate;
    if (excludedDates.has(key)) excludedDates.delete(key); else excludedDates.add(key);
    update();
  });
  $('#includeAll').addEventListener('click', function () { excludedDates.clear(); update(); });
  $('#exclusionChips').addEventListener('click', function (event) {
    var remove = event.target.closest('[data-remove-exclusion]');
    if (remove) { excludedDates.delete(remove.dataset.removeExclusion); update(); return; }
    if (event.target.closest('#moreExclusions')) { exclusionExpanded = !exclusionExpanded; renderPlannerSummary(); }
  });

  $('#schedulesOpen').addEventListener('click', openScheduleDialog);
  $('#scheduleType').addEventListener('change', renderScheduleType);
  $('#scheduleSave').addEventListener('click', saveSchedule);
  $('#scheduleList').addEventListener('click', function (event) {
    var edit = event.target.closest('[data-edit-schedule]');
    var remove = event.target.closest('[data-delete-schedule]');
    if (edit) editSchedule(edit.dataset.editSchedule);
    if (remove && confirm('이 추가 일정을 삭제할까요?')) {
      extraSchedules = extraSchedules.filter(function (schedule) { return schedule.id !== remove.dataset.deleteSchedule; });
      renderScheduleList();
      update();
    }
  });

  $('#savesOpen').addEventListener('click', function () { renderSavedDrafts(); $('#savesDialog').showModal(); });
  $('#saveCurrent').addEventListener('click', saveCurrentDraft);
  $('#savedList').addEventListener('click', function (event) {
    ['load', 'overwrite', 'duplicate', 'rename', 'delete'].some(function (action) {
      var button = event.target.closest('[data-' + action + '-draft]');
      if (!button) return false;
      draftAction(action, button.getAttribute('data-' + action + '-draft'));
      return true;
    });
  });
  $('#exportSaves').addEventListener('click', exportSaves);
  $('#importSaves').addEventListener('click', function () { $('#importFile').click(); });
  $('#importFile').addEventListener('change', function () {
    if (this.files && this.files[0]) importSaves(this.files[0]);
    this.value = '';
  });

  $('#reset').addEventListener('click', function () {
    if (!confirm('현재 입력 내용을 초기화할까요? 이름을 붙여 저장한 저장본은 유지됩니다.')) return;
    document.querySelectorAll('[data-key]').forEach(function (element) { element.value = ''; });
    $('[data-key="lectureDays"]').value = '토요일 · 일요일';
    $('[data-key="lectureTime"]').value = '오후 5시 ~ 오후 8시';
    excludedDates.clear();
    extraSchedules = [];
    update();
  });
  $('#pngDownload').addEventListener('click', downloadPng);

  window.addEventListener('resize', function () {
    fitPreview();
    applyTitleScale();
    applyIntroScale();
    applyInfoDensity();
  });
  window.addEventListener('beforeunload', saveAutosaveNow);

  loadStorage();
  fitPreview();
})();
