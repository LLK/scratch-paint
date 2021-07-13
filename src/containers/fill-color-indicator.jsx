import {connect} from 'react-redux';
import {defineMessages} from 'react-intl';

import {changeFillColor, changeFillColor2, changeFillColorIndex, changeFillGradientType} from '../reducers/fill-style';
import {openFillColor, closeFillColor} from '../reducers/modals';
import {getSelectedLeafItems} from '../helper/selection';
import {setSelectedItems} from '../reducers/selected-items';
import Modes, {GradientToolsModes} from '../lib/modes';
import {isBitmap} from '../lib/format';

import makeColorIndicator from './color-indicator.jsx';

const messages = defineMessages({
    label: {
        id: 'paint.paintEditor.fill',
        description: 'Label for the color picker for the fill color',
        defaultMessage: 'Fill'
    }
});

const FillColorIndicator = makeColorIndicator(messages.label, false);

const mapStateToProps = state => ({
    colorIndex: state.scratchPaint.color.fillColor.activeIndex,
    disabled: state.scratchPaint.mode === Modes.LINE,
    color: state.scratchPaint.color.fillColor.primary,
    color2: state.scratchPaint.color.fillColor.secondary,
    colorModalVisible: state.scratchPaint.modals.fillColor,
    fillBitmapShapes: state.scratchPaint.fillBitmapShapes,
    format: state.scratchPaint.format,
    gradientType: state.scratchPaint.color.fillColor.gradientType,
    isEyeDropping: state.scratchPaint.color.eyeDropper.active,
    shouldShowGradientTools: state.scratchPaint.mode in GradientToolsModes,
    textEditTarget: state.scratchPaint.textEditTarget
});

const mapDispatchToProps = dispatch => ({
    onChangeColorIndex: index => {
        dispatch(changeFillColorIndex(index));
    },
    onChangeColor: (fillColor, index) => {
        if (index === 0) {
            dispatch(changeFillColor(fillColor));
        } else if (index === 1) {
            dispatch(changeFillColor2(fillColor));
        }
    },
    onOpenColor: () => {
        dispatch(openFillColor());
    },
    onCloseColor: () => {
        dispatch(closeFillColor());
    },
    onChangeGradientType: gradientType => {
        dispatch(changeFillGradientType(gradientType));
    },
    setSelectedItems: format => {
        dispatch(setSelectedItems(getSelectedLeafItems(), isBitmap(format)));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(FillColorIndicator);
