import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';

import classNames from 'classnames';

import Slider, {CONTAINER_WIDTH, HANDLE_WIDTH} from '../forms/slider.jsx';
import LabeledIconButton from '../labeled-icon-button/labeled-icon-button.jsx';
import styles from './color-picker.css';
import swatchStyles from '../swatches/swatches.css';
import GradientTypes from '../../lib/gradient-types';
import Swatches from '../../containers/swatches.jsx';
import {MIXED} from '../../helper/style-path';

import noFillIcon from '../color-button/no-fill.svg';
import mixedFillIcon from '../color-button/mixed-fill.svg';
import fillHorzGradientIcon from './icons/fill-horz-gradient-enabled.svg';
import fillRadialIcon from './icons/fill-radial-enabled.svg';
import fillSolidIcon from './icons/fill-solid-enabled.svg';
import fillVertGradientIcon from './icons/fill-vert-gradient-enabled.svg';
import swapIcon from './icons/swap.svg';
import ColorProptype from '../../lib/color-proptype';

/**
 * Converts the color picker's internal color representation (HSV 0-100) into a CSS color string.
 * @param {number} h Hue, from 0 to 100.
 * @param {number} s Saturation, from 0 to 100.
 * @param {number} v Value, from 0 to 100.
 * @returns {string} A valid CSS color string representing the input HSV color.
 */
const hsvToCssString = (h, s, v) => {
    const scaledValue = v * 0.01;
    const hslLightness = scaledValue - ((scaledValue * (s * 0.01)) / 2);
    const m = Math.min(hslLightness, 1 - hslLightness);
    const hslSaturation = (m === 0) ? 0 : (scaledValue - hslLightness) / m;

    return `hsl(${h * 3.6}, ${hslSaturation * 100}%, ${hslLightness * 100}%)`;
};

const messages = defineMessages({
    swap: {
        defaultMessage: 'Swap',
        description: 'Label for button that swaps the two colors in a gradient',
        id: 'paint.colorPicker.swap'
    }
});

class ColorPickerComponent extends React.Component {
    _makeBackground (channel) {
        const stops = [];
        // Generate the color slider background CSS gradients by adding
        // color stops depending on the slider.
        for (let n = 100; n >= 0; n -= 10) {
            switch (channel) {
            case 'hue':
                stops.push(hsvToCssString(n, this.props.saturation, this.props.brightness));
                break;
            case 'saturation':
                stops.push(hsvToCssString(this.props.hue, n, this.props.brightness));
                break;
            case 'brightness':
                stops.push(hsvToCssString(this.props.hue, this.props.saturation, n));
                break;
            default:
                throw new Error(`Unknown channel for color sliders: ${channel}`);
            }
        }

        // The sliders are a rounded capsule shape, and the slider handles are circles. As a consequence, when the
        // slider handle is fully to one side, its center is actually moved away from the start/end of the slider by
        // the slider handle's radius, meaning that the effective range of the slider excludes the rounded caps.
        // To compensate for this, position the first stop to where the rounded cap ends, and position the last stop
        // to where the rounded cap begins.
        const halfHandleWidth = HANDLE_WIDTH / 2;
        stops[0] += ` 0 ${halfHandleWidth}px`;
        stops[stops.length - 1] += ` ${CONTAINER_WIDTH - halfHandleWidth}px 100%`;

        return `linear-gradient(to left, ${stops.join(',')})`;
    }
    render () {
        return (
            <div
                className={styles.colorPickerContainer}
                dir={this.props.rtl ? 'rtl' : 'ltr'}
            >
                {this.props.shouldShowGradientTools ? (
                    <div>
                        <div className={styles.row}>
                            <div className={styles.gradientPickerRow}>
                                <img
                                    className={classNames({
                                        [styles.inactiveGradient]: this.props.gradientType !== GradientTypes.SOLID,
                                        [styles.clickable]: true
                                    })}
                                    draggable={false}
                                    src={fillSolidIcon}
                                    onClick={this.props.onChangeGradientTypeSolid}
                                />
                                <img
                                    className={classNames({
                                        [styles.inactiveGradient]:
                                            this.props.gradientType !== GradientTypes.HORIZONTAL,
                                        [styles.clickable]: true
                                    })}
                                    draggable={false}
                                    src={fillHorzGradientIcon}
                                    onClick={this.props.onChangeGradientTypeHorizontal}
                                />
                                <img
                                    className={classNames({
                                        [styles.inactiveGradient]: this.props.gradientType !== GradientTypes.VERTICAL,
                                        [styles.clickable]: true
                                    })}
                                    draggable={false}
                                    src={fillVertGradientIcon}
                                    onClick={this.props.onChangeGradientTypeVertical}
                                />
                                <img
                                    className={classNames({
                                        [styles.inactiveGradient]: this.props.gradientType !== GradientTypes.RADIAL,
                                        [styles.clickable]: true
                                    })}
                                    draggable={false}
                                    src={fillRadialIcon}
                                    onClick={this.props.onChangeGradientTypeRadial}
                                />
                            </div>
                        </div>
                        <div className={styles.divider} />
                        {this.props.gradientType === GradientTypes.SOLID ? null : (
                            <div className={styles.row}>
                                <div
                                    className={classNames(
                                        styles.gradientPickerRow,
                                        styles.gradientSwatchesRow
                                    )}
                                >
                                    <div
                                        className={classNames({
                                            [styles.clickable]: true,
                                            [styles.largeSwatch]: true,
                                            [swatchStyles.activeSwatch]: this.props.colorIndex === 0
                                        })}
                                        style={{
                                            backgroundColor: this.props.color === null || this.props.color === MIXED ?
                                                'white' : this.props.color.toCSS()
                                        }}
                                        onClick={this.props.onSelectColor}
                                    >
                                        {this.props.color === null ? (
                                            <img
                                                className={styles.largeSwatchIcon}
                                                draggable={false}
                                                src={noFillIcon}
                                            />
                                        ) : this.props.color === MIXED ? (
                                            <img
                                                className={styles.largeSwatchIcon}
                                                draggable={false}
                                                src={mixedFillIcon}
                                            />
                                        ) : null}
                                    </div>
                                    <LabeledIconButton
                                        className={styles.swapButton}
                                        imgSrc={swapIcon}
                                        title={this.props.intl.formatMessage(messages.swap)}
                                        onClick={this.props.onSwap}
                                    />
                                    <div
                                        className={classNames({
                                            [styles.clickable]: true,
                                            [styles.largeSwatch]: true,
                                            [swatchStyles.activeSwatch]: this.props.colorIndex === 1
                                        })}
                                        style={{
                                            backgroundColor: this.props.color2 === null || this.props.color2 === MIXED ?
                                                'white' : this.props.color2.toCSS()
                                        }}
                                        onClick={this.props.onSelectColor2}
                                    >
                                        {this.props.color2 === null ? (
                                            <img
                                                className={styles.largeSwatchIcon}
                                                draggable={false}
                                                src={noFillIcon}
                                            />
                                        ) : this.props.color2 === MIXED ? (
                                            <img
                                                className={styles.largeSwatchIcon}
                                                draggable={false}
                                                src={mixedFillIcon}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
                <Swatches
                    isStrokeColor={this.props.isStrokeColor}
                    containerStyle={styles.colorSwatchesContainer}
                    onChangeColor={this.props.onChangeColor}
                />
                <div className={styles.row}>
                    <div className={styles.rowHeader}>
                        <span className={styles.labelName}>
                            <FormattedMessage
                                defaultMessage="Color"
                                description="Label for the hue component in the color picker"
                                id="paint.paintEditor.hue"
                            />
                        </span>
                        <span className={styles.labelReadout}>
                            {Math.round(this.props.hue)}
                        </span>
                    </div>
                    <div className={styles.rowSlider}>
                        <Slider
                            background={this._makeBackground('hue')}
                            value={this.props.hue}
                            onChange={this.props.onHueChange}
                        />
                    </div>
                </div>
                <div className={styles.row}>
                    <div className={styles.rowHeader}>
                        <span className={styles.labelName}>
                            <FormattedMessage
                                defaultMessage="Saturation"
                                description="Label for the saturation component in the color picker"
                                id="paint.paintEditor.saturation"
                            />
                        </span>
                        <span className={styles.labelReadout}>
                            {Math.round(this.props.saturation)}
                        </span>
                    </div>
                    <div className={styles.rowSlider}>
                        <Slider
                            background={this._makeBackground('saturation')}
                            value={this.props.saturation}
                            onChange={this.props.onSaturationChange}
                        />
                    </div>
                </div>
                <div className={styles.row}>
                    <div className={styles.rowHeader}>
                        <span className={styles.labelName}>
                            <FormattedMessage
                                defaultMessage="Brightness"
                                description="Label for the brightness component in the color picker"
                                id="paint.paintEditor.brightness"
                            />
                        </span>
                        <span className={styles.labelReadout}>
                            {Math.round(this.props.brightness)}
                        </span>
                    </div>
                    <div className={styles.rowSlider}>
                        <Slider
                            background={this._makeBackground('brightness')}
                            value={this.props.brightness}
                            onChange={this.props.onBrightnessChange}
                        />
                    </div>
                </div>
            </div>
        );
    }
}

ColorPickerComponent.propTypes = {
    brightness: PropTypes.number.isRequired,
    color: ColorProptype,
    color2: ColorProptype,
    colorIndex: PropTypes.number.isRequired,
    gradientType: PropTypes.oneOf(Object.keys(GradientTypes)).isRequired,
    hue: PropTypes.number.isRequired,
    intl: intlShape.isRequired,
    isStrokeColor: PropTypes.bool.isRequired,
    onBrightnessChange: PropTypes.func.isRequired,
    onChangeColor: PropTypes.func.isRequired,
    onChangeGradientTypeHorizontal: PropTypes.func.isRequired,
    onChangeGradientTypeRadial: PropTypes.func.isRequired,
    onChangeGradientTypeSolid: PropTypes.func.isRequired,
    onChangeGradientTypeVertical: PropTypes.func.isRequired,
    onHueChange: PropTypes.func.isRequired,
    onSaturationChange: PropTypes.func.isRequired,
    onSelectColor: PropTypes.func.isRequired,
    onSelectColor2: PropTypes.func.isRequired,
    onSwap: PropTypes.func,
    rtl: PropTypes.bool.isRequired,
    saturation: PropTypes.number.isRequired,
    shouldShowGradientTools: PropTypes.bool.isRequired
};

export default injectIntl(ColorPickerComponent);
