import log from '../log/log';
import {CHANGE_SELECTED_ITEMS} from '../reducers/selected-items';
import {getColorsFromSelection, MIXED} from '../helper/style-path';
import GradientTypes from './gradient-types';
import paper from '@scratch/paper';

const isValidColor = color => {
    if (!(color instanceof paper.Color) && color !== null && color !== MIXED) {
        log.warn(`Invalid color: ${color}`);
        return false;
    }
    return true;
};

const makeColorStyleReducer = ({
    // Action name for changing the primary color
    changePrimaryColorAction,
    // Action name for changing the secondary color
    changeSecondaryColorAction,
    // Action name for changing the gradient type
    changeGradientTypeAction,
    // Action name for clearing the gradient
    clearGradientAction,
    // Action for changing which of the primary and secondary colors is currently 'active' to change.
    changeIndexAction,
    // Initial color when not set
    defaultColor,
    // The name of the property read from getColorsFromSelection to get the primary color.
    // e.g. `fillColor` or `strokeColor`.
    selectionPrimaryColorKey,
    // The name of the property read from getColorsFromSelection to get the secondary color.
    // e.g. `fillColor2` or `strokeColor2`.
    selectionSecondaryColorKey,
    // The name of the property read from getColorsFromSelection to get the gradient type.
    // e.g. `fillGradientType` or `strokeGradientType`.
    selectionGradientTypeKey
}) => function colorReducer (state, action) {
    if (typeof state === 'undefined') {
        state = {
            primary: defaultColor,
            secondary: null,
            gradientType: GradientTypes.SOLID,
            activeIndex: 0
        };
    }
    switch (action.type) {
    case changePrimaryColorAction:
        if (!isValidColor(action.color)) return state;
        return {...state, primary: action.color};
    case changeSecondaryColorAction:
        if (!isValidColor(action.color)) return state;
        return {...state, secondary: action.color};
    case CHANGE_SELECTED_ITEMS: {
        // Don't change state if no selection
        if (!action.selectedItems || !action.selectedItems.length) {
            return state;
        }
        const colors = getColorsFromSelection(action.selectedItems, action.bitmapMode);

        // Only set the primary color + gradient type if they exist in what getColorsFromSelection gave us.
        // E.g. in bitmap mode, getColorsFromSelection will not return stroke color/gradient type. This allows us to
        // preserve stroke swatch state across bitmap mode-- if getColorsFromSelection set them to null, then selecting
        // anything in bitmap mode would overwrite the stroke state.
        const newState = {...state};
        if (selectionPrimaryColorKey in colors) {
            newState.primary = colors[selectionPrimaryColorKey];
        }
        if (selectionGradientTypeKey in colors) {
            newState.gradientType = colors[selectionGradientTypeKey];
        }

        // Gradient type may be solid when multiple gradient types are selected.
        // In this case, changing the first color should not change the second color.
        if (
            selectionSecondaryColorKey in colors &&
            (colors[selectionGradientTypeKey] !== GradientTypes.SOLID ||
            colors[selectionSecondaryColorKey] === MIXED)
        ) {
            newState.secondary = colors[selectionSecondaryColorKey];
        }
        return newState;
    }
    case changeIndexAction:
        if (action.index !== 1 && action.index !== 0) {
            log.warn(`Invalid color index: ${action.index}`);
            return state;
        }
        return {...state, activeIndex: action.index};
    case changeGradientTypeAction:
        if (action.gradientType in GradientTypes) {
            const newState = {...state, gradientType: action.gradientType};
            if (action.gradientType === GradientTypes.SOLID) newState.activeIndex = 0;
            return newState;
        }
        log.warn(`Gradient type does not exist: ${action.gradientType}`);
        return state;
    case clearGradientAction:
        return {...state, secondary: null, gradientType: GradientTypes.SOLID, activeIndex: 0};
    default:
        return state;
    }
};

export {
    makeColorStyleReducer as default,
    isValidColor
};
