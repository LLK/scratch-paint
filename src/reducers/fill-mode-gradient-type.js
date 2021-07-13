// Gradient type shown in the fill tool. This is the last gradient type explicitly chosen by the user,
// and isn't overwritten by changing the selection.
import GradientTypes from '../lib/gradient-types';
import log from '../log/log';
import {CHANGE_FILL_GRADIENT_TYPE} from './fill-style';

const initialState = GradientTypes.SOLID;

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case CHANGE_FILL_GRADIENT_TYPE:
        if (action.gradientType in GradientTypes) {
            return action.gradientType;
        }
        log.warn(`Gradient type does not exist: ${action.gradientType}`);
        /* falls through */
    default:
        return state;
    }
};

export {
    reducer as default
};
