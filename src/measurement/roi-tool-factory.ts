import { RectangleROI } from './rectangle-roi';
import { CircleROI } from './circle-roi';
import { FreehandROI } from './freehand-roi';

export class ROIToolFactory {
  createRectangle(): RectangleROI {
    return new RectangleROI();
  }

  createCircle(): CircleROI {
    return new CircleROI();
  }

  createFreehand(): FreehandROI {
    return new FreehandROI();
  }
}
