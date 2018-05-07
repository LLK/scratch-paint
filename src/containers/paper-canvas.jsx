import classNames from 'classnames';
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import paper from '@scratch/paper';
import Formats from '../lib/format';
import Modes from '../lib/modes';
import {ModeClasses} from '../lib/modes';
import log from '../log/log';

import {trim} from '../helper/bitmap';
import {performSnapshot} from '../helper/undo';
import {undoSnapshot, clearUndoState} from '../reducers/undo';
import {clearRaster, getRaster, setupLayers, hideGuideLayers, showGuideLayers} from '../helper/layer';
import {deleteSelection, getSelectedLeafItems} from '../helper/selection';
import {clearSelectedItems, setSelectedItems} from '../reducers/selected-items';
import {ART_BOARD_WIDTH, ART_BOARD_HEIGHT, pan, resetZoom, zoomOnFixedPoint} from '../helper/view';
import {ensureClockwise, scaleWithStrokes} from '../helper/math';
import {clearHoveredItem} from '../reducers/hover';
import {clearPasteOffset} from '../reducers/clipboard';
import {updateViewBounds} from '../reducers/view-bounds';
import {changeFormat} from '../reducers/format';

import {isVector, isBitmap} from '../lib/format';

import styles from './paper-canvas.css';

class PaperCanvas extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'convertToBitmap',
            'convertToVector',
            'setCanvas',
            'importSvg',
            'handleKeyDown',
            'handleWheel',
            'switchCostume'
        ]);
    }
    componentDidMount () {
        document.addEventListener('keydown', this.handleKeyDown);
        paper.setup(this.canvas);
        resetZoom();

        const context = this.canvas.getContext('2d');
        context.webkitImageSmoothingEnabled = false;
        context.imageSmoothingEnabled = false;

        // Don't show handles by default
        paper.settings.handleSize = 0;
        // Make layers.
        setupLayers();
        this.importImage(
            this.props.imageFormat, this.props.image, this.props.rotationCenterX, this.props.rotationCenterY);
    }
    componentWillReceiveProps (newProps) {
        if (this.props.imageId !== newProps.imageId) {
            this.switchCostume(
                newProps.imageFormat, newProps.image, newProps.rotationCenterX, newProps.rotationCenterY);
        } else if (isVector(this.props.format) && newProps.format === Formats.BITMAP) {
            this.convertToBitmap();
        } else if (isBitmap(this.props.format) && newProps.format === Formats.VECTOR) {
            this.convertToVector();
        }
    }
    componentWillUnmount () {
        paper.remove();
        document.removeEventListener('keydown', this.handleKeyDown);
    }
    handleKeyDown (event) {
        if (event.target instanceof HTMLInputElement) {
            // Ignore delete if a text input field is focused
            return;
        }
        // Backspace, delete
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (deleteSelection(this.props.mode, this.props.onUpdateImage)) {
                this.props.setSelectedItems();
            }
        }
    }
    convertToBitmap () {
        // @todo if the active layer contains only rasters, drawing them directly to the raster layer
        // would be more efficient.

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
        const svgString = (new XMLSerializer()).serializeToString(svg);

        // Put anti-aliased SVG into image, and dump image back into canvas
        const img = new Image();
        img.onload = () => {
            getRaster().drawImage(
                img,
                new paper.Point(Math.floor(bounds.topLeft.x), Math.floor(bounds.topLeft.y)));

            paper.project.activeLayer.removeChildren();
            this.props.onUpdateImage();
        };
        img.onerror = () => {
            // Fallback if browser does not support SVG data URIs in images.
            // The problem with rasterize is that it will anti-alias.
            const raster = paper.project.activeLayer.rasterize(72, false /* insert */);
            raster.onLoad = () => {
                getRaster().drawImage(raster.canvas, raster.bounds.topLeft);
                paper.project.activeLayer.removeChildren();
                this.props.onUpdateImage();
            };
        };
        // Hash tags will break image loading without being encoded first
        img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
    }
    convertToVector () {
        this.props.clearSelectedItems();
        const raster = trim(getRaster());
        if (raster.width === 0 || raster.height === 0) {
            raster.remove();
        } else {
            paper.project.activeLayer.addChild(raster);
        }
        clearRaster();
        this.props.onUpdateImage();
    }
    switchCostume (format, image, rotationCenterX, rotationCenterY) {
        for (const layer of paper.project.layers) {
            if (layer.data.isRasterLayer) {
                clearRaster();
            } else if (!layer.data.isBackgroundGuideLayer) {
                layer.removeChildren();
            }
        }
        this.props.clearUndo();
        this.props.clearSelectedItems();
        this.props.clearHoveredItem();
        this.props.clearPasteOffset();
        this.importImage(format, image, rotationCenterX, rotationCenterY);
    }
    importImage (format, image, rotationCenterX, rotationCenterY) {
        if (!image) {
            this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
            performSnapshot(this.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
            return;
        }

        if (format === 'jpg' || format === 'png') {
            // import bitmap
            this.props.changeFormat(Formats.BITMAP_SKIP_CONVERT);
            const imgElement = new Image();
            imgElement.onload = () => {
                getRaster().drawImage(
                    imgElement,
                    (ART_BOARD_WIDTH / 2) - rotationCenterX,
                    (ART_BOARD_HEIGHT / 2) - rotationCenterY);
                getRaster().drawImage(
                    imgElement,
                    (ART_BOARD_WIDTH / 2) - rotationCenterX,
                    (ART_BOARD_HEIGHT / 2) - rotationCenterY);
                performSnapshot(this.props.undoSnapshot, Formats.BITMAP_SKIP_CONVERT);
            };
            imgElement.src = image;
        } else if (format === 'svg') {
            this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
            this.importSvg(image, rotationCenterX, rotationCenterY);
        } else {
            log.error(`Didn't recognize format: ${format}. Use 'jpg', 'png' or 'svg'.`);
            this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
            performSnapshot(this.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
        }
    }
    importSvg (svg, rotationCenterX, rotationCenterY) {
        const paperCanvas = this;
        // Pre-process SVG to prevent parsing errors (discussion from #213)
        // 1. Remove svg: namespace on elements.
        svg = svg.split(/<\s*svg:/).join('<');
        svg = svg.split(/<\/\s*svg:/).join('</');
        // 2. Add root svg namespace if it does not exist.
        const svgAttrs = svg.match(/<svg [^>]*>/);
        if (svgAttrs && svgAttrs[0].indexOf('xmlns=') === -1) {
            svg = svg.replace(
                '<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        }

        // Get the origin which the viewBox is defined relative to. During import, Paper will translate
        // the viewBox to start at (0, 0), and we need to translate it back for some costumes to render
        // correctly.
        const parser = new DOMParser();
        const svgDom = parser.parseFromString(svg, 'text/xml');
        const viewBox = svgDom.documentElement.attributes.viewBox ?
            svgDom.documentElement.attributes.viewBox.value.match(/\S+/g) : null;
        if (viewBox) {
            for (let i = 0; i < viewBox.length; i++) {
                viewBox[i] = parseFloat(viewBox[i]);
            }
        }

        paper.project.importSVG(svg, {
            expandShapes: true,
            onLoad: function (item) {
                if (!item) {
                    log.error('SVG import failed:');
                    log.info(svg);
                    this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
                    performSnapshot(paperCanvas.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
                    return;
                }
                const itemWidth = item.bounds.width;
                const itemHeight = item.bounds.height;

                // Remove viewbox
                if (item.clipped) {
                    let mask;
                    for (const child of item.children) {
                        if (child.isClipMask()) {
                            mask = child;
                            break;
                        }
                    }
                    item.clipped = false;
                    mask.remove();
                }

                // Reduce single item nested in groups
                if (item instanceof paper.Group && item.children.length === 1) {
                    item = item.reduce();
                }

                ensureClockwise(item);
                scaleWithStrokes(item, 2, new paper.Point()); // Import at 2x
                
                if (typeof rotationCenterX !== 'undefined' && typeof rotationCenterY !== 'undefined') {
                    let rotationPoint = new paper.Point(rotationCenterX, rotationCenterY);
                    if (viewBox && viewBox.length >= 2 && !isNaN(viewBox[0]) && !isNaN(viewBox[1])) {
                        rotationPoint = rotationPoint.subtract(viewBox[0], viewBox[1]);
                    }
                    item.translate(new paper.Point(ART_BOARD_WIDTH / 2, ART_BOARD_HEIGHT / 2)
                        .subtract(rotationPoint.multiply(2)));
                } else {
                    // Center
                    item.translate(new paper.Point(ART_BOARD_WIDTH / 2, ART_BOARD_HEIGHT / 2)
                        .subtract(itemWidth, itemHeight));
                }

                performSnapshot(paperCanvas.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
            }
        });
    }
    setCanvas (canvas) {
        this.canvas = canvas;
        if (this.props.canvasRef) {
            this.props.canvasRef(canvas);
        }
    }
    handleWheel (event) {
        if (event.metaKey || event.ctrlKey) {
            // Zoom keeping mouse location fixed
            const canvasRect = this.canvas.getBoundingClientRect();
            const offsetX = event.clientX - canvasRect.left;
            const offsetY = event.clientY - canvasRect.top;
            const fixedPoint = paper.project.view.viewToProject(
                new paper.Point(offsetX, offsetY)
            );
            zoomOnFixedPoint(-event.deltaY / 100, fixedPoint);
            this.props.updateViewBounds(paper.view.matrix);
            this.props.setSelectedItems();
        } else if (event.shiftKey && event.deltaX === 0) {
            // Scroll horizontally (based on vertical scroll delta)
            // This is needed as for some browser/system combinations which do not set deltaX.
            // See #156.
            const dx = event.deltaY / paper.project.view.zoom;
            pan(dx, 0);
            this.props.updateViewBounds(paper.view.matrix);
        } else {
            const dx = event.deltaX / paper.project.view.zoom;
            const dy = event.deltaY / paper.project.view.zoom;
            pan(dx, dy);
            this.props.updateViewBounds(paper.view.matrix);
        }
        event.preventDefault();
    }
    render () {
        return (
            <canvas
                className={classNames(
                    styles.paperCanvas,
                    styles[ModeClasses[this.props.mode]]
                )}
                height="360px"
                ref={this.setCanvas}
                width="480px"
                onWheel={this.handleWheel}
            />
        );
    }
}

PaperCanvas.propTypes = {
    canvasRef: PropTypes.func,
    changeFormat: PropTypes.func.isRequired,
    clearHoveredItem: PropTypes.func.isRequired,
    clearPasteOffset: PropTypes.func.isRequired,
    clearSelectedItems: PropTypes.func.isRequired,
    clearUndo: PropTypes.func.isRequired,
    format: PropTypes.oneOf(Object.keys(Formats)), // Internal, up-to-date data format
    image: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.instanceOf(HTMLImageElement)
    ]),
    imageFormat: PropTypes.string, // The incoming image's data format, used during import
    imageId: PropTypes.string,
    mode: PropTypes.oneOf(Object.keys(Modes)),
    onUpdateImage: PropTypes.func.isRequired,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    setSelectedItems: PropTypes.func.isRequired,
    undoSnapshot: PropTypes.func.isRequired,
    updateViewBounds: PropTypes.func.isRequired
};
const mapStateToProps = state => ({
    mode: state.scratchPaint.mode,
    format: state.scratchPaint.format
});
const mapDispatchToProps = dispatch => ({
    undoSnapshot: snapshot => {
        dispatch(undoSnapshot(snapshot));
    },
    clearUndo: () => {
        dispatch(clearUndoState());
    },
    setSelectedItems: () => {
        dispatch(setSelectedItems(getSelectedLeafItems()));
    },
    clearSelectedItems: () => {
        dispatch(clearSelectedItems());
    },
    clearHoveredItem: () => {
        dispatch(clearHoveredItem());
    },
    clearPasteOffset: () => {
        dispatch(clearPasteOffset());
    },
    changeFormat: format => {
        dispatch(changeFormat(format));
    },
    updateViewBounds: matrix => {
        dispatch(updateViewBounds(matrix));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PaperCanvas);
