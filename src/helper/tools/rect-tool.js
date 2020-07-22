import paper from '@scratch/paper';
import Modes from '../../lib/modes';
import ShapeTool from './shape-tool';

/**
 * Tool for drawing rectangles.
 */
class RectTool extends ShapeTool {
    /**
     * @param {function} setSelectedItems Callback to set the set of selected items in the Redux state
     * @param {function} clearSelectedItems Callback to clear the set of selected items in the Redux state
     * @param {function} setCursor Callback to set the visible mouse cursor
     * @param {!function} onUpdateImage A callback to call when the image visibly changes
     */
    constructor (setSelectedItems, clearSelectedItems, setCursor, onUpdateImage) {
        super(setSelectedItems, clearSelectedItems, setCursor, onUpdateImage, Modes.RECT);
        this.shapeConstructor = paper.Shape.Rectangle;
    }
}

export default RectTool;
