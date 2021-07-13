import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';
import paper from '@scratch/paper';
import PropTypes from 'prop-types';
import React from 'react';

import {clearSelectedItems} from '../reducers/selected-items';
import {activateEyeDropper} from '../reducers/eye-dropper';

import SwatchesComponent from '../components/swatches/swatches.jsx';
import {colorsEqual} from '../helper/style-path';
import {getRow1Colors, getRow2Colors} from '../lib/colors';
import Modes from '../lib/modes';
import ColorProptype from '../lib/color-proptype';

class Swatches extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'colorMatchesActiveColor',
            'handleSwatch',
            'handleTransparent',
            'handleActivateEyeDropper',
            'transparentSwatchEnabled'
        ]);
    }
    colorMatchesActiveColor (color) {
        // Eyedropper is the "active color" when eyedropping
        if (this.props.isEyeDropping) return false;
        let activeColor;
        if (this.props.isStrokeColor) {
            if (this.props.strokeColorIndex === 1) {
                activeColor = this.props.strokeColor2;
            } else {
                activeColor = this.props.strokeColor;
            }
        } else if (!this.props.isStrokeColor) {
            if (this.props.fillColorIndex === 1) {
                activeColor = this.props.fillColor2;
            } else {
                activeColor = this.props.fillColor;
            }
        }
        return colorsEqual(activeColor, color);
    }
    // Transparent swatch is disabled in shape, line, and brush tools to help
    // prevent confusion (the drawing won't be visible)
    transparentSwatchEnabled () {
        switch (this.props.mode) {
        case Modes.SELECT:
        case Modes.FILL:
        case Modes.RESHAPE:
        case Modes.BIT_SELECT:
        case Modes.BIT_FILL:
            return true;
        default:
            return false;
        }
    }
    /**
     * @param{string} color - a hex color
     */
    handleSwatch (color) {
        this.props.onChangeColor(color);
    }
    handleTransparent () {
        this.props.onChangeColor(null);
    }
    handleActivateEyeDropper () {
        this.props.onActivateEyeDropper(
            paper.tool, // get the currently active tool from paper
            this.props.onChangeColor
        );
    }
    render () {
        return (
            <SwatchesComponent
                color={this.props.isStrokeColor ? this.props.strokeColor : this.props.fillColor}
                color2={this.props.isStrokeColor ? this.props.strokeColor2 : this.props.fillColor2}
                containerStyle={this.props.containerStyle}
                row1Colors={getRow1Colors()}
                row2Colors={getRow2Colors()}
                colorMatchesActiveColor={this.colorMatchesActiveColor}
                colorIndex={this.props.isStrokeColor ? this.props.strokeColorIndex : this.props.fillColorIndex}
                isEyeDropping={this.props.isEyeDropping}
                isTransparentSwatchEnabled={this.transparentSwatchEnabled}
                isStrokeColor={this.props.isStrokeColor}
                small={this.props.small}
                onActivateEyeDropper={this.handleActivateEyeDropper}
                onSwatch={this.handleSwatch}
                onTransparent={this.handleTransparent}
            />
        );
    }
}

Swatches.propTypes = {
    containerStyle: PropTypes.string,
    fillColor: ColorProptype,
    fillColor2: ColorProptype,
    fillColorIndex: PropTypes.number.isRequired,
    isEyeDropping: PropTypes.bool.isRequired,
    isStrokeColor: PropTypes.bool.isRequired,
    mode: PropTypes.oneOf(Object.keys(Modes)).isRequired,
    small: PropTypes.bool,
    strokeColor: ColorProptype,
    strokeColor2: ColorProptype,
    strokeColorIndex: PropTypes.number.isRequired,
    onActivateEyeDropper: PropTypes.func.isRequired,
    onChangeColor: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    isEyeDropping: state.scratchPaint.color.eyeDropper.active,
    fillColorIndex: state.scratchPaint.color.fillColor.activeIndex,
    fillColor: state.scratchPaint.color.fillColor.primary,
    fillColor2: state.scratchPaint.color.fillColor.secondary,
    mode: state.scratchPaint.mode,
    strokeColor: state.scratchPaint.color.strokeColor.primary,
    strokeColor2: state.scratchPaint.color.strokeColor.secondary,
    strokeColorIndex: state.scratchPaint.color.strokeColor.activeIndex
});

const mapDispatchToProps = dispatch => ({
    clearSelectedItems: () => {
        dispatch(clearSelectedItems());
    },
    onActivateEyeDropper: (currentTool, callback) => {
        dispatch(activateEyeDropper(currentTool, callback));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Swatches);
