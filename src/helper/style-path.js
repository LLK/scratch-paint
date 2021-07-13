import paper from '@scratch/paper';
import {getSelectedLeafItems, getItems} from './selection';
import {isPointTextItem} from './item';
import {isGroup} from './group';
import GradientTypes from '../lib/gradient-types';
import {DEFAULT_COLOR} from '../reducers/fill-style';
import {isCompoundPathChild} from '../helper/compound-path';
import log from '../log/log';

const MIXED = 'scratch-paint/style-path/mixed';

const _isBlack = hsbColor => hsbColor.brightness === 0;

const _isWhite = hsbColor => hsbColor.brightness === 100 && hsbColor.saturation === 100;

// Check if two colors, possibly null, are (approximately) equal.
const colorsEqual = (color1, color2) => {
    if (color1 === color2) return true;
    if (!color1 || !color2) return false;
    if (color1 === MIXED || color2 === MIXED) {
        return false; // Don't warn if one of the colors is mixed
    }

    if (!(color1 instanceof paper.Color && color2 instanceof paper.Color)) {
        log.warn('colorsEqual passed non-Colors');
        return false;
    }

    const hsb1 = color1.type === 'hsb' ? color1 : color1.convert('hsb');
    const hsb2 = color2.type === 'hsb' ? color2 : color2.convert('hsb');

    // Collapse equivalent colors in hsb color space
    if (_isBlack(hsb1) && _isBlack(hsb2)) return true;
    if (_isWhite(hsb1) && _isWhite(hsb2)) return true;

    // Colors that are similar enough, as determined by this threshold, will be considered equal.
    // (in terms of units on the Scratch color scale)
    const EPSILON = 0.5;

    return (
        Math.abs(hsb1.hue - hsb2.hue) < EPSILON * (360 / 100) &&
        Math.abs(hsb1.saturation - hsb2.saturation) < EPSILON / 100 &&
        Math.abs(hsb1.brightness - hsb2.brightness) < EPSILON / 100 &&
        Math.abs(hsb1.alpha - hsb2.alpha) < EPSILON
    );
};

// Selected items and currently active text edit items respond to color changes.
const _getColorStateListeners = function (textEditTargetId) {
    const items = getSelectedLeafItems();
    if (textEditTargetId) {
        const matches = getItems({
            match: item => item.id === textEditTargetId
        });
        if (matches.length) {
            items.push(matches[0]);
        }
    }
    return items;
};

/**
 * Transparent R, G, B values need to match the other color of the gradient
 * in order to form a smooth gradient, otherwise it fades through black. This
 * function gets the transparent color for a given color string.
 * @param {?paper.Color} colorToMatch Other color of gradient, or null for transparent
 * @return {paper.Color} Color for matching color of transparent
 */
const getColorForTransparent = function (colorToMatch) {
    if (colorToMatch === null) return new paper.Color({hue: 0, saturation: 0, brightness: 0, alpha: 0});
    const color = colorToMatch.clone();
    color.alpha = 0;
    return color;
};

/**
 * Generate a color that contrasts well with the passed-in color.
 * @param {string} firstColor The "primary" color
 * @return {string} CSS string for generated color
 */
const generateSecondaryColor = function (firstColor) {
    if (firstColor === MIXED) return null;
    const color = new paper.Color(firstColor);
    if (!firstColor || color.alpha === 0) return DEFAULT_COLOR;

    color.type = 'hsb';
    const desaturated = color.saturation <= 0.15;
    // If the color is desaturated or dark enough that a hue shift would be hard to see, do a brightness shift.
    if (desaturated || color.brightness <= 0.4) {
        // Choose the shade that contrasts the most with the given color.
        // Use a brightness of 0.1 instead of 0 because if the brightness is 0, it's black and we lose the hue.
        color.brightness = (color.brightness < 0.55 ? 1 : 0.1);
    }
    // If the color was desaturated, don't do a hue shift, as it would be hard to see anyway.
    if (!desaturated) {
        // adding 288 and taking the result modulo 360 is equivalent to subtracting 72, and ensures hue is kept positive
        color.hue = (color.hue + 288) % 360;
    }
    // The returned color will be one of three things:
    // 1. If the color was bright and saturated (e.g. colorful), it will be that color, hue-shifted.
    // 2. If the color was dark and saturated, it will be that color, brightened and hue-shifted.
    // 3. If the color was not saturated, it will be that color, brightened or darkened as needed to contrast most.
    return color;
};

/**
 * Convert params to a paper.Color gradient object
 * @param {?paper.Color} color1 Primary gradient color, or null for transparent
 * @param {?paper.Color} color2 Secondary gradient color, or null for transparent
 * @param {GradientType} gradientType gradient type
 * @param {paper.Rectangle} bounds Bounds of the object
 * @param {?paper.Point} [radialCenter] Where the center of a radial gradient should be, if the gradient is radial.
 * Defaults to center of bounds.
 * @param {number} [minSize] The minimum width/height of the gradient object.
 * @return {paper.Color} Color object with gradient, may be null or color string if the gradient type is solid
 */
const createGradientObject = function (color1, color2, gradientType, bounds, radialCenter, minSize) {
    if (gradientType === GradientTypes.SOLID) return color1;
    if (color1 === null) {
        color1 = getColorForTransparent(color2);
    }
    if (color2 === null) {
        color2 = getColorForTransparent(color1);
    }

    // Force gradients to have a minimum length. If the gradient start and end points are the same or very close
    // (e.g. applying a vertical gradient to a perfectly horizontal line or vice versa), the gradient will not appear.
    if (!minSize) minSize = 1e-2;

    let start;
    let end;
    switch (gradientType) {
    case GradientTypes.HORIZONTAL: {
        // clone these points so that adding/subtracting doesn't affect actual bounds
        start = bounds.leftCenter.clone();
        end = bounds.rightCenter.clone();

        const gradientSize = Math.abs(end.x - start.x);
        if (gradientSize < minSize) {
            const sizeDiff = (minSize - gradientSize) / 2;
            end.x += sizeDiff;
            start.x -= sizeDiff;
        }
        break;
    }
    case GradientTypes.VERTICAL: {
        // clone these points so that adding/subtracting doesn't affect actual bounds
        start = bounds.topCenter.clone();
        end = bounds.bottomCenter.clone();

        const gradientSize = Math.abs(end.y - start.y);
        if (gradientSize < minSize) {
            const sizeDiff = (minSize - gradientSize) / 2;
            end.y += sizeDiff;
            start.y -= sizeDiff;
        }
        break;
    }

    case GradientTypes.RADIAL: {
        const halfLongestDimension = Math.max(bounds.width, bounds.height) / 2;
        start = radialCenter || bounds.center;
        end = start.add(new paper.Point(
            Math.max(halfLongestDimension, minSize / 2),
            0));
        break;
    }
    }
    return {
        gradient: {
            stops: [color1, color2],
            radial: gradientType === GradientTypes.RADIAL
        },
        origin: start,
        destination: end
    };
};

/**
 * Called when setting an item's color
 * @param {paper.Color} color new color, or null if completely transparent
 * @param {number} colorIndex index of color being changed
 * @param {boolean} isSolidGradient True if is solid gradient. Sometimes the item has a gradient but the color
 *     picker is set to a solid gradient. This happens when a mix of colors and gradient types is selected.
 *     When changing the color in this case, the solid gradient should override the existing gradient on the item.
 * @param {?boolean} applyToStroke True if changing the selection's stroke, false if changing its fill.
 * @param {?string} textEditTargetId paper.Item.id of text editing target, if any
 * @return {boolean} Whether the color application actually changed visibly.
 */
const applyColorToSelection = function (
    color,
    colorIndex,
    isSolidGradient,
    applyToStroke,
    textEditTargetId
) {
    const items = _getColorStateListeners(textEditTargetId);
    let changed = false;
    for (let item of items) {
        if (item.parent instanceof paper.CompoundPath) {
            item = item.parent;
        }

        const itemColorProp = applyToStroke ? 'strokeColor' : 'fillColor';
        const itemColor = item[itemColorProp];

        if (isSolidGradient || !itemColor || !itemColor.gradient ||
                !itemColor.gradient.stops.length === 2) {
            // Applying a solid color
            if (!colorsEqual(itemColor, color)) {
                changed = true;
                if (isPointTextItem(item) && !color) {
                    // Allows transparent text to be hit
                    item[itemColorProp] = 'rgba(0,0,0,0)';
                } else {
                    item[itemColorProp] = color;
                }
            }
        } else if (!colorsEqual(itemColor.gradient.stops[colorIndex].color, color)) {
            // Changing one color of an existing gradient
            changed = true;
            const otherIndex = colorIndex === 0 ? 1 : 0;
            if (color === null) {
                color = getColorForTransparent(itemColor.gradient.stops[otherIndex].color);
            }
            const colors = [0, 0];
            colors[colorIndex] = color;
            // If the other color is transparent, its RGB values need to be adjusted for the gradient to be smooth
            if (itemColor.gradient.stops[otherIndex].color.alpha === 0) {
                colors[otherIndex] = getColorForTransparent(color);
            } else {
                colors[otherIndex] = itemColor.gradient.stops[otherIndex].color;
            }
            // There seems to be a bug where setting colors on stops doesn't always update the view, so set gradient.
            itemColor.gradient = {stops: colors, radial: itemColor.gradient.radial};
        }
    }
    return changed;
};

/**
 * Called to swap gradient colors
 * @param {?boolean} applyToStroke True if changing the selection's stroke, false if changing its fill.
 * @param {?string} textEditTargetId paper.Item.id of text editing target, if any
 * @return {boolean} Whether the color application actually changed visibly.
 */
const swapColorsInSelection = function (applyToStroke, textEditTargetId) {
    const items = _getColorStateListeners(textEditTargetId);
    let changed = false;
    for (const item of items) {
        // If an item is a child path, do not swap colors.
        // At some point, we'll iterate over its parent path, and we don't want to swap colors twice--
        // that would leave us right where we started.
        if (isCompoundPathChild(item)) continue;

        const itemColor = applyToStroke ? item.strokeColor : item.fillColor;
        if (!itemColor || !itemColor.gradient || !itemColor.gradient.stops.length === 2) {
            // Only one color; nothing to swap
            continue;
        } else if (!itemColor.gradient.stops[0].color.equals(itemColor.gradient.stops[1].color)) {
            // Changing one color of an existing gradient
            changed = true;
            const colors = [
                itemColor.gradient.stops[1].color,
                itemColor.gradient.stops[0].color
            ];
            // There seems to be a bug where setting colors on stops doesn't always update the view, so set gradient.
            itemColor.gradient = {stops: colors, radial: itemColor.gradient.radial};
        }
    }
    return changed;
};

/**
 * Called when setting gradient type
 * @param {GradientType} gradientType gradient type
 * @param {?boolean} applyToStroke True if changing the selection's stroke, false if changing its fill.
 * @param {?string} textEditTargetId paper.Item.id of text editing target, if any
 * @return {boolean} Whether the color application actually changed visibly.
 */
const applyGradientTypeToSelection = function (gradientType, applyToStroke, textEditTargetId) {
    const items = _getColorStateListeners(textEditTargetId);
    let changed = false;
    for (let item of items) {
        if (item.parent instanceof paper.CompoundPath) {
            item = item.parent;
        }

        const itemColorProp = applyToStroke ? 'strokeColor' : 'fillColor';
        const itemColor = item[itemColorProp];

        const hasGradient = itemColor && itemColor.gradient;

        let itemColor1;
        if (itemColor === null || itemColor.alpha === 0) {
            // Transparent
            itemColor1 = null;
        } else if (!hasGradient) {
            // Solid color
            itemColor1 = itemColor;
        } else if (!itemColor.gradient.stops[0] || itemColor.gradient.stops[0].color.alpha === 0) {
            // Gradient where first color is transparent
            itemColor1 = null;
        } else {
            // Gradient where first color is not transparent
            itemColor1 = itemColor.gradient.stops[0].color;
        }

        let itemColor2;
        if (!hasGradient || !itemColor.gradient.stops[1]) {
            // If item color is solid or a gradient that has no 2nd color, set the 2nd color based on the first color
            itemColor2 = generateSecondaryColor(itemColor1);
        } else if (itemColor.gradient.stops[1].color.alpha === 0) {
            // Gradient has 2nd color which is transparent
            itemColor2 = null;
        } else {
            // Gradient has 2nd color which is not transparent
            itemColor2 = itemColor.gradient.stops[1].color;
        }

        if (gradientType === GradientTypes.SOLID) {
            if (itemColor && itemColor.gradient) {
                changed = true;
                item[itemColorProp] = itemColor1;
            }
            continue;
        }

        // If this is a stroke, we don't display it as having a gradient in the color picker
        // if there's no stroke width. Then treat it as if it doesn't have a gradient.
        let hasDisplayGradient = hasGradient;
        if (applyToStroke) hasDisplayGradient = hasGradient && item.strokeWidth > 0;
        if (!hasDisplayGradient) {
            const noColorOriginally = !itemColor ||
                (itemColor.gradient &&
                itemColor.gradient.stops &&
                itemColor.gradient.stops[0].color.alpha === 0);
            const addingStroke = applyToStroke && item.strokeWidth === 0;
            const hasGradientNow = itemColor1 || itemColor2;
            if ((noColorOriginally || addingStroke) && hasGradientNow) {
                if (applyToStroke) {
                    // Make outline visible
                    item.strokeWidth = 1;
                }
                // Make the gradient black to white
                itemColor1 = 'black';
                itemColor2 = 'white';
            }
        }

        if (itemColor1 === null) {
            itemColor1 = getColorForTransparent(itemColor2);
        }
        if (itemColor2 === null) {
            itemColor2 = getColorForTransparent(itemColor1);
        }

        let gradientTypeDiffers = false;
        // If the item's gradient type differs from the gradient type we want to apply, then we change it
        switch (gradientType) {
        case GradientTypes.RADIAL: {
            const hasRadialGradient = hasDisplayGradient && itemColor.gradient.radial;
            gradientTypeDiffers = !hasRadialGradient;
            break;
        }
        case GradientTypes.HORIZONTAL: {
            const hasHorizontalGradient = hasDisplayGradient && !itemColor.gradient.radial &&
                Math.abs(itemColor.origin.y - itemColor.destination.y) < 1e-8;
            gradientTypeDiffers = !hasHorizontalGradient;
            break;
        }
        case GradientTypes.VERTICAL: {
            const hasVerticalGradient = hasDisplayGradient && !itemColor.gradient.radial &&
                Math.abs(itemColor.origin.x - itemColor.destination.x) < 1e-8;
            gradientTypeDiffers = !hasVerticalGradient;
            break;
        }
        }

        if (gradientTypeDiffers) {
            changed = true;
            item[itemColorProp] = createGradientObject(
                itemColor1,
                itemColor2,
                gradientType,
                item.bounds,
                null, // radialCenter
                item.strokeWidth
            );
        }
    }
    return changed;
};

/**
 * Called when setting stroke width
 * @param {number} value New stroke width
 * @param {?string} textEditTargetId paper.Item.id of text editing target, if any
 * @return {boolean} Whether the color application actually changed visibly.
 */
const applyStrokeWidthToSelection = function (value, textEditTargetId) {
    let changed = false;
    const items = _getColorStateListeners(textEditTargetId);
    for (let item of items) {
        if (item.parent instanceof paper.CompoundPath) {
            item = item.parent;
        }
        if (isGroup(item)) {
            continue;
        } else if (item.strokeWidth !== value) {
            item.strokeWidth = value;
            changed = true;
        }
    }
    return changed;
};

const _colorStateFromGradient = gradient => {
    const colorState = {};
    // Scratch only recognizes 2 color gradients
    if (gradient.stops.length === 2) {
        if (gradient.radial) {
            colorState.gradientType = GradientTypes.RADIAL;
        } else {
            // Always use horizontal for linear gradients, since horizontal and vertical gradients
            // are the same with rotation. We don't want to show MIXED just because anything is rotated.
            colorState.gradientType = GradientTypes.HORIZONTAL;
        }
        colorState.primary = gradient.stops[0].color.alpha === 0 ?
            null :
            gradient.stops[0].color;
        colorState.secondary = gradient.stops[1].color.alpha === 0 ?
            null :
            gradient.stops[1].color;
    } else {
        if (gradient.stops.length < 2) log.warn(`Gradient has ${gradient.stops.length} stop(s)`);

        colorState.primary = MIXED;
        colorState.secondary = MIXED;
    }

    return colorState;
};

/**
 * Get state of colors and stroke width for selection
 * @param {!Array<paper.Item>} selectedItems Selected paper items
 * @param {?boolean} bitmapMode True if the item is being selected in bitmap mode
 * @return {?object} Object of strokeColor, strokeWidth, fillColor, thickness of the selection.
 *     Gives MIXED when there are mixed values for a color, and null for transparent.
 *     Gives null when there are mixed values for stroke width.
 *     Thickness is line thickness, used in the bitmap editor
 */
const getColorsFromSelection = function (selectedItems, bitmapMode) {
    // TODO: DRY out this code
    // TODO: Handle cases in which the paper.Color of the selection is an RGB color, and convert to an HSB color
    let selectionFillColor;
    let selectionFillColor2;
    let selectionStrokeColor;
    let selectionStrokeColor2;
    let selectionStrokeWidth;
    let selectionThickness;
    let selectionFillGradientType;
    let selectionStrokeGradientType;
    let firstChild = true;

    for (let item of selectedItems) {
        if (item.parent instanceof paper.CompoundPath) {
            // Compound path children inherit fill and stroke color from their parent.
            item = item.parent;
        }
        let itemFillColor;
        let itemFillColor2;
        let itemStrokeColor;
        let itemStrokeColor2;
        let itemFillGradientType = GradientTypes.SOLID;
        let itemStrokeGradientType = GradientTypes.SOLID;

        if (!isGroup(item)) {
            if (item.fillColor) {
                // hack bc text items with null fill can't be detected by fill-hitTest anymore
                if (isPointTextItem(item) && item.fillColor.alpha === 0) {
                    itemFillColor = null;
                } else if (item.fillColor.type === 'gradient') {
                    const {primary, secondary, gradientType} = _colorStateFromGradient(item.fillColor.gradient);
                    itemFillColor = primary;
                    itemFillColor2 = secondary;
                    itemFillGradientType = gradientType;
                } else {
                    itemFillColor = item.fillColor.alpha === 0 ?
                        null :
                        item.fillColor;
                    itemFillColor2 = null;
                }
            }
            if (item.strokeColor) {
                if (item.strokeColor.type === 'gradient') {
                    const {primary, secondary, gradientType} = _colorStateFromGradient(item.strokeColor.gradient);

                    let strokeColor = primary;
                    const strokecolor2 = secondary;
                    let strokeGradientType = gradientType;

                    // If the item's stroke width is 0, pretend the stroke color is null
                    if (!item.strokeWidth) {
                        strokeColor = null;
                        // Hide the second color. This way if you choose a second color, remove
                        // the gradient, and re-add it, your second color selection is preserved.
                        strokeGradientType = GradientTypes.SOLID;
                    }

                    // Stroke color is fill color in bitmap
                    if (bitmapMode) {
                        itemFillColor = strokeColor;
                        itemFillColor2 = strokecolor2;
                        itemFillGradientType = strokeGradientType;
                    } else {
                        itemStrokeColor = strokeColor;
                        itemStrokeColor2 = strokecolor2;
                        itemStrokeGradientType = strokeGradientType;
                    }
                } else {
                    const strokeColor = item.strokeColor.alpha === 0 || !item.strokeWidth ?
                        null :
                        item.strokeColor;

                    // Stroke color is fill color in bitmap
                    if (bitmapMode) {
                        itemFillColor = strokeColor;
                    } else {
                        itemStrokeColor = strokeColor;
                    }
                }
            } else {
                itemStrokeColor = null;
                itemStrokeColor2 = null;
            }
            // check every style against the first of the items
            if (firstChild) {
                firstChild = false;
                selectionFillColor = itemFillColor;
                selectionFillColor2 = itemFillColor2;
                selectionStrokeColor = itemStrokeColor;
                selectionStrokeColor2 = itemStrokeColor2;
                selectionFillGradientType = itemFillGradientType;
                selectionStrokeGradientType = itemStrokeGradientType;
                selectionStrokeWidth = itemStrokeColor || itemStrokeColor2 ? item.strokeWidth : 0;
                if (item.strokeWidth && item.data && item.data.zoomLevel) {
                    selectionThickness = item.strokeWidth / item.data.zoomLevel;
                }
            }

            if (!colorsEqual(itemFillColor, selectionFillColor)) {
                selectionFillColor = MIXED;
            }
            if (!colorsEqual(itemFillColor2, selectionFillColor2)) {
                selectionFillColor2 = MIXED;
            }
            if (itemFillGradientType !== selectionFillGradientType) {
                selectionFillGradientType = GradientTypes.SOLID;
                selectionFillColor = MIXED;
                selectionFillColor2 = MIXED;
            }
            if (itemStrokeGradientType !== selectionStrokeGradientType) {
                selectionStrokeGradientType = GradientTypes.SOLID;
                selectionStrokeColor = MIXED;
                selectionStrokeColor2 = MIXED;
            }
            if (itemStrokeColor !== selectionStrokeColor) {
                selectionStrokeColor = MIXED;
            }
            if (itemStrokeColor2 !== selectionStrokeColor2) {
                selectionStrokeColor2 = MIXED;
            }
            const itemStrokeWidth = itemStrokeColor || itemStrokeColor2 ? item.strokeWidth : 0;
            if (selectionStrokeWidth !== itemStrokeWidth) {
                selectionStrokeWidth = null;
            }
        }
    }
    // Convert selection gradient type from horizontal to vertical if first item is exactly vertical
    // This is because up to this point, we assume all non-radial gradients are horizontal
    // Otherwise, if there were a mix of horizontal/vertical gradient types in the selection, they would show as MIXED
    // whereas we want them to show as horizontal (or vertical if the first item is vertical)
    if (selectedItems && selectedItems.length) {
        let firstItem = selectedItems[0];
        if (firstItem.parent instanceof paper.CompoundPath) firstItem = firstItem.parent;

        if (selectionFillGradientType !== GradientTypes.SOLID) {
            // Stroke color is fill color in bitmap if fill color is missing
            // TODO: this whole "treat horizontal/vertical gradients specially" logic is janky; refactor at some point
            const firstItemColor = (bitmapMode && firstItem.strokeColor) ? firstItem.strokeColor : firstItem.fillColor;
            const direction = firstItemColor.destination.subtract(firstItemColor.origin);
            if (Math.abs(direction.angle) === 90) {
                selectionFillGradientType = GradientTypes.VERTICAL;
            }
        }

        if (selectionStrokeGradientType !== GradientTypes.SOLID) {
            const direction = firstItem.strokeColor.destination.subtract(firstItem.strokeColor.origin);
            if (Math.abs(direction.angle) === 90) {
                selectionStrokeGradientType = GradientTypes.VERTICAL;
            }
        }
    }
    if (bitmapMode) {
        return {
            fillColor: selectionFillColor ? selectionFillColor : null,
            fillColor2: selectionFillColor2 ? selectionFillColor2 : null,
            fillGradientType: selectionFillGradientType,
            thickness: selectionThickness
        };
    }
    return {
        fillColor: selectionFillColor ? selectionFillColor : null,
        fillColor2: selectionFillColor2 ? selectionFillColor2 : null,
        fillGradientType: selectionFillGradientType,
        strokeColor: selectionStrokeColor ? selectionStrokeColor : null,
        strokeColor2: selectionStrokeColor2 ? selectionStrokeColor2 : null,
        strokeGradientType: selectionStrokeGradientType,
        strokeWidth: selectionStrokeWidth || (selectionStrokeWidth === null) ? selectionStrokeWidth : 0
    };
};

const styleBlob = function (path, options) {
    if (options.isEraser) {
        path.fillColor = 'white';
    } else if (options.fillColor) {
        path.fillColor = options.fillColor;
    } else {
        // Make sure something visible is drawn
        path.fillColor = 'black';
    }
};

const styleCursorPreview = function (path, options) {
    if (options.isEraser) {
        path.fillColor = 'white';
        path.strokeColor = 'cornflowerblue';
        path.strokeWidth = 1;
    } else if (options.fillColor) {
        path.fillColor = options.fillColor;
    } else {
        // Make sure something visible is drawn
        path.fillColor = 'black';
    }
};

const styleShape = function (path, options) {
    for (const colorKey of ['fillColor', 'strokeColor']) {
        if (options[colorKey] === null) {
            path[colorKey] = null;
        } else if (options[colorKey].gradientType === GradientTypes.SOLID) {
            path[colorKey] = options[colorKey].primary;
        } else {
            const {primary, secondary, gradientType} = options[colorKey];
            path[colorKey] = createGradientObject(
                primary,
                secondary,
                gradientType,
                path.bounds,
                null, // radialCenter
                options.strokeWidth // minimum gradient size is stroke width
            );
        }
    }

    if (options.hasOwnProperty('strokeWidth')) path.strokeWidth = options.strokeWidth;
};

export {
    applyColorToSelection,
    applyGradientTypeToSelection,
    applyStrokeWidthToSelection,
    colorsEqual,
    createGradientObject,
    getColorsFromSelection,
    generateSecondaryColor,
    MIXED,
    styleBlob,
    styleShape,
    styleCursorPreview,
    swapColorsInSelection
};
