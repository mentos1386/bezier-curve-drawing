class Point {

  constructor(x, y, color = '#3f3f3f') {
    this.x = x;
    this.y = y;
    this.color = color;
  }

  hit() {
    throw Error('Parent needs method "hit"');
  }

  draw() {
    throw Error('Parent needs method "draw"');
  }

}

class Square extends Point {
  constructor(x, y, color) {
    super(x, y, color);

    this.height = 10;
    this.width = 10;
  }

  draw(context) {
    const x = this.x - this.width / 2;
    const y = this.y - this.height / 2;
    context.fillStyle = this.color;
    context.fillRect(x, y, this.width, this.height);
  }

  hit(x, y) {
    const checkX = x < this.x + this.width / 2 && x > this.x - this.width / 2;
    const checkY = y < this.y + this.height / 2 && y > this.y - this.height / 2;
    return checkX && checkY;
  }
}

class Circle extends Point {
  constructor(x, y, radius = 2, color) {
    super(x, y, color);

    this.radius = radius;
  }

  draw(context) {
    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
    context.fillStyle = this.color;
    context.fill();
  }

  hit(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt((dx * dx) + (dy * dy)) < this.radius;
  }
}

class Curve {

  constructor(startPoint, controlPoints, endPoint, color = '#E0E1DD') {
    this.startPoint = startPoint;
    this.endPoint = endPoint;
    this.controlPoints = controlPoints;

    this.color = color;
    this.width = '1';
    this.points = [];
  }

  static get numOfPoints() {
    throw Error('Parent needs method "numOfPoints"');
  }

  static get precision() {
    return 0.001;
  }

  createPoints() {
    throw Error('Parent needs method "createPoints"');
  }

  drawSupportLines(context) {
    context.beginPath();
    context.strokeStyle = '#E0E1DD';
    context.moveTo(this.startPoint.x, this.startPoint.y);
    this.controlPoints.forEach(controlPoint => context.lineTo(controlPoint.x, controlPoint.y));
    context.lineTo(this.endPoint.x, this.endPoint.y);
    context.stroke();
  }

  drawPoints(context) {
    this.startPoint.draw(context);
    this.controlPoints.forEach(controlPoint => controlPoint.draw(context));
    this.endPoint.draw(context);
  }

  /**
   * Check if we hit points
   * @param {number} x
   * @param {number} y
   * @returns {Point}
   */
  hitPoints(x, y) {
    if (this.startPoint.hit(x, y)) return this.startPoint;

    const hitControlPoint = this.controlPoints.filter(controlPoint => controlPoint.hit(x, y));
    if (hitControlPoint.length) return hitControlPoint[0];

    if (this.endPoint.hit(x, y)) return this.endPoint;
    return null;
  }

  /**
   * Check if we hit any part of curve
   * @param {number} x
   * @param {number} y
   * @return {boolean}
   */
  hit(x, y) {
    const hitAnyCurvePoints = this.points.filter(point => point.hit(x, y)).filter(i => i);

    if (this.hitPoints(x, y)) return true;
    return hitAnyCurvePoints.length !== 0;
  }

  setColor(color) {
    this.color = color;
    this.createPoints();
  }

  drawCurve(context) {
    this.createPoints();
    this.points.forEach(point => point.draw(context));
  }
}

class QuadraticCurve extends Curve {

  constructor(startPoint, controlPoints, endPoint, color) {
    super(startPoint, controlPoints, endPoint, color);
  }

  static get numOfPoints() {
    return 3;
  }

  createPoints() {
    this.points = [];
    for (let t = 0; t < 1; t += Curve.precision) {
      const x = (1 - t) ** 2 * this.startPoint.x + 2 * (1 - t) * t * this.controlPoints[0].x + t * t * this.endPoint.x;
      const y = (1 - t) ** 2 * this.startPoint.y + 2 * (1 - t) * t * this.controlPoints[0].y + t * t * this.endPoint.y;
      this.points.push(new Circle(x, y, 2, this.color));
    }
  }
}

class CubicCurve extends Curve {

  constructor(startPoint, controlPoints, endPoint, color) {
    super(startPoint, controlPoints, endPoint, color);
  }

  static get numOfPoints() {
    return 4;
  }

  createPoints() {
    this.points = [];
    for (let t = 0; t < 1; t += Curve.precision) {
      const x = (1 - t) ** 3 * this.startPoint.x +
        3 * (1 - t) ** 2 * t * this.controlPoints[0].x +
        3 * (1 - t) * t ** 2 * this.controlPoints[1].x +
        t ** 3 * this.endPoint.x;

      const y = (1 - t) ** 3 * this.startPoint.y +
        3 * (1 - t) ** 2 * t * this.controlPoints[0].y +
        3 * (1 - t) * t ** 2 * this.controlPoints[1].y +
        t ** 3 * this.endPoint.y;

      this.points.push(new Circle(x, y, 2, this.color));
    }
  }
}

class Draw {

  constructor(canvas, clearButton, curve = QuadraticCurve, colors) {
    this.canvas = canvas;
    this.clearButton = clearButton;
    this.curve = curve;
    this.colorPicker = new ColorPicker(this, ...colors);
    this.context = this.canvas.getContext('2d');
    this.curves = [];
    this.drawingPoints = [];
    this.movingPoint = null;
    this.movingCurve = null;
    this.movedPoint = false;
    this.tool = 'draw';
    this.continuity = 'continuity-0';

    if (this.clearButton) this.clearButton.addEventListener('click', () => {
      this.clearCanvas();
      this.drawingPoints = [];
      this.curves = [];
    });

    this.canvas.addEventListener('mousedown', (event) => this.onMouseDownEvent(event));
    this.canvas.addEventListener('mousemove', (event) => this.onMouseMoveEvent(event));
    this.canvas.addEventListener('mouseup', (event) => this.onMouseUpEvent(event));
    this.canvas.addEventListener('click', (event) => this.onMouseClickEvent(event));
  }

  onMouseDownEvent(event) {
    const { x, y } = this.getEventCoordinates(event);
    console.log(`onMouseDownEvent x=${x} y=${y}`, this.tool);

    if (this.tool === 'draw') {
      const hitDrawingPoints = this.drawingPoints.filter((point) => point.hit(x, y));
      const hitCurvePoints = this.curves.map(curve => {
        const hitPoint = curve.hitPoints(x, y);
        if (hitPoint) return { curve, hitPoint };
        return null;
      }).filter(i => i);

      // Check if we want to move drawing point
      if (hitDrawingPoints.length) {
        this.movingPoint = hitDrawingPoints[0];
      }
      // Check if we want to move point on a drawn curve
      else if (hitCurvePoints.length) {
        this.movingPoint = hitCurvePoints[0].hitPoint;
        this.movingCurve = hitCurvePoints[0].curve;
      }
      // Check if we already added 3 points
      else if (this.drawingPoints.length === this.curve.numOfPoints) {
        alert(`You already have ${this.curve.numOfPoints} points!`);
      }
      else {
        // Else treat it as click event (trying to create a point)
        this.createDrawingPoint(x, y);
      }
    }
  }

  onMouseClickEvent(event) {
    const { x, y } = this.getEventCoordinates(event);
    console.log(`onMouseClickEvent x=${x} y=${y} tool=${this.tool}`);

    if (this.tool === 'color') {
      const hitCurves = this.curves.filter(curve => curve.hit(x, y));

      if (hitCurves.length) {
        const curve = hitCurves[0];
        curve.setColor(this.color);
      }
    }
    if (this.tool === 'delete') {
      const deleteCurves = this.curves.filter(curve => curve.hit(x, y));

      if (deleteCurves.length) {
        const findMatching = (deleteCurves) => {
          const notChecked = this.curves
          .filter(curve => deleteCurves.indexOf(curve) === -1);

          // Check if should delete
          const shouldRemove = notChecked.filter(curve => deleteCurves.filter(_curve => {
            return curve.startPoint === _curve.startPoint ||
              curve.startPoint === _curve.endPoint ||
              curve.endPoint === _curve.startPoint ||
              curve.endPoint === _curve.endPoint;
          }).length);

          if (shouldRemove.length === 0) return deleteCurves;
          return findMatching([...deleteCurves, ...shouldRemove]);
        };

        const shouldDeleteCurves = findMatching(deleteCurves);
        this.curves = this.curves.filter(curve => shouldDeleteCurves.indexOf(curve) === -1);
      }
    }

    this.draw();
  }

  onMouseMoveEvent(event) {
    if (this.movingPoint && this.tool === 'draw') {
      this.movedPoint = true;
      const { x, y } = this.getEventCoordinates(event);
      this.movingPoint.x = x;
      this.movingPoint.y = y;
      this.draw();
    }
  }

  onMouseUpEvent(event) {
    console.log(`onMouseUpEvent`, event, this.tool);

    if (this.tool === 'draw') {
      // If we were "moving" a point, but didn't actually move it, and we haven't created a
      // drawingPoint. Treat this as "join" curves
      if (this.movingPoint && !this.movedPoint &&
        ( this.drawingPoints.length === 0 || this.drawingPoints.length === this.curve.numOfPoints - 1 )
      ) {
        console.log(`Joining curve continuity=${this.continuity}`);
        switch (this.continuity) {
          case 'continuity-0':
            this.drawingPoints.push(this.movingPoint);
            break;
          case 'continuity-1':
            this.drawingPoints.push(this.movingPoint);
            let point1, point2;
            let x;


            point1 = this.movingPoint;

            if (this.movingPoint === this.movingCurve.startPoint)
              point2 = this.movingCurve.controlPoints[0];
            else if (this.movingPoint === this.movingCurve.endPoint)
              point2 = this.movingCurve.controlPoints[this.movingCurve.controlPoints.length - 1];

            if (point1.x < point2.x) x = point1.x - (point2.x - point1.x);
            if (point1.x > point2.x) x = point1.x + (point1.x - point2.x);

            const k = (point1.y - point2.y) / (point1.x - point2.x);

            const newY = (x, x1, y1) => k * x - k * x1 + y1;

            if (this.drawingPoints.length === this.curve.numOfPoints) {
              const lastControlPoint = this.drawingPoints[this.drawingPoints.length - 2];
              lastControlPoint.x = Math.floor(x);
              lastControlPoint.y = Math.floor(newY(x, point1.x, point1.y));
            }
            else
              this.createDrawingPoint(Math.floor(x), Math.floor(newY(x, point1.x, point1.y)));

            console.log('continuity-1');
            break;
          case 'continuity-2':
            console.log('continuity-2');
            break;
        }
      }

      if (this.movingPoint) {
        this.movingPoint = null;
        this.movingCurve = null;
        this.movedPoint = false;
      }

      if (this.drawingPoints.length === this.curve.numOfPoints) {
        console.log('Creating new curve', this.color);
        const controlPoints = this.drawingPoints.splice(1, this.drawingPoints.length - 2);

        // Try to create new curve
        const curve = new this.curve(
          this.drawingPoints[0],
          controlPoints,
          this.drawingPoints[this.drawingPoints.length - 1],
          this.color,
        );

        this.curves.push(curve);
        this.drawingPoints = [];

        this.draw();
      }
    }
  }

  createDrawingPoint(x, y) {
    console.log(`createDrawingPoint x=${x} y=${y}`);

    // Create Interpolated point
    if (this.drawingPoints.length === 0 || this.drawingPoints.length === this.curve.numOfPoints - 1) {
      this.drawingPoints.push(new Square(x, y));
    } else {
      // Create approximated point
      this.drawingPoints.push(new Circle(x, y, 5));
    }
    this.draw();
  }

  getEventCoordinates(event) {
    return {
      x: event.pageX - this.canvas.offsetLeft,
      y: event.pageY - this.canvas.offsetTop,
    };
  }

  draw() {
    this.clearCanvas();
    this.drawingPoints.forEach(point => point.draw(this.context));
    this.curves.forEach(curve => {
      curve.drawSupportLines(this.context);
      curve.drawPoints(this.context);
      curve.drawCurve(this.context);
    });
  };

  setColor(color) {
    console.log('Set color', color);
    this.color = color;
  }

  setTool(tool) {
    console.log('Set tool', tool);
    this.tool = tool;
  }

  setContinuity(continuity) {
    this.continuity = continuity;
  }

  clearCanvas() {
    console.log('Clear canvas');
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

}

class Color {
  constructor(id, color) {
    this.element = document.getElementById(id);
    this.id = id;
    this.color = color;

    this.setStyle();
  }

  setStyle() {
    console.log('Setting color style');
    const style = `
    #${this.id} { background: ${this.color} }
    #${this.id}:hover { background: ${shadeColor(this.color, -0.2)} }`;
    const element = document.createElement('style');
    element.appendChild(document.createTextNode(style));

    document.getElementsByTagName('head')[0].appendChild(element);
  }

  setActive() {
    this.element.className += ' active';
  }

  removeActive() {
    this.element.className = this.element.className.replace(' active', '');
  }
}

class ColorPicker {
  constructor(drawing, ...colors) {
    this.colors = colors;
    this.defaultColor = colors[0];
    this.drawing = drawing;

    console.log('Color Picker colors', colors);

    // Set first color as default
    this.drawing.setColor(this.defaultColor.color);
    this.defaultColor.setActive();

    this.setListeners();
  }

  setListeners() {
    this.colors.forEach(color => {
      color.element.addEventListener('click', (event) => this.onClickEvent(event, color));
    });
  }

  onClickEvent(event, color) {
    console.log('Color click event');
    this.colors.forEach(c => c.removeActive());
    color.setActive();
    this.drawing.setColor(color.color);
  }
}

function shadeColor(color, percent) {
  const f = parseInt(color.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = percent < 0 ? percent * -1 : percent;
  const R = f >> 16;
  const G = f >> 8 & 0x00FF;
  const B = f & 0x0000FF;
  return '#' + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(
    16).slice(1);
}

/**
 * Start
 */

const CANVAS_ID = 'canvas';
const CLEAR_BUTTON_ID = 'clear-canvas';
const SWITCH_QUADRATIC_ID = 'switch-quadratic';
const SWITCH_CUBIC_ID = 'switch-cubic';
const SWITCH_TOOL_DRAW_ID = 'switch-draw';
const SWITCH_TOOL_DELETE_ID = 'switch-delete';
const SWITCH_TOOL_COLOR_ID = 'switch-color';
const SWITCH_CONTINUITY_0 = 'switch-continuity-0';
const SWITCH_CONTINUITY_1 = 'switch-continuity-1';
const SWITCH_CONTINUITY_2 = 'switch-continuity-2';
const MODAL_WRAP_ID = 'modal-wrap';
const BODY_WRAP_ID = 'body-wrap';

const clearButton = document.getElementById(CLEAR_BUTTON_ID);

let canvas = document.getElementById(CANVAS_ID);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const colors = [
  new Color('color-dark', '#3f3f3f'),
  new Color('color-grey', '#9e9e9e'),
  new Color('color-white', '#ffffff'),
  new Color('color-blue', '#4DB5F2'),
  new Color('color-red', '#F44336'),
  new Color('color-pink', '#E91E63'),
  new Color('color-lime', '#CDDC39'),
  new Color('color-yellow', '#ffeb3b'),
  new Color('color-orange', '#ff9800'),
];

let activeMethod = 'quadratic';
let activeTool = 'draw';
let activeContinuity = 'continuity-0';
let drawing = new Draw(canvas, clearButton, QuadraticCurve, colors);

const switchQuadraticButton = document.getElementById(SWITCH_QUADRATIC_ID);
const switchCubicButton = document.getElementById(SWITCH_CUBIC_ID);
const switchDrawButton = document.getElementById(SWITCH_TOOL_DRAW_ID);
const switchDeleteButton = document.getElementById(SWITCH_TOOL_DELETE_ID);
const switchColorButton = document.getElementById(SWITCH_TOOL_COLOR_ID);
const switchContinuity0Button = document.getElementById(SWITCH_CONTINUITY_0);
const switchContinuity1Button = document.getElementById(SWITCH_CONTINUITY_1);
const switchContinuity2Button = document.getElementById(SWITCH_CONTINUITY_2);
const bodyWrap = document.getElementById(BODY_WRAP_ID);
const modalWrap = document.getElementById(MODAL_WRAP_ID);

function switchDrawingMethod(method) {
  drawing.clearCanvas();

  switch (method) {
    case 'cubic':
      if (activeMethod === method) break;
      activeMethod = method;
      removeAllListeners(canvas);
      drawing = new Draw(canvas, clearButton, CubicCurve, colors);
      drawing.setTool(activeTool);
      drawing.setContinuity(activeContinuity);
      switchCubicButton.className += ' active';
      switchQuadraticButton.className = switchQuadraticButton.className.replace(' active', '');
      break;
    case 'quadratic':
      if (activeMethod === method) break;
      activeMethod = method;
      removeAllListeners(canvas);
      drawing = new Draw(canvas, clearButton, QuadraticCurve, colors);
      drawing.setTool(activeTool);
      drawing.setContinuity(activeContinuity);
      switchQuadraticButton.className += ' active';
      switchCubicButton.className = switchCubicButton.className.replace(' active', '');
      break;
  }
}

function switchTool(tool) {
  switch (tool) {
    case 'draw':
      if (activeTool === tool) break;
      activeTool = tool;
      switchDrawButton.className += ' active';
      switchDeleteButton.className = switchDeleteButton.className.replace(' active', '');
      switchColorButton.className = switchColorButton.className.replace(' active', '');
      drawing.setTool(tool);
      break;
    case 'delete':
      if (activeTool === tool) break;
      activeTool = tool;
      switchDeleteButton.className += ' active';
      switchDrawButton.className = switchDrawButton.className.replace(' active', '');
      switchColorButton.className = switchColorButton.className.replace(' active', '');
      drawing.setTool(tool);
      break;
    case 'color':
      if (activeTool === tool) break;
      activeTool = tool;
      switchColorButton.className += ' active';
      switchDeleteButton.className = switchDeleteButton.className.replace(' active', '');
      switchDrawButton.className = switchDrawButton.className.replace(' active', '');
      drawing.setTool(tool);
      break;
  }
}

function switchContinuity(continuity) {
  switch (continuity) {
    case 'continuity-0':
      if (activeContinuity === continuity) break;
      activeContinuity = continuity;
      switchContinuity0Button.className += ' active';
      switchContinuity1Button.className = switchContinuity1Button.className.replace(' active', '');
      switchContinuity2Button.className = switchContinuity2Button.className.replace(' active', '');
      drawing.setContinuity(continuity);
      break;
    case 'continuity-1':
      if (activeContinuity === continuity) break;
      activeContinuity = continuity;
      switchContinuity1Button.className += ' active';
      switchContinuity2Button.className = switchContinuity2Button.className.replace(' active', '');
      switchContinuity0Button.className = switchContinuity0Button.className.replace(' active', '');
      drawing.setContinuity(continuity);
      break;
    case 'continuity-2':
      if (activeContinuity === continuity) break;
      activeContinuity = continuity;
      switchContinuity2Button.className += ' active';
      switchContinuity1Button.className = switchContinuity1Button.className.replace(' active', '');
      switchContinuity0Button.className = switchContinuity0Button.className.replace(' active', '');
      drawing.setContinuity(continuity);
      break;
  }
}

function removeAllListeners(element) {
  const clonedElement = element.cloneNode(true);
  element.parentNode.replaceChild(clonedElement, element);
  canvas = clonedElement;
}

function closeModal() {
  modalWrap.parentNode.removeChild(modalWrap);
  bodyWrap.className = '';
}