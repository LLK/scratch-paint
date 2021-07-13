import {combineReducers} from 'redux';
import fillModeGradientTypeReducer from './fill-mode-gradient-type';

export default combineReducers({
    gradientType: fillModeGradientTypeReducer
});
