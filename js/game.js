/**
 * 扫雷 · 核心逻辑层（对应 02-设计规格说明书 §4、§5.1）
 *
 * 纯 JavaScript 实现，零 DOM 依赖，可在浏览器与 Node 中运行。
 * 对外暴露全局函数 createGame(config, rng?)。
 *
 * 数据模型：
 *   GameState = { rows, cols, mineCount, status: 'idle'|'playing'|'won'|'lost', firstMove }
 *   Cell      = { isMine, isRevealed, isFlagged, adjacentMines, exploded }
 */
(function (global) {
  'use strict';

  var DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  /**
   * 创建一局扫雷游戏。
   * @param {Object} config - { rows, cols, mineCount }
   * @param {Function} [rng] - 可注入随机源（默认 Math.random），用于测试可复现性
   */
  function createGame(config, rng) {
    var rows = config.rows;
    var cols = config.cols;
    var mineCount = config.mineCount;
    var random = rng || Math.random;

    var board = null;
    var status = 'idle';   // idle | playing | won | lost
    var firstMove = true;
    var revealedCount = 0;

    /* ---------- 内部工具 ---------- */

    function initBoard() {
      board = [];
      for (var r = 0; r < rows; r++) {
        board[r] = [];
        for (var c = 0; c < cols; c++) {
          board[r][c] = {
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0,
            exploded: false
          };
        }
      }
    }

    function inBounds(r, c) {
      return r >= 0 && r < rows && c >= 0 && c < cols;
    }

    function neighbors(r, c) {
      var list = [];
      for (var i = 0; i < DIRECTIONS.length; i++) {
        var nr = r + DIRECTIONS[i][0];
        var nc = c + DIRECTIONS[i][1];
        if (inBounds(nr, nc)) list.push([nr, nc]);
      }
      return list;
    }

    function copyCell(cell) {
      return {
        isMine: cell.isMine,
        isRevealed: cell.isRevealed,
        isFlagged: cell.isFlagged,
        adjacentMines: cell.adjacentMines,
        exploded: cell.exploded
      };
    }

    /* ---------- 布雷（首击安全，FR-4） ---------- */

    function placeMines(safeR, safeC) {
      // 禁区：首击格自身 + 8 邻域
      var safeSet = {};
      safeSet[safeR * cols + safeC] = true;
      var nb = neighbors(safeR, safeC);
      for (var i = 0; i < nb.length; i++) {
        safeSet[nb[i][0] * cols + nb[i][1]] = true;
      }

      // 候选集：禁区之外的全部格子
      var candidates = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (!safeSet[r * cols + c]) candidates.push([r, c]);
        }
      }

      // Fisher–Yates 洗牌，取前 mineCount 个布雷
      for (var j = candidates.length - 1; j > 0; j--) {
        var k = Math.floor(random() * (j + 1));
        var tmp = candidates[j];
        candidates[j] = candidates[k];
        candidates[k] = tmp;
      }

      var toPlace = Math.min(mineCount, candidates.length);
      for (var m = 0; m < toPlace; m++) {
        board[candidates[m][0]][candidates[m][1]].isMine = true;
      }

      // 边界兜底：候选不足时从禁区补足，保证雷数精确（9x9/10 雷不会触发）
      var extra = mineCount - toPlace;
      if (extra > 0) {
        var fallback = nb.concat([[safeR, safeC]]);
        for (var e = 0; e < extra && e < fallback.length; e++) {
          board[fallback[e][0]][fallback[e][1]].isMine = true;
        }
      }

      computeNumbers();
    }

    /* ---------- 数字计算（FR-2.3） ---------- */

    function computeNumbers() {
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (board[r][c].isMine) {
            board[r][c].adjacentMines = 0;
            continue;
          }
          var count = 0;
          var nb = neighbors(r, c);
          for (var i = 0; i < nb.length; i++) {
            if (board[nb[i][0]][nb[i][1]].isMine) count++;
          }
          board[r][c].adjacentMines = count;
        }
      }
    }

    /* ---------- 挖开（FR-2） ---------- */

    function reveal(r, c) {
      if (!inBounds(r, c)) return;
      if (status === 'won' || status === 'lost') return; // 输入锁定
      var cell = board[r][c];
      if (cell.isRevealed || cell.isFlagged) return;

      // 首次挖开：此刻才布雷，保证首击安全（FR-4）
      if (firstMove) {
        firstMove = false;
        placeMines(r, c);
        status = 'playing';
      }

      if (cell.isMine) {
        cell.isRevealed = true;
        cell.exploded = true;
        revealAllMines();
        status = 'lost';
        return;
      }

      floodReveal(r, c);
      checkWin();
    }

    /** 连锁展开（FR-2.4）：队列 BFS */
    function floodReveal(startR, startC) {
      var queue = [[startR, startC]];
      while (queue.length > 0) {
        var cur = queue.shift();
        var cr = cur[0];
        var cc = cur[1];
        var cell = board[cr][cc];
        if (cell.isRevealed || cell.isFlagged || cell.isMine) continue;

        cell.isRevealed = true;
        revealedCount++;

        if (cell.adjacentMines === 0) {
          var nb = neighbors(cr, cc);
          for (var i = 0; i < nb.length; i++) {
            var n = board[nb[i][0]][nb[i][1]];
            if (!n.isRevealed && !n.isFlagged && !n.isMine) {
              queue.push([nb[i][0], nb[i][1]]);
            }
          }
        }
      }
    }

    /** 判负时展开全部地雷（FR-5.1） */
    function revealAllMines() {
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (board[r][c].isMine) board[r][c].isRevealed = true;
        }
      }
    }

    /** 判胜（FR-5.2）：胜利时把剩下的雷自动补旗，棋盘不会留“没点开”的格子 */
    function checkWin() {
      if (revealedCount === rows * cols - mineCount) {
        status = 'won';
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            if (board[r][c].isMine) board[r][c].isFlagged = true;
          }
        }
      }
    }

    /* ---------- 插旗（FR-3） ---------- */

    function toggleFlag(r, c) {
      if (!inBounds(r, c)) return;
      if (status === 'won' || status === 'lost') return; // 输入锁定
      var cell = board[r][c];
      if (cell.isRevealed) return;
      cell.isFlagged = !cell.isFlagged;
    }

    /* ---------- 读取 ---------- */

    function getState() {
      return {
        rows: rows,
        cols: cols,
        mineCount: mineCount,
        status: status,
        firstMove: firstMove
      };
    }

    function getCell(r, c) {
      if (!inBounds(r, c)) return null;
      return copyCell(board[r][c]);
    }

    function getBoard() {
      var out = [];
      for (var r = 0; r < rows; r++) {
        out[r] = [];
        for (var c = 0; c < cols; c++) {
          out[r][c] = copyCell(board[r][c]);
        }
      }
      return out;
    }

    /* ---------- 初始化 ---------- */

    initBoard();

    return {
      reveal: reveal,
      toggleFlag: toggleFlag,
      getState: getState,
      getCell: getCell,
      getBoard: getBoard
    };
  }

  // 浏览器（window）与 Node（globalThis）双环境挂载
  global.createGame = createGame;
})(typeof window !== 'undefined' ? window : globalThis);
