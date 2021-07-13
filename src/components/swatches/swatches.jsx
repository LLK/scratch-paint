import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import styles from './swatches.css';

import eyeDropperIcon from '../color-picker/icons/eye-dropper.svg';
import noFillIcon from '../color-button/no-fill.svg';
import {getColorName, getColorObj} from '../../lib/colors';
import ColorProptype from '../../lib/color-proptype';

const SwatchesComponent = props => {
    const swatchClickFactory = color =>
        () => props.onSwatch(color);

    const colorToSwatchMap = colorKey => {
        const color = getColorObj(colorKey);
        const colorsMatch = props.colorMatchesActiveColor(color);
        return (<div
            key={colorKey}
            role="img"
            alt={getColorName(colorKey)}
            title={getColorName(colorKey)}
            className={classNames({
                [styles.swatch]: true,
                [styles.smallSwatch]: props.small,
                [styles.activeSwatch]: colorsMatch,
                [styles.smallActiveSwatch]: colorsMatch && props.small
            })}
            style={{
                backgroundColor: color.toCSS()
            }}
            onClick={swatchClickFactory(color)}
        />
        );
    };

    const isTransparent = () =>
        (props.colorIndex === 0 && props.color === null) ||
        (props.colorIndex === 1 && props.color2 === null);

    return (
        <div className={props.containerStyle || ''} >
            <div className={styles.swatchRow}>
                <div
                    className={classNames({
                        [styles.clickable]: true,
                        [styles.swatch]: true,
                        [styles.smallSwatch]: props.small,
                        [styles.activeSwatch]: isTransparent(),
                        [styles.smallActiveSwatch]: isTransparent() && props.small,
                        [styles.disabled]: !props.isTransparentSwatchEnabled()
                    })}
                    onClick={props.onTransparent}
                >
                    <img
                        className={classNames({
                            [styles.swatchIcon]: true,
                            [styles.smallSwatchIcon]: props.small
                        })}
                        draggable={false}
                        src={noFillIcon}
                    />
                </div>
                {props.row1Colors ? props.row1Colors.map(colorToSwatchMap) : null}
            </div>
            <div className={styles.swatchRow}>
                <div
                    className={classNames({
                        [styles.clickable]: true,
                        [styles.swatch]: true,
                        [styles.smallSwatch]: props.small,
                        [styles.activeSwatch]: props.isEyeDropping,
                        [styles.smallActiveSwatch]: props.isEyeDropping && props.small
                    })}
                    onClick={props.onActivateEyeDropper}
                >
                    <img
                        className={classNames({
                            [styles.swatchIcon]: true,
                            [styles.smallSwatchIcon]: props.small
                        })}
                        draggable={false}
                        src={eyeDropperIcon}
                    />
                </div>
                {props.row2Colors ? props.row2Colors.map(colorToSwatchMap) : null}
            </div>
        </div>
    );
};

SwatchesComponent.propTypes = {
    onActivateEyeDropper: PropTypes.func.isRequired,
    onSwatch: PropTypes.func.isRequired,
    onTransparent: PropTypes.func.isRequired,
    color: ColorProptype,
    color2: ColorProptype,
    colorIndex: PropTypes.number.isRequired,
    colorMatchesActiveColor: PropTypes.func.isRequired, // eslint-disable-line react/no-unused-prop-types
    containerStyle: PropTypes.string,
    isEyeDropping: PropTypes.bool.isRequired,
    isTransparentSwatchEnabled: PropTypes.func.isRequired,
    small: PropTypes.bool,
    row1Colors: PropTypes.arrayOf(PropTypes.string),
    row2Colors: PropTypes.arrayOf(PropTypes.string)
};

SwatchesComponent.defaultProps = {
    small: false
};
export default SwatchesComponent;
