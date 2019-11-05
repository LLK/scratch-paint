import paper from '@scratch/paper';
import Modes from '../../lib/modes';
import {isGroup} from '../group';
import {isCompoundPathItem, getRootItem} from '../item';
import {checkPointsClose, snapDeltaToAngle} from '../math';
import {getActionBounds, CENTER} from '../view';
import {clearSelection, cloneSelection, getSelectedLeafItems, getSelectedRootItems, setItemSelection}
    from '../selection';
import {getDragCrosshairLayer} from '../layer';

/** Snap to align selection center to rotation center within this distance */
const SNAPPING_THRESHOLD = 4;

/**
 * Tool to handle dragging an item to reposition it in a selection mode.
 */
class MoveTool {
    /**
     * @param {Modes} mode Paint editor mode
     * @param {function} setSelectedItems Callback to set the set of selected items in the Redux state
     * @param {function} clearSelectedItems Callback to clear the set of selected items in the Redux state
     * @param {!function} onUpdateImage A callback to call when the image visibly changes
     * @param {?function} switchToTextTool A callback to call to switch to the text tool
     */
    constructor (mode, setSelectedItems, clearSelectedItems, onUpdateImage, switchToTextTool) {
        this.mode = mode;
        this.setSelectedItems = setSelectedItems;
        this.clearSelectedItems = clearSelectedItems;
        this.selectedItems = null;
        this.selectionCenter = null;
        this.onUpdateImage = onUpdateImage;
        this.switchToTextTool = switchToTextTool;
        this.boundsPath = null;
        this.firstDrag = false;
    }

    /**
     * @param {!object} hitProperties Describes the mouse event
     * @param {!paper.HitResult} hitProperties.hitResult Data about the location of the mouse click
     * @param {?boolean} hitProperties.clone Whether to clone on mouse down (e.g. alt key held)
     * @param {?boolean} hitProperties.multiselect Whether to multiselect on mouse down (e.g. shift key held)
     * @param {?boolean} hitProperties.doubleClicked True if this is the second click in a short amout of time
     * @param {?boolean} hitProperties.subselect True if we allow selection of subgroups, false if we should
     *     select the whole group.
     */
    onMouseDown (hitProperties) {
        let item = hitProperties.hitResult.item;
        if (!hitProperties.subselect) {
            const root = getRootItem(hitProperties.hitResult.item);
            item = isCompoundPathItem(root) || isGroup(root) ? root : hitProperties.hitResult.item;
        }
        if (item.selected) {
            // Double click causes all points to be selected in subselect mode. If the target is text, it
            // enters text edit.
            if (hitProperties.doubleClicked) {
                if (!hitProperties.multiselect) {
                    if (this.switchToTextTool && item instanceof paper.PointText) {
                        this.switchToTextTool();
                        return;
                    }
                    clearSelection(this.clearSelectedItems);
                }
                this._select(item, true /* state */, hitProperties.subselect, true /* fullySelect */);
            } else if (hitProperties.multiselect) {
                this._select(item, false /* state */, hitProperties.subselect);
            }
        } else {
            // deselect all by default if multiselect isn't on
            if (!hitProperties.multiselect) {
                clearSelection(this.clearSelectedItems);
            }
            this._select(item, true, hitProperties.subselect);
        }
        if (hitProperties.clone) cloneSelection(hitProperties.subselect, this.onUpdateImage);

        this.selectedItems = this.mode === Modes.RESHAPE ? getSelectedLeafItems() : getSelectedRootItems();
        if (this.selectedItems.length === 0) {
            return;
        }

        let selectionBounds;
        for (const selectedItem of this.selectedItems) {
            if (selectionBounds) {
                selectionBounds = selectionBounds.unite(selectedItem.bounds);
            } else {
                selectionBounds = selectedItem.bounds;
            }
        }
        this.selectionCenter = selectionBounds.center;

        if (this.boundsPath) {
            this.selectedItems.push(this.boundsPath);
        }

        this.firstDrag = true;
    }
    setBoundsPath (boundsPath) {
        this.boundsPath = boundsPath;
    }
    /**
     * Sets the selection state of an item.
     * @param {!paper.Item} item Item to select or deselect
     * @param {?boolean} state True if item should be selected, false if deselected
     * @param {?boolean} subselect True if a subset of all points in an item are allowed to be
     *     selected, false if items must be selected all or nothing.
     * @param {?boolean} fullySelect True if in addition to the item being selected, all of its
     *     control points should be selected. False if the item should be selected but not its
     *     points. Only relevant when subselect is true.
     */
    _select (item, state, subselect, fullySelect) {
        if (subselect) {
            item.selected = false;
            if (fullySelect) {
                item.fullySelected = state;
            } else {
                item.selected = state;
            }
        } else {
            setItemSelection(item, state);
        }
        this.setSelectedItems();
    }
    onMouseDrag (event) {
        const point = event.point;
        const bounds = getActionBounds();
        
        point.x = Math.max(bounds.left, Math.min(point.x, bounds.right));
        point.y = Math.max(bounds.top, Math.min(point.y, bounds.bottom));
        const dragVector = point.subtract(event.downPoint);
        let snapVector;

        // Snapping to align center. Not in reshape mode, because reshape doesn't show center crosshair
        if (!event.modifiers.shift && this.mode !== Modes.RESHAPE) {
            if (checkPointsClose(
                this.selectionCenter.add(dragVector),
                CENTER,
                SNAPPING_THRESHOLD / paper.view.zoom /* threshold */)) {
                
                snapVector = center.subtract(this.selectionCenter);
            }
        }

        for (const item of this.selectedItems) {
            // add the position of the item before the drag started
            // for later use in the snap calculation
            if (!item.data.origPos) {
                item.data.origPos = item.position;
            }

            if (snapVector) {
                item.position = item.data.origPos.add(snapVector);
            } else if (event.modifiers.shift) {
                item.position = item.data.origPos.add(snapDeltaToAngle(dragVector, Math.PI / 4));
            } else {
                item.position = item.data.origPos.add(dragVector);
                if (checkPointsClose(item.position, CENTER, 2 / paper.view.zoom /* threshold */)) {
                    item.position = CENTER;
                }
            }
        }
        
        if (this.firstDrag) {
            // Show the center crosshair above the selected item while dragging.
            getDragCrosshairLayer().visible = true;
            this.firstDrag = false;
        }
        const opacity = Math.max(0, 1 - ((CENTER.getDistance(this.selectionCenter.add(dragVector)) / CENTER.x) * (4 * paper.view.zoom)));
        console.log(opacity);
        getDragCrosshairLayer().opacity = opacity;
    }
    onMouseUp () {
        this.firstDrag = false;
        let moved = false;
        // resetting the items origin point for the next usage
        for (const item of this.selectedItems) {
            if (item.data && item.data.origPos && !item.position.equals(item.data.origPos)) {
                moved = true;
            }
            item.data.origPos = null;
        }
        this.selectedItems = null;
        this.selectionCenter = null;

        if (moved) {
            this.onUpdateImage();
        }

        // Hide the crosshair we showed earlier.
        getDragCrosshairLayer().visible = false;
    }
}

export default MoveTool;
