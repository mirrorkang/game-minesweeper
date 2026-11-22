/**
 * 扫雷 · 渲染与交互层
 *
 * createBoard(container, game, options?)：
 *   - 构建 CSS Grid 棋盘（<button class="cell">）
 *   - 左键挖开；右键 / 触屏长按插旗
 *   - 依据 game.getBoard() 重绘所有格子，并同步无障碍标签
 *   - 返回 { render(), destroy() }
 */
(function (global) {
  'use strict';

  // 经典数字配色，下标即数字本身
  var NUMBER_COLORS = [
    '',
    '#0000ff', // 1 蓝
    '#008000', // 2 绿
    '#ff0000', // 3 红
    '#000080', // 4 深蓝
    '#800000', // 5 深红
    '#008080', // 6 青
    '#000000', // 7 黑
    '#808080'  // 8 灰
  ];

  var LONG_PRESS_MS = 420;

  function createBoard(container, game, options) {
    var onStatusChange = (options && options.onStatusChange) || function () {};

    var state = game.getState();
    var cells = [];
    var longPressTimer = null;
    var longPressed = false;

    var grid = document.createElement('div');
    grid.className = 'board-grid';
    grid.style.setProperty('--cols', String(state.cols));
    grid.style.setProperty('--rows', String(state.rows));

    function clearLongPress() {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    for (var r = 0; r < state.rows; r++) {
      cells[r] = [];
      for (var c = 0; c < state.cols; c++) {
        (function (row, col) {
          var el = document.createElement('button');
          el.type = 'button';
          el.className = 'cell';
          el.setAttribute('aria-label', '第' + (row + 1) + '行第' + (col + 1) + '列，未挖开');

          function revealHere() {
            game.reveal(row, col);
            render();
            onStatusChange(game.getState().status);
          }

          function flagHere() {
            game.toggleFlag(row, col);
            render();
            onStatusChange(game.getState().status);
          }

          el.addEventListener('click', function () {
            if (longPressed) {
              // 长按插旗后浏览器可能补发 click，忽略一次
              longPressed = false;
              return;
            }
            revealHere();
          });

          el.addEventListener('contextmenu', function (e) {
            e.preventDefault(); // 禁止浏览器右键菜单
            flagHere();
          });

          var pressStartX = 0;
          var pressStartY = 0;

          // 触屏长按 = 插旗
          el.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) return;
            longPressed = false;
            pressStartX = e.touches[0].clientX;
            pressStartY = e.touches[0].clientY;
            clearLongPress();
            longPressTimer = setTimeout(function () {
              longPressTimer = null;
              longPressed = true;
              flagHere();
            }, LONG_PRESS_MS);
          }, { passive: true });

          el.addEventListener('touchend', function (e) {
            clearLongPress();
            if (longPressed) e.preventDefault(); // 阻止长按后补发的 click
          }, { passive: false });

          // 手指明显滑动（>12px）才取消长按，轻微抖动不影响
          el.addEventListener('touchmove', function (e) {
            if (e.touches.length !== 1) {
              clearLongPress();
              longPressed = false;
              return;
            }
            var dx = e.touches[0].clientX - pressStartX;
            var dy = e.touches[0].clientY - pressStartY;
            if (dx * dx + dy * dy > 12 * 12) {
              clearLongPress();
              longPressed = false;
            }
          }, { passive: true });

          el.addEventListener('touchcancel', function () {
            clearLongPress();
            longPressed = false;
          });

          grid.appendChild(el);
          cells[row][col] = el;
        })(r, c);
      }
    }
    container.appendChild(grid);

    /** 依据游戏状态重绘整个棋盘 */
    function render() {
      var boardData = game.getBoard();
      var status = game.getState().status;
      for (var r = 0; r < boardData.length; r++) {
        for (var c = 0; c < boardData[r].length; c++) {
          paint(cells[r][c], boardData[r][c], r, c, status);
        }
      }
      grid.classList.toggle('is-ended', status === 'won' || status === 'lost');
    }

    /** 单个格子的状态 → 视觉 + 无障碍标签 */
    function paint(el, cell, row, col, status) {
      el.className = 'cell';
      el.textContent = '';
      el.style.color = '';

      var label = '第' + (row + 1) + '行第' + (col + 1) + '列';

      if (cell.isRevealed) {
        el.classList.add('revealed');
        if (cell.isMine) {
          el.textContent = '💣';
          if (cell.exploded) el.classList.add('exploded');
          label += '，地雷';
        } else if (cell.adjacentMines > 0) {
          el.textContent = String(cell.adjacentMines);
          el.classList.add('num');
          el.style.color = NUMBER_COLORS[cell.adjacentMines];
          label += '，周围 ' + cell.adjacentMines + ' 颗雷';
        } else {
          label += '，空白格';
        }
      } else if (cell.isFlagged) {
        el.classList.add('flagged');
        el.textContent = '🚩';
        label += '，已插旗';
        if (status === 'lost' && !cell.isMine) {
          el.classList.add('wrong');
          label += '，插错了';
        }
      } else {
        label += '，未挖开';
      }

      el.setAttribute('aria-label', label);
    }

    render();
    onStatusChange(game.getState().status);

    return {
      render: render,
      destroy: function () {
        clearLongPress();
        if (grid.parentNode) grid.parentNode.removeChild(grid);
      }
    };
  }

  global.createBoard = createBoard;
})(typeof window !== 'undefined' ? window : globalThis);
