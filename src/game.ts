(function(global: any, doc: Document) {

  enum KeyCodes {
    ArrowLeft = 37,
    ArrowUp = 38,
    ArrowRight = 39,
    ArrowDown = 40,
    Space = 91,
    Enter = 13
  }

  enum Collision {
    None,
    Snake,
    Fruit
  }

  enum Difficulty {
    Easy = 1000 / 8,
    Medium = 1000 / 15,
    Hard = 1000 / 30
  }

  const DEFAULT_GRID_SIZE = 21;
  const DEFAULT_SNAKE_SIZE = 5;

  class Coordinate {
    constructor(public x: number, public y: number) {}
  }

  class Snake {

    get head() {return this.trail[0] || null;}

    constructor(public trail: Coordinate[]) {}

    move(position: Coordinate, shouldGrow: boolean = false) {
      if (!shouldGrow) this.trail.pop();
      this.trail.unshift(position);
    }
  }

  class GameField {
    private _ctx: CanvasRenderingContext2D;
    private _canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
      this._ctx = canvas.getContext('2d');
      this._canvas = canvas;

      this._drawBackground();
    }

    draw(snake?: Snake, fruit?: Coordinate, gridSize?: number) {
      const ctx = this._ctx;
      const canvas = this._canvas;
      const cellW = this._canvas.width / gridSize;
      const cellH = this._canvas.height / gridSize;

      this._drawBackground(gridSize);

      if (fruit && gridSize) {
        ctx.fillStyle = '#ACA8FE';
        ctx.fillRect(fruit.x * cellW, fruit.y * cellH, cellW, cellH);
      }

      if (snake && gridSize) {
        const trail = snake.trail;
        ctx.fillStyle = '#92da92';
        for (let i = 0; i < trail.length; i++) {
          ctx.fillRect(trail[i].x * cellW, trail[i].y * cellH, cellW, cellH);
        }
      }

    }

    private _drawBackground(gridSize?: number) {
      const ctx = this._ctx;
      const cWidth = this._canvas.width;
      const cHeight = this._canvas.height;

      // Draw the background
      ctx.fillStyle = '#222930';
      ctx.fillRect(0, 0, cWidth, cHeight);

      ctx.fillStyle = '#1b2125';

      if (gridSize) {
        const w = cWidth / gridSize;
        const h = cHeight / gridSize;
        const i = 0;
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            if ((i + j) % 2 === 0) {
              ctx.fillRect(w * i, h * j, w, h);
            }
          }
        }
      }

    }
  }

  class Game {
    private _field: GameField;
    private _snake: Snake | null = null;
    private _fruit: Coordinate | null = null;
    private _runTimer: number | null = null;
    private _currentGridSize: number = 21;
    private _isAfterDrawing: boolean = true;
    private _velocityX: number = 1;
    private _velocityY: number = 0;
    private _difficulty: Difficulty | number = Difficulty.Medium;

    get started() {return this._snake !== null;}

    get difficulty(): Difficulty | number { return this._difficulty; }
    set difficulty(value: Difficulty | number) { this._difficulty = value; }


    constructor(canvasElementOrId: HTMLCanvasElement | string) {
      let canvasEl: HTMLCanvasElement;
      if (canvasElementOrId instanceof HTMLCanvasElement) {
        canvasEl = canvasElementOrId;
      } else if (typeof canvasElementOrId === 'string') {
        canvasEl = doc.getElementById(canvasElementOrId) as HTMLCanvasElement;
      }

      if (!(canvasEl instanceof HTMLCanvasElement)) {
        throw new Error(`No Canvas for Snake :(`);
      }

      const gameField = new GameField(canvasEl);
      this._field = gameField;

      doc.addEventListener('keydown', ev => this._handleKeydown(ev));

      this._draw();
    }

    start(gridSize: number = DEFAULT_GRID_SIZE, snakeSize: number = DEFAULT_SNAKE_SIZE,
      difficulty: Difficulty | number = Difficulty.Medium) {
      if (this.started) {
        throw new Error(`Can't start a new game, snake is already running. Did you mean "restart"?`);
      }
      this._difficulty = difficulty;
      this._currentGridSize = gridSize;
      this._snake = this._createSnake(snakeSize);
      this._fruit = this._createFruit();

      this._run();
    }

    restart(gridSize?: number, snakeSize?: number, difficulty?: Difficulty | number) {
      this.stop();
      this.start(gridSize, snakeSize, difficulty);
    }

    stop() {
      if (this.started) {
        throw new Error(`Can't stop, no game is running!`);
      }
      this._softStop();
    }

    private _softStop() {
      if (this._runTimer) clearTimeout(this._runTimer);
      this._runTimer = null;
      this._snake = null;
      this._fruit = null;
    }

    private _handleKeydown(event: KeyboardEvent) {
      switch (event.keyCode) {
        case KeyCodes.ArrowUp:
          if (this._velocityY === 0) {
            this._velocityX = 0;
            this._velocityY = -1;
          }
          break;
        case KeyCodes.ArrowDown:
          if (this._velocityY === 0) {
            this._velocityX = 0;
            this._velocityY = 1;
          }
          break;
        case KeyCodes.ArrowLeft:
          if (this._velocityX === 0) {
            this._velocityX = -1;
            this._velocityY = 0;
          }
          break;
        case KeyCodes.ArrowRight:
          if (this._velocityX === 0) {
            this._velocityX = 1;
            this._velocityY = 0;
          }
          break;
      }
    }

    private _run() {
      if (!this.started) return;
      if (this._isAfterDrawing) {
        this._isAfterDrawing = false;
        getDrawFrame(() => {
          this._isAfterDrawing = true;
          this._draw();
        });
      }
      const collision = this._checkCollision();
      const shouldGrow = collision === Collision.Fruit;
      if (shouldGrow) {
        this._fruit = this._createFruit();
      }
      this._moveSnake(shouldGrow);
      if (collision === Collision.Snake) {
        this._softStop();
      } else {
        this._runTimer = setTimeout(() => this._run(), this.difficulty);
      }
    }

    private _moveSnake(shouldGrow?: boolean) {
      let posX = this._snake.head.x;
      let posY = this._snake.head.y;
      const lastCell = this._currentGridSize - 1;

      posX += this._velocityX;
      posY += this._velocityY;

      if (posX < 0) {posX = lastCell;}
      if (posX > lastCell) {posX = 0;}
      if (posY < 0) {posY = lastCell;}
      if (posY > lastCell) {posY = 0;}

      this._snake.move(new Coordinate(posX, posY), shouldGrow);
    }

    private _checkCollision(): Collision {
      const trail = this._snake.trail;
      const size = trail.length;
      const head = this._snake.head;
      const fruit = this._fruit;
      for (let i = 1; i < size; i++) {
        const pos = trail[i];
        if (pos.x === head.x && pos.y === head.y) return Collision.Snake;
        if (pos.x === fruit.x && pos.y === fruit.y) return Collision.Fruit;
      }
      return Collision.None;
    }

    private _createSnake(snakeSize: number): Snake {
      const gridSize = this._currentGridSize;
      if (snakeSize > gridSize - 1) {
        throw new Error('Size of the snake is bigger than the grid');
      }

      const mid = Math.ceil(gridSize / 2) - 1;
      const trail: Coordinate[] = [];
      while (snakeSize--) {
        let x = mid - snakeSize;
        if (x < 0) {
          x = gridSize + x;
        }
        trail.unshift(new Coordinate(x, mid));
      }

      return new Snake(trail);
    }

    _createFruit() {
      const randomize = () => Math.floor(Math.random() * this._currentGridSize);
      const trail = this._snake.trail;
      const size = trail.length;
      let isValidPosition = false;
      let x: number;
      let y: number;

      while (!isValidPosition) {
        x = randomize();
        y = randomize();
        isValidPosition = true;
        for (let i = 0; i < size; i++) {
          const cell = trail[i];
          if (cell.x === x || cell.y === y) {
            isValidPosition = false;
          }
        }
      }

      return new Coordinate(x, y);
    }

    private _draw() {
      this._field.draw(this._snake, this._fruit, this._currentGridSize);
    }
  }

  function getDrawFrame(cb: Function) {
    if ('requestAnimationFrame' in window) {
      global.requestAnimationFrame(() => cb());
    } else {
      cb();
    }
  }

  global.Snake = {
    Difficulty: Difficulty,
    init: (canvasElementOrId: HTMLCanvasElement | string, gridSize?: number): Game =>
      new Game(canvasElementOrId),
    start: (game: Game, gridSize?: number, snakeSize?: number, difficulty?: Difficulty | number) =>
      game.start(gridSize, snakeSize, difficulty),
    stop: (game: Game) => game.stop()
  }
})(window, document);