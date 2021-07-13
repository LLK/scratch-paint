import paper from '@scratch/paper';
import PropTypes from 'prop-types';
import {MIXED} from '../helper/style-path';

const colorProptype = PropTypes.oneOfType([
    PropTypes.instanceOf(paper.Color),
    PropTypes.oneOf([MIXED])
]);

export default colorProptype;
