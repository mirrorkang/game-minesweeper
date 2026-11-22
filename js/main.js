/**
 * 扫雷 · 装配层
 *
 * 初始化游戏与棋盘，绑定「重新开始」按钮与状态栏更新。
 * 第一格点下后才开始计时；胜利 / 失败时在状态栏显示用时。
 */
(function () {
  'use strict';

  var boardEl = document.getElementById('board');
  var statusEl = document.getElementById('status');
  var announcerEl = document.getElementById('announcer');
  var restartBtn = document.getElementById('restart-btn');

  var STATUS_TEXT = {
    idle: '未开始 · 点击格子开始',
    playing: '进行中',
    won: '🎉 你赢了！',
    lost: '💥 踩雷了！'
  };

  var game = null;
  var board = null;
  var startedAt = 0;
  var endedAt = 0;
  var timerId = null;

  /** 毫秒 → mm:ss */
  function formatTime(ms) {
    var total = Math.floor(ms / 1000);
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  }

  function startTimer() {
    if (timerId !== null) return;
    startedAt = Date.now();
    timerId = setInterval(function () {
      statusEl.textContent = STATUS_TEXT.playing + ' · ' + formatTime(Date.now() - startedAt);
    }, 250);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function updateStatus(status) {
    if (status === 'playing') {
      startTimer();
      statusEl.textContent = STATUS_TEXT.playing + ' · ' + formatTime(Date.now() - startedAt);
    } else if (status === 'won' || status === 'lost') {
      // 只结算一次，结束后再点格子 / 右键不会把用时刷回 00:00
      if (!endedAt) {
        endedAt = Date.now();
        stopTimer();
        statusEl.textContent = STATUS_TEXT[status] + '用时 ' + formatTime(startedAt ? endedAt - startedAt : 0);
      }
    } else {
      stopTimer();
      startedAt = 0;
      endedAt = 0;
      statusEl.textContent = STATUS_TEXT.idle;
    }
    statusEl.className = 'status ' + status;

    // 屏幕阅读器：只在开局 / 结束时报一句，不跟着秒表每秒刷
    if (announcerEl && status !== 'playing') {
      var message = status === 'idle'
        ? '新的一局，点击格子开始'
        : (status === 'won' ? '你赢了，用时 ' : '踩雷了，用时 ') + formatTime(endedAt - startedAt);
      if (announcerEl.textContent !== message) announcerEl.textContent = message;
    }
  }

  function start() {
    stopTimer();
    startedAt = 0;
    endedAt = 0;
    game = createGame({ rows: 9, cols: 9, mineCount: 10 });
    if (board) board.destroy();
    board = createBoard(boardEl, game, { onStatusChange: updateStatus });
    updateStatus(game.getState().status);
  }

  restartBtn.addEventListener('click', start);
  start();
})();
