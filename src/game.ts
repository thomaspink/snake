(function(global: any, doc: Document) {

  /** Need key codes */
  enum KeyCodes {
    ArrowLeft = 37,
    ArrowUp = 38,
    ArrowRight = 39,
    ArrowDown = 40,
    Space = 91,
    Enter = 13
  }

  /** Various collition types */
  enum Collision {
    None,
    Snake,
    Fruit
  }

  /** Predefined Difficulties */
  enum Difficulty {
    Easy = 1000 / 8,
    Medium = 1000 / 15,
    Hard = 1000 / 30
  }

  const DEFAULT_GRID_SIZE = 21;
  const DEFAULT_SNAKE_SIZE = 5;

  /** Represents a coordinate containing x and y position */
  class Coordinate {
    constructor(public x: number, public y: number) {}

    /** Checks whether two x/y coordinates match */
    match(other: {x: number, y: number}): boolean;
    /** Checks whether the coordinate object matches x/y values */
    match(x: number, y: number): boolean;
    match(coordinateOrXValue: {x: number, y: number} | number, y?: number): boolean {
      if (typeof coordinateOrXValue === 'number' && typeof y === 'number') {
        return this.x === coordinateOrXValue && this.y === y;
      } else if (typeof coordinateOrXValue === 'object') {
        return this.x === coordinateOrXValue.x && this.y === coordinateOrXValue.y;
      }
      throw `Can not match coordinates, invalid argumets provided`;
    }
  }

  /** Represents a snake including all of the position of its cells */
  class Snake {
    get head() {return this.trail[0] || null;}

    constructor(public trail: Coordinate[]) {}

    /**
     * Moves the snake on cell to the provided position by prepending
     * a new cell to the trail and optionally removing the last cell
     * if the snake does not grow (when eating fruits)
     */
    move(position: Coordinate, shouldGrow: boolean = false) {
      if (!shouldGrow) this.trail.pop();
      this.trail.unshift(position);
    }
  }

  /**
   * Represents the field/canvas and the drawing mechanics.
   * This class only talks to the canvas element.
   */
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

      // Draw the fruit
      if (fruit && gridSize) {
        ctx.fillStyle = '#ACA8FE';
        ctx.fillRect(fruit.x * cellW, fruit.y * cellH, cellW, cellH);
      }

      // Draw the snake
      if (snake && gridSize) {
        const trail = snake.trail;
        ctx.fillStyle = '#92da92';
        for (let i = 0; i < trail.length; i++) {
          ctx.fillRect(trail[i].x * cellW, trail[i].y * cellH, cellW, cellH);
        }
      }

    }

    /** Draw the background (bg-color and grid) */
    private _drawBackground(gridSize?: number) {
      const ctx = this._ctx;
      const cWidth = this._canvas.width;
      const cHeight = this._canvas.height;

      // Draw the background color
      ctx.fillStyle = '#222930';
      ctx.fillRect(0, 0, cWidth, cHeight);

      // Draw a grid
      ctx.fillStyle = '#1b2125';
      if (gridSize) {
        const w = cWidth / gridSize;
        const h = cHeight / gridSize;
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

  /**
   * Represents the game itself. Includes logic for creating and moving the snake,
   * the game loop and so on. Talks to the GameField for drawing.
   */
  class Game {
    private _field: GameField;
    private _snake: Snake | null = null;
    private _fruit: Coordinate | null = null;
    private _runTimer: number | null = null;
    private _currentGridSize: number = DEFAULT_GRID_SIZE;
    private _startSnakeSize: number = DEFAULT_SNAKE_SIZE;
    private _isAfterDrawing: boolean = true;
    private _velocityX: number = 1;
    private _velocityY: number = 0;
    private _difficulty: Difficulty | number = Difficulty.Medium;
    private _fruitsCollected: number = 0;
    private _fruitCollectedCb: (points: number) => void;
    private _gameOverCb: (points: number) => void;

    /** Whether a game has been started */
    get started() {return this._snake !== null;}

    /** Difficulty of the game based on the time of the game loop (eg. 1000/15ms) */
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
        throw new Error(`No Canvas provided for Snake :(`);
      }

      // Create a new GameField and provide the canvas element
      const gameField = new GameField(canvasEl);
      this._field = gameField;

      // Listen to key events on the document
      doc.addEventListener('keydown', ev => this._handleKeydown(ev));

      // Do an inital draw to display the grid and the background
      this._draw();
    }

    /** Starts a new game */
    start(
      gridSize: number = DEFAULT_GRID_SIZE,
      snakeSize: number = DEFAULT_SNAKE_SIZE,
      difficulty: Difficulty | number = Difficulty.Medium,
      fruitCollectedCb?: (points: number) => void,
      gameOverCb?: (points: number) => void
    ) {
      if (this.started) {
        throw new Error(`Can't start a new game, snake is already running. Did you mean "restart"?`);
      }
      this._difficulty = difficulty;
      this._fruitCollectedCb = fruitCollectedCb || function() {};
      this._gameOverCb = gameOverCb || function() {};
      this._currentGridSize = gridSize;
      this._startSnakeSize = snakeSize;
      this._snake = this._createSnake(snakeSize);
      this._fruit = this._createFruit();
      this._fruitsCollected = 0;

      this._run();
    }

    /** Restart the game */
    restart(
      gridSize?: number,
      snakeSize?: number,
      difficulty?: Difficulty | number,
      fruitCollectedCb?: (points: number) => void,
      gameOverCb?: (points: number) => void
    ) {
      if (this.started) this.stop();
      this.start(
        gridSize || this._currentGridSize,
        snakeSize || this._startSnakeSize,
        difficulty || this._difficulty,
        fruitCollectedCb || this._fruitCollectedCb,
        gameOverCb || this._gameOverCb);
    }

    /** Stops and resets the game that is currently running */
    stop() {
      if (!this.started) {
        throw new Error(`Can't stop, no game is running!`);
      }
      this._softStop();
    }

    /** Stops and resets the game without checking if a game is running  */
    private _softStop() {
      if (this._runTimer) clearTimeout(this._runTimer);
      this._runTimer = null;
      this._snake = null;
      this._fruit = null;
    }

    /** Handle Keydown events and adjust snakes velocity */
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

    /** Game loop, also handles code optimized draw calls. */
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
        this._fruitsCollected++;
        if (this._fruitCollectedCb) this._fruitCollectedCb(this._fruitsCollected);
      }
      this._moveSnake(shouldGrow);
      if (collision === Collision.Snake) {
        this._softStop();
        if (this._gameOverCb) this._gameOverCb(this._fruitsCollected);
      } else {
        this._runTimer = setTimeout(() => this._run(), this.difficulty);
      }
    }

    /** Moves the snake forward based on the velocity values */
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

    /** Checks for collisions with the snake itself or the fruit */
    private _checkCollision(): Collision {
      const trail = this._snake.trail;
      const size = trail.length;
      const head = this._snake.head;
      const fruit = this._fruit;
      for (let i = 1; i < size; i++) {
        const pos = trail[i];
        if (pos.match(head)) return Collision.Snake;
        if (pos.match(fruit)) return Collision.Fruit;
      }
      return Collision.None;
    }

    /** Creates a new snake with a specified size and positions it in the grid */
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

    /** Creates a new fruit with randomized positoin */
    _createFruit() {
      const randomize = () => Math.floor(Math.random() * this._currentGridSize);
      const trail = this._snake.trail;
      const size = trail.length;
      let isValidPosition = false;
      let x: number;
      let y: number;

      // We need to make sure the randomized position of the fruit
      // is not on a cell where the snake is currently on.
      // So we randomize until we get a correct cell
      while (!isValidPosition) {
        x = randomize();
        y = randomize();
        isValidPosition = true;
        for (let i = 0; i < size; i++) {
          const cell = trail[i];
          if (cell.match(x, y)) {
            isValidPosition = false;
          }
        }
      }

      return new Coordinate(x, y);
    }

    /** Invokes the draw command on the GameField. */
    private _draw() {
      this._field.draw(this._snake, this._fruit, this._currentGridSize);
    }
  }

  /**
   * Invokes the provided function on the next available animation frame.
   * Calls the function immediately if requestAnimationFrame is not available.
   */
  function getDrawFrame(cb: Function) {
    if ('requestAnimationFrame' in window) {
      global.requestAnimationFrame(() => cb());
    } else {
      cb();
    }
  }

  // Makes the snake api public available in an "Snake" object.
  global.Snake = {
    
    /** Predefined Difficulties */
    Difficulty: Difficulty,

    /** Initialize a new Snake game on an canvas element */
    init: (canvasElementOrId: HTMLCanvasElement | string, gridSize?: number): Game =>
      new Game(canvasElementOrId),

    /** Start the initialized game */
    start: (game: Game, gridSize?: number, snakeSize?: number, difficulty?: Difficulty | number) =>
      game.start(gridSize, snakeSize, difficulty),

    /** Restart the started game */
    restart: (game: Game, gridSize?: number, snakeSize?: number, difficulty?: Difficulty | number) =>
      game.restart(gridSize, snakeSize, difficulty),

    /** Stop the provided game */
    stop: (game: Game) => game.stop(),

    /** Adjust the difficulty */
    setDifficulty: (game: Game, difficulty: Difficulty | number) => game.difficulty = difficulty
  }
})(window, document);