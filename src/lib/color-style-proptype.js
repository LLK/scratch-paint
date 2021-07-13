import {PropTypes} from 'prop-types';

import GradientTypes from './gradient-types';
import ColorProptype from './color-proptype';

export default PropTypes.shape({
    primary: ColorProptype,
    secondary: ColorProptype,
    gradientType: PropTypes.oneOf(Object.keys(GradientTypes)).isRequired
});
