import paper from '@scratch/paper';
import PropTypes from 'prop-types';
import log from '../log/log';

import React from 'react';
import {connect} from 'react-redux';
import PaintEditorComponent from '../components/paint-editor/paint-editor.jsx';

import {changeMode} from '../reducers/modes';
import {changeFormat} from '../reducers/format';
import {undo, redo, undoSnapshot} from '../reducers/undo';
import {clearSelectedItems, setSelectedItems} from '../reducers/selected-items';
import {deactivateEyeDropper} from '../reducers/eye-dropper';
import {setTextEditTarget} from '../reducers/text-edit-target';
import {updateViewBounds} from '../reducers/view-bounds';
import {setLayout} from '../reducers/layout';

import {getRaster, hideGuideLayers, showGuideLayers} from '../helper/layer';
import {commitSelectionToBitmap, convertToBitmap, convertToVector, getHitBounds} from '../helper/bitmap';
import {performUndo, performRedo, performSnapshot, shouldShowUndo, shouldShowRedo} from '../helper/undo';
import {bringToFront, sendBackward, sendToBack, bringForward} from '../helper/order';
import {groupSelection, ungroupSelection} from '../helper/group';
import {scaleWithStrokes} from '../helper/math';
import {getSelectedLeafItems} from '../helper/selection';
import {ART_BOARD_WIDTH, ART_BOARD_HEIGHT, SVG_ART_BOARD_WIDTH, SVG_ART_BOARD_HEIGHT} from '../helper/view';
import {resetZoom, zoomOnSelection} from '../helper/view';
import EyeDropperTool from '../helper/tools/eye-dropper';

import Modes from '../lib/modes';
import {BitmapModes} from '../lib/modes';
import Formats from '../lib/format';
import {isBitmap, isVector} from '../lib/format';
import bindAll from 'lodash.bindall';

/**
 * The top-level paint editor component. See README for more details on usage.
 *
 * <PaintEditor
 *     image={optionalImage}
 *     imageId={optionalId}
 *     imageFormat='svg'
 *     rotationCenterX={optionalCenterPointX}
 *     rotationCenterY={optionalCenterPointY}
 *     rtl={true|false}
 *     onUpdateImage={handleUpdateImageFunction}
 *     zoomLevelId={optionalZoomLevelId}
 * />
 *
 * `image`: may either be nothing, an SVG string or a base64 data URI)
 * SVGs of up to size 480 x 360 will fit into the view window of the paint editor,
 * while bitmaps of size up to 960 x 720 will fit into the paint editor. One unit
 * of an SVG will appear twice as tall and wide as one unit of a bitmap. This quirky
 * import behavior comes from needing to support legacy projects in Scratch.
 *
 * `imageId`: If this parameter changes, then the paint editor will be cleared, the
 * undo stack reset, and the image re-imported.
 *
 * `imageFormat`: 'svg', 'png', or 'jpg'. Other formats are currently not supported.
 *
 * `rotationCenterX`: x coordinate relative to the top left corner of the sprite of
 * the point that should be centered.
 *
 * `rotationCenterY`: y coordinate relative to the top left corner of the sprite of
 * the point that should be centered.
 *
 * `rtl`: True if the paint editor should be laid out right to left (meant for right
 * to left languages)
 *
 * `onUpdateImage`: A handler called with the new image (either an SVG string or an
 * ImageData) each time the drawing is edited.
 *
 * `zoomLevelId`: All costumes with the same zoom level ID will share the same saved
 * zoom level. When a new zoom level ID is encountered, the paint editor will zoom to
 * fit the current costume comfortably. Leave undefined to perform no zoom to fit.
 */
class PaintEditor extends React.Component {
    static get ZOOM_INCREMENT () {
        return 0.5;
    }
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleUpdateImage',
            'handleUpdateBitmap',
            'handleUpdateVector',
            'handleUndo',
            'handleRedo',
            'handleSendBackward',
            'handleSendForward',
            'handleSendToBack',
            'handleSendToFront',
            'handleSetSelectedItems',
            'handleGroup',
            'handleUngroup',
            'handleZoomIn',
            'handleZoomOut',
            'handleZoomReset',
            'canRedo',
            'canUndo',
            'switchMode',
            'onMouseDown',
            'setCanvas',
            'setTextArea',
            'startEyeDroppingLoop',
            'stopEyeDroppingLoop'
        ]);
        this.state = {
            canvas: null,
            colorInfo: null
        };
        // When isSwitchingFormats is true, the format is about to switch, but isn't done switching.
        // This gives currently active tools a chance to finish what they were doing.
        this.isSwitchingFormats = false;
        this.props.setLayout(this.props.rtl ? 'rtl' : 'ltr');
    }
    componentDidMount () {
        document.addEventListener('keydown', (/* event */) => {
            // Don't activate keyboard shortcuts during text editing
            if (!this.props.textEditing) {
                // @todo disabling keyboard shortcuts because there is a bug
                // that is interfering with text editing.
                // this.props.onKeyPress(event);
            }
        });
        // document listeners used to detect if a mouse is down outside of the
        // canvas, and should therefore stop the eye dropper
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('touchstart', this.onMouseDown);
    }
    componentWillReceiveProps (newProps) {
        if ((isVector(this.props.format) && newProps.format === Formats.BITMAP) ||
                (isBitmap(this.props.format) && newProps.format === Formats.VECTOR)) {
            this.isSwitchingFormats = true;
        }
        if (isVector(this.props.format) && isBitmap(newProps.format)) {
            this.switchMode(Formats.BITMAP);
        } else if (isVector(newProps.format) && isBitmap(this.props.format)) {
            this.switchMode(Formats.VECTOR);
        }
        if (newProps.rtl !== this.props.rtl) {
            this.props.setLayout(newProps.rtl ? 'rtl' : 'ltr');
        }
    }
    componentDidUpdate (prevProps) {
        if (this.props.isEyeDropping && !prevProps.isEyeDropping) {
            this.startEyeDroppingLoop();
        } else if (!this.props.isEyeDropping && prevProps.isEyeDropping) {
            this.stopEyeDroppingLoop();
        } else if (this.props.isEyeDropping && this.props.viewBounds !== prevProps.viewBounds) {
            this.props.previousTool.activate();
            this.props.onDeactivateEyeDropper();
            this.stopEyeDroppingLoop();
        }
        if (this.props.format === Formats.VECTOR && isBitmap(prevProps.format)) {
            this.isSwitchingFormats = false;
            convertToVector(this.props.clearSelectedItems, this.handleUpdateImage);
        } else if (isVector(prevProps.format) && this.props.format === Formats.BITMAP) {
            this.isSwitchingFormats = false;
            convertToBitmap(this.props.clearSelectedItems, this.handleUpdateImage);
        }
    }
    componentWillUnmount () {
        document.removeEventListener('keydown', this.props.onKeyPress);
        this.stopEyeDroppingLoop();
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('touchstart', this.onMouseDown);
    }
    switchMode (newFormat) {
        if (isVector(newFormat)) {
            switch (this.props.mode) {
            case Modes.BIT_BRUSH:
                this.props.changeMode(Modes.BRUSH);
                break;
            case Modes.BIT_LINE:
                this.props.changeMode(Modes.LINE);
                break;
            case Modes.BIT_OVAL:
                this.props.changeMode(Modes.OVAL);
                break;
            case Modes.BIT_RECT:
                this.props.changeMode(Modes.RECT);
                break;
            case Modes.BIT_TEXT:
                this.props.changeMode(Modes.TEXT);
                break;
            case Modes.BIT_FILL:
                this.props.changeMode(Modes.FILL);
                break;
            case Modes.BIT_ERASER:
                this.props.changeMode(Modes.ERASER);
                break;
            case Modes.BIT_SELECT:
                this.props.changeMode(Modes.SELECT);
                break;
            default:
                log.error(`Mode not handled: ${this.props.mode}`);
                this.props.changeMode(Modes.BRUSH);
            }
        } else if (isBitmap(newFormat)) {
            switch (this.props.mode) {
            case Modes.BRUSH:
                this.props.changeMode(Modes.BIT_BRUSH);
                break;
            case Modes.LINE:
                this.props.changeMode(Modes.BIT_LINE);
                break;
            case Modes.OVAL:
                this.props.changeMode(Modes.BIT_OVAL);
                break;
            case Modes.RECT:
                this.props.changeMode(Modes.BIT_RECT);
                break;
            case Modes.TEXT:
                this.props.changeMode(Modes.BIT_TEXT);
                break;
            case Modes.FILL:
                this.props.changeMode(Modes.BIT_FILL);
                break;
            case Modes.ERASER:
                this.props.changeMode(Modes.BIT_ERASER);
                break;
            case Modes.RESHAPE:
                /* falls through */
            case Modes.SELECT:
                this.props.changeMode(Modes.BIT_SELECT);
                break;
            default:
                log.error(`Mode not handled: ${this.props.mode}`);
                this.props.changeMode(Modes.BIT_BRUSH);
            }
        }
    }
    handleUpdateImage (skipSnapshot) {
        // If in the middle of switching formats, rely on the current mode instead of format.
        let actualFormat = this.props.format;
        if (this.isSwitchingFormats) {
            actualFormat = BitmapModes[this.props.mode] ? Formats.BITMAP : Formats.VECTOR;
        }
        if (isBitmap(actualFormat)) {
            this.handleUpdateBitmap(skipSnapshot);
        } else if (isVector(actualFormat)) {
            this.handleUpdateVector(skipSnapshot);
        }
    }
    handleUpdateBitmap (skipSnapshot) {
        if (!getRaster().loaded) {
            // In general, callers of updateImage should wait for getRaster().loaded = true before
            // calling updateImage.
            // However, this may happen if the user is rapidly undoing/redoing. In this case it's safe
            // to skip the update.
            log.warn('Bitmap layer should be loaded before calling updateImage.');
            return;
        }
        // Plaster the selection onto the raster layer before exporting, if there is a selection.
        const plasteredRaster = getRaster().getSubRaster(getRaster().bounds);
        plasteredRaster.remove(); // Don't insert
        const selectedItems = getSelectedLeafItems();
        if (selectedItems.length === 1 && selectedItems[0] instanceof paper.Raster) {
            if (!selectedItems[0].loaded ||
                (selectedItems[0].data && selectedItems[0].data.expanded && !selectedItems[0].data.expanded.loaded)) {
                log.warn('Bitmap layer should be loaded before calling updateImage.');
                return;
            }
            commitSelectionToBitmap(selectedItems[0], plasteredRaster);
        }
        const rect = getHitBounds(plasteredRaster);
        this.props.onUpdateImage(
            false /* isVector */,
            plasteredRaster.getImageData(rect),
            (ART_BOARD_WIDTH / 2) - rect.x,
            (ART_BOARD_HEIGHT / 2) - rect.y);

        if (!skipSnapshot) {
            performSnapshot(this.props.undoSnapshot, Formats.BITMAP);
        }
    }
    handleUpdateVector (skipSnapshot) {
        const guideLayers = hideGuideLayers(true /* includeRaster */);

        // Export at 0.5x
        scaleWithStrokes(paper.project.activeLayer, .5, new paper.Point());
        const bounds = paper.project.activeLayer.bounds;
        // @todo generate view box
        this.props.onUpdateImage(
            true /* isVector */,
            paper.project.exportSVG({
                asString: true,
                bounds: 'content',
                matrix: new paper.Matrix().translate(-bounds.x, -bounds.y)
            }),
            (SVG_ART_BOARD_WIDTH / 2) - bounds.x,
            (SVG_ART_BOARD_HEIGHT / 2) - bounds.y);
        scaleWithStrokes(paper.project.activeLayer, 2, new paper.Point());
        paper.project.activeLayer.applyMatrix = true;

        showGuideLayers(guideLayers);

        if (!skipSnapshot) {
            performSnapshot(this.props.undoSnapshot, Formats.VECTOR);
        }
    }
    handleUndo () {
        performUndo(this.props.undoState, this.props.onUndo, this.handleSetSelectedItems, this.handleUpdateImage);
    }
    handleRedo () {
        performRedo(this.props.undoState, this.props.onRedo, this.handleSetSelectedItems, this.handleUpdateImage);
    }
    handleGroup () {
        groupSelection(this.props.clearSelectedItems, this.handleSetSelectedItems, this.handleUpdateImage);
    }
    handleUngroup () {
        ungroupSelection(this.props.clearSelectedItems, this.handleSetSelectedItems, this.handleUpdateImage);
    }
    handleSendBackward () {
        sendBackward(this.handleUpdateImage);
    }
    handleSendForward () {
        bringForward(this.handleUpdateImage);
    }
    handleSendToBack () {
        sendToBack(this.handleUpdateImage);
    }
    handleSendToFront () {
        bringToFront(this.handleUpdateImage);
    }
    handleSetSelectedItems () {
        this.props.setSelectedItems(this.props.format);
    }
    canUndo () {
        return shouldShowUndo(this.props.undoState);
    }
    canRedo () {
        return shouldShowRedo(this.props.undoState);
    }
    handleZoomIn () {
        zoomOnSelection(PaintEditor.ZOOM_INCREMENT);
        this.props.updateViewBounds(paper.view.matrix);
        this.handleSetSelectedItems();
    }
    handleZoomOut () {
        zoomOnSelection(-PaintEditor.ZOOM_INCREMENT);
        this.props.updateViewBounds(paper.view.matrix);
        this.handleSetSelectedItems();
    }
    handleZoomReset () {
        resetZoom();
        this.props.updateViewBounds(paper.view.matrix);
        this.handleSetSelectedItems();
    }
    setCanvas (canvas) {
        this.setState({canvas: canvas});
        this.canvas = canvas;
    }
    setTextArea (element) {
        this.setState({textArea: element});
    }
    onMouseDown (event) {
        if (event.target === paper.view.element &&
                document.activeElement instanceof HTMLInputElement) {
            document.activeElement.blur();
        }

        if (event.target !== paper.view.element && event.target !== this.state.textArea) {
            // Exit text edit mode if you click anywhere outside of canvas
            this.props.removeTextEditTarget();
        }

        if (this.props.isEyeDropping) {
            const colorString = this.eyeDropper.colorString;
            const callback = this.props.changeColorToEyeDropper;

            this.eyeDropper.remove();
            if (!this.eyeDropper.hideLoupe) {
                // If not hide loupe, that means the click is inside the canvas,
                // so apply the new color
                callback(colorString);
            }
            this.props.previousTool.activate();
            this.props.onDeactivateEyeDropper();
            this.stopEyeDroppingLoop();
        }
    }
    startEyeDroppingLoop () {
        this.eyeDropper = new EyeDropperTool(
            this.canvas,
            paper.project.view.bounds.width,
            paper.project.view.bounds.height,
            paper.project.view.pixelRatio,
            paper.view.zoom,
            paper.project.view.bounds.x,
            paper.project.view.bounds.y,
            isBitmap(this.props.format)
        );
        this.eyeDropper.pickX = -1;
        this.eyeDropper.pickY = -1;
        this.eyeDropper.activate();

        this.intervalId = setInterval(() => {
            const colorInfo = this.eyeDropper.getColorInfo(
                this.eyeDropper.pickX,
                this.eyeDropper.pickY,
                this.eyeDropper.hideLoupe
            );
            if (!colorInfo) return;
            if (
                this.state.colorInfo === null ||
                this.state.colorInfo.x !== colorInfo.x ||
                this.state.colorInfo.y !== colorInfo.y
            ) {
                this.setState({
                    colorInfo: colorInfo
                });
            }
        }, 30);
    }
    stopEyeDroppingLoop () {
        clearInterval(this.intervalId);
        this.setState({colorInfo: null});
    }
    render () {
        return (
            <PaintEditorComponent
                canRedo={this.canRedo}
                canUndo={this.canUndo}
                canvas={this.state.canvas}
                colorInfo={this.state.colorInfo}
                format={this.props.format}
                image={this.props.image}
                imageFormat={this.props.imageFormat}
                imageId={this.props.imageId}
                isEyeDropping={this.props.isEyeDropping}
                name={this.props.name}
                rotationCenterX={this.props.rotationCenterX}
                rotationCenterY={this.props.rotationCenterY}
                rtl={this.props.rtl}
                setCanvas={this.setCanvas}
                setTextArea={this.setTextArea}
                textArea={this.state.textArea}
                zoomLevelId={this.props.zoomLevelId}
                onGroup={this.handleGroup}
                onRedo={this.handleRedo}
                onSendBackward={this.handleSendBackward}
                onSendForward={this.handleSendForward}
                onSendToBack={this.handleSendToBack}
                onSendToFront={this.handleSendToFront}
                onSwitchToBitmap={this.props.handleSwitchToBitmap}
                onSwitchToVector={this.props.handleSwitchToVector}
                onUndo={this.handleUndo}
                onUngroup={this.handleUngroup}
                onUpdateImage={this.handleUpdateImage}
                onUpdateName={this.props.onUpdateName}
                onZoomIn={this.handleZoomIn}
                onZoomOut={this.handleZoomOut}
                onZoomReset={this.handleZoomReset}
            />
        );
    }
}

PaintEditor.propTypes = {
    changeColorToEyeDropper: PropTypes.func,
    changeMode: PropTypes.func.isRequired,
    clearSelectedItems: PropTypes.func.isRequired,
    format: PropTypes.oneOf(Object.keys(Formats)), // Internal, up-to-date data format
    handleSwitchToBitmap: PropTypes.func.isRequired,
    handleSwitchToVector: PropTypes.func.isRequired,
    image: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.instanceOf(HTMLImageElement)
    ]),
    imageFormat: PropTypes.string, // The incoming image's data format, used during import
    imageId: PropTypes.string,
    isEyeDropping: PropTypes.bool,
    mode: PropTypes.oneOf(Object.keys(Modes)).isRequired,
    name: PropTypes.string,
    onDeactivateEyeDropper: PropTypes.func.isRequired,
    onKeyPress: PropTypes.func.isRequired,
    onRedo: PropTypes.func.isRequired,
    onUndo: PropTypes.func.isRequired,
    onUpdateImage: PropTypes.func.isRequired,
    onUpdateName: PropTypes.func.isRequired,
    previousTool: PropTypes.shape({ // paper.Tool
        activate: PropTypes.func.isRequired,
        remove: PropTypes.func.isRequired
    }),
    removeTextEditTarget: PropTypes.func.isRequired,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    rtl: PropTypes.bool,
    setLayout: PropTypes.func.isRequired,
    setSelectedItems: PropTypes.func.isRequired,
    textEditing: PropTypes.bool.isRequired,
    undoSnapshot: PropTypes.func.isRequired,
    undoState: PropTypes.shape({
        stack: PropTypes.arrayOf(PropTypes.object).isRequired,
        pointer: PropTypes.number.isRequired
    }),
    updateViewBounds: PropTypes.func.isRequired,
    viewBounds: PropTypes.instanceOf(paper.Matrix).isRequired,
    zoomLevelId: PropTypes.string
};

const mapStateToProps = state => ({
    changeColorToEyeDropper: state.scratchPaint.color.eyeDropper.callback,
    clipboardItems: state.scratchPaint.clipboard.items,
    format: state.scratchPaint.format,
    isEyeDropping: state.scratchPaint.color.eyeDropper.active,
    mode: state.scratchPaint.mode,
    pasteOffset: state.scratchPaint.clipboard.pasteOffset,
    previousTool: state.scratchPaint.color.eyeDropper.previousTool,
    selectedItems: state.scratchPaint.selectedItems,
    textEditing: state.scratchPaint.textEditTarget !== null,
    undoState: state.scratchPaint.undo,
    viewBounds: state.scratchPaint.viewBounds
});
const mapDispatchToProps = dispatch => ({
    onKeyPress: event => {
        if (event.key === 'e') {
            dispatch(changeMode(Modes.ERASER));
        } else if (event.key === 'b') {
            dispatch(changeMode(Modes.BRUSH));
        } else if (event.key === 'l') {
            dispatch(changeMode(Modes.LINE));
        } else if (event.key === 's') {
            dispatch(changeMode(Modes.SELECT));
        } else if (event.key === 'w') {
            dispatch(changeMode(Modes.RESHAPE));
        } else if (event.key === 'f') {
            dispatch(changeMode(Modes.FILL));
        } else if (event.key === 't') {
            dispatch(changeMode(Modes.TEXT));
        } else if (event.key === 'c') {
            dispatch(changeMode(Modes.OVAL));
        } else if (event.key === 'r') {
            dispatch(changeMode(Modes.RECT));
        }
    },
    changeMode: mode => {
        dispatch(changeMode(mode));
    },
    clearSelectedItems: () => {
        dispatch(clearSelectedItems());
    },
    handleSwitchToBitmap: () => {
        dispatch(changeFormat(Formats.BITMAP));
    },
    handleSwitchToVector: () => {
        dispatch(changeFormat(Formats.VECTOR));
    },
    removeTextEditTarget: () => {
        dispatch(setTextEditTarget());
    },
    setLayout: layout => {
        dispatch(setLayout(layout));
    },
    setSelectedItems: format => {
        dispatch(setSelectedItems(getSelectedLeafItems(), isBitmap(format)));
    },
    onDeactivateEyeDropper: () => {
        // set redux values to default for eye dropper reducer
        dispatch(deactivateEyeDropper());
    },
    onUndo: format => {
        dispatch(undo(format));
    },
    onRedo: format => {
        dispatch(redo(format));
    },
    undoSnapshot: snapshot => {
        dispatch(undoSnapshot(snapshot));
    },
    updateViewBounds: matrix => {
        dispatch(updateViewBounds(matrix));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PaintEditor);
