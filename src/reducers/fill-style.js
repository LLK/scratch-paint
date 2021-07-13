import makeColorStyleReducer from '../lib/make-color-style-reducer';
import paper from '@scratch/paper';

const CHANGE_FILL_COLOR = 'scratch-paint/fill-style/CHANGE_FILL_COLOR';
const CHANGE_FILL_COLOR_2 = 'scratch-paint/fill-style/CHANGE_FILL_COLOR_2';
const CHANGE_FILL_GRADIENT_TYPE = 'scratch-paint/fill-style/CHANGE_FILL_GRADIENT_TYPE';
const CLEAR_FILL_GRADIENT = 'scratch-paint/fill-style/CLEAR_FILL_GRADIENT';
const CHANGE_FILL_COLOR_INDEX = 'scratch-paint/fill-style/CHANGE_FILL_COLOR_INDEX';
const DEFAULT_COLOR = new paper.Color({hue: 259, saturation: 0.6, brightness: 1});

const reducer = makeColorStyleReducer({
    changePrimaryColorAction: CHANGE_FILL_COLOR,
    changeSecondaryColorAction: CHANGE_FILL_COLOR_2,
    changeGradientTypeAction: CHANGE_FILL_GRADIENT_TYPE,
    clearGradientAction: CLEAR_FILL_GRADIENT,
    changeIndexAction: CHANGE_FILL_COLOR_INDEX,
    defaultColor: DEFAULT_COLOR,
    selectionPrimaryColorKey: 'fillColor',
    selectionSecondaryColorKey: 'fillColor2',
    selectionGradientTypeKey: 'fillGradientType'
});

// Action creators ==================================
const changeFillColor = function (fillColor) {
    return {
        type: CHANGE_FILL_COLOR,
        color: fillColor
    };
};

const changeFillColor2 = function (fillColor) {
    return {
        type: CHANGE_FILL_COLOR_2,
        color: fillColor
    };
};

const changeFillGradientType = function (gradientType) {
    return {
        type: CHANGE_FILL_GRADIENT_TYPE,
        gradientType
    };
};

const clearFillGradient = function () {
    return {
        type: CLEAR_FILL_GRADIENT
    };
};

const changeFillColorIndex = function (index) {
    return {
        type: CHANGE_FILL_COLOR_INDEX,
        index: index
    };
};

export {
    reducer as default,
    changeFillColor,
    changeFillColor2,
    changeFillGradientType,
    changeFillColorIndex,
    clearFillGradient,
    DEFAULT_COLOR,
    CHANGE_FILL_GRADIENT_TYPE
};
