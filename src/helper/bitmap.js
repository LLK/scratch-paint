import paper from '@scratch/paper';
import {clearRaster, getRaster, hideGuideLayers, showGuideLayers} from '../helper/layer';
import {inlineSvgFonts} from 'scratch-svg-renderer';

const forEachLinePoint = function (point1, point2, callback) {
    // Bresenham line algorithm
    let x1 = ~~point1.x;
    const x2 = ~~point2.x;
    let y1 = ~~point1.y;
    const y2 = ~~point2.y;
    
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = (x1 < x2) ? 1 : -1;
    const sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;
    
    callback(x1, y1);
    while (x1 !== x2 || y1 !== y2) {
        const e2 = err * 2;
        if (e2 > -dy) {
            err -= dy;
            x1 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y1 += sy;
        }
        callback(x1, y1);
    }
};

/**
 * @param {!number} a Coefficient in ax^2 + bx + c = 0
 * @param {!number} b Coefficient in ax^2 + bx + c = 0
 * @param {!number} c Coefficient in ax^2 + bx + c = 0
 * @return {Array<number>} Array of 2 solutions, with the larger solution first
 */
const solveQuadratic_ = function (a, b, c) {
    const soln1 = (-b + Math.sqrt((b * b) - (4 * a * c))) / 2 / a;
    const soln2 = (-b - Math.sqrt((b * b) - (4 * a * c))) / 2 / a;
    return soln1 > soln2 ? [soln1, soln2] : [soln2, soln1];
};

/**
 * @param {!object} options drawing options
 * @param {!number} options.centerX center of ellipse, x
 * @param {!number} options.centerY center of ellipse, y
 * @param {!number} options.radiusX major radius of ellipse
 * @param {!number} options.radiusY minor radius of ellipse
 * @param {!number} options.shearSlope slope of the sheared x axis
 * @param {?boolean} options.isFilled true if isFilled
 * @param {!CanvasRenderingContext2D} context for drawing
 */
const drawShearedEllipse = function (options, context) {
    const centerX = ~~options.centerX;
    const centerY = ~~options.centerY;
    const radiusX = ~~options.radiusX - .5;
    const radiusY = ~~options.radiusY - .5;
    const shearSlope = options.shearSlope;
    const isFilled = options.isFilled;
    if (shearSlope === Infinity || radiusX === 0 || radiusY === 0) {
        return;
    }
    // A, B, and C represent Ax^2 + Bxy + Cy^2 = 1 coefficients in a skewed ellipse formula
    const A = (1 / radiusX / radiusX) + (shearSlope * shearSlope / radiusY / radiusY);
    const B = -2 * shearSlope / radiusY / radiusY;
    const C = 1 / radiusY / radiusY;
    // Line with slope1 intersects the ellipse where its derivative is 1
    const slope1 = ((-2 * A) - B) / ((2 * C) + B);
    // Line with slope2 intersects the ellipse where its derivative is -1
    const slope2 = (-(2 * A) + B) / (-(2 * C) + B);
    const verticalStepsFirst = slope1 > slope2;

    /**
     * Vertical stepping portion of ellipse drawing algorithm
     * @param {!number} startY y to start drawing from
     * @param {!function} conditionFn function which should become true when we should stop stepping
     * @return {object} last point drawn to the canvas, or null if no points drawn
     */
    const drawEllipseStepVertical_ = function (startY, conditionFn) {
        // Points on the ellipse
        let y = startY;
        let x = solveQuadratic_(A, B * y, (C * y * y) - 1);
        // last pixel position at which a draw was performed
        let pY;
        let pX1;
        let pX2;
        while (conditionFn(x[0], y)) {
            pY = Math.floor(y);
            pX1 = Math.floor(x[0]);
            pX2 = Math.floor(x[1]);
            if (isFilled) {
                context.fillRect(centerX - pX1 - 1, centerY + pY, pX1 - pX2 + 1, 1);
                context.fillRect(centerX + pX2, centerY - pY - 1, pX1 - pX2 + 1, 1);
            } else {
                context.fillRect(centerX - pX1 - 1, centerY + pY, 1, 1);
                context.fillRect(centerX + pX1, centerY - pY - 1, 1, 1);
            }
            y--;
            x = solveQuadratic_(A, B * y, (C * y * y) - 1);
        }
        return pX1 || pY ? {x: pX1, y: pY} : null;
    };

    /**
     * Horizontal stepping portion of ellipse drawing algorithm
     * @param {!number} startX x to start drawing from
     * @param {!function} conditionFn function which should become true when we should stop stepping
     * @return {object} last point drawn to the canvas, or null if no points drawn
     */
    const drawEllipseStepHorizontal_ = function (startX, conditionFn) {
        // Points on the ellipse
        let x = startX;
        let y = solveQuadratic_(C, B * x, (A * x * x) - 1);
        // last pixel position at which a draw was performed
        let pX;
        let pY1;
        let pY2;
        while (conditionFn(x, y[0])) {
            pX = Math.floor(x);
            pY1 = Math.floor(y[0]);
            pY2 = Math.floor(y[1]);
            if (isFilled) {
                context.fillRect(centerX - pX - 1, centerY + pY2, 1, pY1 - pY2 + 1);
                context.fillRect(centerX + pX, centerY - pY1 - 1, 1, pY1 - pY2 + 1);
            } else {
                context.fillRect(centerX - pX - 1, centerY + pY1, 1, 1);
                context.fillRect(centerX + pX, centerY - pY1 - 1, 1, 1);
            }
            x++;
            y = solveQuadratic_(C, B * x, (A * x * x) - 1);
        }
        return pX || pY1 ? {x: pX, y: pY1} : null;
    };

    // Last point drawn
    let lastPoint;
    if (verticalStepsFirst) {
        let forwardLeaning = false;
        if (slope1 > 0) forwardLeaning = true;

        // step vertically
        lastPoint = drawEllipseStepVertical_(
            forwardLeaning ? -radiusY : radiusY,
            (x, y) => (y / x > slope1) || (forwardLeaning && x === 0));
        // step horizontally while slope is flat
        lastPoint = drawEllipseStepHorizontal_(
            lastPoint ? -lastPoint.x + .5 : .5,
            (x, y) => y / x > slope2) || lastPoint;
        // step vertically until back to start
        drawEllipseStepVertical_(
            lastPoint.y - .5,
            (x, y) => {
                if (forwardLeaning) return y > -radiusY;
                return y > radiusY;
            }
        );
    } else {
        // step horizontally forward
        lastPoint = drawEllipseStepHorizontal_(
            .5,
            (x, y) => y / x > slope2);
        // step vertically while slope is steep
        lastPoint = drawEllipseStepVertical_(
            lastPoint ? lastPoint.y - .5 : radiusY,
            (x, y) => (y / x > slope1) || x === 0) || lastPoint;
        // step horizontally until back to start
        drawEllipseStepHorizontal_(
            -lastPoint.x + .5,
            (x, y) => y / x > slope2);
    }
};

/**
 * @param {!object} options drawing options
 * @param {!number} options.centerX center of ellipse, x
 * @param {!number} options.centerY center of ellipse, y
 * @param {!number} options.radiusX major radius of ellipse
 * @param {!number} options.radiusY minor radius of ellipse
 * @param {!number} options.rotation of ellipse, radians
 * @param {?boolean} options.isFilled true if isFilled
 * @param {!CanvasRenderingContext2D} context for drawing
 */
const drawRotatedEllipse = function (options, context) {
    const centerX = ~~options.centerX;
    const centerY = ~~options.centerY;
    const radiusX = options.radiusX;
    const radiusY = options.radiusY;
    const rotation = options.rotation;
    const isFilled = options.isFilled;
    if (radiusX === radiusY) {
        drawShearedEllipse({centerX, centerY, radiusX, radiusY, shearSlope: 0, isFilled}, context);
    }
    const theta = Math.atan2(radiusY * -Math.tan(rotation), radiusX);
    const shearDx = (radiusX * Math.cos(theta) * Math.cos(rotation)) - (radiusY * Math.sin(theta) * Math.sin(rotation));
    const shearDy = (radiusX * Math.cos(theta) * Math.sin(rotation)) + (radiusY * Math.sin(theta) * Math.cos(rotation));
    const shearSlope = shearDy / shearDx;
    const shearRadiusX = Math.abs(shearDx);
    const shearRadiusY = radiusX * radiusY / shearRadiusX;
    drawShearedEllipse({centerX, centerY, radiusX: shearRadiusX, radiusY: shearRadiusY, shearSlope, isFilled}, context);
};

/**
 * @param {!number} size The diameter of the brush
 * @param {!string} color The css color of the brush
 * @return {HTMLCanvasElement} a canvas with the brush mark printed on it
 */
const getBrushMark = function (size, color) {
    size = ~~size;
    const canvas = document.createElement('canvas');
    const roundedUpRadius = Math.ceil(size / 2);
    canvas.width = roundedUpRadius * 2;
    canvas.height = roundedUpRadius * 2;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.fillStyle = color;
    // Small squares for pixel artists
    if (size <= 5) {
        if (size % 2) {
            context.fillRect(1, 1, size, size);
        } else {
            context.fillRect(0, 0, size, size);
        }
    } else {
        drawShearedEllipse({
            centerX: size / 2,
            centerY: size / 2,
            radiusX: size / 2,
            radiusY: size / 2,
            shearSlope: 0,
            isFilled: true
        }, context);
    }
    return canvas;
};

const rowBlank_ = function (imageData, width, y) {
    for (let x = 0; x < width; ++x) {
        if (imageData.data[(y * width << 2) + (x << 2) + 3] !== 0) return false;
    }
    return true;
};

const columnBlank_ = function (imageData, width, x, top, bottom) {
    for (let y = top; y < bottom; ++y) {
        if (imageData.data[(y * width << 2) + (x << 2) + 3] !== 0) return false;
    }
    return true;
};

// Adapted from Tim Down's https://gist.github.com/timdown/021d9c8f2aabc7092df564996f5afbbf
// Get bounds, trimming transparent pixels from edges.
const getHitBounds = function (raster) {
    const width = raster.width;
    const imageData = raster.getImageData(raster.bounds);
    let top = 0;
    let bottom = imageData.height;
    let left = 0;
    let right = imageData.width;

    while (top < bottom && rowBlank_(imageData, width, top)) ++top;
    while (bottom - 1 > top && rowBlank_(imageData, width, bottom - 1)) --bottom;
    while (left < right && columnBlank_(imageData, width, left, top, bottom)) ++left;
    while (right - 1 > left && columnBlank_(imageData, width, right - 1, top, bottom)) --right;

    return new paper.Rectangle(left, top, right - left, bottom - top);
};

const _trim = function (raster) {
    return raster.getSubRaster(getHitBounds(raster));
};

const convertToBitmap = function (clearSelectedItems, onUpdateImage) {
    // @todo if the active layer contains only rasters, drawing them directly to the raster layer
    // would be more efficient.

    clearSelectedItems();

    // Export svg
    const guideLayers = hideGuideLayers(true /* includeRaster */);
    const bounds = paper.project.activeLayer.bounds;
    const svg = paper.project.exportSVG({
        bounds: 'content',
        matrix: new paper.Matrix().translate(-bounds.x, -bounds.y)
    });
    showGuideLayers(guideLayers);

    // Get rid of anti-aliasing
    // @todo get crisp text?
    svg.setAttribute('shape-rendering', 'crispEdges');
    inlineSvgFonts(svg);
    const svgString = (new XMLSerializer()).serializeToString(svg);

    // Put anti-aliased SVG into image, and dump image back into canvas
    const img = new Image();
    img.onload = () => {
        getRaster().drawImage(
            img,
            new paper.Point(Math.floor(bounds.topLeft.x), Math.floor(bounds.topLeft.y)));

        paper.project.activeLayer.removeChildren();
        onUpdateImage();
    };
    img.onerror = () => {
        // Fallback if browser does not support SVG data URIs in images.
        // The problem with rasterize is that it will anti-alias.
        const raster = paper.project.activeLayer.rasterize(72, false /* insert */);
        raster.onLoad = () => {
            getRaster().drawImage(raster.canvas, raster.bounds.topLeft);
            paper.project.activeLayer.removeChildren();
            onUpdateImage();
        };
    };
    // Hash tags will break image loading without being encoded first
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};

const convertToVector = function (clearSelectedItems, onUpdateImage) {
    clearSelectedItems();
    const raster = _trim(getRaster());
    if (raster.width === 0 || raster.height === 0) {
        raster.remove();
    } else {
        paper.project.activeLayer.addChild(raster);
    }
    clearRaster();
    onUpdateImage();
};

export {
    convertToBitmap,
    convertToVector,
    getBrushMark,
    getHitBounds,
    drawRotatedEllipse,
    drawShearedEllipse,
    forEachLinePoint
};
